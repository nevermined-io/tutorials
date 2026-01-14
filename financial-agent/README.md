[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

## Financial Agent Tutorial (OpenAI + Nevermined x402 Protocol)

This tutorial shows how to evolve a simple financial-advice agent and client from an unprotected HTTP API to a Nevermined-protected, paid-access API using the **x402 payment protocol**. You will:

- Start with an unprotected agent and client
- Add Nevermined x402 payment protection to the agent
- Implement dynamic credit settlement based on token usage
- Update the client to handle the x402 payment flow (402 → obtain token → retry)

The project includes both versions side-by-side for learning purposes.

## Prerequisites
- Node.js 18+
- An OpenAI API key
- A Nevermined account (sandbox or live), with:
  - A Publisher/Builder API Key (server-side) → `BUILDER_NVM_API_KEY`
  - A Subscriber API Key (client-side) → `SUBSCRIBER_NVM_API_KEY`
  - An Agent created in Nevermined → `NVM_AGENT_ID`
  - A Plan associated with that agent → `NVM_PLAN_ID`

## Install dependencies
```
npm install
```

## Project layout
```
agent/
  index_unprotected.ts   # Express server without Nevermined protection
  index_nevermined.ts    # Express server with Nevermined protection
client/
  index_unprotected.ts   # Simple client hitting the free agent
  index_nevermined.ts    # Client that buys/uses plan to call protected agent
.env                      # Environment variables
```

---

## Part 1 — Unprotected agent and client

The unprotected version exposes a POST `/ask` endpoint and a GET `/health` endpoint. A minimal client sends three sequential questions, preserving the returned `sessionId` so the model keeps context.

### 1.1 Server (unprotected)

Key points in `agent/index_unprotected.ts`:
```ts
// Model and runnable
const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.3, apiKey: OPENAI_API_KEY });
const runnable = createRunnable(model);

// POST /ask without any auth
app.post("/ask", async (req: Request, res: Response) => {
  const input = String(req.body?.input_query ?? "").trim();
  if (!input) return res.status(400).json({ error: "Missing input" });

  let { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) sessionId = crypto.randomUUID();

  const result = await runnable.invoke({ input }, { configurable: { sessionId } });
  const text = result?.content ?? (Array.isArray(result) ? result.map((m: any) => m.content).join("\n") : String(result));
  res.json({ output: text, sessionId });
});
```

Run it:
```
PORT=3001 OPENAI_API_KEY=sk-... npm run dev:agent:unprotected
```
Health check:
```
curl http://localhost:3001/health
```

### 1.2 Client (unprotected)

The free client simply POSTs to `/ask` and prints the responses:
```ts
const baseUrl = process.env.AGENT_URL || "http://localhost:3001";
const questions = [
  "What is your market outlook for Bitcoin over the next month?",
  "How are major stock indices performing today and what trends are notable?",
  "What risks should I consider before increasing exposure to tech stocks?",
];

let sessionId: string | undefined;
for (let i = 0; i < questions.length; i += 1) {
  const response = await askAgent(baseUrl, questions[i], sessionId);
  sessionId = response.sessionId;
  console.log(`[FREE AGENT] (sessionId=${sessionId})\n${response.output}`);
}
```

Run it (in a separate terminal):
```
AGENT_URL=http://localhost:3001 npm run dev:client:unprotected
```

---

## Part 2 — Protecting the agent with Nevermined x402 Protocol

Now we add paid access protection using the **x402 payment protocol**. The high-level flow is:

1) The client makes a request without any payment signature
2) The agent returns HTTP 402 with a `PAYMENT-REQUIRED` header containing payment requirements
3) The client obtains an x402 access token based on those requirements
4) The client retries the request with a `PAYMENT-SIGNATURE` header
5) The agent verifies permissions, executes the request, and settles credits
6) The agent returns the response with a `PAYMENT-RESPONSE` header

### 2.1 Environment variables

Create a `.env` file in the project root. Use `staging_sandbox` by default while testing.

