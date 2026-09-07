#!/usr/bin/env bash
# Song From the Headlines — a Nevermined Catalog demo.
# One agent, one payment primitive, four vendors, two rails, two chains. Real money on Live.
#
# Prereqs: ~/.nvm-router-buyer.json = { "apiBase": "...", "apiKey": "live:..." }
# Run:     ./run-demo.sh
#
# ⚠ REQUIRES THE OPAQUE ROUTER BROKER (nvm-monorepo #3304). This demo pays cataloged services
#   BY SLUG — via the {slug,path} body route and the /api/v1/router/svc/<slug> invoke surface.
#   That mechanism is merged to `main` but NOT yet in a release tag (latest v1.31.0), so it is not
#   on prod/staging as of 2026-09. Run against a BROKER-ENABLED API. Against a pre-broker API the
#   `slug`/`path` fields are stripped (server whitelist) and /svc 404s, so purchases won't settle
#   (only the off-catalog 2s.io raw-URL call would). This is intentional per issue #70 — landing the
#   demo so it is correct the day the broker ships.
set -euo pipefail

# ── credentials (never put the key on the command line) ─────────────────────
CREDS=~/.nvm-router-buyer.json
API_BASE=$(jq -r '.apiBase // .API_BASE' "$CREDS")
KEY=$(jq -r '.apiKey // .KEY' "$CREDS")
# NOTE: Content-Type is REQUIRED — without it curl sends form-encoded and the API 400s.
AUTH=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json")
HERE=$(cd "$(dirname "$0")" && pwd)

# ── the budget: one capped, short-lived delegation (like a prepaid card) ─────
echo "▸ Creating a capped budget (50¢ / 10 min)…"
DEL_ID=$(curl -s "${AUTH[@]}" -X POST "$API_BASE/api/v1/delegation/create" \
  -d '{"provider":"erc4337","currency":"usdc","spendingLimitCents":50,"durationSecs":600,
       "consumerPrompt":"Song from the headlines","assuranceData":{}}' \
  | jq -r '.id // .delegationId')
echo "  budget id: $DEL_ID"

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
  curl -s "$API_BASE/api/v1/catalog/services?search=$(jq -rn --arg t "$1" '$t|@uri')&offset=100" \
    | jq -r --arg s "$2" 'if any(.services[]?.slug; . == $s) then $s else empty end'
}

