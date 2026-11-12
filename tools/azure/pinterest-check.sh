#!/usr/bin/env bash
# Asks Pinterest for a board the way scripts/lib/pinterest-public.js does, and prints what comes back.
# Read-only: it changes nothing. Run in Cloud Shell:  bash pinterest-check.sh [username/board]
set -uo pipefail

PATHPART="${1:-hejgarm/100-heads}"
USERNAME="${PATHPART%%/*}"
SLUG="${PATHPART#*/}"; SLUG="${SLUG%/}"
B="/$USERNAME/$SLUG/"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
TMP=$(mktemp -d)

req() {
  curl -s --compressed -o "$TMP/$2" -w "%{http_code}" --max-time 30 -G "https://www.pinterest.com/resource/$1/get/" \
    --data-urlencode "source_url=$B" --data-urlencode "data=$3" \
    -H "User-Agent: $UA" -H "Accept: application/json, text/javascript, */*; q=0.01" \
    -H "Accept-Language: en-US,en;q=0.9" -H "X-Requested-With: XMLHttpRequest" \
    -H "X-Pinterest-AppState: active" -H "X-Pinterest-Source-Url: $B"
}

echo "Board $B"
echo "1. board details: HTTP $(req BoardResource board.json "{\"options\":{\"username\":\"$USERNAME\",\"slug\":\"$SLUG\",\"field_set_key\":\"detailed\"},\"context\":{}}")"
BID=$(python3 - "$TMP/board.json" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding='utf-8', errors='replace').read()
try:
    r = json.loads(raw).get('resource_response', {})
except Exception:
    print('   not JSON, starts with:', raw[:160].replace('\n', ' '), file=sys.stderr); sys.exit(0)
d = r.get('data') or {}
print('   status:', r.get('status'), '| message:', r.get('message'), '| board id:', d.get('id'), '| pin count:', d.get('pin_count'), file=sys.stderr)
print(d.get('id') or '')
PY
)

if [[ -n "$BID" ]]; then
  echo "2. pin list: HTTP $(req BoardFeedResource feed.json "{\"options\":{\"board_id\":\"$BID\",\"board_url\":\"$B\",\"field_set_key\":\"react_grid_pin\",\"filter_section_pins\":false,\"layout\":\"default\",\"page_size\":50,\"redux_normalize_feed\":true},\"context\":{}}")"
  python3 - "$TMP/feed.json" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding='utf-8', errors='replace').read()
try:
    r = json.loads(raw).get('resource_response', {})
except Exception:
    print('   not JSON, starts with:', raw[:160].replace('\n', ' ')); sys.exit(0)
items = r.get('data')
print('   status:', r.get('status'), '| message:', r.get('message'), '| bookmark:', str(r.get('bookmark'))[:16])
if isinstance(items, list):
    types = {}
    for it in items:
        if isinstance(it, dict): types[it.get('type')] = types.get(it.get('type'), 0) + 1
    print('   items:', len(items), '| types:', types)
    first = next((it for it in items if isinstance(it, dict)), None)
    if first:
        print('   first item keys:', ', '.join(sorted(first.keys())[:30]))
        imgs = first.get('images')
        print('   images:', list(imgs.keys())[:8] if isinstance(imgs, dict) else type(imgs).__name__)
else:
    print('   data is', type(items).__name__, (list(items.keys())[:15] if isinstance(items, dict) else ''))
PY
else
  echo "2. pin list: skipped (no board id)"
fi
echo "3. RSS feed: HTTP $(curl -s --compressed -o "$TMP/feed.rss" -w "%{http_code}" --max-time 30 -H "User-Agent: $UA" "https://www.pinterest.com/$USERNAME/$SLUG.rss") with $(grep -o '<item>' "$TMP/feed.rss" | wc -l) pins"
echo "4. embed widget feed: HTTP $(curl -s --compressed -o "$TMP/widget.json" -w "%{http_code}" --max-time 30 -H "User-Agent: $UA" "https://widgets.pinterest.com/v3/pidgets/boards/$USERNAME/$SLUG/pins/")"
python3 - "$TMP/widget.json" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding='utf-8', errors='replace').read()
try:
    j = json.loads(raw)
except Exception:
    print('   not JSON, starts with:', raw[:160].replace('\n', ' ')); sys.exit(0)
d = j.get('data') or {}
pins = d.get('pins') if isinstance(d, dict) else None
board = d.get('board') if isinstance(d, dict) else None
print('   status:', j.get('status'), '| message:', j.get('message'), '| pins returned:', len(pins) if isinstance(pins, list) else None,
      '| board pin count:', (board or {}).get('pin_count'))
if isinstance(pins, list) and pins:
    print('   first pin keys:', ', '.join(sorted(pins[0].keys())[:20]))
PY
rm -rf "$TMP"
