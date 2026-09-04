#!/usr/bin/env bash
# Discover the Catalog — a Nevermined Catalog demo.
# The same catalog, read three ways: by eye, by an agent, and by a crawler.
#
# This is a DISCOVERY tour. It reads the public catalog only — no account, no API key,
# no payment. Every call below is unauthenticated and free.
#
# Prereqs: curl + jq.  (python3 optional, only for prettier facet bars.)
# Run:     ./run-demo.sh                 # sandbox by default
#          NVM_TIER=live ./run-demo.sh   # the production catalog
#          Q="web scraping" ./run-demo.sh
set -euo pipefail

TIER="${NVM_TIER:-sandbox}"                      # discovery is read-only; sandbox is the safe default
API="https://api.${TIER}.nevermined.app"
MCP="https://mcp.${TIER}.nevermined.app/mcp"
Q="${Q:-company enrichment}"                       # the thing we're looking for

b(){ printf '\n\033[1;36m%s\033[0m\n' "$*"; }      # section header
dim(){ printf '\033[2m%s\033[0m\n' "$*"; }

b "▸ The catalog at a glance  (tier: $TIER)"
dim "GET $API/api/v1/catalog/categories"
curl -s "$API/api/v1/catalog/categories" \
  | jq -r 'sort_by(-.count)[] | "  \(.count|tostring|(" "*(4-length))+.)  \(.category)"'
TOTAL=$(curl -s "$API/api/v1/catalog/categories" | jq '[.[].count] | add')
X402=$(curl -s "$API/api/v1/catalog/services?protocol=x402&offset=1" | jq .total)
MPP=$(curl -s "$API/api/v1/catalog/services?protocol=mpp&offset=1" | jq .total)
echo "  ── $TOTAL agents · x402: $X402 · MPP: $MPP (the two payment rails you can use) ──"

b "① BY EYE — the REST catalog a person (or a website) browses"
dim "GET $API/api/v1/catalog/services?search=$(printf %s "$Q" | jq -sRr @uri)&offset=5"
curl -s "$API/api/v1/catalog/services?search=$(printf %s "$Q" | jq -sRr @uri)&offset=5" \
  | jq -r '.services[] | "  • \(.title)  [\(.protocol)]  — \(.shortDescription[0:70])"'

b "② BY AN AGENT — the ARD registry: relevance-ranked search over the whole question"
dim "POST $API/api/v1/ard/search   { query: { text: \"$Q\" } }"
curl -s -X POST "$API/api/v1/ard/search" -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$Q" '{query:{text:$t},pageSize:5}')" \
  | jq -r '.results[] | "  \(.score|tostring|(" "*(3-length))+.)  \(.displayName)  [\((."nvm:catalog".protocol) // "?")]"'

b "   …and ARD /explore — the STRUCTURE behind those results (this is the part people miss)"
dim "POST $API/api/v1/ard/explore   { query:{text}, resultType:{ facets:[pay:protocol, tags] } }"
curl -s -X POST "$API/api/v1/ard/explore" -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$Q" '{query:{text:$t},resultType:{facets:[{field:"pay:protocol"},{field:"tags",limit:6}]}}')" \
  | jq -r '
     "  payment rails:", (.facets."pay:protocol".buckets[] | "     \(.value)  ×\(.count)"),
     "  top tags:",      (.facets.tags.buckets[]           | "     \(.value)  ×\(.count)")'

b "   MCP — the very same discovery, exposed as a tool an agent can call"
dim "POST $MCP   tools/call search_services { query: \"$Q\" }"
curl -s -X POST "$MCP" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d "$(jq -n --arg t "$Q" '{jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"search_services",arguments:{query:$t,offset:3}}}')" \
  | jq -r '.result.content[0].text | fromjson | "  \(.total) matches, e.g. \(.services[0].title) [\(.services[0].protocol)]"'

b "③ BY A CRAWLER — the whole catalog as one agent-ready (Google ARD) feed"
dim "GET $API/.well-known/ard.json"
curl -s "$API/.well-known/ard.json" \
  | jq -r '"  specVersion \(.specVersion) · host \(.host.identifier) · \(.entries|length) entries",
           "  sample entry: \(.entries[0].displayName) — \(.entries[0].representativeQueries[0])"'

b "Done."
echo "Found something? Pay for and call it through the Router — see ../diligence-in-a-box or ../song-from-the-headlines."
echo "Or explore it visually: run ./playground  (see playground/README.md)."
