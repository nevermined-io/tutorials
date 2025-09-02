[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

## Financial Agent Tutorial (LangChain + OpenAI + Nevermined)

This tutorial shows how to evolve a simple financial-advice agent and client from an unprotected HTTP API to a Nevermined-protected, paid-access API. You will:

- Start with an unprotected agent and client
- Add Nevermined authorization to the agent
- Redeem credits on successful requests
- Update the client to purchase a plan (if needed), obtain an access token, and call the protected endpoint

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
.env                      # Environment variables (not committed)
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

## Part 2 — Protecting the agent with Nevermined

Now we add paid access protection. The high-level flow is:

1) The client obtains an access token for a specific `plan` and `agent`
2) The client calls the agent with `Authorization: Bearer <token>`
3) The agent verifies authorization using Nevermined
4) The agent completes the request and redeems one credit

### 2.1 Environment variables

Create a `.env` file in the project root. Use sandbox by default while testing.

For the protected agent (server):
```
OPENAI_API_KEY=sk-...
PORT=3000
NVM_ENV=sandbox
BUILDER_NVM_API_KEY=your-builder-api-key   # server-side key
NVM_AGENT_ID=your-agent-id                 # agent registered in Nevermined
NVM_AGENT_HOST=http://localhost:3000       # public URL in production
```

For the protected client:
```
AGENT_URL=http://localhost:3000
NVM_ENV=sandbox
SUBSCRIBER_NVM_API_KEY=your-subscriber-api-key  # client/subscriber key
NVM_PLAN_ID=your-plan-id                         # plan linked to the agent
NVM_AGENT_ID=your-agent-id
```

### 2.2 Server (protected) — add authorization

Key additions in `agent/index_nevermined.ts`:

1) Create a Nevermined `Payments` client (server side uses the Builder key). This object talks to the Nevermined backend to validate access and redeem credits.
```ts
import { Payments, EnvironmentName } from "@nevermined-io/payments";

const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENV = (process.env.NVM_ENV || "sandbox") as EnvironmentName; // or "live" for prod environment
const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENV });
```

2) Extract the `Authorization` header and the HTTP request context. We will pass these to Nevermined to verify that the token is valid for this `agent` and endpoint.
```ts
const authHeader = (req.headers["authorization"] || "") as string;
const requestedUrl = `${NVM_AGENT_HOST}${req.url}`; 
const httpVerb = req.method; 
```

3) Ask Nevermined to start processing this request. This validates the token and returns metadata:
```ts
const result = await payments.requests.startProcessingRequest(
  NVM_AGENT_ID,
  authHeader,
  requestedUrl,
  httpVerb
);
```

4) Enforce access policy. If the caller is not a subscriber and has no valid credits for the plan/agent, return HTTP 402 (Payment Required).
```ts
if (!result.balance.isSubscriber || result.balance.balance < 1n) {
  const error: any = new Error("Payment Required");
  error.statusCode = 402;
  throw error;
}
```

5) Capture two important values for later:
- **agentRequestId**: a unique identifier Nevermined assigns to this in-flight request. You must use it when redeeming credits.
- **requestAccessToken**: the token extracted from the `Authorization` header, used again during redemption.
```ts
const requestAccessToken = authHeader.replace(/^Bearer\s+/i, "");
const agentRequestId = result.agentRequestId;
```

6) Wrap the above in a helper you can call at the top of protected handlers:
```ts
async function ensureAuthorized(req: Request): Promise<{ agentRequestId: string; requestAccessToken: string }> {
  const authHeader = (req.headers["authorization"] || "") as string;
  const requestedUrl = `${NVM_AGENT_HOST}${req.url}`;
  const httpVerb = req.method;
  const result = await payments.requests.startProcessingRequest(NVM_AGENT_ID, authHeader, requestedUrl, httpVerb);
  if (!result.balance.isSubscriber || result.balance.balance < 1n) {
    const error: any = new Error("Payment Required");
    error.statusCode = 402;
    throw error;
  }
  const requestAccessToken = authHeader.replace(/^Bearer\s+/i, "");
  return { agentRequestId: result.agentRequestId, requestAccessToken };
}
```

7) Use `ensureAuthorized` at the very beginning of your protected endpoint. If it throws, reply accordingly; otherwise, proceed with your normal logic.
```ts
app.post("/ask", async (req: Request, res: Response) => {
  try {
    const { agentRequestId, requestAccessToken } = await ensureAuthorized(req);
    // ... run your model and build the response ...
  } catch (error: any) {
    const status = error?.statusCode === 402 ? 402 : 500;
    res.status(status).json({ error: status === 402 ? "Payment Required" : "Internal server error" });
  }
});
```

### 2.3 Server (protected) — redeem credits after success

After you successfully generate the response, redeem credits so the user is charged for usage. This is a separate call to tie consumption to the validated request.

- You must pass the same `agentRequestId` returned by `startProcessingRequest`
- You must include the `requestAccessToken` used for authorization
- The third parameter is the number of credits to redeem (as a bigint)

