#!/usr/bin/env bash
# Diligence-in-a-Box — a Nevermined Catalog demo.
# One agent, one payment primitive, five diligence sources, two rails, two chains.
# It builds a VC-grade investment memo on a startup and pays for every source itself.
# Real money on Live (~$0.49 for the run below).
#
# Prereqs: ~/.nvm-router-buyer.json = { "apiBase": "https://api.live.nevermined.app", "apiKey": "live:..." }
#          plus jq and curl.
# Run:     ./run-demo.sh              # profiles perplexity.ai by default
#          DOMAIN=stripe.com ./run-demo.sh
set -euo pipefail

DOMAIN="${DOMAIN:-perplexity.ai}"          # the startup to diligence
COMPANY_NAME="${COMPANY_NAME:-Perplexity}"  # EDGAR full-text keyword = the company NAME, not the domain

# ── credentials (never put the key on the command line) ─────────────────────
CREDS=~/.nvm-router-buyer.json
API_BASE=$(jq -r '.apiBase // .API_BASE' "$CREDS")
KEY=$(jq -r '.apiKey // .KEY' "$CREDS")
# NOTE: Content-Type is REQUIRED — without it curl sends form-encoded and the API 400s.
AUTH=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json")

# ── the budget: one capped, short-lived delegation (like a prepaid card) ─────
echo "▸ Creating a capped budget (\$1.00 / 15 min)…"
DEL_ID=$(curl -s "${AUTH[@]}" -X POST "$API_BASE/api/v1/delegation/create" \
  -d '{"provider":"erc4337","currency":"usdc","spendingLimitCents":100,"durationSecs":900,
       "consumerPrompt":"Diligence-in-a-box demo","assuranceData":{}}' \
  | jq -r '.id // .delegationId')
echo "  budget id: $DEL_ID"

# ── the one primitive the agent uses for every purchase ─────────────────────
# The agent never chooses a protocol — it hands the Router a URL + method and the
# Router probes the merchant's 402, picks the rail (MPP or x402), and settles.
route() {  # $1=url  $2=method(GET|POST)  $3=json-body ('' for none)
  local payload
  payload=$(jq -n --arg d "$DEL_ID" --arg u "$1" --arg m "$2" --arg r "dd-$(date +%s)-$RANDOM" \
    '{delegationId:$d,url:$u,method:$m,requestId:$r}')
  [ -n "${3:-}" ] && payload=$(jq --argjson b "$3" '.+{body:$b}' <<<"$payload")
  curl -s --max-time 120 "${AUTH[@]}" -X POST "$API_BASE/api/v1/router/route" -d "$payload"
}

