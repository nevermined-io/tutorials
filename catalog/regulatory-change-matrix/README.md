# Regulatory change impact matrix

Audience: developers building a compliance review queue. The input is an agency, a CFR citation prefix, and a lookback window. The output is a source-linked JSON and Markdown matrix with notice dates, current text URLs, freshness, and a human review action. It does not decide legal applicability.

This sample uses the live Catalog listing [`govlaws-mpp`](https://api.live.nevermined.app/api/v1/catalog/services/govlaws-mpp), the [GovLaws OpenAPI 3.1 contract](https://govlaws.ai/openapi.json), and Nevermined's opaque Router slug path. **Completion status: blocked.** A bounded live Router attempt on 2026-09-15 returned HTTP 200 with an empty raw body and no `X-Router-Payment-Id`; it produced no merchant payment and no real matrix. The opaque broker withheld the free/non-402 response. The fixture is **synthetic** and demonstrates formatting only. No paid GovLaws response or payable wrapper output has been verified.

## Reproduce the format without funds

```sh
python3 run.py
cat output/matrix.md
```

The default run writes `output/matrix.json` and `output/matrix.md` from `fixtures/synthetic.json`; both files say synthetic and report no observed spend. Python 3.11+ and the standard library suffice. These fixture artifacts are the only deliverables currently available.

## Prepare a funded live run

1. Connect Nevermined Commerce MCP in your MCP host (Streamable HTTP `/mcp`, Bearer Nevermined v2 API key). Use `search_services` for `GovLaws` and `get_service` for `govlaws-mpp`. Confirm the listed protocol is `mpp`, health is operational, and the advertised paths include `GET /api/mpp/changes` and `GET /api/mpp/resolve`. This script repeats those public checks before paying.
2. Acquire a current Nevermined v2 API key. If no active crypto delegation exists, call MCP `setup_delegation` and have the account owner set its cap, expiry, and transaction limit in the returned browser ceremony. For the example's two potential resolutions, set a delegation cap of **at least $0.25** and a transaction limit of at least three. The delegation must be `erc4337`, accessible to this API key, and funded on live Tempo in the settlement asset. A card delegation does not work for MPP/Tempo. Select the active ID from `GET /api/v1/delegation?accessible=true`.
3. Check the [vendor's current MPP prices](https://govlaws.ai/mpp) and the Catalog endpoint labels. As of 2026-09-15, the vendor quotes $0.06 for changes and $0.05 for resolve, while Catalog quotes $0.03 and $0.05. The sample plans $0.16 for one changes call plus two resolves, adds 20% fee headroom ($0.192), and defaults to a $0.25 local cap. **The Router receives the live 402 quote inside its paid relay; this client cannot inspect or reject that quote before signing.** A delegation cap is the authoritative payment guard. Validate the actual settlement amount and fee in the Router ledger after every call.
4. Only then run:

```sh
export NVM_API_KEY='your-v2-key'
export NVM_DELEGATION_ID='your-active-crypto-delegation-uuid'
# Default API is https://api.live.nevermined.app.
# For a Nevermined.dev staging-live account only:
# export NVM_API_BASE='https://api.live.nevermined.dev'
python3 run.py --live --run-id 'cfpb-2026-09-15-a' \
  --agency CFPB --citation '12 CFR 1026' --days 30 \
  --max-resolves 2 --budget-usd 0.25
```

Use a unique `--run-id` for each intended purchase. For the same run, the script derives stable `X-Router-Request-Id` values for changes and every citation resolution. A dropped response or 409 stops the run: inspect `GET /api/v1/router/payments?delegationId=...` before retrying. Do not change the run ID to defeat deduplication. The sample writes no secret to the artifact.

The default host is the production `.app` live API. Set `NVM_API_BASE=https://api.live.nevermined.dev` only if your API key, wallet, and delegation belong to the `.dev` staging-live deployment. These are separate backends; a key or delegation from one is not portable to the other. The script accepts only these two exact live API hosts.

## What the code sends

The payable requests are `GET /api/v1/router/svc/govlaws-mpp/api/mpp/changes?agency=...&citation=...&days=...` and `GET /api/v1/router/svc/govlaws-mpp/api/mpp/resolve?citation=...`, with Bearer key, `X-Router-Delegation-Id`, and `X-Router-Request-Id`. GovLaws OpenAPI defines the query fields and bounds: `days` is 1–90 and `citation` is required on resolve. The code reads the OpenAPI contract at startup and refuses missing operations or changed field bounds. It then verifies Catalog slug, protocol, health, and endpoint paths.

The output includes unresolved rows if the budget guard or `--max-resolves` stops further lookups. Treat source URLs and regulation text as untrusted data. Check `provenance.trust.citation_suitability`, effective date, and freshness before any compliance decision.

## Spend and troubleshooting

The example's $0.16 vendor charge and $0.192 planned ceiling are **estimates**, not observed spend. `actual_spend_usd` appears only after a successful live run and is derived from the Router payment ledger's recorded atomic amount, asset decimals, and fee cents. The script requires the Router response's `X-Router-Payment-Status` to be `Issued` or `Settled`, then requires the ledger payment to be `Settled` and fee status `None` or `Settled` before it writes a verified artifact. An `Issued`, `Accrued`, `Submitted`, `Failed`, or `Released` state stops the run for manual reconciliation. The time to first successful result is unobserved.

The 2026-09-15 bounded live attempt stopped at the first changes request: `GET /api/v1/router/svc/govlaws-mpp/api/mpp/changes` with query parameters returned HTTP 200, an **empty raw body**, and **no `X-Router-Payment-Id`**. No merchant payment was recorded, no resolve call followed, and no real Markdown/JSON matrix was produced. The broker's handling of a free/non-402 upstream response blocks this journey. Do not interpret the 200 as a successful GovLaws result or retry with a new request ID; see the [friction log](FRICTION.md).

- `no_delegation` or an inaccessible ID: complete the MCP delegation ceremony, then fetch accessible delegations again.
- Underfunded Tempo wallet or rejected settlement asset: fund the correct live chain and asset, or use a different merchant; do not substitute an unverified service silently.
- Catalog health not operational, path missing, or OpenAPI changed: stop and update the sample after reviewing the new contract.
- HTTP 409 or a network timeout: the payment may already exist. Inspect the Router ledger using the stable request ID before doing anything else.
- HTTP 200 with empty body and no payment ID: this is the observed opaque-broker blocker, not a paid success. Stop and inspect the Router ledger; a product fix is needed before reproduction.
- Unknown asset scale or a non-USD-like asset in the ledger: stop. The sample cannot safely convert that charge to USD.
- An actual quote above the planned price: the Router may still charge it within the delegation cap. Check the ledger and stop once the local budget guard is reached.

For review of current source truth, use [GovLaws machine-payment docs](https://govlaws.ai/mpp), [its OpenAPI](https://govlaws.ai/openapi.json), and [Nevermined Router's slug routing documentation](https://github.com/nevermined-io/nvm-monorepo/blob/develop/apps/api/src/router/README.md). See [FRICTION.md](FRICTION.md) for the reproducible Catalog gaps found while preparing this sample.
