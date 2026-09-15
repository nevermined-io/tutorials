# SEC earnings evidence pack: AAPL

Company keyword: Apple; CIK: 320193. Raw paid responses remain private in `out/`.

Observed merchant spend: 0.040 USD; delegation cap consumed: 5¢.

Public sources: [SEC submissions](https://data.sec.gov/submissions/CIK0000320193.json), [SEC company facts](https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json), [EDGAR search service](https://nevermined.app/catalog/edgar-search), [Alpha Vantage service](https://nevermined.app/catalog/alpha-vantage-mpp).

| Evidence | Value | Paid response |
|---|---|---|
| Latest 10-K/10-Q | 10-Q filed 2026-07-31 accession 0000320193-26-000020 | `submissions.router.json` |
| Revenue XBRL | 109417000000 USD; period 2026-03-29 to 2026-06-27; filed 2026-07-31 | `facts.router.json` |
| Net income XBRL | 29789000000 USD; period 2026-03-29 to 2026-06-27; filed 2026-07-31 | `facts.router.json` |
| EDGAR keyword hits | at least 10000 | `search.router.json` |
| Quarterly reported EPS | 2.02 for 2026-06-30 | `earnings.router.json` |
| Quarterly total revenue | 109417000000 for 2026-06-30 | `income.router.json` |

## Mapping and limits

- `submissions`: body.data (detected).
- `facts`: body.data (detected).
- `search`: body.data (detected).
- `earnings`: body.data (detected).
- `income`: body.data (detected).
- The body mapping was detected in saved paid responses; other runs may use different wrappers.
- A full-text EDGAR hit can be a third-party mention, not a company filing.
- EDGAR hit totals with relation gte are lower bounds, not exact totals.
- XBRL facts may refer to different periods or amendments; compare end and accession before interpreting them.
- Alpha Vantage fields are secondary data and may lag SEC filings.

This pack records source evidence; it is not an investment recommendation.
