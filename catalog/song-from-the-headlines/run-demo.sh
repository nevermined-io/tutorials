#!/usr/bin/env bash
# Song From the Headlines — a Nevermined Catalog demo.
# One agent, one payment primitive, four vendors, two rails, two chains. Real money on Live.
#
# Prereqs: ~/.nvm-router-buyer.json = { "apiBase": "...", "apiKey": "live:..." }
# Run:     ./run-demo.sh
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

# ── the one primitive the agent uses for every purchase ─────────────────────
route() {  # $1=url  $2=json-body
  local payload
  payload=$(jq -n --arg d "$DEL_ID" --arg u "$1" --arg r "song-$(date +%s)-$RANDOM" --argjson b "$2" \
    '{delegationId:$d,url:$u,method:"POST",requestId:$r,body:$b}')
  curl -s --max-time 120 "${AUTH[@]}" -X POST "$API_BASE/api/v1/router/route" -d "$payload"
}

# ── 1. Brave — today's #1 tech headline  [MPP · Tempo] ──────────────────────
echo "▸ 1/4  Finding today's top tech headline (Brave)…"
NEWS=$(route "https://brave.mpp.paywithlocus.com/brave/news-search" \
  '{"q":"technology","count":5,"freshness":"pd"}')
HEADLINE=$(jq -r '.body.data.results[0].title // .body.results[0].title' <<<"$NEWS")
echo "  headline: $HEADLINE"

# ── 2. 2s.io — 90s-pop lyrics  [x402 · Base] ────────────────────────────────
# 2s.io is OpenAI-compatible. Two gotchas: pick a model from GET /api/ai/models
# (gpt-4o-mini is NOT valid), and do NOT send a system role — fold it into the user message.
echo "▸ 2/4  Writing 90s-pop lyrics (2s.io)…"
LYR=$(route "https://2s.io/api/ai/chat" "$(jq -n --arg h "$HEADLINE" '{
  model:"google/gemini-2.5-flash-lite", max_tokens:400,
  messages:[{role:"user",content:("You are a 90s pop songwriter. Output only lyrics. Write an upbeat 90s pop anthem about: "+$h)}]}')")
LYRICS=$(jq -r '.body.choices[0].message.content' <<<"$LYR")
echo "  lyrics: $(head -c 60 <<<"$LYRICS")…"

# ── 3. Suno — full song from the lyrics  [MPP · Tempo] (async) ──────────────
# Suno needs customMode + instrumental + model; taskId comes back nested.
echo "▸ 3/4  Composing the song (Suno — this takes ~a minute)…"
JOB=$(route "https://suno.mpp.paywithlocus.com/suno/generate-music" "$(jq -n --arg l "$LYRICS" '{
  customMode:true, instrumental:false, model:"V5",
  prompt:$l, style:"90s pop anthem", title:"Song From the Headlines"}')")
TASK=$(jq -r '.body.data.data.taskId // .body.data.taskId // .body.taskId' <<<"$JOB")
AUDIO=""
for i in $(seq 1 30); do
  sleep 10
  ST=$(route "https://suno.mpp.paywithlocus.com/suno/get-music-status" "$(jq -n --arg t "$TASK" '{taskId:$t}')")
  AUDIO=$(jq -r '[.. | .audioUrl? // .audio_url? // empty] | map(select(. != "")) | .[0] // empty' <<<"$ST")
  [ -n "$AUDIO" ] && break
  echo "  …still rendering ($i)"
done
echo "  song: ${AUDIO:-<not ready>}"

# ── 4. fal.ai — album cover  [MPP · Tempo] ──────────────────────────────────
echo "▸ 4/4  Painting the album cover (fal.ai FLUX)…"
COV=$(route "https://fal.mpp.tempo.xyz/fal-ai/flux/schnell" "$(jq -n --arg h "$HEADLINE" '{
  prompt:("90s pop album cover art about: "+$h), image_size:"square_hd", num_images:1}')")
COVER=$(jq -r '.body.images[0].url' <<<"$COV")
echo "  cover: $COVER"

# ── download the artifacts ──────────────────────────────────────────────────
[ -n "$AUDIO" ] && curl -sL "$AUDIO" -o "$HERE/song.mp3" && echo "  saved song.mp3"
[ -n "$COVER" ] && curl -sL "$COVER" -o "$HERE/album-cover.jpg" && echo "  saved album-cover.jpg"

# ── the receipt: one budget, four vendors, two rails, two chains ────────────
echo; echo "▸ Receipt:"
curl -s "${AUTH[@]}" "$API_BASE/api/v1/router/payments?delegationId=$DEL_ID" \
  | jq -r '.[] | "  \(.protocol|ascii_upcase)\t\(.network)\t$\(.amount)\t\(.status)\t\(.txHash)"'
echo
echo "✔ Done — a song and a cover from one prompt. Four vendors, two rails, two chains, zero clicks."
