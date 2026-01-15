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

**Important:** Both unprotected and protected files share the same structure and organization. This makes it easy to compare them side-by-side and understand exactly what needs to be added to transform an unprotected version into a protected one. The only differences are the payment-related functions and Nevermined SDK integration.

---

## Part 1 — Unprotected agent and client

The unprotected version exposes a POST `/ask` endpoint and a GET `/health` endpoint. A minimal client sends three sequential questions, preserving the returned `sessionId` so the model keeps context.

### 1.1 Server (unprotected)

The unprotected server uses OpenAI SDK directly and follows the same structure as the protected version. Key points in `agent/index_unprotected.ts`:

**Structure:** The file is organized into clear sections:
- Configuration
- Validation
- SDK Initialization (OpenAI only)
- Session Management
- Express App Initialization
- Prompt Configuration
- LLM Integration (OpenAI Direct)
- API Routes
- Server Initialization

**Key code:**
```ts
// Initialize OpenAI client
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Generate response using OpenAI API directly
async function generateLLMResponse(messages: any[], maxTokens: number) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    temperature: 0.3,
    max_tokens: maxTokens,
  });
  return { 
    response: completion.choices[0]?.message?.content || "No response generated",
    tokensUsed: completion.usage?.completion_tokens || 0
  };
}

// POST /ask without any payment protection
app.post("/ask", async (req: Request, res: Response) => {
  const input = String(req.body?.input_query ?? "").trim();
  if (!input) return res.status(400).json({ error: "Missing input" });

  let { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) sessionId = crypto.randomUUID();

  // Generate response
  const { response, tokensUsed } = await generateLLMResponse(messages, maxTokens);
  
  res.json({ output: response, sessionId });
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

The unprotected client follows the same structure as the protected version, making it easy to see what needs to be added. Key points in `client/index_unprotected.ts`:

**Structure:** The file is organized into clear sections:
- Configuration
- Demo Data
- Types
- SDK Initialization (empty - no external services)
- Validation
- Agent Communication
- Demo Execution
- Entry Point

**Key code:**
```ts
// Simple request to agent (no payment flow)
async function askAgent(input: string, sessionId?: string): Promise<AgentResponse> {
  const response = await fetch(`${AGENT_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_query: input, sessionId }),
  });
  
  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.status}`);
  }
  
  return await response.json() as AgentResponse;
}

// Run demo
const questions = [
  "Hi there! I'm new to investing and keep hearing about diversification...",
  "That makes sense! So if I want to start investing but only have $100 a month...",
  "I've been thinking about cryptocurrency. What should a beginner like me know...",
];

let sessionId: string | undefined;
for (const question of questions) {
  const result = await askAgent(question, sessionId);
  sessionId = result.sessionId;
  console.log(`🤖 FinGuide (Session: ${sessionId}):`);
  console.log(result.output);
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

Since both files share the same structure, transforming from unprotected to protected is straightforward. This section shows exactly what changes to make when converting `agent/index_unprotected.ts` into `agent/index_nevermined.ts` using the x402 protocol.

**Key advantage:** The identical file structure means you can easily compare sections side-by-side. Each section in the unprotected file has a corresponding section in the protected file, with payment-related code added.

**In the Configuration section:**
- Add Nevermined environment variables:
```ts
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "staging_sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";
const AGENT_URL = process.env.AGENT_URL || `http://localhost:${PORT}`;
```

**In the Validation section:**
- Add Nevermined validation:
```ts
if (!NVM_API_KEY || !NVM_AGENT_ID || !NVM_PLAN_ID) {
  console.error("Nevermined environment is required: set NVM_API_KEY, NVM_AGENT_ID, and NVM_PLAN_ID in .env");
  process.exit(1);
}
```

**In the SDK Initialization section:**
- Add imports at the top:
```ts
import { Payments, EnvironmentName, buildPaymentRequired } from "@nevermined-io/payments";
```

- Add Nevermined Payments SDK initialization:
```ts
const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENVIRONMENT });
```

**Add a new "Payment Helpers" section** (after "Credit Calculation" section):
- Add helper functions:
```ts
function returnPaymentRequired(res: Response, paymentRequired: any, errorMessage?: string): Response {
  const paymentRequiredBase64 = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return res.status(402).set("PAYMENT-REQUIRED", paymentRequiredBase64).json({ error: errorMessage || "Payment required" });
}

function decodePaymentToken(x402Token: string): any | null {
  try {
    const paymentPayload = JSON.parse(Buffer.from(x402Token, "base64").toString("utf-8"));
    if (!paymentPayload || paymentPayload.x402Version !== 2 || !paymentPayload.accepted) {
      return null;
    }
    return paymentPayload;
  } catch {
    return null;
  }
}