For the protected agent (server):
```
OPENAI_API_KEY=sk-...
PORT=3000
NVM_ENVIRONMENT=staging_sandbox            # or "live" for production
BUILDER_NVM_API_KEY=your-builder-api-key   # server-side key
NVM_AGENT_ID=your-agent-id                 # agent registered in Nevermined
NVM_PLAN_ID=your-plan-id                   # plan linked to the agent
NVM_AGENT_HOST=http://localhost:3000       # public URL in production
```

For the protected client:
```
AGENT_URL=http://localhost:3000
NVM_ENVIRONMENT=staging_sandbox            # or "live" for production
SUBSCRIBER_NVM_API_KEY=your-subscriber-api-key  # client/subscriber key
```
Note: The client no longer needs `NVM_PLAN_ID` or `NVM_AGENT_ID` upfront — these are provided by the agent in the `PAYMENT-REQUIRED` header.

### 2.2 Server (protected) — x402 payment protection

Key additions in `agent/index_nevermined.ts`:

1) Create a Nevermined `Payments` client (server side uses the Builder key). This object talks to the Nevermined backend to validate access and settle credits.
```ts
import { Payments, EnvironmentName } from "@nevermined-io/payments";

const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "staging_sandbox") as EnvironmentName;
const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENVIRONMENT });
```

2) Build the `PAYMENT-REQUIRED` object that describes what payment is needed. This follows the x402 protocol specification:
```ts
function buildPaymentRequired(url: string, httpVerb: string) {
  return {
    x402Version: 2,
    error: "Payment required to access resource",
    resource: { url, description: "Financial advice agent", mimeType: "application/json" },
    accepts: [{
      scheme: "nvm:erc4337",
      network: "eip155:84532",
      planId: NVM_PLAN_ID,
      extra: { version: "1", agentId: NVM_AGENT_ID, httpVerb },
    }],
    extensions: {},
  };
}
```

3) Return 402 with the `PAYMENT-REQUIRED` header (base64-encoded) when no valid payment is provided:
```ts
function returnPaymentRequired(res: Response, paymentRequired: any, errorMessage?: string) {
  const paymentRequiredBase64 = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return res
    .status(402)
    .set("PAYMENT-REQUIRED", paymentRequiredBase64)
    .json({ error: errorMessage || "Payment required" });
}
```

4) Check for the `PAYMENT-SIGNATURE` header and parse the x402 token:
```ts
const paymentSignature = req.headers["payment-signature"] as string | undefined;
if (!paymentSignature) {
  return returnPaymentRequired(res, paymentRequired, "PAYMENT-SIGNATURE header is required");
}

// Decode the base64-encoded PaymentPayload
const paymentPayload = JSON.parse(Buffer.from(paymentSignature, "base64").toString("utf-8"));
```

5) Verify the user has permission to access this resource using the facilitator API:
```ts
const verification = await payments.facilitator.verifyPermissions({
  paymentRequired,
  x402AccessToken: paymentSignature,
  maxAmount: BigInt(expectedCredits),
});

if (!verification.isValid) {
  return returnPaymentRequired(res, paymentRequired, verification.invalidReason);
}
```

6) After generating the response, settle permissions to charge the user:
```ts
const settlementResult = await payments.facilitator.settlePermissions({
  paymentRequired,
  x402AccessToken: paymentSignature,
  maxAmount: BigInt(creditAmount),
});
```

7) Return the response with a `PAYMENT-RESPONSE` header containing the settlement receipt:
```ts
const paymentResponse = {
  success: settlementResult.success,
  transaction: settlementResult.transaction || "",
  network: paymentRequired.accepts[0].network,
  payer: paymentPayload.payload?.authorization?.from || "",
};
const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponse)).toString("base64");

res.set("PAYMENT-RESPONSE", paymentResponseBase64).json({ output: response, sessionId, payment: { ... } });
```

### 2.3 Server (protected) — dynamic credit settlement

The agent calculates credits dynamically based on actual token usage. This rewards shorter responses with lower costs:

```ts
function calculateCreditAmount(tokensUsed: number, maxTokens: number): number {
  // Formula: 10 * (actual_tokens / max_tokens)
  const tokenUtilization = Math.min(tokensUsed / maxTokens, 1);
  const baseCreditAmount = 10 * tokenUtilization;
  return Math.max(Math.ceil(baseCreditAmount), 1); // Minimum 1 credit
}
```

