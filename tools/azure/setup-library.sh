#!/usr/bin/env bash
# Sketch Hour photo library on Azure: pilot setup.
#
# Creates, in the signed-in subscription:
#   - resource group  rg-sketchhour (Sweden Central)
#   - storage account sketchhour<6 characters> with two containers:
#       web        web-size copies; anyone can open a photo by its address, nobody can list the container
#       originals  full-size originals; private, moved to the cheaper Cool tier after a day
#   - 7-day soft delete for photos and containers, so a mistaken delete can be undone
#   - CORS so sketchhour.com (and the local test server) can read the library's index file and
#     draw photos into the value-study canvas
#   - the "Storage Blob Data Contributor" role for you, so azcopy can upload after `azcopy login`
#   - a monthly budget (in the billing currency) with email alerts at 50 %, 80 % and 100 % of actual cost and 100 % of forecast
#
# Run it in Azure Cloud Shell (Bash), where you are already signed in:
#   ALERT_EMAIL=you@example.com bash setup-library.sh
#
# Running it again is safe: existing resources are kept and settings are reapplied.
# Optional overrides: LOCATION, RG, ACCOUNT, BUDGET (per month, in the billing account's currency:
# SEK for Sketch Hour, so the default 500 is about 50 USD; raise it as services are added).

set -euo pipefail

ALERT_EMAIL="${ALERT_EMAIL:-}"
LOCATION="${LOCATION:-swedencentral}"
RG="${RG:-rg-sketchhour}"
BUDGET="${BUDGET:-500}"
SITE_ORIGINS=("https://sketchhour.com" "https://www.sketchhour.com" "http://localhost:4280")
TAGS=(project=sketchhour env=pilot)

# Azure sometimes needs a few seconds before a new setting takes effect.
retry() {
  local n=0
  until "$@"; do
    n=$((n + 1))
    if (( n > 5 )); then return 1; fi
    echo "    Azure isn't ready yet, trying again in 10 seconds ($n/5)"
    sleep 10
  done
}

if [[ -z "$ALERT_EMAIL" ]]; then
  echo "Set the email for budget alerts first, for example:"
  echo "  ALERT_EMAIL=you@example.com bash setup-library.sh"
  exit 1
fi

SUB_ID=$(az account show --query id -o tsv)
SUB_NAME=$(az account show --query name -o tsv)
ACCOUNT="${ACCOUNT:-sketchhour$(printf '%s' "$SUB_ID" | sha1sum | cut -c1-6)}"

echo "Subscription:    $SUB_NAME ($SUB_ID)"
echo "Resource group:  $RG in $LOCATION"
echo "Storage account: $ACCOUNT"
echo "Budget:          $BUDGET a month in your billing currency, alerts to $ALERT_EMAIL"
read -r -p "Create these? [y/N] " answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "Nothing changed."; exit 0; }

echo "1/7 Resource group"
# A new subscription has to switch on each Azure service before first use; until then Azure answers "SubscriptionNotFound".
for ns in Microsoft.Storage Microsoft.Consumption; do
  if [[ "$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null)" != "Registered" ]]; then
    echo "    switching on $ns for this subscription (takes a minute or two)"
    az provider register --namespace "$ns" --wait -o none
  fi
done
az group create --name "$RG" --location "$LOCATION" --tags "${TAGS[@]}" -o none

echo "2/7 Storage account"
if az storage account show --name "$ACCOUNT" --resource-group "$RG" -o none 2>/dev/null; then
  echo "    already exists, keeping it"
else
  available=$(az storage account check-name --name "$ACCOUNT" --query nameAvailable -o tsv)
  if [[ "$available" != "true" ]]; then
    echo "The name $ACCOUNT is taken. Run again with ACCOUNT=<another name, 3-24 lowercase letters and digits>."
    exit 1
  fi
  az storage account create --name "$ACCOUNT" --resource-group "$RG" --location "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --access-tier Hot \
    --https-only true --min-tls-version TLS1_2 --allow-blob-public-access true \
    --tags "${TAGS[@]}" -o none
fi
ACCOUNT_ID=$(az storage account show --name "$ACCOUNT" --resource-group "$RG" --query id -o tsv)
KEY=$(az storage account keys list --account-name "$ACCOUNT" --resource-group "$RG" --query "[0].value" -o tsv --only-show-errors)  # kept in memory only, never printed

echo "3/7 Containers"
retry az storage container create --account-name "$ACCOUNT" --account-key "$KEY" --name web --public-access blob -o none
retry az storage container create --account-name "$ACCOUNT" --account-key "$KEY" --name originals --public-access off -o none
# Reapply in case a container already existed with another setting.
retry az storage container set-permission --account-name "$ACCOUNT" --account-key "$KEY" --name web --public-access blob -o none
retry az storage container set-permission --account-name "$ACCOUNT" --account-key "$KEY" --name originals --public-access off -o none

