#!/usr/bin/env bash
# Brake On The Code — a Nevermined Catalog demo ("song from the headlines", delta-blues take).
# One agent, one payment primitive, four vendors, two rails, two chains. Real money on Live.
#
# The twist in this take: the agent writes NO lyrics. It reads the news, hands a ≤200-char
# factual brief to an AI service (Suno), and that service writes the words, then the song.
# The only human-authored text in the whole run is the brief and the production prompts below.
#
# Prereqs: ~/.nvm-router-buyer.json = { "apiBase": "https://api.live.nevermined.app", "apiKey": "live:..." }
#          plus jq and curl.
# Run:     ./run-demo.sh
#
# Requires a broker-enabled Router API with Catalog slug/path support (nvm-monorepo #3304).
# Check the selected deployment before spending: an older API cannot settle these slug calls.
set -euo pipefail
set +x  # Never trace credential loading or authenticated calls, even under bash -x.
umask 077
RUN_STARTED_AT=$(date +%s)

# ── credentials (never put the key on the command line) ─────────────────────
CREDS=~/.nvm-router-buyer.json
command -v jq >/dev/null && command -v curl >/dev/null || { echo "jq and curl are required" >&2; exit 1; }
[ -r "$CREDS" ] || { echo "Missing credentials: $CREDS" >&2; exit 1; }
API_BASE=$(jq -er '.apiBase // .API_BASE' "$CREDS")
KEY=$(jq -er '.apiKey // .KEY' "$CREDS")
[[ "$API_BASE" == https://* ]] || { echo "apiBase must use HTTPS" >&2; exit 1; }
# NOTE: Content-Type is REQUIRED — without it curl sends form-encoded and the API 400s.
# Pass the credential through a private fd; curl's argv contains only /dev/fd, not the key.
auth_curl() { curl -H @<(printf 'Authorization: Bearer %s\n' "$KEY") -H 'Content-Type: application/json' "$@"; }
HERE=$(cd "$(dirname "$0")" && pwd)

# ── discovery: find each service's catalog slug at runtime (the whole point) ──
# The agent doesn't hardcode where a service lives. It searches the Catalog, gets the
# service's slug, and pays the opaque Router broker BY SLUG — the broker resolves the slug
# to the real upstream server-side, so the merchant host is never exposed. A raw-URL payment
# to a cataloged host is refused (409 BCK.ROUTER.0014); raw URL is for off-catalog hosts only.
catalog_slug() {  # $1=search term  $2=expected slug → prints $2 iff the catalog lists it (else empty)
  # Discover-and-verify. Top-1 is NOT a stable identity: the default sort reshuffles every ~6h and
  # `search` is a substring match over title+description, so a bare term can match 2+ services and
  # resolve to a different one each window ('fal' also matches a weather service). Pinning the exact
  # slug keeps a live catalog lookup — proves the service is listed, aborts with a clear message
  # if delisted/renamed — while guaranteeing a real-money run pays the intended vendor.
  # NB: the page-size param is `offset` (items per page, default 20, cap 100) — `limit` is not in the
  # DTO and is silently stripped. Ask for the 100 cap so the exact slug is in the page for a broad term.
  curl -fsS --max-time 20 "$API_BASE/api/v1/catalog/services?search=$(jq -rn --arg t "$1" '$t|@uri')&offset=100" \
    | jq -er --arg s "$2" 'if any(.services[]?.slug; . == $s) then $s else empty end'
}
catalog_path() { # check a fixed POST path is present in the current Catalog detail before spending
  curl -fsS --max-time 20 "$API_BASE/api/v1/catalog/services/$1" \
    | jq -e --arg path "$2" 'any(.endpoints[]?; .path == $path and .method == "POST")' >/dev/null
}

# ── the one primitive the agent uses for every purchase ──────────────────────
# The slug-native invoke surface: POST /api/v1/router/svc/<slug>/<subpath>. The slug lives in the
# URL (no X-Router-Target-Slug needed); the delegation + a per-call idempotency key ride the
# X-Router-* headers. The Router probes the merchant's 402, picks the rail (MPP or x402), settles,
# and returns the RAW upstream body on 2xx (parse .field directly — there is no {paid,body,payment}
# envelope here; settlement is proven by the /router/payments ledger printed at the end).
# The broker withholds the body on any non-2xx, so a failed call is surfaced, never silent.
# X-Router-Request-Id MUST be fresh per call — including per status poll: reusing one returns the
# first cached response forever (documented idempotency), so a naive poller would hang and keep paying.
route_slug_post() {  # $1=slug  $2=subpath  $3=json-body → prints raw upstream JSON body (2xx only)
  local slug="$1" subpath="$2" body="$3" resp code json
  resp=$(auth_curl -sS --max-time 180 -X POST \
    -H "X-Router-Delegation-Id: $DEL_ID" \
    -H "X-Router-Request-Id: song-$(date +%s)-$RANDOM-$RANDOM" \
    -w $'\n%{http_code}' --data "$body" \
    "$API_BASE/api/v1/router/svc/$slug$subpath") || resp=$'\n000'
  code=${resp##*$'\n'}
  [[ "$code" =~ ^2[0-9][0-9]$ ]] || { echo "  ✗ $slug$subpath → HTTP $code (check the ledger before retrying)" >&2; return 1; }
  json=$(jq -c . <<<"${resp%$'\n'*}" 2>/dev/null) || json=''
  [ -n "$json" ] && [ "$json" != null ] || { echo "  ✗ $slug$subpath returned no JSON body" >&2; return 1; }
  printf '%s' "$json"
}

# discover each cataloged service's slug in the Catalog once, up front
echo "▸ Discovering services in the Nevermined Catalog…"
BRAVE=$(catalog_slug brave brave-search-via-mpp) || { echo "Brave unavailable in Catalog" >&2; exit 1; }
SUNO=$(catalog_slug suno suno-mpp)               || { echo "Suno unavailable in Catalog" >&2; exit 1; }
FAL=$(catalog_slug fal fal-ai-mpp)               || { echo "fal.ai unavailable in Catalog" >&2; exit 1; }
TWOS=$(catalog_slug 2s 2s-io)                    || { echo "2s.io unavailable in Catalog" >&2; exit 1; }
# Verify every POST path we intend to pay for BEFORE creating the delegation. A wrong/renamed path
# aborts here for free (no money spent) instead of burning a paid 400 to discover the schema.
catalog_path "$BRAVE" /brave/news-search        && \
catalog_path "$SUNO"  /suno/generate-lyrics      && catalog_path "$SUNO" /suno/get-lyrics-status && \
catalog_path "$SUNO"  /suno/generate-music       && catalog_path "$SUNO" /suno/get-music-status  && \
catalog_path "$FAL"   /fal-ai/flux/dev           && catalog_path "$TWOS" /api/ai/describe-image  || {
  echo "A required POST path is missing from the current Catalog detail; no delegation created" >&2; exit 1; }
echo "  slugs: $BRAVE · $SUNO · $FAL · $TWOS"

# ── capped budget ────────────────────────────────────────────────────────────
# $1.00 hard cap — the real protection. The window is short on purpose: the async Suno polls finish
# in a couple of minutes, and a demo script should never leave a week-long spend authorization open.
# ponytail: 15-min window is plenty for this pipeline; the cap, not the clock, is what bounds spend.
echo "▸ Creating a capped budget (\$1.00 / 15 min)…"
DEL_ID=$(auth_curl -fsS --max-time 30 -X POST "$API_BASE/api/v1/delegation/create" \
  -d '{"provider":"erc4337","currency":"usdc","spendingLimitCents":100,"durationSecs":900,
       "consumerPrompt":"Brake On The Code — song from the headlines","assuranceData":{}}' \
  | jq -er '.id // .delegationId')
OUT="$HERE/out"; mkdir -p "$OUT"; chmod 700 "$OUT"
jq -n --arg id "$DEL_ID" '{delegationId:$id}' > "$OUT/delegation.json"
show_receipt() {
  trap - EXIT
  set +e
  echo; echo "▸ Receipt (also printed after an interrupted paid run):"
  auth_curl -fsS --max-time 20 "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" \
    | jq -r '.[]? | "  \(.protocol|ascii_upcase)\t\(.network)\t$\((.amount|tonumber) / pow(10; .assetDecimals // 6))\t\(.status)\t\(.txHash // "—")"' \
    || echo "  Ledger unavailable; use the delegation ID in private out/delegation.json." >&2
}
trap show_receipt EXIT

# ── 1. Brave — a current headline on the AI-safety "slow down" story  [MPP · Tempo] ──
echo "▸ 1/5  Reading the news (Brave)…"
NEWS=$(route_slug_post "$BRAVE" /brave/news-search \
  "$(jq -n '{q:"AI safety slow down pause", count:8, freshness:"pw"}')")
HEADLINE=$(jq -r '.results[0].title // .data.results[0].title // empty' <<<"$NEWS")
# Guard the seed: a failed Brave call yields "" — don't brief Suno, compose, and paint a cover for
# a non-headline. Abort with the reason instead (the whole demo is seeded by this one call).
[ -n "$HEADLINE" ] && [ "$HEADLINE" != null ] || {
  echo "  ✗ Brave returned no headline (check the Router response and broker support) — aborting"; exit 1; }
FIRST_RESULT_SECS=$(($(date +%s) - RUN_STARTED_AT))
echo "  headline: $HEADLINE"

# ── the ONLY human-authored text: a ≤200-char factual brief (NOT the lyrics) ──
# Suno's generate-lyrics takes a short brief, not the words. We fold the genre + structure and the
# live headline into ≤200 chars and let Suno write every line. (Suno's chars-limit is strict; cut.)
BRIEF=$(printf '%s' "1930s Mississippi delta blues, AAB verses + chorus + bridge, about this news: $HEADLINE" | cut -c1-200)
echo "  brief (${#BRIEF} chars): $BRIEF"

# ── 2. Suno — WRITE THE LYRICS from the brief  [MPP · Tempo] (async) ──────────
# Suno is async: generate-* returns a taskId; poll get-*-status (FRESH request-id each poll) until it
# resolves. callBackUrl is REQUIRED on every generate call even when you intend to poll — pass a
# placeholder. Model must be in the allowed set (V3_5/V4/V4_5/V5/…); "V3_5" is fine here for lyrics.
echo "▸ 2/5  Suno writes the words (generate-lyrics)…"
LJOB=$(route_slug_post "$SUNO" /suno/generate-lyrics \
  "$(jq -n --arg p "$BRIEF" '{prompt:$p, callBackUrl:"https://example.com/callback"}')")
LTASK=$(jq -r '[.. | (.taskId? // .task_id?) // empty] | .[0] // empty' <<<"$LJOB")
[ -n "$LTASK" ] || { echo "  ✗ Suno generate-lyrics returned no taskId" >&2; exit 1; }
LYRICS=""
for i in $(seq 1 8); do
  sleep 8
  LST=$(route_slug_post "$SUNO" /suno/get-lyrics-status "$(jq -n --arg t "$LTASK" '{taskId:$t}')") || {
    echo "  ✗ Suno lyrics-status payment failed; inspect the ledger before retrying" >&2; exit 1; }
  # The finished lyric text is nested (data.response.data[].text on sunoapi.org). Pull the longest
  # non-empty string field that looks like lyrics, regardless of exact nesting.
  LYRICS=$(jq -r '[.. | (.text? // .lyrics? // .prompt?) // empty] | map(select(type=="string" and (length>40))) | .[0] // empty' <<<"$LST" 2>/dev/null) || LYRICS=""
  [ -n "$LYRICS" ] && break
  echo "  …still writing ($i)"
done
[ -n "$LYRICS" ] || { echo "  ✗ Suno did not return lyrics within the poll budget" >&2; exit 1; }
echo "  lyrics: $(head -c 60 <<<"$LYRICS")…"

# ── 3. Suno — turn the words into a full sung song  [MPP · Tempo] (async) ─────
echo "▸ 3/5  Composing the song (Suno generate-music — this takes ~a minute)…"
MJOB=$(route_slug_post "$SUNO" /suno/generate-music "$(jq -n --arg l "$LYRICS" '{
  customMode:true, instrumental:false, model:"V4_5",
  prompt:$l, style:"1930s Mississippi delta blues, acoustic slide guitar, mournful, lo-fi",
  title:"Brake On The Code", callBackUrl:"https://example.com/callback"}')")
MTASK=$(jq -r '[.. | (.taskId? // .task_id?) // empty] | .[0] // empty' <<<"$MJOB")
[ -n "$MTASK" ] || { echo "  ✗ Suno generate-music returned no taskId" >&2; exit 1; }
AUDIO=""
for i in $(seq 1 12); do
  sleep 10
  ST=$(route_slug_post "$SUNO" /suno/get-music-status "$(jq -n --arg t "$MTASK" '{taskId:$t}')") || {
    echo "  ✗ Suno music-status payment failed; inspect the ledger before retrying" >&2; exit 1; }
  AUDIO=$(jq -r '[.. | (.audioUrl? // .audio_url?) // empty] | map(select(type=="string" and (startswith("http")))) | .[0] // empty' <<<"$ST" 2>/dev/null) || AUDIO=""
  [ -n "$AUDIO" ] && break
  echo "  …still rendering ($i)"
done
[ -n "$AUDIO" ] || { echo "  ✗ Suno did not deliver audio within 12 checks; check task and ledger" >&2; exit 1; }
[[ "$AUDIO" == https://* ]] || { echo "  ✗ Suno audio URL is not HTTPS" >&2; exit 1; }
echo "  song: $AUDIO"

# ── 4. fal.ai — album cover  [MPP · Tempo] ───────────────────────────────────
echo "▸ 4/5  Painting the album cover (fal.ai FLUX.1 [dev])…"
COV=$(route_slug_post "$FAL" /fal-ai/flux/dev "$(jq -n --arg h "$HEADLINE" '{
  prompt:("1930s delta-blues album cover, sepia and gold: a silhouetted figure in a cowboy hat playing an acoustic guitar on a wooden porch at sunset, a giant blurred robot looming behind among power lines — Americana meets science fiction. Inspired by: "+$h),
  image_size:"square_hd", num_images:1}')")
COVER=$(jq -r '[.. | .url? // empty] | map(select(type=="string" and (startswith("http")))) | .[0] // empty' <<<"$COV")
[ -n "$COVER" ] || { echo "  ✗ fal.ai returned no cover URL" >&2; exit 1; }
[[ "$COVER" == https://* ]] || { echo "  ✗ fal.ai cover URL is not HTTPS" >&2; exit 1; }
echo "  cover: $COVER"

# ── 5. 2s.io — read the cover back for a caption  [x402 · Base]  (best-effort) ─
# The only step on the other rail (x402 on Base). It's decorative alt-text, not a deliverable, so a
# failure here (2s.io's /api/ai/* backend 5xx'd during the recorded run) never fails the song+cover.
echo "▸ 5/5  Captioning the cover (2s.io describe-image, Claude Haiku)…"
CAPTION=""
if CAP=$(route_slug_post "$TWOS" /api/ai/describe-image "$(jq -n --arg u "$COVER" '{image_url:$u}')" 2>/dev/null); then
  CAPTION=$(jq -r '[.. | (.altText? // .alt_text? // .description? // .caption?) // empty] | map(select(type=="string" and (length>0))) | .[0] // empty' <<<"$CAP" 2>/dev/null) || CAPTION=""
fi
echo "  caption: ${CAPTION:-<unavailable — cover still delivered>}"

# ── download the artifacts ────────────────────────────────────────────────────
curl -fsSL --max-time 180 "$AUDIO" -o "$OUT/song.mp3"
curl -fsSL --max-time 120 "$COVER" -o "$OUT/album-cover.jpg"
[ -s "$OUT/song.mp3" ] && [ -s "$OUT/album-cover.jpg" ] || { echo "  ✗ downloaded artifact is empty" >&2; exit 1; }
[ -n "$CAPTION" ] && printf '%s\n' "$CAPTION" > "$OUT/cover-caption.txt"
printf '%s\n' "$LYRICS" > "$OUT/lyrics.txt"

# ── refuse to claim success without a settled receipt ─────────────────────────
# The svc/ proxy returns raw bodies (no per-call settlement field), so settlement is proven by the
# ledger. The critical path is four merchant charges — Brave, Suno lyrics, Suno music, fal cover;
# require at least that many Settled before we call the run complete.
SETTLED=$(auth_curl -fsS --max-time 20 "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" \
  | jq -r '[.[]? | select(.status=="Settled")] | length')
[ "${SETTLED:-0}" -ge 4 ] || { echo "  ✗ fewer than 4 Settled payments on the receipt — not counting this as a completed run" >&2; exit 1; }

echo "  saved $OUT/song.mp3 and $OUT/album-cover.jpg (lyrics + caption alongside)"
echo "  first delivered result: ${FIRST_RESULT_SECS}s after start"
echo "✔ Done — a delta-blues song (words and all, written by Suno) and a cover from one brief."
echo "  Four vendors, two rails, two chains, zero clicks — and not a lyric written by a human."