Putting it together, a minimal protected handler follows this sequence:
```ts
app.post("/ask", async (req: Request, res: Response) => {
  const paymentRequired = buildPaymentRequired(`${NVM_AGENT_HOST}${req.url}`, req.method);
  const paymentSignature = req.headers["payment-signature"] as string | undefined;

  // 1) If no payment signature, return 402 with payment requirements
  if (!paymentSignature) {
    return returnPaymentRequired(res, paymentRequired);
  }

  // 2) Verify permissions
  const verification = await payments.facilitator.verifyPermissions({
    paymentRequired, x402AccessToken: paymentSignature, maxAmount: BigInt(10)
  });
  if (!verification.isValid) {
    return returnPaymentRequired(res, paymentRequired, verification.invalidReason);
  }

  // 3) Execute your business logic (call OpenAI, etc.)
  const completion = await openai.chat.completions.create({ ... });
  const tokensUsed = completion.usage?.completion_tokens || 0;

  // 4) Calculate and settle credits based on actual usage
  const creditAmount = calculateCreditAmount(tokensUsed, maxTokens);
  const settlementResult = await payments.facilitator.settlePermissions({
    paymentRequired, x402AccessToken: paymentSignature, maxAmount: BigInt(creditAmount)
  });

  // 5) Return response with PAYMENT-RESPONSE header
  res.set("PAYMENT-RESPONSE", paymentResponseBase64).json({ output, sessionId, payment: { ... } });
});
```

Run the protected server:
```
PORT=3000 OPENAI_API_KEY=sk-... \
BUILDER_NVM_API_KEY=... NVM_ENVIRONMENT=sandbox NVM_AGENT_ID=... \
npm run dev:agent
```
Health check:
```
curl http://localhost:3000/health
```

---

## Part 3 — Updating the client to use x402 payment flow

The protected client implements the full x402 payment protocol:
1) Make an initial request without payment
2) Receive 402 with `PAYMENT-REQUIRED` header
3) Parse the payment requirements to get `planId` and `agentId`
4) Obtain an x402 access token
5) Retry the request with `PAYMENT-SIGNATURE` header
6) Parse the `PAYMENT-RESPONSE` header from successful responses

### 3.1 Parse the PAYMENT-REQUIRED header

When the agent returns 402, extract the payment requirements from the header:
```ts
function parsePaymentRequiredHeader(response: Response): PaymentRequired | null {
  const header = response.headers.get("payment-required");
  if (!header) return null;

  const decoded = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(decoded) as PaymentRequired;
}
```

### 3.2 Get x402 access token

Use the `payments.x402.getX402AccessToken()` method to obtain a token:
```ts
async function getX402AccessToken(planId: string, agentId: string): Promise<string> {
  // Try to get token directly first
  try {
    const result = await payments.x402.getX402AccessToken(planId, agentId);
    if (result?.accessToken) return result.accessToken;
  } catch {
    // Check if we need to purchase a subscription
    const balanceInfo = await payments.plans.getPlanBalance(planId);
    if (!balanceInfo?.isSubscriber && !balanceInfo?.balance) {
      await payments.plans.orderPlan(planId);
    }
    // Retry after subscription
    const result = await payments.x402.getX402AccessToken(planId, agentId);
    return result.accessToken;
  }
}
```

### 3.3 Implement the full x402 flow

