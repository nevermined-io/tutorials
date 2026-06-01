# langchain-research-agent-py

A LangGraph **freemium** market-research agent gated by **Nevermined x402**. Users can chat with it for free (introspection: "what can you do?", pricing, etc.); only the actual research capability charges credits. Gating happens **inside a tool**, not at the HTTP route, so the introspection flow stays free without bypassing the payment lifecycle.

Companion to the [browser chat UI tutorial](../langchain-chat-ui-nvm/) — clone and run this agent first, then point the chat UI at `http://127.0.0.1:2024`.

## What it demonstrates

- A LangGraph **ReAct agent** (`create_react_agent`) with an LLM concierge and one paid tool.
- The `@requires_payment` decorator from `payments_py.x402.langchain`, which wraps the tool with the canonical x402 lifecycle:

  ```
  verify_permissions  →  tool body  →  settle_permissions
  ```

- A thin wrapper around the decorator that catches `PaymentRequiredError` and surfaces a friendly text notice the LLM relays to the user verbatim, plus a settlement-receipt footer read from `last_settlement()`.
- **Plain LangGraph deployment** — no `http.app` is required. The same graph runs locally via `langgraph dev` and on hosted LangSmith Deployment without changes.

If your use case is "every call is paid" (no free introspection), use the route-level ASGI middleware instead — see the companion [`langchain-langsmith-deployment-py`](../langchain-langsmith-deployment-py) tutorial.

## How buyers attach a payment

The contract is: an x402 access token must be at `config.configurable.payment_token` on the run. The decorator reads it from there.

```python
{
  "assistant_id": "research",
  "input": {"messages": [...]},
  "config": {"configurable": {"payment_token": access_token}}
}
```

Two ways to put it there:

1. **From a CLI / SDK buyer** — set the field directly on the run body (see `src/buyer.py`).
2. **From the browser chat UI** — the Next.js proxy at [`../langchain-chat-ui-nvm/`](../langchain-chat-ui-nvm/) reads the token from a httpOnly cookie (set after the popup card-delegation flow) and JSON-injects it into the outgoing run body. No code changes on the agent side.

## Prerequisites

- **Python 3.11+**
- A **Nevermined account** with an enrolled payment method and a plan to charge for the `market_research` tool. Create at [https://nevermined.app](https://nevermined.app).
- An **OpenAI API key** (or swap `ChatOpenAI` for another `langchain` chat model in `src/agent.py`).

## Quick start

```bash
# 1. Install
poetry install

# 2. Configure
cp .env.example .env
$EDITOR .env   # fill in NVM_API_KEY, NVM_PLAN_ID, OPENAI_API_KEY

# 3. Run the agent locally
poetry run langgraph dev --no-browser --port 2024
```

In a second terminal:

```bash
# 4. Drive the free + paid flow end-to-end
poetry run buyer
```

You should see:

```
Connecting to LangSmith Deployment at http://127.0.0.1:2024

[1/4] Asking the agent what it can do (free, no token)...
      Agent reply:
      I'm a market research agent... [free chat reply]

[2/4] Plan resolves to scheme=nvm:card-delegation, provider=stripe
      Using payment method: visa *4242

[3/4] Acquiring x402 access token from the plan...
      token = eyJ4NDAyVmVyc2lvbi...

[4/4] Running research request with token: 'Research the electric vehicle market in Europe'

Agent reply (raw tool output):

## Market Size
... [structured analysis from the analyst LLM]

_💳 Settled 5 credit(s). Remaining balance: 95._
```

## Smoke test without a token

Hit the agent with `/runs/wait` and no `config.configurable.payment_token` — the tool returns a `PAYMENT_REQUIRED:` notice instead of executing.

```bash
TID=$(curl -sS -X POST http://127.0.0.1:2024/threads -H 'content-type: application/json' -d '{}' | jq -r .thread_id)

curl -sS -X POST "http://127.0.0.1:2024/threads/$TID/runs/wait" \
  -H 'content-type: application/json' \
  -d '{"assistant_id":"research","input":{"messages":[{"type":"human","content":"Research the EV market"}]}}'
```

The final AI message will start with `PAYMENT_REQUIRED:`.

## Deploy to LangSmith Deployment (hosted)

```bash
poetry run langgraph up
```

`langgraph up` builds a Docker image of the project, brings up postgres, redis, and the API server, and exposes the deployment locally. Once the local container is healthy, push to LangSmith Deployment per the [LangChain docs](https://docs.langchain.com/langsmith/deployment).

Required deployment secrets:

| Secret | Why |
|---|---|
| `NVM_API_KEY` | The tool calls `payments.facilitator.verify_permissions` / `settle_permissions` from inside the deployed worker. |
| `NVM_PLAN_ID` | Which plan the tool charges against. |
| `OPENAI_API_KEY` | LLM concierge + analyst. |

## Files

| File | Purpose |
|---|---|
| `src/agent.py` | `create_react_agent` with the `market_research` tool. The tool's paid inner is wrapped with `@requires_payment` from `payments_py.x402.langchain`, which reads `config.configurable.payment_token` and runs verify → analyst → settle. |
| `src/buyer.py` | CLI buyer that exercises the free path and the paid path back-to-back. |
| `langgraph.json` | Wires the agent at `graphs.research`. **No `http.app`** — gating is in-graph. |
| `.env.example` | Template for the Nevermined + OpenAI env vars. |

## Observability with LangSmith (optional)

Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY=...` in `.env` to emit `nvm:verify` and `nvm:settlement` spans into your LangSmith project. The `payments_py.langsmith` spans wrap `verify_permissions` / `settle_permissions` regardless of where you call them from, so they fire inside the tool too. GCP EU accounts also need `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com`.

## Why in-tool gating

The route-level ASGI middleware (`payments_py.langsmith.PaymentMiddleware`, demonstrated in [`langchain-langsmith-deployment-py`](../langchain-langsmith-deployment-py)) gates the whole HTTP route, so any message would require payment up-front. Tool-layer gating lets the LLM act as the front-of-house concierge — it answers introspection questions for free and routes only the paid capability through the verify/settle lifecycle. Both patterns are valid; pick by how you want the UX to feel.
