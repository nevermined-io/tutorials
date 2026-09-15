# SEC Earnings Evidence Pack

This sample buys five filing and earnings responses through one capped Nevermined Router delegation, then builds `out/evidence.json` and `out/evidence.md`. The pack records source files, filing dates, accession numbers, and available numeric fields. Missing fields stay `null` or `unavailable`; it does not write an investment conclusion.

The paid calls use three current Catalog slugs. The script checks each exact `POST` path in the current Catalog detail before creating a delegation: `edgar-sec-mpp` company submissions and company facts, `edgar-search` full-text search, and `alpha-vantage-mpp` earnings and income statement. The SEC/Alpha request keys come from the provider skill files: EDGAR `cik`, Alpha Vantage `symbol`. The `edgar-search` `{q}` body comes from the earlier diligence demo and passed a Live paid repeat, but Catalog still has no request schema for it; a failed call stops with its Router envelope saved.

The [sample Markdown pack](sample/evidence.md) and [sample JSON pack](sample/evidence.json) came from a completed Apple run on 2026-09-15. [BUILD_LOG.md](BUILD_LOG.md) records the calls, spend, path fix and repeat; [FRICTION.md](FRICTION.md) records the developer journey gaps. Raw paid responses stay private.

## Reproduce on Production Live

Install `jq`, `curl`, and Python 3. Use a Nevermined API key and a real balance. Save the key in a private JSON file:

```bash
umask 077
cat > ~/.nvm-router-buyer.json <<'EOF'
{ "apiBase": "https://api.live.nevermined.app", "apiKey": "live:YOUR_KEY_HERE" }
EOF
CIK=320193 SYMBOL=AAPL COMPANY=Apple ./run-demo.sh
```

The script allows at most five purchases and creates a 10¢ / 10-minute delegation. Catalog labels suggest about 0.8¢ per call, or about 4¢ total; those labels are **estimates**, not guaranteed quotes. The linked representative run charged **$0.040** to merchants, but consumed **5¢** of delegation cap because each sub-cent purchase counts as a whole cent against that cap. It delivered its first successful result in **10 seconds** and finished in **41 seconds**. Prices and timing can vary. The Router handles each merchant's live HTTP 402 quote during settlement; the delegation enforces the cap. After each delivery, the script checks a `Settled` payment in the ledger and the delegation's spent and remaining cents. It stops when a receipt, delivered body, or budget check is missing. An ambiguous transport failure is not retried automatically; each named call has a stable request ID within the delegation, which must be reused for any manual retry.

The earlier representative run had the same five Settled $0.008 charges and 5¢ cap consumption, with first delivery in **8 seconds** and total time **35 seconds**. The linked sample has been refreshed from the later Apple follow-up; its raw responses and receipts remain in ignored `out/`.

`out/` contains paid responses and payment records and is ignored by Git. Check these files before sharing the generated pack. `build-pack.py` can rebuild it offline from saved responses without making new purchases.

## Evidence and limits

The pack chooses the latest 10-K/10-Q in the SEC submissions response, recent XBRL revenue and net-income facts, the EDGAR search hit lower bound, and Alpha Vantage quarterly EPS and income fields. It prefers three-month XBRL facts and keeps period start/end, filing date, and accession so figures can be checked against the actual filing. EDGAR full-text hits can include third-party mentions, and a `gte` search count is not exact. XBRL concepts and Alpha Vantage reports can use different periods, so the pack does not imply they reconcile.

The full Live run verified that all five paid merchant payloads were delivered under `body.data`. `build-pack.py` records the selected wrapper for each source and leaves unfamiliar shapes unavailable. Catalog metadata still does not provide typed request and response schemas. The sample uses Alpha Vantage earnings and income statement rather than an earnings-call transcript: these endpoints provide quarterly figures that can be compared with SEC facts, while transcript coverage and wrapper schema were not verified. The deliverable is a numeric evidence pack with provenance rather than a narrative transcript summary.

Provider and source documentation: [SEC EDGAR API structures](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [Alpha Vantage earnings and financials](https://www.alphavantage.co/documentation/), [Locus EDGAR endpoint requests](https://paywithlocus.com/mpp/edgar.md), and [Locus Alpha Vantage endpoint requests](https://paywithlocus.com/mpp/alphavantage.md).

This is a paid demonstration and not investment advice. The public pack is a redacted representative result; verify its source dates before relying on any number.