The client handles the 402 → token → retry flow automatically:
```ts
async function askAgent(input: string, sessionId?: string) {
  // Step 1: Make initial request without PAYMENT-SIGNATURE
  const initialResponse = await fetch(`${AGENT_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_query: input, sessionId }),
  });

  // Step 2: If 402, parse PAYMENT-REQUIRED and get token
  if (initialResponse.status === 402) {
    const paymentRequired = parsePaymentRequiredHeader(initialResponse);
    const { planId, extra: { agentId } } = paymentRequired.accepts[0];

    const x402Token = await getX402AccessToken(planId, agentId);

    // Step 3: Retry with PAYMENT-SIGNATURE header
    const retryResponse = await fetch(`${AGENT_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": x402Token,
      },
      body: JSON.stringify({ input_query: input, sessionId }),
    });

    // Step 4: Parse PAYMENT-RESPONSE header
    const paymentResponseHeader = retryResponse.headers.get("payment-response");
    // ... decode and log settlement info

    return await retryResponse.json();
  }

  return await initialResponse.json();
}
```

Run it (in a separate terminal):
```
AGENT_URL=http://localhost:3000 \
SUBSCRIBER_NVM_API_KEY=... NVM_ENVIRONMENT=staging_sandbox \
npm run dev:client
```
Note: The client automatically discovers `planId` and `agentId` from the `PAYMENT-REQUIRED` header.

---

## Commands quick reference

Unprotected flow:
```
# Terminal A (agent)
PORT=3001 OPENAI_API_KEY=sk-... npm run dev:agent:unprotected

# Terminal B (client)
AGENT_URL=http://localhost:3001 npm run dev:client:unprotected
```

Protected flow (x402):
```
# Terminal A (agent)
PORT=3000 OPENAI_API_KEY=sk-... \
BUILDER_NVM_API_KEY=... NVM_ENVIRONMENT=staging_sandbox \
NVM_AGENT_ID=... NVM_PLAN_ID=... \
npm run dev:agent

# Terminal B (client)
AGENT_URL=http://localhost:3000 \
SUBSCRIBER_NVM_API_KEY=... NVM_ENVIRONMENT=staging_sandbox \
npm run dev:client
```

---

## Notes and tips
- Session memory is in-memory for simplicity; for production, use a durable store.
- Use `sandbox` while testing payments; switch to `live` when ready.
- Ensure you use the correct API keys: `BUILDER_NVM_API_KEY` on the server, `SUBSCRIBER_NVM_API_KEY` on the client.
- If the client receives HTTP 402, it means the request isn’t authorized (no subscription/credits or missing/invalid token).

---

## Unprotected → Protected: 1:1 code mapping (x402 protocol)

This section shows exactly what changes to make when converting `agent/index_unprotected.ts` into `agent/index_nevermined.ts` using the x402 protocol.

- Add imports:
```ts
import { Payments, EnvironmentName } from "@nevermined-io/payments";
```

- Add Nevermined configuration (after OpenAI checks):
```ts
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "staging_sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";
const NVM_AGENT_HOST = process.env.NVM_AGENT_HOST || `http://localhost:${PORT}`;
if (!NVM_API_KEY || !NVM_AGENT_ID || !NVM_PLAN_ID) {
  console.error("Nevermined environment is required: set NVM_API_KEY, NVM_AGENT_ID, and NVM_PLAN_ID in .env");
  process.exit(1);
}
```

- Create a singleton `payments` client:
```ts
const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENVIRONMENT });
```

- Add helper to build payment requirements (x402 protocol):
```ts
function buildPaymentRequired(url: string, httpVerb: string) {
  return {
    x402Version: 2,
    error: "Payment required to access resource",
    resource: { url, description: "Financial advice agent", mimeType: "application/json" },
    accepts: [{
      scheme: "nvm:erc4337",
      network: "eip155:84532",
      planId: NVM_PLAN_ID,
      extra: { version: "1", agentId: NVM_AGENT_ID, httpVerb },
    }],
    extensions: {},
  };
}
```

- Add helper to return 402 with PAYMENT-REQUIRED header:
```ts
function returnPaymentRequired(res: Response, paymentRequired: any, errorMessage?: string) {
  const paymentRequiredBase64 = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return res.status(402).set("PAYMENT-REQUIRED", paymentRequiredBase64).json({ error: errorMessage || "Payment required" });
}
```

- Modify `/ask` handler to implement x402 flow:
```ts
app.post("/ask", async (req: Request, res: Response) => {
  const paymentRequired = buildPaymentRequired(`${NVM_AGENT_HOST}${req.url}`, req.method);
  const paymentSignature = req.headers["payment-signature"] as string | undefined;

  if (!paymentSignature) {
    return returnPaymentRequired(res, paymentRequired, "PAYMENT-SIGNATURE header is required");
  }

  // Verify permissions
  const verification = await payments.facilitator.verifyPermissions({
    paymentRequired, x402AccessToken: paymentSignature, maxAmount: BigInt(10)
  });
  if (!verification.isValid) {
    return returnPaymentRequired(res, paymentRequired, verification.invalidReason);
  }

  // ... existing input/session handling + LLM invocation ...

  // Settle credits after success
  const settlementResult = await payments.facilitator.settlePermissions({
    paymentRequired, x402AccessToken: paymentSignature, maxAmount: BigInt(creditAmount)
  });

  // Return with PAYMENT-RESPONSE header
  const paymentResponseBase64 = Buffer.from(JSON.stringify({ success: true, ... })).toString("base64");
  res.set("PAYMENT-RESPONSE", paymentResponseBase64).json({ output, sessionId, payment: { ... } });
});
```

Notes:
- The x402 protocol uses `PAYMENT-SIGNATURE` and `PAYMENT-REQUIRED` headers instead of `Authorization: Bearer`
- `payments.facilitator.verifyPermissions()` replaces `payments.requests.startProcessingRequest()`
- `payments.facilitator.settlePermissions()` replaces `payments.requests.redeemCreditsFromRequest()`
- The agent now provides `planId` and `agentId` to clients in the payment requirements

---

## Migration checklist (unprotected → x402 protected)

**Agent-side:**
- Add `@nevermined-io/payments` import
- Add env vars: `BUILDER_NVM_API_KEY`, `NVM_ENVIRONMENT`, `NVM_AGENT_ID`, `NVM_PLAN_ID`, `NVM_AGENT_HOST`
- Instantiate `payments = Payments.getInstance(...)`
- Add `buildPaymentRequired()` and `returnPaymentRequired()` helpers
- Check for `PAYMENT-SIGNATURE` header; return 402 with `PAYMENT-REQUIRED` if missing
- Use `payments.facilitator.verifyPermissions()` to validate the token
- Use `payments.facilitator.settlePermissions()` to charge credits after success
- Return `PAYMENT-RESPONSE` header with settlement receipt

**Client-side:**
- Add `@nevermined-io/payments` import with Subscriber key
- Implement 402 handling: parse `PAYMENT-REQUIRED` header
- Use `payments.x402.getX402AccessToken(planId, agentId)` to obtain token
- Retry requests with `PAYMENT-SIGNATURE` header
- Parse `PAYMENT-RESPONSE` header for settlement info

---

## Troubleshooting

- HTTP 402 Payment Required
  - Missing `PAYMENT-SIGNATURE` header
  - Invalid or expired x402 token; obtain a fresh token via `payments.x402.getX402AccessToken()`
  - Plan has zero credits and you're not a subscriber; purchase the plan then retry
  - `NVM_AGENT_ID` or `NVM_PLAN_ID` mismatched between client and agent
- 401/403 Unauthorized
  - Access token invalid/expired; obtain a fresh token
  - Using Subscriber key on the server or Builder key on the client (keys swapped)
- 500 Internal server error after model run
  - Settlement failing. Log `settleErr` details
  - Timeouts or network issues reaching Nevermined; retry or increase timeouts
- Wrong `requestedUrl`
  - Ensure `NVM_AGENT_HOST` matches the externally reachable host used by clients
- staging_sandbox vs live
  - `NVM_ENVIRONMENT` must match keys and assets created in that environment
- x402 token parsing errors
  - Ensure the `PAYMENT-SIGNATURE` header contains the base64-encoded token
  - Check that `x402Version` in the token matches version 2

---

## .env.example

Copy to `.env` and adjust values:

```
# --- Server ---
OPENAI_API_KEY=sk-your-openai-key
PORT=3000
NVM_ENVIRONMENT=staging_sandbox # or live
BUILDER_NVM_API_KEY=your-builder-api-key
NVM_AGENT_ID=your-agent-id
NVM_PLAN_ID=your-plan-id
NVM_AGENT_HOST=http://localhost:3000 # public URL in production

# --- Client ---
AGENT_URL=http://localhost:3000
NVM_ENVIRONMENT=staging_sandbox # or live
SUBSCRIBER_NVM_API_KEY=your-subscriber-api-key
# Note: planId and agentId are discovered from the PAYMENT-REQUIRED header
```

## License

```
Apache License 2.0

(C) 2025 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions
and limitations under the License. 
