# langchain-deep-agent-py

A **Deep Agents** market-research agent gated by **Nevermined x402**, where the paid capability lives *inside a subagent*. Users chat with the supervisor for free; only the delegated research capability charges credits.

This is the sibling of [`langchain-research-agent-py`](../langchain-research-agent-py/), which does the same thing with a plain `create_react_agent`. Same payment contract, different harness — read them side by side to see what the harness does and does not change.

## What it demonstrates

The interesting claim, and the reason this tutorial exists:

```
main agent  ──task()──▶  research-sub  ──▶  market_research  [PAID]
     ▲                                            │
     └──────── x402 token supplied here ──────────┘
        config.configurable.payment_token
```

The buyer attaches an x402 access token to the **run**. The supervisor never touches it — it delegates via the built-in `task` tool, and LangGraph copies `configurable` down into the subagent's own tool calls. So `@requires_payment` works **unchanged one delegation hop away** from where the token was supplied.

Why that matters: a deep agent's whole premise is that the supervisor hands work to subagents. If payment context did not survive that hop, every paid tool would have to sit on the main agent and the harness would be useless for monetized capabilities. It survives.

- [`create_deep_agent`](https://docs.langchain.com/oss/python/deepagents/overview) supervisor with planning, filesystem and `task` tools built in.
- One subagent (`research-sub`) that owns the single paid tool.
- The `@requires_payment` decorator from `payments_py.x402.langchain`, which wraps the tool with the canonical x402 lifecycle:

  ```
  verify_permissions  →  tool body  →  settle_permissions
  ```

- A per-run budget cap, because a deep agent decides for itself how many subagent hops a request warrants (see [Two things to know](#two-things-to-know-before-you-ship-this)).
- **Plain LangGraph deployment** — `create_deep_agent()` returns a compiled graph, so `langgraph dev` and hosted LangSmith Deployment work with no extra wiring.

## Two things to know before you ship this

These are properties of the harness, not bugs, and both are worth designing around.

**1. A deep agent can bill several times per user turn.** The supervisor, not you, decides how many subagent calls a request warrants. One "research X" message may settle credits more than once. This tutorial caps it explicitly rather than trusting the model to be frugal:

```bash
NVM_MAX_PAID_CALLS_PER_RUN=3   # in .env
```

The cap is keyed by run, and an attempt that returns `PAYMENT_REQUIRED` is refunded — a user who authorizes mid-run still gets the calls they paid for.

**2. Two LLM layers can paraphrase the tool's output.** The subagent relays to the supervisor, which relays to the user. Both are instructed to pass text through verbatim; neither is guaranteed to. The plain ReAct sibling has one such layer, so this is strictly worse here. Treat the tool's return value as the source of truth — `src/buyer.py` prints the raw `ToolMessage`, not the chat reply, for exactly this reason.

A related failure mode to watch for while developing: a capable supervisor sometimes answers a research question **from its own knowledge** instead of delegating, which silently gives the paid capability away for free. Both system prompts here forbid it explicitly. If you swap in a different model, re-test that path — it is prompt-dependent, not structural.

## Prerequisites

- **Python 3.11+**
- A **Nevermined account** with an enrolled payment method and a plan to charge for the `market_research` tool. Create at [https://nevermined.app](https://nevermined.app).
- An **OpenAI API key** (or swap `ChatOpenAI` / the `model=` string in `src/agent.py` for another provider).

> **Its own virtualenv, on purpose.** `deepagents` requires the LangChain v1 stack (`langchain-core >= 1.6.1`). The sibling research agent resolves `langchain-core 1.4` with `langchain-openai 0.3`, so the two tutorials cannot share an environment. Install this one separately.

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
      I can provide market research... [free chat reply]

[2/4] Plan resolves to scheme=nvm:card-delegation, provider=stripe
      Using payment method: visa *4242

[3/4] Acquiring x402 access token from the plan...
      token = eyJ4NDAyVmVyc2lvbi...

[4/4] Running research request with token: 'Research the electric vehicle market in Europe'
      (supervisor -> task() -> research-sub -> market_research)

Agent reply (raw subagent output):

## Market Size
... [structured analysis from the analyst LLM]

_💳 Settled 5 credit(s). Remaining balance: 95._
```

## Smoke test without a token

Hit the agent with `/runs/wait` and no `config.configurable.payment_token` — the paid tool returns a `PAYMENT_REQUIRED:` notice instead of executing, and the supervisor relays it.

```bash
TID=$(curl -sS -X POST http://127.0.0.1:2024/threads -H 'content-type: application/json' -d '{}' | jq -r .thread_id)

curl -sS -X POST "http://127.0.0.1:2024/threads/$TID/runs/wait" \
  -H 'content-type: application/json' \
  -d '{"assistant_id":"deep_research","input":{"messages":[{"type":"human","content":"Research the EV market"}]}}'
```

## Use it with the browser chat UI

The buyer-side contract is identical to the ReAct tutorial's, so the [`langchain-chat-ui-nvm`](../langchain-chat-ui-nvm/) tutorial works against this agent unchanged — its proxy injects the token at `config.configurable.payment_token` either way. Point it at this agent and set the assistant id:

```bash
# in ../langchain-chat-ui-nvm/.env.local
LANGGRAPH_API_URL=http://127.0.0.1:2024
NEXT_PUBLIC_ASSISTANT_ID=deep_research
```

Run only one of the two agents on port 2024 at a time.

## Deploy to LangSmith Deployment (hosted)

```bash
poetry run langgraph up
```

Required deployment secrets:

| Secret | Why |
|---|---|
| `NVM_API_KEY` | The tool calls `payments.facilitator.verify_permissions` / `settle_permissions` from inside the deployed worker. |
| `NVM_PLAN_ID` | Which plan the tool charges against. |
| `OPENAI_API_KEY` | Supervisor, subagent, and analyst LLMs. |

## Files

| File | Purpose |
|---|---|
| `src/agent.py` | `create_deep_agent` supervisor + `research-sub` subagent. The paid tool is given **only** to the subagent, so every paid call crosses a `task()` boundary. Includes the per-run budget cap. |
| `src/buyer.py` | CLI buyer that exercises the free path and the paid path back-to-back. Identical contract to the ReAct tutorial's buyer. |
| `langgraph.json` | Wires the agent at `graphs.deep_research`. **No `http.app`** — gating is in-graph. |
| `.env.example` | Template for the Nevermined + OpenAI env vars. |

## Observability with LangSmith (optional)

Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY=...` in `.env` to emit `nvm:verify` and `nvm:settlement` spans into your LangSmith project. On a deep agent these nest under the `task` span, so you can see which subagent hop incurred each charge — useful when reasoning about the multi-settlement behaviour above. GCP EU accounts also need `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com`.

## Which harness should I use?

| | [`langchain-research-agent-py`](../langchain-research-agent-py/) | this tutorial |
|---|---|---|
| Harness | `create_react_agent` | `create_deep_agent` |
| Paid tool lives on | the agent itself | a subagent, one `task()` hop away |
| LLM layers between tool and user | 1 | 2 |
| Paid calls per user turn | one per tool call the model makes | supervisor decides — cap it |
| Built-in planning / filesystem / subagents | no | yes |
| Buyer-side contract | `config.configurable.payment_token` | **identical** |

Start from the ReAct tutorial if you want the smallest thing that works. Come here when the agent needs to plan, delegate, or manage its own context — and note that the payment integration itself does not change.
