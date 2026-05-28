# langchain-langsmith-deployment-py

Nevermined x402 + LangSmith Deployment tutorial — Sprint 3 of the LangChain integration epic ([nvm-monorepo#1703](https://github.com/nevermined-io/nvm-monorepo/issues/1703), tracked at [nvm-monorepo#1707](https://github.com/nevermined-io/nvm-monorepo/issues/1707)).

Deploys a LangGraph agent to **LangSmith Deployment** (the rebrand of LangGraph Platform) and gates its `POST /threads/{id}/runs/wait` endpoint with the Nevermined x402 payment flow. A single environment variable file plus four lines of glue code in `src/nvm_app.py` is all it takes.

## What you get

| Endpoint | Gated? | Behavior |
|---|---|---|
| `POST /threads` | no | Creates a thread, free. |
| `POST /threads/{id}/runs/wait` | **yes** | First call without `payment-signature` returns `402` + the x402 envelope in the `payment-required` response header. Retry with the signature returns `200` + the settlement receipt in the `payment-response` response header. |
| `GET /assistants/search`, `GET /info`, `GET /ok`, ... | no | Pass through; not protected by default. |

The middleware follows the canonical x402 lifecycle:

```
verify -> agent runs -> settle (only if agent succeeded)
```

Failed agent runs do not bill the buyer. Settlement failures after a successful run are logged but do not surface to the client (the buyer already received the value).

## Prerequisites

- **Python 3.11, 3.12, or 3.13** (3.14 is currently blocked upstream by `jsonschema-rs`)
- **Docker** (for `langgraph up` / hosted deployment)
- A **Nevermined account** with an enrolled payment method and a plan to gate the agent. Create at [https://nevermined.app](https://nevermined.app).

## Quick start

```bash
# 1. Install
poetry install

# 2. Configure
cp .env.example .env
$EDITOR .env   # fill in NVM_API_KEY, NVM_PLAN_ID

# 3. Start the gated agent locally
poetry run langgraph dev --no-browser --port 2024
```

In a second terminal:

```bash
# 4. Drive the 402 round-trip
poetry run buyer
```

You should see:

```
Connecting to LangSmith Deployment at http://127.0.0.1:2024

[1/5] Creating thread...
      thread_id = ...

[2/5] Submitting run without payment-signature -> expecting 402...
      envelope: scheme=nvm:erc4337, network=eip155:84532, plan_id=plan-...

[3/5] Picking enrolled payment method matching 'eip155:84532'...
      Visa *4242

[4/5] Acquiring x402 access token...
      token = eyJ4NDAyVmVyc2lvbi...

[5/5] Retrying run with payment-signature -> expecting 200...
      Agent output: {'input': 'hello from the buyer', 'output': 'echo: hello from the buyer'}

Settlement receipt:
      transaction:       0x...
      payer:             0x...
      credits_redeemed:  1
      remaining_balance: ...
```

## Smoke test without Nevermined credentials

You can verify the middleware is wired correctly without a real Nevermined account by hitting the gated endpoint with `curl`:

```bash
# Should return 402 with payment-required header
curl -i -X POST http://127.0.0.1:2024/threads/$(curl -s -X POST http://127.0.0.1:2024/threads -H 'content-type: application/json' -d '{}' | jq -r .thread_id)/runs/wait \
  -H 'content-type: application/json' \
  -d '{"assistant_id":"echo","input":{"messages":[{"type":"human","content":"hi"}]}}'
```

The response should include `HTTP/1.1 402 Payment Required` and a `payment-required: <base64>` header.

## Deploy to LangSmith Deployment (hosted)

```bash
poetry run langgraph up
```

`langgraph up` builds a Docker image of the project, brings up postgres, redis, and the API server, and exposes the deployment locally. Once the local container is healthy, push to LangSmith Deployment per the [LangChain docs](https://docs.langchain.com/langsmith/deployment).

## Files

| File | Purpose |
|---|---|
| `src/agent.py` | Minimal LangGraph `StateGraph` that echoes input. No LLM, no tools. Replace with your real agent. |
| `src/nvm_app.py` | The four lines of glue: instantiates `Payments`, calls `build_payment_app(payments, routes={...})`, exports `app` for `langgraph.json`. |
| `src/buyer.py` | Buyer-side companion that drives the 402 round-trip end-to-end. |
| `langgraph.json` | Wires the agent at `graphs.echo` and the gated FastAPI app at `http.app`. |
| `.env.example` | Template for the Nevermined + (optional) LangSmith env vars. |

## Customize per-route pricing

`src/nvm_app.py` ships gating only `POST /threads/{thread_id}/runs/wait` at a single plan + credits price. To set per-route pricing or gate additional endpoints:

```python
from payments_py.langsmith import RouteConfig, build_payment_app

app = build_payment_app(
    payments=payments,
    routes={
        "POST /threads/{thread_id}/runs/wait": RouteConfig(
            plan_id="plan-cheap", credits=1,
        ),
        "POST /threads/{thread_id}/runs/stream": RouteConfig(
            plan_id="plan-premium", credits=5,
        ),
    },
)
```

The middleware reads only the explicit `routes` dict — there is no implicit env-var fallback. If you want env-driven config, plumb it through `RouteConfig` yourself (`plan_id=os.environ["NVM_PLAN_ID"]`).

## Observability with LangSmith (optional)

Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY=...` in `.env` to emit Sprint 1's `nvm:verify` and `nvm:settlement` spans into your LangSmith project. GCP EU accounts also need `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com`.

## Known limitations

- **Streaming responses are buffered.** The middleware reads the downstream response body in full before attaching the `payment-response` settlement header, which negates streaming for SSE / `/runs/stream` endpoints. Use the middleware on non-streaming endpoints (`/runs/wait` is fine), or omit it for paths where streaming matters more than payment gating.
- **Python only.** LangSmith Deployment's custom-app surface is Python-only ([docs](https://docs.langchain.com/langsmith/custom-middleware)). TypeScript variant tracked as [TS-3 (#1711)](https://github.com/nevermined-io/nvm-monorepo/issues/1711), blocked on LangChain shipping a TS runtime.
- **Upstream langgraph-api 0.5.42 OpenAPI bug.** `update_openapi_spec` crashes on plain Starlette `http.app` wrappers due to YAML-parsing internal endpoint docstrings. We use FastAPI to dodge it (via the `build_payment_app` factory). Fixed by upgrading langgraph-api when LangChain ships a compatible langgraph-cli release.

## Related sprints

- **Sprint 0** (#1704) — Baseline Python LangChain tutorial with `@requires_payment` decorator.
- **Sprint 1** (#1705) — LangSmith Observability bridge - `nvm:verify` / `nvm:settlement` spans.
- **Sprint 2** (#1706) — Nevermined-x402 MCP server for LangSmith Fleet.
- **Sprint 3** (#1707) — *this tutorial*.
- **Sprint 4** (#1708) — Widget embed for Fleet hosts.
