# LangChain Paid Agent (Python)

A minimal LangChain / LangGraph agent with a single tool gated by [Nevermined](https://nevermined.ai) payments. The tutorial exists to show two things and nothing else:

1. **How a seller protects a LangChain tool** — wrap it with `@requires_payment`.
2. **How a buyer pays for an invocation** — acquire an x402 access token and thread it through `RunnableConfig.configurable.payment_token`.

Everything else (agent prompt, tool body, model choice) is deliberately trivial so the payment flow is the only signal.

> **Note — one Nevermined account for both roles.** In production the seller (plan owner) and the buyer (plan subscriber) are typically separate Nevermined accounts with separate API keys. This tutorial uses a **single** account for both roles so the demo only requires one Nevermined signup. Your account creates a plan, subscribes to it, then acts as both the protected-tool host and the x402 token holder.

For the full, production-ready reference see the published guide: **[Nevermined LangChain integration](https://nevermined.ai/docs/integrate/add-to-your-agent/langchain)**.

## Payment flow

Unlike the x402 HTTP middleware pattern (used in [`http-simple-agent-py`](../http-simple-agent-py/)), the LangChain tool decorator runs in-process: there is no `402` round-trip and no retry. The buyer acquires the token once, then threads it through the agent's `RunnableConfig`. The tool verifies and settles inside the agent's tool call.

```text
┌─────────┐                                                   ┌────────────────┐
│  Buyer  │                                                   │  Seller agent  │
│ script  │                                                   │  (in-process)  │
└────┬────┘                                                   └────────┬───────┘
     │                                                                 │
     │  1. get_x402_access_token(plan_id)                              │
     │      via payments-py (buyer SDK)                                │
     │                                                                 │
     │  2. agent.invoke({"messages": [...]}, config={                  │
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
     │  3. answer + settlement receipt                                 │
     │     (config.configurable.payment_settlement)                    │
     │ <───────────────────────────────────────────────────────────────│
```

## Quick start

### 1. Prerequisites

- Python 3.10+
- A Nevermined account at [nevermined.app](https://nevermined.app). The **same** account plays both roles in this demo:
  - As the seller, it owns the plan and the protected tool.
  - As the buyer, it has subscribed to the plan and acquires x402 access tokens against it.
- An API key for the account (`Settings → API Keys`) — goes into `NVM_API_KEY`.
- A **plan** created and subscribed (one click each on the plan page) — its id goes into `NVM_PLAN_ID`.
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

Fill in `NVM_API_KEY`, `NVM_PLAN_ID`, and `OPENAI_API_KEY`.

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

### Buyer: acquire a token and invoke (`src/buyer.py`)

```python
from payments_py import Payments, PaymentOptions
from .agent import create_agent

# Same Nevermined account as the seller in this demo; the account has
# subscribed to its own plan to acquire x402 access tokens.
payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

token = payments.x402.get_x402_access_token(NVM_PLAN_ID)["accessToken"]

agent = create_agent()
configurable = {"payment_token": token}
result = agent.invoke(
    {"messages": [("human", "What's the market insight on electric vehicles?")]},
    config={"configurable": configurable},
)

settlement = configurable["payment_settlement"]  # populated after settlement
```

The same `configurable` dict that carried the token *into* the agent receives the settlement receipt on the way *out* — that is how the buyer recovers `credits_redeemed`, `remaining_balance`, and the on-chain `transaction`.

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
