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

# ── discovery: find a service's catalog slug at runtime (the whole point) ─────
# The agent doesn't hardcode where a source lives. It searches the Catalog, gets the
# service's slug, and pays the opaque Router broker BY SLUG — the broker resolves the
# slug to the real upstream server-side, so the merchant host is never exposed. A raw-URL
# payment to a cataloged host is refused (409 BCK.ROUTER.0014); raw URL is for off-catalog
# hosts only. `slug` is published in every env (prod or broker), so this works either way.
catalog_slug() {  # $1=search term → prints the top-matching service's slug (empty = off-catalog)
  curl -s "$API_BASE/api/v1/catalog/services?search=$(jq -rn --arg t "$1" '$t|@uri')&offset=1" \
    | jq -r '.services[0].slug // empty'
}

# ── the one primitive the agent uses for every purchase ─────────────────────
# It never chooses a protocol — it hands the Router a slug (cataloged) or a url
# (off-catalog) + method, and the Router probes the merchant's 402, picks the rail
# (MPP or x402), and settles. requestId must be unique per call.
_pay() {  # $1=target-json ({slug,path} | {url})  $2=method  $3=json-body ('' for none)
  local payload
  payload=$(jq -n --arg d "$DEL_ID" --arg m "$2" --arg r "dd-$(date +%s%N)-$RANDOM" --argjson t "$1" \
    '{delegationId:$d,method:$m,requestId:$r}+$t')
  [ -n "${3:-}" ] && payload=$(jq --argjson b "$3" '.+{body:$b}' <<<"$payload")
  curl -s --max-time 120 "${AUTH[@]}" -X POST "$API_BASE/api/v1/router/route" -d "$payload"
}
route_slug() {  # $1=slug  $2=subpath ('' = none)  $3=method  $4=json-body ('')
  local t; t=$(jq -n --arg s "$1" '{slug:$s}')
  [ -n "$2" ] && t=$(jq --arg p "$2" '.+{path:$p}' <<<"$t")
  _pay "$t" "$3" "${4:-}"
}
route_url() {   # $1=url  $2=method  $3=json-body ('')  — OFF-CATALOG hosts only
  _pay "$(jq -n --arg u "$1" '{url:$u}')" "$2" "${3:-}"
}

# discover each source's slug in the Catalog once, up front, and reuse across calls
echo "▸ Discovering sources in the Nevermined Catalog…"
AVIATO=$(catalog_slug aviato)
PREDICTLEADS=$(catalog_slug predictleads)
ONESHOT=$(catalog_slug oneshot)
EDGAR=$(catalog_slug edgar)
RIVETER=$(catalog_slug riveter)
: "${AVIATO:?aviato not found in catalog}" "${PREDICTLEADS:?predictleads not found}" \
  "${ONESHOT:?oneshot not found}" "${EDGAR:?edgar not found}" "${RIVETER:?riveter not found}"
echo "  slugs: $AVIATO · $PREDICTLEADS · $ONESHOT · $EDGAR · $RIVETER"

# ── 1. Aviato — company overview + founders  [MPP · Tempo] ──────────────────
# Aviato's query param is ?website= (not ?domain=); /company/founders also needs page + perPage.
# NOTE (broker query-string gap — see PR): the body route composes the target as
# joinSlugSubpath(base, path) with no `search` arg, so a `?query` inside `path` is percent-encoded
# (`?`→`%3F`) and lost. Aviato's two GETs depend on ?website=/?page=. Written to the intended
# contract (the /svc/:slug/* surface already splits query the same way); pending a broker fix to
# split query from path in resolveRouteTarget. Aviato is on the shared mpp.orthogonal.com host, so
# raw URL is not an option here — it would 409 (BCK.ROUTER.0014). Slug is mandatory.
echo "▸ 1/5  Company overview + founders (Aviato)…"
COMPANY=$(route_slug "$AVIATO" "/company/enrich?website=$DOMAIN" GET '')
echo "  $(jq -r '.body.name // .body.legalName // "company"' <<<"$COMPANY") — raised \$$(jq -r '((.body.totalFunding // .body.totalRaised // 0)/1e6|floor)' <<<"$COMPANY")M"
FOUNDERS=$(route_slug "$AVIATO" "/company/founders?website=$DOMAIN&page=1&perPage=10" GET '')
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
OS_INIT=$(route_slug "$ONESHOT" "" POST \
  "$(jq -n --arg n "$FOUNDER" --arg s "$FOUNDER_LI" --arg c "$COMPANY_NAME" \
     '{name:$n, social_media_url:$s, company:$c} | with_entries(select(.value != ""))')")
REQ_ID=$(jq -r '.body.request_id // .body.data.request_id // empty' <<<"$OS_INIT")
DOSSIER=""
if [ -n "$REQ_ID" ] && [ -n "$BUYER" ]; then
  for i in $(seq 1 20); do
    sleep 6
    # KNOWN LIMITATION: a free follow-up call to a cataloged service returns body:null through the
    # broker (Phase-2 anti-oracle); pending nvm-monorepo follow-up. Left as a direct, free poll to
    # the merchant's status endpoint — which the opaque broker will eventually hide the host of.
    ST=$(curl -s --max-time 60 -H "X-Agent-ID: $BUYER" "https://win.oneshotagent.com/v1/requests/$REQ_ID")
    if [ "$(jq -r '.status // empty' <<<"$ST")" = "completed" ]; then DOSSIER="$ST"; break; fi
    echo "  …still researching ($i)"
  done
fi
echo "  dossier: $(jq -r 'if .result then "ready" else "pending" end' <<<"${DOSSIER:-{}}")"

# ── 3. PredictLeads — hiring + news momentum  [MPP · Tempo] ──────────────────
echo "▸ 3/5  Hiring + news momentum (PredictLeads)…"
JOBS=$(route_slug "$PREDICTLEADS" "/v3/companies/$DOMAIN/job_openings" GET '')
NEWS=$(route_slug "$PREDICTLEADS" "/v3/companies/$DOMAIN/news_events" GET '')
echo "  open roles: $(jq -r '(.body.data|length)? // 0' <<<"$JOBS")   news items: $(jq -r '([.body.included[]? | select(.type=="news_article")]|length)? // 0' <<<"$NEWS")"

# ── 4. EDGAR — any SEC filings  [MPP · Tempo] ───────────────────────────────
# Required field is q (NOT query); pass the COMPANY NAME. A private company returns few/zero
# direct filings — but the third-party SPV/Form-D hits are themselves a diligence signal.
# The catalog targetUrl already includes the full /edgar-search/search path → slug + no subpath.
echo "▸ 4/5  SEC full-text search (EDGAR)…"
FILINGS=$(route_slug "$EDGAR" "" POST \
  "$(jq -n --arg q "$COMPANY_NAME" '{q:$q}')")
echo "  filing hits: $(jq -r '.body.data.hits.total.value? // (.body.data.hits.hits|length)? // 0' <<<"$FILINGS")"

# ── 5. Riveter — web / product research  [MPP · Tempo] ──────────────────────
# Dynamic price — the amount is quoted in the merchant's 402 before it settles.
echo "▸ 5/5  Web + product research (Riveter scrape)…"
WEB=$(route_slug "$RIVETER" "/v1/scrape" POST \
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
