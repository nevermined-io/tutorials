# Competitive product teardown

This one-off sample helps a product-marketing or strategy builder compare a public product page with rival search evidence and write a reviewable positioning hypothesis. It accepts a safe public HTTPS company URL and a rival product query. It produces redacted, sourced Markdown and JSON. It does **not** monitor pages over time, score leads, or make investment claims.

**Status: a bounded three-service Live repeat completed on 2026-09-15; publication is pending.** Separate small paid probes confirmed all three payable wrappers. The first complete-chain attempt settled all three merchants but DeepSeek returned no final text at a 250-token limit, so no artifact was counted. A new 25¢ capped run with a shorter prompt and 1024-token limit delivered the [redacted Markdown teardown](sample/teardown.md) and [JSON teardown](sample/teardown.json). It recorded **$0.069** in merchant-plus-buyer-fee charges, consumed **8¢** of cap, and delivered its first result in **14.44 seconds**. The immediate buyer-fee states were `Submitted`; a later Router audit found all three `Settled`. [`wrapper-contract.json`](wrapper-contract.json), [BUILD_LOG.md](BUILD_LOG.md), and [FRICTION.md](FRICTION.md) record the path from probe to repeat. The sample files are local until this folder is published.

A later local full run delivered its first result in **13.48 seconds** and again recorded **$0.069**. Its Brave buyer-fee status was `Submitted` at receipt time; a read-only ledger reconciliation found all three buyer-fee records **Settled**. The new generated teardown stays in ignored `out/`; the linked sample is from the earlier run.

## Try the synthetic deliverable

```sh
python3 run.py
cat out/teardown.md
```

Python 3.11+ and the standard library suffice. The fixture uses `example.invalid` URLs and clearly labels its content synthetic. `out/teardown.json` and `out/teardown.md` contain no paid spend or real market claims.

## Service discovery and schema decisions

All three listed services were operational on the live `.app` Catalog on 2026-09-15:

