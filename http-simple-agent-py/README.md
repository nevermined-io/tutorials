# HTTP Simple Agent (Python) with x402 Payment Protection

A minimal FastAPI server demonstrating the [x402 payment protocol](https://github.com/coinbase/x402) using Nevermined's payment middleware. This tutorial shows how to protect API endpoints with credit-based payments.

> **Note:** For a TypeScript version of this tutorial, see [http-simple-agent-ts](../http-simple-agent-ts/).

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?logo=discord&logoColor=white)](https://discord.com/invite/GZju2qScKq)

## Overview

This tutorial includes:

- **Agent** (`src/agent.py`) - A FastAPI server with a payment-protected `/ask` endpoint
- **Agent with Observability** (`src/agent_observability.py`) - Same agent with Nevermined observability for tracking OpenAI costs
- **Client** (`src/client.py`) - A demo client showing the complete x402 payment flow

## x402 Payment Flow

```text
┌─────────┐                              ┌─────────┐
│  Client │                              │  Agent  │
└────┬────┘                              └────┬────┘
     │                                        │
     │  1. POST /ask (no token)               │
     │───────────────────────────────────────>│
     │                                        │
     │  2. 402 Payment Required               │
     │     Header: payment-required (base64)  │
     │<───────────────────────────────────────│
     │                                        │
     │  3. Generate x402 token via SDK        │
     │                                        │
     │  4. POST /ask                          │
     │     Header: payment-signature (token)  │
     │───────────────────────────────────────>│
     │                                        │
     │     - Verify permissions               │
     │     - Execute request                  │
     │     - Settle (burn credits)            │
     │                                        │
     │  5. 200 OK + AI response               │
     │     Header: payment-response (base64)  │
     │<───────────────────────────────────────│
     │                                        │
```

## Quick Start

### 1. Install dependencies

```bash
poetry install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Nevermined (required)
NVM_API_KEY=nvm:your-api-key
NVM_ENVIRONMENT=sandbox
NVM_PLAN_ID=your-plan-id

# Agent
OPENAI_API_KEY=sk-your-openai-api-key
PORT=3000

# Client
SERVER_URL=http://localhost:3000
```

### 3. Run the agent (server)

```bash
poetry run agent
```

### 4. Run the client (in another terminal)

```bash
poetry run client
```

## x402 Headers

The middleware follows the [x402 HTTP transport spec](https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md):

| Header              | Direction             | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `payment-signature` | Client → Server       | Base64-encoded x402 access token    |
| `payment-required`  | Server → Client (402) | Base64-encoded payment requirements |
| `payment-response`  | Server → Client (200) | Base64-encoded settlement receipt   |

## Agent Code

The agent uses the `PaymentMiddleware` from `payments_py.x402.fastapi`:

```python
from fastapi import FastAPI, Request
from payments_py import Payments, PaymentOptions
from payments_py.x402.fastapi import PaymentMiddleware

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

app = FastAPI()

# Protect routes with one line
app.add_middleware(
    PaymentMiddleware,
    payments=payments,
    routes={
        "POST /ask": {
            "plan_id": NVM_PLAN_ID,
            "credits": 1,
        },
    }
)

# Route handler - no payment logic needed!
@app.post("/ask")
async def ask(request: Request, body: AskRequest):
    response = openai_client.chat.completions.create(...)
    return {"response": response.choices[0].message.content}
```

## Client Code

The client demonstrates the full x402 flow:

```python
import httpx
from payments_py import Payments, PaymentOptions
from payments_py.x402.fastapi import X402_HEADERS

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

# Step 1: Request without token -> 402
response1 = httpx.post(
    f"{SERVER_URL}/ask",
    headers={"Content-Type": "application/json"},
    json={"query": "What is 2+2?"},
)
# Status: 402, Header: payment-required

# Step 2: Decode payment requirements
payment_required = json.loads(
    base64.b64decode(response1.headers["payment-required"]).decode()
)

# Step 3: Generate x402 token
token_result = payments.x402.get_x402_access_token(NVM_PLAN_ID)
access_token = token_result["accessToken"]

# Step 4: Request with token -> 200
response2 = httpx.post(
    f"{SERVER_URL}/ask",
    headers={
        "Content-Type": "application/json",
        X402_HEADERS["PAYMENT_SIGNATURE"]: access_token,
    },
    json={"query": "What is 2+2?"},
)
# Status: 200, Header: payment-response

# Step 5: Decode settlement receipt
settlement = json.loads(
    base64.b64decode(response2.headers["payment-response"]).decode()
)
```

## API Reference

### POST /ask

Send a query to the AI assistant (payment protected).

**Request Headers:**

```text
Content-Type: application/json
payment-signature: <x402-access-token>
```

**Request Body:**

```json
{
  "query": "Your question here"
}
```

**Success Response (200):**

```text
Header: payment-response: <base64-settlement-receipt>
```

```json
{
  "response": "AI's answer"
}
```

**Payment Required Response (402):**

```text
Header: payment-required: <base64-payment-requirements>
```

```json
{
  "error": "Payment Required",
  "message": "Missing x402 payment token. Send token in payment-signature header."
}
```

## Project Structure

```text
http-simple-agent-py/
├── src/
│   ├── __init__.py
│   ├── agent.py              # FastAPI server with payment middleware
│   ├── agent_observability.py # Agent with Nevermined observability
│   └── client.py             # x402 flow demo client
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

## Scripts

| Script                           | Description                              |
| -------------------------------- | ---------------------------------------- |
| `poetry run agent`               | Run the agent server                     |
| `poetry run agent-observability` | Run the agent with observability logging |
| `poetry run client`              | Run the client demo                      |

## Middleware Options

```python
from payments_py.x402.fastapi import PaymentMiddleware, PaymentMiddlewareOptions

async def on_before_verify(request, payment_required):
    print(f"Verifying {request.url.path}")

async def on_after_verify(request, verification):
    # Access agent_request_id for observability
    if verification.agent_request_id:
        print(f"Request ID: {verification.agent_request_id}")

async def on_after_settle(request, credits_used, settlement):
    print(f"Settled {credits_used} credits")

async def on_payment_error(error, request):
    # Return custom response or None for default
    return None

app.add_middleware(
    PaymentMiddleware,
    payments=payments,
    routes={...},
    options=PaymentMiddlewareOptions(
        token_header="payment-signature",  # x402 v2 default
        on_before_verify=on_before_verify,
        on_after_verify=on_after_verify,
        on_after_settle=on_after_settle,
        on_payment_error=on_payment_error,
    ),
)
```

## Route Configuration

```python
app.add_middleware(
    PaymentMiddleware,
    payments=payments,
    routes={
        # Fixed credits
        "POST /ask": {"plan_id": PLAN_ID, "credits": 1},

        # Path parameters
        "GET /users/:id": {"plan_id": PLAN_ID, "credits": 1},

        # With agent ID
        "POST /agent/task": {
            "plan_id": PLAN_ID,
            "agent_id": AGENT_ID,
            "credits": 5,
        },
    },
)
```

## Observability

The `agent_observability.py` demonstrates how to integrate Nevermined observability for tracking OpenAI costs per agent and plan.

### How it works

1. The `PaymentMiddleware` verifies the x402 token and stores `agent_request_id` in the payment context
2. The `agent_request_id` is available via `request.state.payment_context.agent_request_id` in route handlers
3. The `agent_request_id` can be used to correlate requests across your observability stack

```python
# In your route handler
payment_context = request.state.payment_context
agent_request_id = payment_context.agent_request_id if payment_context else None

if agent_request_id:
    print(f"Tracking request: {agent_request_id}")
```

### Running with observability

```bash
poetry run agent-observability
```

## Learn More

- [Nevermined Documentation](https://nevermined.ai/docs)
- [Nevermined Observability Guide](https://nevermined.ai/docs/development-guide/observability)
- [Nevermined x402 Smart Accounts Spec](https://nevermined.ai/docs/specs/x402-smart-accounts)
- [x402 Protocol Specification](https://github.com/coinbase/x402)
- [payments-py SDK](https://github.com/nevermined-io/payments-py)
