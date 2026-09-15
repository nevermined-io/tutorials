#!/usr/bin/env bash
# SEC earnings evidence pack: five paid calls to three cataloged sources, one capped delegation.
# This is a Live paid sample. Validation must not run this file.
set -euo pipefail
set +x
umask 077

HERE=$(cd "$(dirname "$0")" && pwd)
START_SECONDS=$(date +%s)
CREDS="${CREDS:-$HOME/.nvm-router-buyer.json}"
CIK="${CIK:-320193}"                 # Apple, digits only; SEC CIK is zero-padded upstream
SYMBOL="${SYMBOL:-AAPL}"             # Alpha Vantage stock symbol
COMPANY="${COMPANY:-Apple}"         # EDGAR full-text keyword
CAP_CENTS=10                          # five listed ~$0.008 calls ~= $0.04; cap absorbs fee drift
MAX_CALLS=5

command -v jq >/dev/null && command -v curl >/dev/null && command -v python3 >/dev/null || {
  echo "jq, curl, and Python 3 are required" >&2; exit 1; }
[[ "$CIK" =~ ^[0-9]{1,10}$ ]] || { echo "CIK must contain 1–10 digits" >&2; exit 1; }
[[ "$SYMBOL" =~ ^[A-Za-z0-9.^-]{1,15}$ ]] || { echo "SYMBOL must be a ticker" >&2; exit 1; }
COMPANY_PATTERN='^[A-Za-z0-9 .,&-]{1,80}$'
[[ "$COMPANY" =~ $COMPANY_PATTERN ]] || { echo "COMPANY contains unsupported characters" >&2; exit 1; }
[ -r "$CREDS" ] || { echo "Missing credential file: $CREDS" >&2; exit 1; }
API_BASE=$(jq -er '.apiBase // .API_BASE' "$CREDS")
KEY=$(jq -er '.apiKey // .KEY' "$CREDS")
[[ "$API_BASE" == https://* ]] || { echo "apiBase must use HTTPS" >&2; exit 1; }
auth_curl() { curl -H @<(printf 'Authorization: Bearer %s\n' "$KEY") -H 'Content-Type: application/json' "$@"; }

catalog_slug() {
  local response
  response=$(curl -fsS --max-time 20 "$API_BASE/api/v1/catalog/services?search=$(jq -rn --arg s "$1" '$s|@uri')&offset=100")
  jq -er --arg slug "$2" 'if any(.services[]?.slug; . == $slug) then $slug else empty end' <<<"$response"
}
catalog_path() { # slug, exact path; fail before delegation if endpoint changes
  local detail
  detail=$(curl -fsS --max-time 20 "$API_BASE/api/v1/catalog/services/$1") || return 1
  jq -e --arg path "$2" 'any(.endpoints[]?; .path == $path and .method == "POST")' \
    <<<"$detail" >/dev/null
}

# Discover first, before creating a delegation. Fixed slug identity prevents shuffled search
# results from redirecting a paid run to a different provider.
EDGAR=$(catalog_slug edgar edgar-sec-mpp) || { echo "edgar-sec-mpp unavailable" >&2; exit 1; }
SEARCH=$(catalog_slug edgar edgar-search) || { echo "edgar-search unavailable" >&2; exit 1; }
ALPHA=$(catalog_slug alpha alpha-vantage-mpp) || { echo "alpha-vantage-mpp unavailable" >&2; exit 1; }
catalog_path "$EDGAR" /edgar/company-submissions && catalog_path "$EDGAR" /edgar/company-facts && \
catalog_path "$SEARCH" /edgar-search/search && catalog_path "$ALPHA" /alphavantage/earnings && \
catalog_path "$ALPHA" /alphavantage/income-statement || {
  echo "One required POST path is absent from current Catalog detail; no delegation created" >&2; exit 1; }
echo "Catalog slugs: $EDGAR · $SEARCH · $ALPHA"
echo "Estimated listed price: five calls × about \$0.008 = \$0.04. Live 402 quotes and fees can differ."
echo "Maximum delegation spend: \$$(jq -n --argjson cap "$CAP_CENTS" '$cap / 100') for 10 minutes. This script stops after $MAX_CALLS calls."

DEL_RESPONSE=$(auth_curl -fsS --max-time 30 -X POST "$API_BASE/api/v1/delegation/create" \
  -d "$(jq -n --arg p "SEC earnings pack: $SYMBOL/$CIK" --argjson cap "$CAP_CENTS" \
       '{provider:"erc4337",currency:"usdc",spendingLimitCents:$cap,durationSecs:600,consumerPrompt:$p,assuranceData:{}}')")
DEL_ID=$(jq -er '.id // .delegationId' <<<"$DEL_RESPONSE")
echo "Delegation created (identifier kept in the private output files)."

OUT="$HERE/out"; mkdir -p "$OUT"; chmod 700 "$OUT"
jq -n --arg id "$DEL_ID" '{delegationId:$id}' > "$OUT/delegation.json"
CALLS=0
FIRST_SUCCESS_SECONDS=''
check_budget_and_ledger() { # request-id; fail closed if budget/receipt cannot be reconciled
  local request_id="$1" details payments spent remaining
  details=$(auth_curl -fsS --max-time 20 "$API_BASE/api/v1/delegation/$DEL_ID") || return 1
  payments=$(auth_curl -fsS --max-time 20 "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID") || return 1
  printf '%s\n' "$payments" > "$OUT/payments.json"
  jq -e --arg id "$request_id" 'any(.[]?; .requestId == $id and .status == "Settled")' \
    <<<"$payments" >/dev/null || { echo "Payment ledger has no Settled receipt for this request" >&2; return 1; }
  spent=$(jq -er '.amountSpentCents | tonumber' <<<"$details") || return 1
  remaining=$(jq -er '.remainingBudgetCents | tonumber' <<<"$details") || return 1
  [ "$spent" -ge 0 ] && [ "$remaining" -ge 0 ] && [ "$((spent + remaining))" -eq "$CAP_CENTS" ] || {
    echo "Delegation budget could not be reconciled" >&2; return 1; }
  echo "  ledger: Settled; spent ${spent}¢, remaining ${remaining}¢ of ${CAP_CENTS}¢" >&2
  [ "$CALLS" -eq "$MAX_CALLS" ] || [ "$remaining" -ge 1 ] || {
    echo "Budget depleted; stopping before another call" >&2; return 1; }
}
route_paid() { # name slug path request-body; prints the Router envelope
  local name="$1" slug="$2" path="$3" body="$4" payload response code envelope request_id
  CALLS=$((CALLS + 1))
  [ "$CALLS" -le "$MAX_CALLS" ] || { echo "Call count exceeded" >&2; return 1; }
  # A request gets one stable id for this delegation. An ambiguous transport failure is
  # deliberately not retried automatically; reusing the saved id is mandatory if retried.
  request_id="sec-pack-$name-$DEL_ID"
  payload=$(jq -n --arg id "$DEL_ID" --arg slug "$slug" --arg path "$path" \
    --arg req "$request_id" --argjson body "$body" \
    '{delegationId:$id,slug:$slug,path:$path,method:"POST",requestId:$req,body:$body}')
  printf '%s\n' "$payload" > "$OUT/$name.request.json"; chmod 600 "$OUT/$name.request.json"
  response=$(auth_curl -sS --max-time 120 -w $'\n%{http_code}' \
    -X POST "$API_BASE/api/v1/router/route" -d "$payload") || { echo "$name: transport failure" >&2; return 1; }
  code=${response##*$'\n'}
  envelope=${response%$'\n'*}
  printf '%s\n' "$envelope" > "$OUT/$name.router.json"
  [[ "$code" =~ ^2[0-9][0-9]$ ]] || { echo "$name: Router HTTP $code; see $OUT/$name.router.json" >&2; return 1; }
  # The broker's 402 quote is handled internally. A free trial or withheld follow-up has no
  # delivered evidence; a settled payment without a body is also unusable here.
  jq -e '.paid == true and .body != null and (.payment.status == "Settled")' <<<"$envelope" >/dev/null || {
    echo "$name: no delivered settled product; inspect saved envelope and payment ledger" >&2; return 1; }
  check_budget_and_ledger "$request_id" || { echo "$name: budget/receipt check failed; stopping" >&2; return 1; }
  echo "  $name: settled and delivered" >&2
  [ -n "$FIRST_SUCCESS_SECONDS" ] || FIRST_SUCCESS_SECONDS=$(date +%s)
  printf '%s' "$envelope"
}

echo "Buying company filing history and XBRL facts…"
route_paid submissions "$EDGAR" /edgar/company-submissions "$(jq -n --arg c "$CIK" '{cik:$c}')" >/dev/null
route_paid facts "$EDGAR" /edgar/company-facts "$(jq -n --arg c "$CIK" '{cik:$c}')" >/dev/null
echo "Buying full-text filing matches…"
# The listing advertises /edgar-search/search, but the merchant base already includes
# that path. Appending it through the Router produced upstream 404 in the first Live
# pass (no payment). Route the slug base instead; the same request ID succeeded.
route_paid search "$SEARCH" '' "$(jq -n --arg q "$COMPANY" '{q:$q}')" >/dev/null
echo "Buying earnings and income statement…"
route_paid earnings "$ALPHA" /alphavantage/earnings "$(jq -n --arg s "$SYMBOL" '{symbol:$s}')" >/dev/null
route_paid income "$ALPHA" /alphavantage/income-statement "$(jq -n --arg s "$SYMBOL" '{symbol:$s}')" >/dev/null

auth_curl -fsS --max-time 20 "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" > "$OUT/payments.json"
auth_curl -fsS --max-time 20 "$API_BASE/api/v1/delegation/$DEL_ID" \
  | jq '{budgetSpentCents:.amountSpentCents,remainingBudgetCents:.remainingBudgetCents}' \
  > "$OUT/budget-summary.json"
jq -n --argjson first "$((FIRST_SUCCESS_SECONDS - START_SECONDS))" \
  --argjson elapsed "$(($(date +%s) - START_SECONDS))" \
  '{timeToFirstSuccessSeconds:$first,elapsedSeconds:$elapsed}' > "$OUT/run-summary.json"
CIK="$CIK" SYMBOL="$SYMBOL" COMPANY="$COMPANY" python3 "$HERE/build-pack.py"
echo "Receipt saved: $OUT/payments.json"
echo "Done: $OUT/evidence.md and $OUT/evidence.json. Verify wrapper mapping and filing dates before relying on them."