| Step | Catalog slug and POST path | Catalog price label | Input/response basis |
| --- | --- | --- | --- |
| Rival research | [`brave-search-via-mpp`](https://api.live.nevermined.app/api/v1/catalog/services/brave-search-via-mpp), `/brave/web-search` | $0.035 per search | [Brave's official POST reference](https://api-dashboard.search.brave.com/api-reference/web/search/post) uses JSON `q`, `country`, `search_lang`, `count`. Bounded paid smoke returned Router `body.data.web.results` with title, URL, description. |
| Company-page extraction | [`serper-scrape`](https://api.live.nevermined.app/api/v1/catalog/services/serper-scrape), root `/` | $0.02 per scrape | [Serper Scrape OpenAPI](https://mpp.orthogonal.com/serper-scrape/openapi.json) confirms POST `/` but omits request/response schemas. Bounded paid smoke with `{"url":"https://..."}` returned `body.text`, `body.metadata`, and `body.credits`; there was **no** `markdown` field. |
| Optional model draft | [`deepseek`](https://api.live.nevermined.app/api/v1/catalog/services/deepseek), `/deepseek/chat` | Dynamic; no Catalog endpoint price | [Locus's payable DeepSeek skill](https://paywithlocus.com/mpp/deepseek.md) gives `model:deepseek-v4-flash`, user messages, bounded `max_tokens`, and `stream:false`. Bounded paid smoke returned `body.data.choices[0].message.content`. [Current vendor pricing](https://api-docs.deepseek.com/quick_start/pricing/) varies by tokens and time. |

The two-call smoke observed Brave merchant $0.035 and Serper merchant $0.020, plus a **1-cent Serper buyer fee**: $0.065 recorded in total, rounded to 7 spent cents by the delegation. A tiny separate DeepSeek smoke observed $0.004 merchant and zero fee cents. Both full three-call attempts recorded Brave $0.035, Serper $0.020 plus a 1-cent fee, and DeepSeek $0.004: **$0.069** total, with **8¢** cap consumed. Only the second produced the deliverable. The script reserves a *planning* $0.10 for optional DeepSeek, then applies 20% fee headroom. These observations are not a guaranteed quote for future prompts. The Router receives the live 402 quote inside its server-side relay; a client cannot reject a higher quote before signing. The 25-cent delegation cap is the payment guard.

## Prepare a bounded live run

1. Use Nevermined Commerce MCP `search_services` and `get_service` to re-discover the slugs, paths, protocol, and health. The code repeats the public Catalog checks before spending.
2. Review the three bounded wrapper observations in `wrapper-contract.json` and repeat a small smoke if a deployment or endpoint has changed. The runner's `--smoke-service brave|serper|deepseek` mode makes only one selected paid call under a fresh 10-cent/10-minute delegation and prints **field names/types**, not raw vendor content. Give it `--live`, `--run-id`, `--company-url`, and `--rival-query`. A full run uses the confirmed contract for its selected services.
3. Use a current plain Nevermined v2 API key on the intended live deployment. Confirm legal-document consent is current and the buyer wallet holds an accepted Tempo USD-like settlement asset. The script's full live path calls `POST /api/v1/delegation/create` with `provider=erc4337`, `spendingLimitCents=25`, `durationSecs=600`, `currency=usdc`, and `maxTransactions=3`. A live readback may omit `maxTransactions`, so the code itself caps the full run at two or three selected calls and checks `amountSpentCents` and `remainingBudgetCents` after every purchase. It does not reuse a broader delegation.
4. After the wrapper contract is confirmed, run one intended purchase:

```sh
# Create the private ~/.nvm-router-buyer.json file shown in the SEC tutorial first.
# Default is https://api.live.nevermined.app.
# Use NVM_API_BASE=https://api.live.nevermined.dev only with a .dev staging-live key/wallet.
python3 run.py --live --run-id 'firefox-vs-brave-new-capped-run-id' \
  --company-url 'https://www.mozilla.org/en-US/firefox/' \
  --rival-query 'Brave browser privacy features' --with-llm
```

Omit `--with-llm` for a two-service, deterministic sourced comparison. The completed representative example uses DeepSeek: its prompt sends only a short redacted company excerpt and one rival snippet, asks for two sentences, and sets `max_tokens=1024` so the model can finish reasoning and produce final content. Future token authorization may cost more; each genuinely new attempt gets a **new capped delegation and new run ID**. The model draft remains labeled unverified in the artifact.

The script makes POSTs to `/api/v1/router/route` using `slug` and `path` for Brave, Serper, and optional DeepSeek. The request carries the new delegation ID and a stable `requestId` derived from `--run-id` and service. The Router envelope does not echo the delegation ID; the runner saves it in a private `out/private-*.json` run-state file before paying. Use a new run ID only for a genuinely new purchase. A 409, timeout, missing payment ID, empty response, or unexpected body shape stops the run. Inspect `GET /api/v1/router/payments?delegationId=...` before any retry. Never change the request ID to evade a duplicate.

The script requires a Router `paid:true` envelope with a delivered nonempty body and payment ID/status, then a ledger **merchant payment Settled**. It polls a submitted buyer fee briefly; if it remains submitted, the artifact records that fee as pending and includes its cents in the recorded charge without claiming fee terminal. It calculates USD-like charge from atomic merchant amount, asset decimals, and fee cents after each call, then checks the delegation's remaining budget. The artifact receives `verified_paid_run=true` only after all selected merchant calls have delivered bodies and settled. Source URLs are normalized to HTTPS and stripped of queries; excerpts are truncated and redacted for email addresses, phone numbers, and credential-like strings.

The runner saves each raw Router envelope and any HTTP error body in private `out/private-*-router.json` files with mode 0600; `out/` is ignored by Git. These diagnostic files can contain vendor content and must stay private. It stores the delegation ID in a private run-state file before buying, then adds the first valid Brave result's UTC timestamp and elapsed seconds, so a later paid failure does not erase time-to-first-result evidence. A successful public artifact includes timing without private identifiers or responses. If DeepSeek returns empty `choices[0].message.content`, the runner reports `finish_reason` and `usage` from the paid response and stops; do not retry with a fresh request ID merely to fill the missing text.

The `.app` production-live and `.dev` staging-live APIs are separate account backends. A key/wallet from one cannot be used on the other. The script accepts only those two exact API origins.

See [FRICTION.md](FRICTION.md) for the still-missing public payable schemas, dynamic AI price, quote handling, and the resolved empty model-content failure. The representative sample files have been scanned for the buyer key, emails, payment IDs, and raw HTML tags; all six source URLs returned 200 without authentication. The folder has not yet been published to stable public URLs.
