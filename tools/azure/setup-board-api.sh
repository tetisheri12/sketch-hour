#!/usr/bin/env bash
# Sketch Hour API on Azure Functions: setup and deploy.
#
# Creates, in the signed-in subscription and the same resource group as the photo library:
#   - storage account sketchhourfn<6 characters> for the function's own files (private)
#   - function app    sketchhour-api-<6 characters> on the Flex Consumption plan (Node 22),
#                     with Application Insights for its logs
#   - only sketchhour.com, www.sketchhour.com and the local preview may call it
# and deploys sketchhour-api.zip (built with tools/azure/build-api.sh) to it.
#
# Run it in Azure Cloud Shell (Bash) with sketchhour-api.zip in the same folder:
#   bash setup-board-api.sh
#
# Running it again is safe: it keeps what exists and deploys the zip again, so it's also how to
# publish a new version of the API. Optional overrides: RG, APP, LOCATION, ZIP.

set -euo pipefail

RG="${RG:-rg-sketchhour}"
ZIP="${ZIP:-sketchhour-api.zip}"
ORIGINS=("https://sketchhour.com" "https://www.sketchhour.com" "http://localhost:4280")
TAGS=(project=sketchhour env=pilot)
TEST_BOARD="https://se.pinterest.com/hejgarm/100-heads/"

retry() {
  local n=0
  until "$@"; do
    n=$((n + 1))
    if (( n > 5 )); then return 1; fi
    echo "    Azure isn't ready yet, trying again in 20 seconds ($n/5)"
    sleep 20
  done
}

if [[ ! -f "$ZIP" ]]; then
  echo "Upload $ZIP to this folder first (Manage files > Upload), then run this again."
  exit 1
fi

SUB_ID=$(az account show --query id -o tsv)
SUB_NAME=$(az account show --query name -o tsv)
HASH=$(printf '%s' "$SUB_ID" | sha1sum | cut -c1-6)
APP="${APP:-sketchhour-api-$HASH}"
FNSTORE="sketchhourfn$HASH"

if ! az group show --name "$RG" -o none 2>/dev/null; then
  echo "Resource group $RG doesn't exist. Run setup-library.sh first."
  exit 1
fi

echo "Checking which services this subscription has switched on..."
for ns in Microsoft.Web Microsoft.Storage Microsoft.Insights Microsoft.OperationalInsights Microsoft.AlertsManagement; do
  if [[ "$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null)" != "Registered" ]]; then
    echo "    switching on $ns (takes a minute or two)"
    az provider register --namespace "$ns" --wait -o none
  fi
done

# Flex Consumption isn't offered in every region: use Sweden Central if it is, otherwise the nearest one that is.
if [[ -z "${LOCATION:-}" ]]; then
  FLEX=$(az functionapp list-flexconsumption-locations --query "[].name" -o tsv)
  for l in swedencentral norwayeast northeurope westeurope germanywestcentral; do
    if grep -qx "$l" <<<"$FLEX"; then LOCATION=$l; break; fi
  done
fi
if [[ -z "${LOCATION:-}" ]]; then
  echo "Couldn't find a nearby region with Flex Consumption. Run again with LOCATION=<region>."
  exit 1
fi

echo
echo "Subscription:    $SUB_NAME ($SUB_ID)"
echo "Resource group:  $RG"
echo "Function app:    $APP in $LOCATION (Flex Consumption, Node 22)"
echo "Its storage:     $FNSTORE"
echo "Deploys:         $ZIP"
read -r -p "Go ahead? [y/N] " answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "Nothing changed."; exit 0; }

echo "1/5 Storage for the function"
if az storage account show --name "$FNSTORE" --resource-group "$RG" -o none 2>/dev/null; then
  echo "    already exists, keeping it"
else
  az storage account create --name "$FNSTORE" --resource-group "$RG" --location "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 \
    --allow-blob-public-access false --tags "${TAGS[@]}" -o none
fi

echo "2/5 Function app"
if az functionapp show --name "$APP" --resource-group "$RG" -o none 2>/dev/null; then
  echo "    already exists, keeping it"
else
  retry az functionapp create --name "$APP" --resource-group "$RG" --storage-account "$FNSTORE" \
    --flexconsumption-location "$LOCATION" --runtime node --runtime-version 22 \
    --https-only true --tags "${TAGS[@]}" -o none
fi

echo "3/5 Who may call it"
az functionapp config appsettings set --name "$APP" --resource-group "$RG" \
  --settings "ALLOWED_ORIGINS=$(IFS=,; echo "${ORIGINS[*]}")" -o none
CURRENT=$(az functionapp cors show --name "$APP" --resource-group "$RG" --query "allowedOrigins" -o tsv 2>/dev/null || true)
for o in "${ORIGINS[@]}"; do
  if ! grep -qx "$o" <<<"$CURRENT"; then
    az functionapp cors add --name "$APP" --resource-group "$RG" --allowed-origins "$o" -o none
  fi
done

echo "4/5 Deploying $ZIP"
retry az functionapp deployment source config-zip --name "$APP" --resource-group "$RG" --src "$ZIP" -o none

HOST=$(az functionapp show --name "$APP" --resource-group "$RG" --query defaultHostName -o tsv)
API="https://$HOST/api"

echo "5/5 Trying it with the site's own board"
ok=""
for _ in 1 2 3 4 5 6; do
  body=$(curl -s -H "Origin: https://sketchhour.com" --max-time 60 --get --data-urlencode "url=$TEST_BOARD" "$API/board" || true)
  if grep -q '"pins"' <<<"$body"; then ok=1; break; fi
  sleep 15
done
if [[ -n "$ok" ]]; then
  echo "    $(python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"{d[\"board\"][\"name\"]}: {len(d[\"pins\"])} pins")' <<<"$body")"
else
  echo "    No answer yet. The app can take a few minutes to start the first time; try:"
  echo "    curl -H \"Origin: https://sketchhour.com\" \"$API/board?url=$TEST_BOARD\""
  [[ -n "${body:-}" ]] && echo "    Last answer: ${body:0:300}"
fi

cat <<EOF

Done.

API address: $API
The site expects:  https://sketchhour-api-$HASH.azurewebsites.net/api
If those two differ, send me the API address so I can point the site at it.

Logs: portal > $APP > Monitoring > Logs (Application Insights).
To publish a new version later, upload the new sketchhour-api.zip and run this script again.
EOF
