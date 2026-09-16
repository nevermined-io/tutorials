# Build log

## 2026-09-16 delta-blues take — *Brake On The Code* (lyrics written by an AI)

A fresh Live run replacing this tutorial's take: a 1930s delta blues about the September 2026 story of the biggest AI "frontier" labs jointly calling to slow down development. The defining change from earlier runs is that **the operator wrote no lyrics** — a ≤200-character factual brief went to Suno's `generate-lyrics`, and Suno wrote every verse, the chorus, and the bridge. Every creative element (words, song, cover, caption) was produced by an AI service and paid for autonomously through the Router slug-invoke surface (`/api/v1/router/svc/<slug>/<subpath>`) under one **$1.00** erc4337 delegation.

| Purchase | Rail / chain | Settled |
|---|---|---:|
| Brave — news search (AI-slowdown story) | MPP / Tempo | $0.035 |
| Suno — generate-lyrics + 1 status | MPP / Tempo | $0.030 |
| Suno — generate-music (two takes, V4.5) + 4 status | MPP / Tempo | $0.125 |
| fal.ai — FLUX.1 [dev] album cover, 1024² | MPP / Tempo | $0.025 |
| 2s.io — describe-image cover caption (Claude Haiku) | x402 / Base | $0.045 |
| **Merchant total** | **2 rails · 2 chains** | **$0.260** |

One earlier call is not in the total: an attempt to have `2s-io`'s `/api/ai/chat` auto-write the brief hit a backend **502** and was abandoned for ~$0.015, recorded on the ledger as `Issued` (not settled) — the operator then supplied the brief by hand. Counting the merchant settlements, the failed retry, and routing, the delegation read back **$0.36 drawn of the $1.00 cap — $0.64 remaining**. All creative calls settled on-chain (Tempo USDC.e for the MPP legs, Base USDC for the x402 caption); public transaction hashes are listed in `README.md` and shown on `index.html` (like any on-chain payment, those hashes identify the settling wallet). This log itself records observed amounts and outcome only — no delegation ID, credential, merchant response body, or artifact URL is committed. The generated media (`song.mp3` / `song-take2.mp3` / `album-cover.jpg` / `lyrics.txt`) is checked in as the tutorial's representative sample; the walkthrough video for this take is a follow-up (see `README.md`).

## 2026-09-15 bounded Live repeat

The corrected script completed under its 50¢ / 10-minute delegation cap. It resolved four Catalog slugs, used the Router for every paid call, and returned a playable audio URL and cover. New artifacts were saved in ignored `out/`; the checked-in September 2 examples were not replaced. No artifact was published.

| Purchase | Settled amount |
|---|---:|
| Brave headline search | $0.035 |
| 2s.io lyrics | $0.0025 |
| Suno generation | $0.105 |
| Suno status: 5 × $0.005 | $0.025 |
| fal.ai cover | $0.003 |
| **Total: 9 settled payments** | **$0.1705** |

The receipt spans two payment rails and two chains. The script formerly printed Router `amount` atomic units after a dollar sign; it now divides by 1,000,000 for USD display. The delegation readback showed **22¢ cap consumed and 28¢ remaining** after the $0.1705 merchant charges, because each call rounds up against the cap. This log records the observed run amounts and outcome, without exposing the delegation, credential, merchant responses, or artifact URLs.

The runner did not timestamp each delivery in this repeat, so an exact time to first successful result is unavailable. The first headline and lyrics had both arrived within the first 30-second terminal wait; Suno produced an audio URL after five paid status checks. The runner now prints seconds from start to the first delivered headline for future repeats.

## 2026-09-15 repeat after receipt and timing fixes

The same four slugs completed another capped Live run. The runner delivered the first headline in **8 seconds**, then generated audio and a cover saved in ignored `out/`. All **seven** purchases were `Settled`: Brave $0.035, 2s.io $0.0025, Suno generation $0.105, three Suno status checks × $0.005 = $0.015, and fal.ai $0.003. Merchant charges totaled **$0.1605**; the 50¢ delegation readback showed **20¢ cap consumed and 30¢ remaining**. Buyer fee cents were zero and fee statuses had Settled when audited. The receipt now printed merchant amounts in dollars; no tracked media was overwritten. Status polling caused the difference from the earlier $0.1705 run. The new files have not been published or independently content-reviewed.

The follow-up inspection confirmed `out/song.mp3` is a **3.64 MB MPEG Layer III** file and `out/album-cover.jpg` is a **1024×1024 JPEG** of **1.27 MB**. Both stay in ignored `out/`; the links in the tutorial index still point to the earlier public reference media.
