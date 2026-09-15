#!/usr/bin/env bash
# Song From the Headlines — a Nevermined Catalog demo.
# One agent, one payment primitive, four vendors, two rails, two chains. Real money on Live.
#
# Prereqs: ~/.nvm-router-buyer.json = { "apiBase": "...", "apiKey": "live:..." }
# Run:     ./run-demo.sh
#
# Requires a broker-enabled Router API with Catalog slug/path support (nvm-monorepo #3304).
# Check the selected deployment before spending: an older API cannot settle these slug calls.
set -euo pipefail
RUN_STARTED_AT=$(date +%s)

# ── credentials (never put the key on the command line) ─────────────────────
CREDS=~/.nvm-router-buyer.json
command -v jq >/dev/null && command -v curl >/dev/null || { echo "jq and curl are required" >&2; exit 1; }
[ -r "$CREDS" ] || { echo "Missing credentials: $CREDS" >&2; exit 1; }
API_BASE=$(jq -er '.apiBase // .API_BASE' "$CREDS")
KEY=$(jq -er '.apiKey // .KEY' "$CREDS")
[[ "$API_BASE" == https://* ]] || { echo "apiBase must use HTTPS" >&2; exit 1; }
# NOTE: Content-Type is REQUIRED — without it curl sends form-encoded and the API 400s.
AUTH=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json")
HERE=$(cd "$(dirname "$0")" && pwd)

# ── discovery: find a service's catalog slug at runtime (the whole point) ─────
# The agent doesn't hardcode where a service lives. It searches the Catalog, gets the
# service's slug, and pays the opaque Router broker BY SLUG — the broker resolves the slug
# to the real upstream server-side, so the merchant host is never exposed. A raw-URL payment
# to a cataloged host is refused (409 BCK.ROUTER.0014); raw URL is for off-catalog hosts only.
# (The catalog + `slug` are read from a broker-enabled API — see the prerequisite note at the top.)
catalog_slug() {  # $1=search term  $2=expected slug → prints $2 iff the catalog lists it (else empty)
  # Discover-and-verify. Top-1 is NOT a stable identity: the default sort reshuffles every ~6h and
  # `search` is a substring match over title+description, so a bare term can match 2+ services and
  # resolve to a different one each window ('fal' also matches a weather service). Pinning the exact
  # slug keeps a live catalog lookup — proves the service is listed, aborts loud (via the :? guards)
  # if delisted/renamed — while guaranteeing a real-money run pays the intended vendor.
  # NB: the page-size param is `offset` (items per page, default 20, cap 100) — `limit` is not in the
  # DTO and is silently stripped, leaving the default 20-row (shuffled) window. Ask for the 100 cap so
  # the exact slug is in the page even for a broad term.
  curl -fsS --max-time 20 "$API_BASE/api/v1/catalog/services?search=$(jq -rn --arg t "$1" '$t|@uri')&offset=100" \
    | jq -er --arg s "$2" 'if any(.services[]?.slug; . == $s) then $s else empty end'
}
catalog_path() { # exact POST path in current detail
  curl -fsS --max-time 20 "$API_BASE/api/v1/catalog/services/$1" \
    | jq -e --arg path "$2" 'any(.endpoints[]?; .path == $path and .method == "POST")' >/dev/null
}

# ── the one primitive the agent uses for every purchase ─────────────────────
# It hands the Router a catalog slug; the Router probes the
# merchant's 402, picks the rail (MPP or x402), and settles. requestId must be unique per call.
_pay() {  # $1=target-json ({slug,path})  $2=json-body → prints the JSON result envelope
  local payload resp code
  # requestId must be unique per call (Router idempotency key). date+%s%N is GNU-only; two $RANDOM
  # keep it unique-per-call and portable (macOS `date` has no %N).
  payload=$(jq -n --arg d "$DEL_ID" --arg r "song-$(date +%s)-$RANDOM-$RANDOM" --argjson t "$1" --argjson b "$2" \
    '{delegationId:$d,method:"POST",requestId:$r,body:$b}+$t')
  resp=$(curl -sS --max-time 120 "${AUTH[@]}" -w $'\n%{http_code}' -X POST "$API_BASE/api/v1/router/route" -d "$payload") || resp=$'\n000'
  code=${resp##*$'\n'}
  [[ "$code" =~ ^2[0-9][0-9]$ ]] || { echo "  ✗ router/route → HTTP $code; check the ledger before retrying" >&2; return 1; }
  jq -e '.paid == true and .body != null and (.payment.status == "Settled")' \
    <<<"${resp%$'\n'*}" >/dev/null || { echo "  ✗ Router returned no delivered settled product" >&2; return 1; }
  printf '%s' "${resp%$'\n'*}"
}
route_slug() {  # $1=slug  $2=subpath ('' = none)  $3=json-body
  local t; t=$(jq -n --arg s "$1" '{slug:$s}')
  [ -n "$2" ] && t=$(jq --arg p "$2" '.+{path:$p}' <<<"$t")
  _pay "$t" "$3"
}
# NOTE: every cataloged call here is POST-with-body (no query string), so the {slug,path} body route
# suffices for all of them. A cataloged GET *with query params* can't use the body route — it takes
# the slug-native invoke URL /api/v1/router/svc/<slug>/<subpath>?<query> instead; see the
# route_slug_get helper in ../diligence-in-a-box/run-demo.sh (Aviato).

# discover each cataloged service's slug in the Catalog once, up front
echo "▸ Discovering services in the Nevermined Catalog…"
BRAVE=$(catalog_slug brave brave-search-via-mpp)
SUNO=$(catalog_slug suno suno-mpp)
FAL=$(catalog_slug fal fal-ai-mpp)
TWOS=$(catalog_slug 2s 2s-io)
: "${BRAVE:?brave not found in catalog}" "${SUNO:?suno not found}" "${FAL:?fal not found}" "${TWOS:?2s.io not found}"
catalog_path "$BRAVE" /brave/news-search && catalog_path "$TWOS" /api/ai/chat && \
catalog_path "$SUNO" /suno/generate-music && catalog_path "$SUNO" /suno/get-music-status && \
catalog_path "$FAL" /fal-ai/flux/schnell || {
  echo "A required POST path is missing from the current Catalog detail; no delegation created" >&2; exit 1; }
echo "  slugs: $BRAVE · $TWOS · $SUNO · $FAL"
echo "▸ Creating a capped budget (50¢ / 10 min)…"
DEL_ID=$(curl -fsS --max-time 30 "${AUTH[@]}" -X POST "$API_BASE/api/v1/delegation/create" \
  -d '{"provider":"erc4337","currency":"usdc","spendingLimitCents":50,"durationSecs":600,
       "consumerPrompt":"Song from the headlines","assuranceData":{}}' \
  | jq -er '.id // .delegationId')

# ── 1. Brave — today's #1 tech headline  [MPP · Tempo] ──────────────────────
echo "▸ 1/4  Finding today's top tech headline (Brave)…"
NEWS=$(route_slug "$BRAVE" "/brave/news-search" \
  '{"q":"technology","count":5,"freshness":"pd"}')
HEADLINE=$(jq -r '.body.data.results[0].title // .body.results[0].title // empty' <<<"$NEWS")
# Guard the seed: a failed Brave call yields "" / "null" — don't pay 2s.io, Suno and fal to
# process a non-headline. Abort with the reason instead (the whole demo is seeded by this).
[ -n "$HEADLINE" ] && [ "$HEADLINE" != null ] || {
  echo "  ✗ Brave returned no headline (check the Router response and broker support) — aborting"; exit 1; }
FIRST_RESULT_SECS=$(($(date +%s) - RUN_STARTED_AT))
echo "  headline: $HEADLINE"

# ── 2. 2s.io — 90s-pop lyrics  [x402 · Base] ────────────────────────────────
# 2s.io is cataloged as 2s-io, with /api/ai/chat appended to its catalog base.
# It is OpenAI-compatible. Two gotchas: pick a model from
# GET /api/ai/models (gpt-4o-mini is NOT valid), and do NOT send a system role — fold it in.
echo "▸ 2/4  Writing 90s-pop lyrics (2s.io)…"
LYR=$(route_slug "$TWOS" "/api/ai/chat" "$(jq -n --arg h "$HEADLINE" '{
  model:"google/gemini-2.5-flash-lite", max_tokens:400,
  messages:[{role:"user",content:("You are a 90s pop songwriter. Output only lyrics. Write an upbeat 90s pop anthem about: "+$h)}]}')")
LYRICS=$(jq -r '.body.choices[0].message.content // empty' <<<"$LYR")
[ -n "$LYRICS" ] && [ "$LYRICS" != null ] || { echo "  ✗ 2s.io returned no lyrics — full outcome unavailable" >&2; exit 1; }
echo "  lyrics: $(head -c 60 <<<"$LYRICS")…"

# ── 3. Suno — full song from the lyrics  [MPP · Tempo] (async) ──────────────
# Suno needs customMode + instrumental + model; taskId comes back nested.
echo "▸ 3/4  Composing the song (Suno — this takes ~a minute)…"
AUDIO=""
JOB=$(route_slug "$SUNO" "/suno/generate-music" "$(jq -n --arg l "$LYRICS" '{
  customMode:true, instrumental:false, model:"V5",
  prompt:$l, style:"90s pop anthem", title:"Song From the Headlines"}')")
TASK=$(jq -r '.body.data.data.taskId // .body.data.taskId // .body.taskId // empty' <<<"$JOB")
[ -n "$TASK" ] || { echo "  ✗ Suno returned no taskId" >&2; exit 1; }
for i in $(seq 1 12); do
  sleep 10
  # Suno lists this as a priced status endpoint. Keep the poll inside the Router so the
  # merchant host stays opaque and each status charge appears on the same budget/receipt.
  ST=$(route_slug "$SUNO" "/suno/get-music-status" "$(jq -n --arg t "$TASK" '{taskId:$t}')") || {
    echo "  ✗ Suno status payment failed; inspect ledger before retrying" >&2; exit 1; }
  AUDIO=$(jq -r '[.. | .audioUrl? // .audio_url? // empty] | map(select(. != "")) | .[0] // empty' <<<"$ST" 2>/dev/null) || AUDIO=""
  [ -n "$AUDIO" ] && break
  echo "  …still rendering ($i)"
done
[ -n "$AUDIO" ] || { echo "  ✗ Suno did not deliver audio within 12 checks; check task and ledger" >&2; exit 1; }
[[ "$AUDIO" == https://* ]] || { echo "  ✗ Suno audio URL is not HTTPS" >&2; exit 1; }
echo "  song: ${AUDIO:-<not ready>}"

# ── 4. fal.ai — album cover  [MPP · Tempo] ──────────────────────────────────
echo "▸ 4/4  Painting the album cover (fal.ai FLUX)…"
COV=$(route_slug "$FAL" "/fal-ai/flux/schnell" "$(jq -n --arg h "$HEADLINE" '{
  prompt:("90s pop album cover art about: "+$h), image_size:"square_hd", num_images:1}')")
COVER=$(jq -r '.body.images[0].url // empty' <<<"$COV")
[ -n "$COVER" ] || { echo "  ✗ fal.ai returned no cover URL" >&2; exit 1; }
[[ "$COVER" == https://* ]] || { echo "  ✗ fal.ai cover URL is not HTTPS" >&2; exit 1; }
echo "  cover: ${COVER:-<not ready>}"

# ── download the artifacts ──────────────────────────────────────────────────
OUT="$HERE/out"; mkdir -p "$OUT"
curl -fsSL --max-time 120 "$AUDIO" -o "$OUT/song.mp3"
curl -fsSL --max-time 120 "$COVER" -o "$OUT/album-cover.jpg"
[ -s "$OUT/song.mp3" ] && [ -s "$OUT/album-cover.jpg" ] || { echo "  ✗ downloaded artifact is empty" >&2; exit 1; }
echo "  saved $OUT/song.mp3 and $OUT/album-cover.jpg"

# ── the receipt: one budget, four vendors, two rails, two chains ────────────
echo; echo "▸ Receipt:"
curl -s "${AUTH[@]}" "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" \
  | jq -r '.[] | "  \(.protocol|ascii_upcase)\t\(.network)\t$\(.amount|tonumber/1000000)\t\(.status)\t\(.txHash)"'
echo
echo "  first delivered result: ${FIRST_RESULT_SECS}s after start"
echo "✔ Done — a song and a cover from one prompt. Four vendors, two rails, two chains, zero clicks."