echo "4/7 Soft delete (7 days)"
az storage account blob-service-properties update --account-name "$ACCOUNT" --resource-group "$RG" \
  --enable-delete-retention true --delete-retention-days 7 \
  --enable-container-delete-retention true --container-delete-retention-days 7 -o none

echo "5/7 CORS for the website, and Cool tier for originals"
az storage cors clear --services b --account-name "$ACCOUNT" --account-key "$KEY"
az storage cors add --services b --methods GET HEAD OPTIONS --origins "${SITE_ORIGINS[@]}" \
  --allowed-headers "*" --exposed-headers "*" --max-age 3600 \
  --account-name "$ACCOUNT" --account-key "$KEY"
POLICY=$(mktemp)
cat > "$POLICY" <<'JSON'
{
  "rules": [
    {
      "enabled": true,
      "name": "originals-to-cool",
      "type": "Lifecycle",
      "definition": {
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["originals/"] },
        "actions": { "baseBlob": { "tierToCool": { "daysAfterModificationGreaterThan": 1 } } }
      }
    }
  ]
}
JSON
az storage account management-policy create --account-name "$ACCOUNT" --resource-group "$RG" --policy "@$POLICY" -o none
rm -f "$POLICY"

echo "6/7 Upload permission for you"
ME=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)
if [[ -z "$ME" ]]; then
  echo "    Couldn't look up your user. In the portal, open the storage account > Access control (IAM)"
  echo "    > Add role assignment, and give yourself Storage Blob Data Contributor."
elif [[ -z "$(az role assignment list --assignee "$ME" --scope "$ACCOUNT_ID" --role "Storage Blob Data Contributor" --query "[0].id" -o tsv)" ]]; then
  az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
    --role "Storage Blob Data Contributor" --scope "$ACCOUNT_ID" -o none
else
  echo "    already assigned"
fi

echo "7/7 Monthly budget and alerts"
START=$(date -u +%Y-%m-01T00:00:00Z)
BODY=$(cat <<JSON
{
  "properties": {
    "category": "Cost",
    "amount": $BUDGET,
    "timeGrain": "Monthly",
    "timePeriod": { "startDate": "$START" },
    "notifications": {
      "actual-50":   { "enabled": true, "operator": "GreaterThan", "threshold": 50,  "thresholdType": "Actual",     "contactEmails": ["$ALERT_EMAIL"] },
      "actual-80":   { "enabled": true, "operator": "GreaterThan", "threshold": 80,  "thresholdType": "Actual",     "contactEmails": ["$ALERT_EMAIL"] },
      "actual-100":  { "enabled": true, "operator": "GreaterThan", "threshold": 100, "thresholdType": "Actual",     "contactEmails": ["$ALERT_EMAIL"] },
      "forecast-100":{ "enabled": true, "operator": "GreaterThan", "threshold": 100, "thresholdType": "Forecasted", "contactEmails": ["$ALERT_EMAIL"] }
    }
  }
}
JSON
)
BUDGET_URL="https://management.azure.com/subscriptions/$SUB_ID/providers/Microsoft.Consumption/budgets/sketchhour-monthly?api-version=2023-05-01"
if az rest --method get --url "$BUDGET_URL" -o none 2>/dev/null; then
  echo "    already exists (change the amount in the portal: Cost Management > Budgets)"
elif ! az rest --method put --url "$BUDGET_URL" --body "$BODY" -o none; then
  echo "    The budget could not be created (the error above says why). Everything else is ready."
  echo "    Try the portal: Cost Management > Budgets > Add, $BUDGET monthly, alerts at 50, 80 and 100 %."
  echo "    Some sponsorship subscriptions don't offer budgets yet; then watch spending under"
  echo "    Cost Management + Billing, or at microsoftazuresponsorships.com/usage for older sponsorships."
fi

WEB="https://$ACCOUNT.blob.core.windows.net/web"
ORIG="https://$ACCOUNT.blob.core.windows.net/originals"
cat <<EOF

Done.

Photo library addresses
  web copies:  $WEB/<file>      (public: anyone with the address can open a photo)
  originals:   $ORIG/<file>     (private)

Upload from your computer with azcopy (the role can take a few minutes to start working):
  azcopy login
  azcopy copy "./web/*"       "$WEB/"  --recursive --cache-control "public, max-age=31536000, immutable"
  azcopy copy "./originals/*" "$ORIG/" --recursive --block-blob-tier Cool

Give every web file a new name when its picture changes (for example photo-0012-v2.webp):
the cache setting above lets browsers keep a file for a year.
EOF
