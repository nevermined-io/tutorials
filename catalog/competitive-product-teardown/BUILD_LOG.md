# Build log

## Scope and service selection

The one-off Firefox-versus-Brave product teardown uses three independent Catalog services: Brave web search for rival sources, Serper Scrape for Firefox's current product copy, and DeepSeek for a short, explicitly tentative positioning hypothesis. It produces sourced Markdown and JSON, unlike the curated daily competitor-watch diff. Current `.app` Catalog listings confirmed POST `/brave/web-search`, Serper root `/`, and POST `/deepseek/chat` as operational on 2026-09-15. The hosted Catalog MCP `search_services`/`get_service` can discover those listings, but Catalog detail lacks typed payable request/response bodies.

## Bounded wrapper probes and first full attempt

Under separate 10¢ / 10-minute delegations, the coordinator observed Brave `{q,count}` → `body.data.web.results`, Serper `{url}` → `body.text`/`metadata`, and DeepSeek's payable `deepseek-v4-flash` chat → `body.data.choices`. Brave charged $0.035, Serper $0.020 plus a 1¢ buyer fee, and a tiny DeepSeek probe $0.004. The Brave+Serper probe consumed 7¢ of a 10¢ cap against $0.065 recorded merchant-plus-fee charges. The public Serper OpenAPI confirms only POST `/`, so the paid probe was necessary to verify its body.

The first complete three-call run used a 25¢ / 10-minute delegation, settled all merchants, and consumed 8¢ of cap. Its charges were Brave $0.035, Serper $0.020 plus 1¢ buyer fee, and DeepSeek $0.004, or $0.069 recorded. DeepSeek returned no final `message.content` after a longer evidence prompt with `max_tokens=250`; the runner stopped and wrote no completed teardown. The prompt was shortened to roughly 600 redacted characters, `max_tokens` raised to 1024, and private Router envelopes retained on failure. No automatic fourth paid retry was made.

## Successful full repeat and artifact review

A fresh 25¢ / 10-minute delegation repeated all three steps with the shorter prompt. All three merchant payments were `Settled`, and delivered bodies passed the measured wrapper checks. Brave's first successful result arrived in **14.44 seconds**. Charges again totaled **$0.069**: Brave $0.035, Serper $0.020 merchant plus 1¢ buyer fee, and DeepSeek $0.004. The delegation consumed **8¢** and retained **17¢** of cap. The 1¢ Serper buyer fee and zero-cent fee records still showed `Submitted` immediately after the run; the example records that state without claiming terminal buyer-fee settlement.

The runner generated [redacted Markdown](sample/teardown.md) and [JSON](sample/teardown.json) from the paid responses. Both name the public Firefox source, cite five Brave search results, include bounded excerpts and a review action, mark model text as a hypothesis, and distinguish the $0.069 charge from the 8¢ cap consumption. The builder stripped HTML tags/entities from Brave snippets before writing these representative files. The sample contains no buyer key, email address, payment ID, or raw HTML tags; all six cited HTTPS URLs returned unauthenticated HTTP 200 on 2026-09-15. A later read-only Router audit found all three buyer-fee statuses `Settled`; the sample retains the immediate `Submitted` state to show what the runner saw before reconciliation. Private raw Router responses remain ignored in `out/` and are never part of the sample.

The sample folder and code are prepared locally; their GitHub URLs must be checked after publication before the Catalog outcome links are released. Prices, ranking, page copy, model output, buyer fees, and timing can change on another run.