# ── the one primitive the agent uses for every purchase ─────────────────────
# It hands the Router a slug (cataloged) or a url (off-catalog); the Router probes the
# merchant's 402, picks the rail (MPP or x402), and settles. requestId must be unique per call.
_pay() {  # $1=target-json ({slug,path} | {url})  $2=json-body → prints the JSON result envelope
  local payload resp code
  # requestId must be unique per call (Router idempotency key). date+%s%N is GNU-only; two $RANDOM
  # keep it unique-per-call and portable (macOS `date` has no %N).
  payload=$(jq -n --arg d "$DEL_ID" --arg r "song-$(date +%s)-$RANDOM-$RANDOM" --argjson t "$1" --argjson b "$2" \
    '{delegationId:$d,method:"POST",requestId:$r,body:$b}+$t')
  resp=$(curl -s --max-time 120 "${AUTH[@]}" -w $'\n%{http_code}' -X POST "$API_BASE/api/v1/router/route" -d "$payload") || resp=$'\n000'
  code=${resp##*$'\n'}
  # A settled purchase is 2xx; a 402/409/5xx (or transport 000) means it did NOT settle — surface it
  # so a failed payment never reads as a silent result. The receipt is the durable record.
  { [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; } 2>/dev/null \
    || echo "  ⚠ router/route → HTTP ${code:-?} (payment not settled; see the receipt)" >&2
  printf '%s' "${resp%$'\n'*}"
}
route_slug() {  # $1=slug  $2=subpath ('' = none)  $3=json-body
  local t; t=$(jq -n --arg s "$1" '{slug:$s}')
  [ -n "$2" ] && t=$(jq --arg p "$2" '.+{path:$p}' <<<"$t")
  _pay "$t" "$3"
}
route_url() {   # $1=url  $2=json-body  — OFF-CATALOG hosts only
  _pay "$(jq -n --arg u "$1" '{url:$u}')" "$2"
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
: "${BRAVE:?brave not found in catalog}" "${SUNO:?suno not found}" "${FAL:?fal not found}"
echo "  slugs: $BRAVE · $SUNO · $FAL   (2s.io is off-catalog → paid by raw URL)"

# ── 1. Brave — today's #1 tech headline  [MPP · Tempo] ──────────────────────
echo "▸ 1/4  Finding today's top tech headline (Brave)…"
NEWS=$(route_slug "$BRAVE" "/brave/news-search" \
  '{"q":"technology","count":5,"freshness":"pd"}')
HEADLINE=$(jq -r '.body.data.results[0].title // .body.results[0].title // empty' <<<"$NEWS")
# Guard the seed: a failed Brave call yields "" / "null" — don't pay 2s.io, Suno and fal to
# process a non-headline. Abort with the reason instead (the whole demo is seeded by this).
[ -n "$HEADLINE" ] && [ "$HEADLINE" != null ] || {
  echo "  ✗ Brave returned no headline (broker not enabled? see the prerequisite note) — aborting"; exit 1; }
echo "  headline: $HEADLINE"

# ── 2. 2s.io — 90s-pop lyrics  [x402 · Base] ────────────────────────────────
# 2s.io is OFF-CATALOG (not listed in the Nevermined Catalog) and on its own distinct host,
# so it is paid by raw URL — no slug, and no BCK.ROUTER.0014 (that refusal is host-scoped to
# cataloged services only). 2s.io is OpenAI-compatible. Two gotchas: pick a model from
# GET /api/ai/models (gpt-4o-mini is NOT valid), and do NOT send a system role — fold it in.
echo "▸ 2/4  Writing 90s-pop lyrics (2s.io)…"
LYR=$(route_url "https://2s.io/api/ai/chat" "$(jq -n --arg h "$HEADLINE" '{
  model:"google/gemini-2.5-flash-lite", max_tokens:400,
  messages:[{role:"user",content:("You are a 90s pop songwriter. Output only lyrics. Write an upbeat 90s pop anthem about: "+$h)}]}')")
LYRICS=$(jq -r '.body.choices[0].message.content // empty' <<<"$LYR")
[ -n "$LYRICS" ] && [ "$LYRICS" != null ] || { echo "  ✗ 2s.io returned no lyrics — skipping the song (the cover still runs from the headline)"; LYRICS=""; }
echo "  lyrics: $(head -c 60 <<<"$LYRICS")…"

# ── 3. Suno — full song from the lyrics  [MPP · Tempo] (async) ──────────────
# Suno needs customMode + instrumental + model; taskId comes back nested.
echo "▸ 3/4  Composing the song (Suno — this takes ~a minute)…"
AUDIO=""
if [ -z "$LYRICS" ]; then
  echo "  (skipped — no lyrics to compose)"     # never pay Suno for empty lyrics
else
JOB=$(route_slug "$SUNO" "/suno/generate-music" "$(jq -n --arg l "$LYRICS" '{
  customMode:true, instrumental:false, model:"V5",
  prompt:$l, style:"90s pop anthem", title:"Song From the Headlines"}')")
TASK=$(jq -r '.body.data.data.taskId // .body.data.taskId // .body.taskId // empty' <<<"$JOB")
for i in $(seq 1 30); do
  [ -n "$TASK" ] || { echo "  (no taskId — Suno did not settle)"; break; }
  sleep 10
  # KNOWN LIMITATION — the free status poll bypasses the Router (direct curl), exactly like the
  # OneShot poll in ../diligence-in-a-box. A free follow-up to a cataloged service can't go through
  # the broker: by slug it returns body:null (Phase-2 anti-oracle), and by raw URL it's a payment to a
  # cataloged host → 409 BCK.ROUTER.0014 (so the old route_url poll 409'd every iteration and the song
  # never rendered). In the fully-opaque broker world the demo won't know this host — an authorized
  # free-follow-up mechanism is the real fix (pending nvm-monorepo follow-up).
  # `|| ST=""` so a status-endpoint timeout/error (curl non-zero) can't abort the run under set -e
  # AFTER Suno has already been paid — keep polling / fall through to "<not ready>".
  ST=$(curl -s --max-time 60 -H "Content-Type: application/json" \
       -d "$(jq -n --arg t "$TASK" '{taskId:$t}')" \
       "https://suno.mpp.paywithlocus.com/suno/get-music-status") || ST=""
  AUDIO=$(jq -r '[.. | .audioUrl? // .audio_url? // empty] | map(select(. != "")) | .[0] // empty' <<<"$ST" 2>/dev/null) || AUDIO=""
  [ -n "$AUDIO" ] && break
  echo "  …still rendering ($i)"
done
fi  # end: compose only when there are lyrics
echo "  song: ${AUDIO:-<not ready>}"

# ── 4. fal.ai — album cover  [MPP · Tempo] ──────────────────────────────────
echo "▸ 4/4  Painting the album cover (fal.ai FLUX)…"
COV=$(route_slug "$FAL" "/fal-ai/flux/schnell" "$(jq -n --arg h "$HEADLINE" '{
  prompt:("90s pop album cover art about: "+$h), image_size:"square_hd", num_images:1}')")
COVER=$(jq -r '.body.images[0].url // empty' <<<"$COV")
echo "  cover: ${COVER:-<not ready>}"

# ── download the artifacts ──────────────────────────────────────────────────
[ -n "$AUDIO" ] && curl -sL "$AUDIO" -o "$HERE/song.mp3" && echo "  saved song.mp3"
[ -n "$COVER" ] && curl -sL "$COVER" -o "$HERE/album-cover.jpg" && echo "  saved album-cover.jpg"

# ── the receipt: one budget, four vendors, two rails, two chains ────────────
echo; echo "▸ Receipt:"
curl -s "${AUTH[@]}" "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" \
  | jq -r '.[] | "  \(.protocol|ascii_upcase)\t\(.network)\t$\(.amount)\t\(.status)\t\(.txHash)"'
echo
echo "✔ Done — a song and a cover from one prompt. Four vendors, two rails, two chains, zero clicks."