```ts
try {
  await payments.requests.redeemCreditsFromRequest(
    agentRequestId,      // from ensureAuthorized
    requestAccessToken,  // from ensureAuthorized
    1n                   // redeem one credit for this request
  );
} catch (redeemErr) {
  console.error("Failed to redeem credits:", redeemErr);
}
```

Putting it together, a minimal protected handler follows this sequence (omitting non-essential details):
```ts
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // 1) Authorize
    const { agentRequestId, requestAccessToken } = await ensureAuthorized(req);

    // 2) Perform your business logic
    //    - validate body
    //    - run LLM with per-session memory
    //    - build response text

    // 3) Redeem credits (charge usage)
    await payments.requests.redeemCreditsFromRequest(agentRequestId, requestAccessToken, 1n);

    // 4) Return response
    res.json({ output: text, sessionId });
  } catch (error: any) {
    const status = error?.statusCode === 402 ? 402 : 500;
    res.status(status).json({ error: status === 402 ? "Payment Required" : "Internal server error" });
  }
});
```

Run the protected server:
```
PORT=3000 OPENAI_API_KEY=sk-... \
BUILDER_NVM_API_KEY=... NVM_ENV=sandbox NVM_AGENT_ID=... \
npm run dev:agent
```
Health check:
```
curl http://localhost:3000/health
```

---

## Part 3 — Updating the client to use Nevermined

The protected client must:
1) Check if it has plan access/credits; if not subscribed and no credits, purchase the plan
2) Obtain an access token for the plan + agent
3) Send `Authorization: Bearer <token>` in each request

### 3.1 Get or buy an access token

In `client/index_nevermined.ts`, the client ensures it has access before calling the agent:

1) Initialize the client-side `Payments` using the Subscriber key:
```ts
import { Payments, EnvironmentName } from "@nevermined-io/payments";
const payments = Payments.getInstance({ nvmApiKey: opts.nvmApiKey, environment: opts.nvmEnv });
```

2) Check your plan status. If not a subscriber and no credits remain, purchase the plan:
```ts
const balanceInfo: any = await payments.plans.getPlanBalance(opts.planId);
const hasCredits = Number(balanceInfo?.balance ?? 0) > 0;
const isSubscriber = balanceInfo?.isSubscriber === true;
if (!isSubscriber && !hasCredits) {
  await payments.plans.orderPlan(opts.planId);
}
```

3) Request an access token bound to the `planId` and `agentId`:
```ts
const creds = await payments.agents.getAgentAccessToken(opts.planId, opts.agentId);
if (!creds?.accessToken) throw new Error("Access token unavailable");
return creds.accessToken;
```

### 3.2 Call the agent with Authorization header

Include the token in every request to protected endpoints. The protected server expects `input_query` and an optional `sessionId`:
```ts
const res = await fetch(`${baseUrl}/ask`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearer}`,
  },
  body: JSON.stringify({ input_query: input, sessionId }),
});
```

If the token is missing/invalid or the plan has no credits, the agent will reply with HTTP 402.

### 3.3 Putting it together (client main)

```ts
const baseUrl = process.env.AGENT_URL || "http://localhost:3000";

const planId = process.env.NVM_PLAN_ID as string;
const agentId = process.env.NVM_AGENT_ID as string;
const nvmApiKey = process.env.SUBSCRIBER_NVM_API_KEY as string;
const nvmEnv = (process.env.NVM_ENV || "sandbox") as EnvironmentName;

const bearer = await getOrBuyAccessToken({ planId, agentId, nvmApiKey, nvmEnv });

let sessionId: string | undefined;
for (const input of questions) {
  const response = await askAgent(baseUrl, input, sessionId, bearer);
  sessionId = response.sessionId;
  console.log(`[AGENT] (sessionId=${sessionId})\n${response.output}`);
}
```

Run it (in a separate terminal):
```
AGENT_URL=http://localhost:3000 \
SUBSCRIBER_NVM_API_KEY=... NVM_ENV=sandbox \
NVM_PLAN_ID=... NVM_AGENT_ID=... \
npm run dev:client
```

---

## Commands quick reference

Unprotected flow:
```
# Terminal A (agent)
PORT=3001 OPENAI_API_KEY=sk-... npm run dev:agent:unprotected

# Terminal B (client)
AGENT_URL=http://localhost:3001 npm run dev:client:unprotected
```

Protected flow:
```
# Terminal A (agent)
PORT=3000 OPENAI_API_KEY=sk-... \
BUILDER_NVM_API_KEY=... NVM_ENV=sandbox NVM_AGENT_ID=... \
npm run dev:agent

