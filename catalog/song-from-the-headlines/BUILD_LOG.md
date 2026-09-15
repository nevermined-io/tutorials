# Build log

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
