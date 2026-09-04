#!/usr/bin/env bash
# Copy the catalog demo media into the app's public/ dir so the recap panels play.
# The large .mp4s are gitignored (see .gitignore) — run this after a fresh clone.
# ponytail: plain cp from the sibling catalog folders; no manifest to maintain.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
catalog="$here/../catalog"
dest="$here/public/media"

copy() { # src-dir  slug
  local src="$catalog/$2" out="$dest/$2"
  mkdir -p "$out"
  # shellcheck disable=SC2086
  cp -f "$src"/*.mp4 "$src"/*.mp3 "$src"/*.jpg "$src"/*.srt "$out"/ 2>/dev/null || true
  # HTML5 <track> only accepts WebVTT, so derive .vtt from each .srt
  # (WEBVTT header + comma→dot in the timestamps).
  for srt in "$out"/*.srt; do
    [ -e "$srt" ] || continue
    { printf 'WEBVTT\n\n'; sed 's/\r$//; s/\([0-9:][0-9:]*\),\([0-9][0-9][0-9]\)/\1.\2/g' "$srt"; } > "${srt%.srt}.vtt"
  done
  echo "synced $2 → $(ls "$out" | tr '\n' ' ')"
}

if [ ! -d "$catalog" ]; then
  echo "catalog/ not found at $catalog — run from the showcase app inside the tutorials repo." >&2
  exit 1
fi

copy catalog song-from-the-headlines
copy catalog diligence-in-a-box
echo "done."