# Terminal B (client)
AGENT_URL=http://localhost:3000 \
SUBSCRIBER_NVM_API_KEY=... NVM_ENV=sandbox \
NVM_PLAN_ID=... NVM_AGENT_ID=... \
npm run dev:client
```

---

## Notes and tips
- Session memory is in-memory for simplicity; for production, use a durable store.
- Use `sandbox` while testing payments; switch to `live` when ready.
- Ensure you use the correct API keys: `BUILDER_NVM_API_KEY` on the server, `SUBSCRIBER_NVM_API_KEY` on the client.
- If the client receives HTTP 402, it means the request isn’t authorized (no subscription/credits or missing/invalid token).

---

## Unprotected → Protected: 1:1 code mapping

This section shows exactly what changes to make when converting `agent/index_unprotected.ts` into `agent/index_nevermined.ts`. 

- Add imports:
```ts
import { Payments, EnvironmentName } from "@nevermined-io/payments";
```

- Add Nevermined configuration (after OpenAI checks):
```ts
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENV = (process.env.NVM_ENV || "sandbox") as EnvironmentName; // or "live"
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_AGENT_HOST = process.env.NVM_AGENT_HOST || `http://localhost:${PORT}`;
if (!NVM_API_KEY || !NVM_AGENT_ID) {
  console.error("Nevermined environment is required: set NVM_API_KEY and NVM_AGENT_ID in .env");
  process.exit(1);
}
```

- Create a singleton `payments` client (near other singletons like `model`):
```ts
const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENV });
```

- Introduce an authorization helper (before route handlers):
```ts
async function ensureAuthorized(req: Request): Promise<{ agentRequestId: string; requestAccessToken: string }> {
  const authHeader = (req.headers["authorization"] || "") as string;
  const requestedUrl = `${NVM_AGENT_HOST}${req.url}`;
  const httpVerb = req.method;
  const result = await payments.requests.startProcessingRequest(NVM_AGENT_ID, authHeader, requestedUrl, httpVerb);
  if (!result.balance.isSubscriber || result.balance.balance < 1n) {
    const error: any = new Error("Payment Required");
    error.statusCode = 402;
    throw error;
  }
  const requestAccessToken = authHeader.replace(/^Bearer\s+/i, "");
  return { agentRequestId: result.agentRequestId, requestAccessToken };
}
```

- Modify `/ask` handler: call `ensureAuthorized` first, and redeem credits before responding:
```ts
app.post("/ask", async (req: Request, res: Response) => {
  try {
    const { agentRequestId, requestAccessToken } = await ensureAuthorized(req);
    // ... existing input/session handling + LLM invocation ...
    await payments.requests.redeemCreditsFromRequest(agentRequestId, requestAccessToken, 1n);
    res.json({ output: text, sessionId });
  } catch (error: any) {
    const status = error?.statusCode === 402 ? 402 : 500;
    res.status(status).json({ error: status === 402 ? "Payment Required" : "Internal server error" });
  }
});
```

Notes:
- `agentRequestId` is a unique id for the current request; use it when redeeming credits so consumption is tied to a validated request.
- `requestAccessToken` is the token extracted from `Authorization: Bearer ...`; pass it to redemption as well.
- `NVM_AGENT_HOST` should reflect how clients reach your agent (public URL in production). It’s used to build `requestedUrl` for Nevermined request verification.

---

## Migration checklist (unprotected → protected)

- Add `@nevermined-io/payments` import in the agent
- Add env vars: `BUILDER_NVM_API_KEY`, `NVM_ENV`, `NVM_AGENT_ID`, `NVM_AGENT_HOST`
- Instantiate `payments = Payments.getInstance(...)`
- Add `ensureAuthorized(req)` and call it at the start of protected handlers
- On success, call `payments.requests.redeemCreditsFromRequest(agentRequestId, requestAccessToken, 1n)`
- Handle 402 errors (`Payment Required`) distinctly from 500
- On the client, add Subscriber key, plan/agent ids, `getOrBuyAccessToken`, and send `Authorization: Bearer <token>`

---

## Troubleshooting

- HTTP 402 Payment Required
  - Missing `Authorization` header or token malformed (must be `Bearer <token>`)
  - Plan has zero credits and you’re not a subscriber; purchase the plan then retry
  - `NVM_AGENT_ID` mismatched between client/agent
- 401/403 Unauthorized
  - Access token invalid/expired; obtain a fresh token
  - Using Subscriber key on the server or Builder key on the client (keys swapped)
- 500 Internal server error after model run
  - Redemption failing. Log `redeemErr` details; ensure you pass both `agentRequestId` and `requestAccessToken`
  - Timeouts or network issues reaching Nevermined; retry or increase timeouts
- Wrong `requestedUrl`
  - Ensure `NVM_AGENT_HOST` matches the externally reachable host used by clients
- Sandbox vs live
  - `NVM_ENV` must match keys and assets created in that environment

---

## .env.example

Copy to `.env` and adjust values:

```
# --- Server ---
OPENAI_API_KEY=sk-your-openai-key
PORT=3000
NVM_ENV=sandbox # or live
BUILDER_NVM_API_KEY=your-builder-api-key
NVM_AGENT_ID=your-agent-id
NVM_AGENT_HOST=http://localhost:3000 # public URL in production

# --- Client ---
AGENT_URL=http://localhost:3000
NVM_ENV=sandbox # or live
SUBSCRIBER_NVM_API_KEY=your-subscriber-api-key
NVM_PLAN_ID=your-plan-id
NVM_AGENT_ID=your-agent-id
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
