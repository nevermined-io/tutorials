# HTTP Simple Agent with x402 Payment Protection

A minimal Express server demonstrating the [x402 payment protocol](https://github.com/coinbase/x402) using Nevermined's payment middleware. This tutorial shows how to protect API endpoints with credit-based payments.

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?logo=discord&logoColor=white)](https://discord.com/invite/GZju2qScKq)

## Overview

This tutorial includes:

- **Agent** (`src/agent.ts`) - An Express server with a payment-protected `/ask` endpoint
- **Client** (`src/client.ts`) - A demo client showing the complete x402 payment flow

## x402 Payment Flow

```
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
yarn install
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
yarn agent
```

### 4. Run the client (in another terminal)

```bash
yarn client
```

## x402 Headers

The middleware follows the [x402 HTTP transport spec](https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md):

| Header              | Direction             | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `payment-signature` | Client → Server       | Base64-encoded x402 access token    |
| `payment-required`  | Server → Client (402) | Base64-encoded payment requirements |
| `payment-response`  | Server → Client (200) | Base64-encoded settlement receipt   |

## Agent Code

The agent uses the `paymentMiddleware` from `@nevermined-io/payments/express`:

```typescript
import { Payments } from "@nevermined-io/payments";
import { paymentMiddleware } from "@nevermined-io/payments/express";

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// Protect routes with one line
app.use(
  paymentMiddleware(payments, {
    "POST /ask": {
      planId: NVM_PLAN_ID,
      credits: 1,
    },
  })
);

// Route handler - no payment logic needed!
app.post("/ask", async (req, res) => {
  const response = await openai.chat.completions.create({ ... });
  res.json({ response: response.choices[0].message.content });
});
```

## Client Code

The client demonstrates the full x402 flow:

```typescript
import { Payments } from "@nevermined-io/payments";
import { X402_HEADERS } from "@nevermined-io/payments/express";

// Step 1: Request without token -> 402
const response1 = await fetch(`${SERVER_URL}/ask`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "What is 2+2?" }),
});
// Status: 402, Header: payment-required

// Step 2: Decode payment requirements
const paymentRequired = JSON.parse(
  Buffer.from(response1.headers.get("payment-required"), "base64").toString()
);

// Step 3: Generate x402 token
const { accessToken } = await payments.x402.getX402AccessToken(NVM_PLAN_ID);

// Step 4: Request with token -> 200
const response2 = await fetch(`${SERVER_URL}/ask`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken,
  },
  body: JSON.stringify({ query: "What is 2+2?" }),
});
// Status: 200, Header: payment-response

// Step 5: Decode settlement receipt
const settlement = JSON.parse(
  Buffer.from(response2.headers.get("payment-response"), "base64").toString()
);
```

## API Reference

### POST /ask

Send a query to the AI assistant (payment protected).

**Request Headers:**

```
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

```
Header: payment-response: <base64-settlement-receipt>
```

```json
{
  "response": "AI's answer"
}
```

**Payment Required Response (402):**

```
Header: payment-required: <base64-payment-requirements>
```

```json
{
  "error": "Payment Required",
  "message": "Missing x402 payment token. Send token in payment-signature header."
}
```

## Project Structure

```
http-simple-agent/
├── src/
│   ├── agent.ts       # Express server with payment middleware
│   └── client.ts      # x402 flow demo client
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Scripts

| Script              | Description                     |
| ------------------- | ------------------------------- |
| `yarn agent`        | Run the agent server (dev mode) |
| `yarn client`       | Run the client demo             |
| `yarn build`        | Build TypeScript to JavaScript  |
| `yarn start:agent`  | Run built agent                 |
| `yarn start:client` | Run built client                |

## Middleware Options

```typescript
paymentMiddleware(payments, routes, {
  // Custom token header(s) - default: ['payment-signature', 'x-payment']
  tokenHeader: "payment-signature",

  // Hook before verification
  onBeforeVerify: (req, paymentRequired) => {
    console.log(`Verifying ${req.path}`);
  },

  // Hook after settlement
  onAfterSettle: (req, creditsUsed, settlement) => {
    console.log(`Settled ${creditsUsed} credits`);
  },

  // Custom error handler
  onPaymentError: (error, req, res) => {
    res.status(402).json({ error: error.message });
  },
});
```

## Route Configuration

```typescript
paymentMiddleware(payments, {
  // Fixed credits
  "POST /ask": { planId: PLAN_ID, credits: 1 },

  // Dynamic credits based on request
  "POST /generate": {
    planId: PLAN_ID,
    credits: (req, res) => req.body.tokens / 100,
  },

  // Path parameters
  "GET /users/:id": { planId: PLAN_ID, credits: 1 },

  // With agent ID
  "POST /agent/task": {
    planId: PLAN_ID,
    agentId: AGENT_ID,
    credits: 5,
  },
});
```

## Learn More

- [Nevermined Documentation](https://nevermined.ai/docs)
- [Nevermined x402 Smart Accounts Spec](https://nevermined.ai/docs/specs/x402-smart-accounts)
- [x402 Protocol Specification](https://github.com/coinbase/x402)
- [@nevermined-io/payments SDK](https://github.com/nevermined-io/payments)
