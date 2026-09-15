# Build log: Apple SEC earnings evidence pack

The sample in [`sample/evidence.md`](sample/evidence.md) and [`sample/evidence.json`](sample/evidence.json) came from a completed Production Live run on 2026-09-15. It is an evidence pack for public data about Apple (`CIK 320193`, `AAPL`), not an investment conclusion. The private `out/` folder holds raw Router requests, responses and receipts; only selected public facts and cost totals appear in the sample.

## Selection and setup

The audience is a developer building a financial-data tool. The input is a public-company CIK, ticker and search keyword. The useful output is a structured pack that lets another developer trace a filing date/accession, XBRL values, EDGAR full-text coverage and secondary earnings figures back to sources. The existing Catalog outcomes already cover company one-pagers and crypto movers; this one focuses on SEC and earnings evidence.

The current live Catalog and hosted Commerce MCP both listed `edgar-sec-mpp`, `edgar-search` and `alpha-vantage-mpp` as operational MPP services on Tempo. I connected to `https://mcp.live.nevermined.app/mcp` with a Live buyer key, completed MCP initialize, called `search_services` and `get_service` for the three slugs, and confirmed methods and paths. The runnable shell script also verifies the slugs through the public Catalog API before paying. MCP `get_service` did not contain request/response schemas, so the EDGAR and Alpha Vantage bodies came from provider documentation and the EDGAR search `{q}` body from an earlier working demo.

The originally considered Alpha Vantage earnings-call transcript was replaced with `/alphavantage/earnings` and `/alphavantage/income-statement`. Those typed numeric responses can be compared with SEC XBRL facts; transcript coverage and wrapper shape were not validated. The runner creates one `erc4337` USDC delegation capped at 10¢ for ten minutes, uses one stable request ID per named purchase, and checks the Router payment ledger and remaining delegation budget after each delivered call.

## What happened

The first pass paid for EDGAR submissions and company facts, then received upstream 404 on `edgar-search` with the Catalog-advertised `/edgar-search/search` appended to its slug base. That 404 returned `paid:false` and made no search payment. The merchant base already included the path. I changed the script to route the slug base, reused the original request ID, and received a 200 body with one Settled search payment. The same delegation then bought the Alpha Vantage earnings and income responses and generated the pack. This recovery pass spent $0.040 in merchant charges.

After that fix, a complete fresh run of `./run-demo.sh` passed all five purchases without manual steps. I repeated once with timing and cost fields instrumented; the public sample is from that final full run. Every call returned a delivered 200 upstream body, `paid:true`, and a Settled MPP/Tempo merchant payment. The five responses used the `body.data` wrapper, which the pack builder now records. No service was substituted during the final run.

| Paid leg | Actual merchant charge | Final result |
| --- | ---: | --- |
| EDGAR submissions | $0.008 | Settled; latest 10-Q accession/date available |
| EDGAR company facts | $0.008 | Settled; XBRL revenue and net-income facts available |
| EDGAR full-text search | $0.008 | Settled; keyword hit count available |
| Alpha Vantage earnings | $0.008 | Settled; quarterly EPS available |
| Alpha Vantage income statement | $0.008 | Settled; quarterly income fields available |
| **Merchant total for the representative run** | **$0.040** | **5/5 delivered** |

The representative run used 5¢ of its 10¢ delegation cap, with 5¢ remaining. Each $0.008 purchase consumed a whole cent of delegation budget even though merchant charges summed to four cents; `feeCents` was zero on all five records. The immediate merchant records were Settled; the fee-status field still read `Submitted` at receipt time, so do not infer an additional settled fee from it. Time from runner start to its first successful delivered call was **8 seconds**; the full runner and pack build took **35 seconds**. Across the aborted/recovered pass and the two full validation passes, this preparation made fifteen settled payments and $0.120 in merchant charges. The public example describes one representative five-payment run.

## Reproduce and inspect

Follow [README.md](README.md) and run `CIK=320193 SYMBOL=AAPL COMPANY=Apple ./run-demo.sh` with a funded Live buyer. It saves raw receipts privately to `out/`, builds `out/evidence.json` and `out/evidence.md`, and records observed merchant spend, delegation consumption and timing. Check `out/payments.json` and `out/budget-summary.json` before sharing; compare the public facts to the SEC source URLs in the pack. Unknown body mappings and missing values remain unavailable rather than becoming invented facts.

The repeat verified the script's EDGAR path correction. Larger Catalog gaps, with reproduction and acceptance checks, are in [FRICTION.md](FRICTION.md). The public sample contains no API key, delegation ID, request ID, buyer wallet, personal contact field or raw merchant payload.