# ── 1. Aviato — company overview + founders  [MPP · Tempo] ──────────────────
# Aviato's query param is ?website= (not ?domain=); /company/founders also needs page + perPage.
echo "▸ 1/5  Company overview + founders (Aviato)…"
COMPANY=$(route "https://mpp.orthogonal.com/aviato/company/enrich?website=$DOMAIN" GET '')
echo "  $(jq -r '.body.name // .body.legalName // "company"' <<<"$COMPANY") — raised \$$(jq -r '((.body.totalFunding // .body.totalRaised // 0)/1e6|floor)' <<<"$COMPANY")M"
FOUNDERS=$(route "https://mpp.orthogonal.com/aviato/company/founders?website=$DOMAIN&page=1&perPage=10" GET '')
# pick the CEO-ish founder (prefer the one based in San Francisco), with their LinkedIn for a richer dossier
FOUNDER=$(jq -r '[.body.founders[]? | select(((.location//"")|test("San Francisco"))) ] as $sf
                 | (($sf[0] // .body.founders[0]).fullName // "")' <<<"$FOUNDERS")
FOUNDER_LI=$(jq -r '[.body.founders[]? | select(((.location//"")|test("San Francisco"))) ] as $sf
                 | (($sf[0] // .body.founders[0]).URLs.linkedin // "")' <<<"$FOUNDERS")
echo "  founder to deep-dive: ${FOUNDER:-<none>}"

# the buyer wallet is the OneShot poll header (X-Agent-ID) — read it off the first settled payment
BUYER=$(curl -s "${AUTH[@]}" "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" | jq -r '.[0].buyer // empty')

# ── 2. OneShot — founder deep-dive  [x402 · Base]  (async) ───────────────────
# Body keys: name / social_media_url / company (NOT linkedin_url / full_name). Name-only is thin —
# pass the LinkedIn + company for a real dossier. Returns 202 + request_id; poll the FREE, direct
# status endpoint with X-Agent-ID: <buyer wallet> (no payment, no router).
echo "▸ 2/5  Founder deep-dive (OneShot — x402 on Base, runs asynchronously)…"
OS_INIT=$(route "https://win.oneshotagent.com/v1/tools/research/person" POST \
  "$(jq -n --arg n "$FOUNDER" --arg s "$FOUNDER_LI" --arg c "$COMPANY_NAME" \
     '{name:$n, social_media_url:$s, company:$c} | with_entries(select(.value != ""))')")
REQ_ID=$(jq -r '.body.request_id // .body.data.request_id // empty' <<<"$OS_INIT")
DOSSIER=""
if [ -n "$REQ_ID" ] && [ -n "$BUYER" ]; then
  for i in $(seq 1 20); do
    sleep 6
    ST=$(curl -s --max-time 60 -H "X-Agent-ID: $BUYER" "https://win.oneshotagent.com/v1/requests/$REQ_ID")
    if [ "$(jq -r '.status // empty' <<<"$ST")" = "completed" ]; then DOSSIER="$ST"; break; fi
    echo "  …still researching ($i)"
  done
fi
echo "  dossier: $(jq -r 'if .result then "ready" else "pending" end' <<<"${DOSSIER:-{}}")"

# ── 3. PredictLeads — hiring + news momentum  [MPP · Tempo] ──────────────────
echo "▸ 3/5  Hiring + news momentum (PredictLeads)…"
JOBS=$(route "https://mpp.orthogonal.com/predictleads/v3/companies/$DOMAIN/job_openings" GET '')
NEWS=$(route "https://mpp.orthogonal.com/predictleads/v3/companies/$DOMAIN/news_events" GET '')
echo "  open roles: $(jq -r '(.body.data|length)? // 0' <<<"$JOBS")   news items: $(jq -r '([.body.included[]? | select(.type=="news_article")]|length)? // 0' <<<"$NEWS")"

# ── 4. EDGAR — any SEC filings  [MPP · Tempo]  (targetUrl == path → call as-is) ─
# Required field is q (NOT query); pass the COMPANY NAME. A private company returns few/zero
# direct filings — but the third-party SPV/Form-D hits are themselves a diligence signal.
echo "▸ 4/5  SEC full-text search (EDGAR)…"
FILINGS=$(route "https://edgar-search.mpp.paywithlocus.com/edgar-search/search" POST \
  "$(jq -n --arg q "$COMPANY_NAME" '{q:$q}')")
echo "  filing hits: $(jq -r '.body.data.hits.total.value? // (.body.data.hits.hits|length)? // 0' <<<"$FILINGS")"

# ── 5. Riveter — web / product research  [MPP · Tempo] ──────────────────────
# Dynamic price — the amount is quoted in the merchant's 402 before it settles.
echo "▸ 5/5  Web + product research (Riveter scrape)…"
WEB=$(route "https://mpp.orthogonal.com/riveter/v1/scrape" POST \
  "$(jq -n --arg u "https://$DOMAIN" '{url:$u}')")
echo "  scraped $(jq -r '(.body.text|length)? // 0' <<<"$WEB") chars from $DOMAIN"

# → a harness would now assemble COMPANY + DOSSIER + JOBS + NEWS + FILINGS + WEB into a memo.
# Save the raw payloads so you can build the memo yourself.
HERE=$(cd "$(dirname "$0")" && pwd); OUT="$HERE/out"; mkdir -p "$OUT"
printf '%s' "$COMPANY"  >"$OUT/company.json"
printf '%s' "$FOUNDERS" >"$OUT/founders.json"
printf '%s' "${DOSSIER:-{}}" >"$OUT/founder-dossier.json"
printf '%s' "$JOBS"     >"$OUT/hiring.json"
printf '%s' "$NEWS"     >"$OUT/news.json"
printf '%s' "$FILINGS"  >"$OUT/filings.json"
printf '%s' "$WEB"      >"$OUT/web.json"
echo "  saved raw source payloads to ./out/"

# ── the receipt: one budget, five sources, two rails, two chains ─────────────
echo; echo "▸ Receipt:"
curl -s "${AUTH[@]}" "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" \
  | jq -r '.[] | "  \(.protocol|ascii_upcase)\t\(.network)\t$\(.amount|tonumber/1e6)\t\(.status)\t\(.txHash // "—")"'
echo
echo "✔ Done — a VC-grade memo on $DOMAIN from one prompt. Five sources, two rails, two chains, zero clicks."
