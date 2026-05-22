# LangChain Paid Agent (Python)

A minimal LangChain / LangGraph agent with a single tool gated by [Nevermined](https://nevermined.ai) payments. The tutorial exists to show two things and nothing else:

1. **How a seller protects a LangChain tool** — wrap it with `@requires_payment`.
2. **How a buyer pays for an invocation** — acquire an x402 access token and thread it through `RunnableConfig.configurable.payment_token`.

Everything else (agent prompt, tool body, model choice) is deliberately trivial so the payment flow is the only signal.

> **Note — one Nevermined account for both roles.** In production the seller (plan owner) and the buyer (plan subscriber) are typically separate Nevermined accounts with separate API keys. This tutorial uses a **single** account for both roles so the demo only requires one Nevermined signup. Your account creates a plan, subscribes to it, then acts as both the protected-tool host and the x402 token holder.

For the full, production-ready reference see the published guide: **[Nevermined LangChain integration](https://nevermined.ai/docs/integrate/add-to-your-agent/langchain)**.

## Payment flow

This tutorial mirrors the x402 HTTP discovery pattern from [`http-simple-agent-py`](../http-simple-agent-py/) but in-process: the buyer first invokes the agent **without** a payment token, the protected tool raises `PaymentRequiredError` carrying the full x402 `accepts` block (scheme, network, plan id), and the buyer uses that to acquire a token before retrying. No plan id, no provider name, no scheme has to be configured on the buyer up front.

```text
┌─────────┐                                                   ┌────────────────┐
│  Buyer  │                                                   │  Seller agent  │
│ script  │                                                   │  (in-process)  │
└────┬────┘                                                   └────────┬───────┘
     │                                                                 │
     │  1. agent.invoke({"messages": [...]},                           │
     │       config={"configurable": {}})       (no payment_token)     │
     │ ───────────────────────────────────────────────────────────────>│
     │                                                                 │
     │  2. PaymentRequiredError raised                                 │
     │     .payment_required.accepts[0] →                              │
     │       scheme, network, plan_id                                  │
     │ <───────────────────────────────────────────────────────────────│
     │                                                                 │
     │  3. Pick an enrolled payment method whose provider              │
     │     matches accept.network                                      │
     │                                                                 │
     │  4. get_x402_access_token(plan_id, token_options=...)           │
     │                                                                 │
     │  5. agent.invoke({"messages": [...]}, config={                  │
     │        "configurable": {"payment_token": token}})               │
     │ ───────────────────────────────────────────────────────────────>│
     │                                                                 │
     │                                          ┌──────────────────────┘
     │                                          │  ReAct loop:
     │                                          │    LLM picks the tool
     │                                          │    @requires_payment:
     │                                          │      a) verify token
     │                                          │      b) execute tool body
     │                                          │      c) settle (burn credits)
     │                                          └──────────────────────┐
     │                                                                 │
     │  6. answer + settlement receipt                                 │
     │ <───────────────────────────────────────────────────────────────│
```

## Quick start

### 1. Prerequisites

- Python 3.10+
- A Nevermined account at [nevermined.app](https://nevermined.app). The **same** account plays both roles in this demo:
  - As the seller, it owns the plan and the protected tool.
  - As the buyer, it has subscribed to the plan and acquires x402 access tokens against it.
- An API key for the account (`Settings → API Keys`) — goes into `NVM_API_KEY`.
- A **fiat plan** (card-delegation scheme), created and subscribed, with at least one charge remaining — its id goes into `NVM_PLAN_ID`.
- A **payment method enrolled** that matches the plan's provider (Stripe by default; set `NVM_PAYMENT_PROVIDER` if your plan uses a different provider).
- An OpenAI API key for the agent's LLM.

> Need the click-by-click for the plan setup? Follow the [5-minute setup](https://nevermined.ai/docs/integrate/quickstart/5-minute-setup).

### 2. Install

```bash
poetry install
```

### 3. Configure

```bash
cp .env.example .env
```

Fill in `NVM_API_KEY`, `NVM_PLAN_ID`, and `OPENAI_API_KEY`. The buyer learns the payment provider from the protocol error — no need to hard-code it.

### 4. Run

```bash
poetry run buyer
```

Expected output (truncated):

```text
[1/4] Acquiring x402 access token for plan plan_abc...
      token = eyJhbGciOi...  (truncated)

[2/4] Building the LangGraph agent...

[3/4] Invoking the agent with query: 'What's the market insight on electric vehicles?'

      Agent answer: Demand is up 12% quarter-on-quarter ...

[4/4] Settlement receipt (from configurable.payment_settlement):
      credits_redeemed: 1
      remaining_balance: 49
      transaction: 0x...
      network: base-sepolia
      payer: 0x...
```

## Code walkthrough

### Seller: protect the tool (`src/agent.py`)

```python
from langchain_core.tools import tool
from payments_py import Payments, PaymentOptions
from payments_py.x402.langchain import requires_payment

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

@tool
@requires_payment(payments=payments, plan_id=NVM_PLAN_ID, credits=1)
def get_market_insight(topic: str, config: RunnableConfig = None) -> str:
    """Return a short market insight for the requested topic. Costs 1 credit."""
    return f"Market insight for '{topic}': ..."
```

Two requirements for the tool function:

- Decorator order is `@tool` *outside* `@requires_payment` *inside*.
- The function signature **must** include `config: RunnableConfig` — that is how the decorator reads the payment token at call time.

### Buyer: discover, pay, retry (`src/buyer.py`)

```python
from payments_py import Payments, PaymentOptions
from payments_py.x402.langchain import PaymentRequiredError
from payments_py.x402.types import DelegationConfig, X402TokenOptions
from .agent import LAST_SETTLEMENT, create_agent

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)
agent = create_agent()

# 1. Probe — invoke without a payment_token to provoke the protocol error.
try:
    agent.invoke({"messages": [("human", "...")]}, config={"configurable": {}})
except PaymentRequiredError as err:
    accept = err.payment_required.accepts[0]
    # accept.scheme   → "nvm:card-delegation"
    # accept.network  → "stripe"
    # accept.plan_id  → "<plan id>"

# 2. Pick an enrolled payment method whose provider matches accept.network.
methods = payments.delegation.list_payment_methods()
pm = next(m for m in methods if m.provider == accept.network)

# 3. Acquire a token against the discovered plan.
token = payments.x402.get_x402_access_token(
    accept.plan_id,
    token_options=X402TokenOptions(
        scheme=accept.scheme,
        delegation_config=DelegationConfig(
            provider_payment_method_id=pm.id,
            spending_limit_cents=10000,
            duration_secs=604800,
            currency="usd",
        ),
    ),
)["accessToken"]

# 4. Retry with the token.
result = agent.invoke(
    {"messages": [("human", "...")]},
    config={"configurable": {"payment_token": token}},
)
settlement = LAST_SETTLEMENT["value"]
```

### Why does the agent raise instead of swallowing the error?

By default LangGraph's `ToolNode` catches tool exceptions and surfaces them to the LLM as `ToolMessage` content (`handle_tool_errors=True`). That stringifies the exception and **loses** the `X402PaymentRequired` payload. `src/agent.py` therefore builds the agent with `ToolNode([get_market_insight], handle_tool_errors=False)` so `PaymentRequiredError` propagates all the way up to `agent.invoke()`'s caller with its payload intact.

### Why `LAST_SETTLEMENT` and not `configurable["payment_settlement"]`?

The decorator writes the settlement receipt to `config["configurable"]["payment_settlement"]`. **LangGraph copies `configurable` into a new dict per node**, so the receipt is set on the *node's copy* of `configurable`, not on the dict the buyer passed in. The seller-side `agent.py` therefore wraps the protected tool with a tiny `_capture_settlement` decorator (placed **outside** `@requires_payment` so it runs after settle) that reads the receipt off the inner `configurable` and stashes it in module-level `LAST_SETTLEMENT` — a place the buyer's outer scope can see.

### Why does the receipt say `credits_redeemed: 5` when the decorator says `credits=1`?

For **fixed plans** (the kind this tutorial recommends), the server-side `plan.credits.maxAmount` always wins — the client-side `credits=N` is overridden. The decorator's `credits` parameter is effectively a max-cap that only constrains **range plans** (where `minAmount < maxAmount` and the caller picks the amount within that band). For fixed plans, leaving `credits` at the default `1` is fine; the actual redemption is whatever the plan was configured with.

## File layout

```text
langchain-paid-agent-py/
├── src/
│   ├── __init__.py
│   ├── agent.py     # Paid tool + LangGraph agent factory
│   └── buyer.py     # Token acquisition + agent invocation + receipt print
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

## Learn more

- [Nevermined LangChain integration guide](https://nevermined.ai/docs/integrate/add-to-your-agent/langchain) — full reference with both this decorator pattern and the HTTP middleware pattern.
- [Nevermined Payments SDK (Python)](https://github.com/nevermined-io/payments-py)
- [x402 protocol](https://github.com/coinbase/x402)