function buildPaymentResponse(settlementResult: any, paymentRequired: any, paymentPayload: any): string {
  const paymentResponse = {
    success: settlementResult.success,
    transaction: settlementResult.transaction || "",
    network: paymentRequired.accepts[0].network,
    payer: paymentPayload.payload?.authorization?.from || "",
  };
  return Buffer.from(JSON.stringify(paymentResponse)).toString("base64");
}
```

Note: The `buildPaymentRequired()` function is provided by the `@nevermined-io/payments` library, so you use it directly instead of defining it yourself.

**In the API Routes section, modify the `/ask` handler** to add payment verification and settlement:

The structure remains the same, but add payment checks at the beginning and settlement at the end:

```ts
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // NEW: Build payment requirements and check for payment signature
    const requestedUrl = `${AGENT_URL}${req.url}`;
    const paymentRequired = buildPaymentRequired(NVM_PLAN_ID, {
      endpoint: requestedUrl,
      agentId: NVM_AGENT_ID,
      httpVerb: req.method,
    });

    const paymentSignature = req.headers["payment-signature"] as string | undefined;
    if (!paymentSignature) {
      return returnPaymentRequired(res, paymentRequired, "PAYMENT-SIGNATURE header is required");
    }

    // NEW: Decode and validate payment token
    const paymentPayload = decodePaymentToken(paymentSignature);
    if (!paymentPayload) {
      return returnPaymentRequired(res, paymentRequired, "Invalid PAYMENT-SIGNATURE format");
    }

    // NEW: Verify permissions
    const expectedCredits = 10;
    const verification = await payments.facilitator.verifyPermissions({
      paymentRequired,
      x402AccessToken: paymentSignature,
      maxAmount: BigInt(expectedCredits),
    });
    if (!verification.isValid) {
      return returnPaymentRequired(res, paymentRequired, verification.invalidReason || "Payment verification failed");
    }

    // EXISTING: Extract input, get/create sessionId, generate response
    const input = String(req.body?.input_query ?? "").trim();
    if (!input) return res.status(400).json({ error: "Missing input" });
    
    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) sessionId = crypto.randomUUID();
    
    // ... existing LLM generation code ...
    const { response, tokensUsed } = await generateLLMResponse(messages, maxTokens);
    const creditAmount = calculateCreditAmount(tokensUsed, maxTokens);

    // NEW: Settle permissions after successful API call
    const settlementResult = await payments.facilitator.settlePermissions({
      paymentRequired,
      x402AccessToken: paymentSignature,
      maxAmount: BigInt(creditAmount),
    });

    // NEW: Build and return PAYMENT-RESPONSE header
    const paymentResponseBase64 = buildPaymentResponse(settlementResult, paymentRequired, paymentPayload);
    
    res.set("PAYMENT-RESPONSE", paymentResponseBase64).json({
      output: response,
      sessionId,
      payment: {
        creditsRedeemed: settlementResult.creditsRedeemed || creditAmount.toString(),
        remainingBalance: settlementResult.remainingBalance || "unknown",
      },
    });
  } catch (error: any) {
    // ... error handling ...
  }
});
```

Notes:
- The x402 protocol uses `PAYMENT-SIGNATURE` and `PAYMENT-REQUIRED` headers for payment authentication and requirements
- `payments.facilitator.verifyPermissions()` validates that the subscriber has sufficient credits before processing the request
- `payments.facilitator.settlePermissions()` burns the credits after successful request completion
- The agent provides `planId` and `agentId` to clients in the payment requirements, enabling them to obtain the necessary access tokens

---

## Migration checklist (unprotected → x402 protected)

Since both files share the same structure, you can work section by section:

**Agent-side (`agent/index_unprotected.ts` → `agent/index_nevermined.ts`):**
1. **Configuration section:** Add Nevermined environment variables (`NVM_API_KEY`, `NVM_ENVIRONMENT`, `NVM_AGENT_ID`, `NVM_PLAN_ID`, `AGENT_URL`)
2. **Validation section:** Add Nevermined validation checks
3. **SDK Initialization section:** 
   - Add `@nevermined-io/payments` import
   - Instantiate `payments = Payments.getInstance(...)`
4. **Add "Payment Helpers" section:** Add `returnPaymentRequired()`, `decodePaymentToken()`, and `buildPaymentResponse()` functions
5. **API Routes section:** 
   - Add payment verification at the start of `/ask` handler
   - Add payment settlement after successful LLM response
   - Add `PAYMENT-RESPONSE` header to response

**Client-side (`client/index_unprotected.ts` → `client/index_nevermined.ts`):**
1. **Configuration section:** Add `SUBSCRIBER_API_KEY` and `NVM_ENVIRONMENT`
2. **SDK Initialization section:** Add `@nevermined-io/payments` import and initialize Payments SDK
3. **Add "Token Cache" section:** Add token caching for efficiency
4. **Add "Payment Header Parsing" section:** Add functions to parse payment headers
5. **Add "Token Management" section:** Add functions to obtain and manage x402 tokens
6. **Agent Communication section:** 
   - Modify `askAgent()` to implement 402 → token → retry flow
   - Add `makeInitialRequest()`, `retryRequestWithPayment()`, and `handlePaymentRequired()` helper functions
7. **Demo Execution section:** Update `displayAgentResponse()` to show payment info

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
