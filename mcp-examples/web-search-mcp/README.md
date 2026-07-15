# Web Search MCP — fully-mock buyer-side demo

A **fully-mock** MCP server for the "Agents That Pay" cookbook. It exposes two tools over streamable-HTTP and returns canned results — **no credentials, no auth, no payments**. It exists so a **LangChain Fleet** agent can be shown *buying* from external sellers (Exa / Baselayer) mid-task, for screenshots.

> In the real flow the **sellers** (Exa, Baselayer) verify + settle the payment; this server is **not** a paywall. It only stands in for their responses so the buying moment is visible in the Fleet chat.

## Tools

| Tool | Args | Returns |
|---|---|---|
| `web_search` | `{ query: string }` | Mock Exa-style results (title, url, snippet) + a "paid Exa via delegation" footer |
| `company_lookup` | `{ name: string }` | Mock Baselayer-style verified company data + a "paid Baselayer via delegation" footer |

## Run (zero setup — no creds)

```bash
yarn install
yarn dev            # tsx src/main.ts  (default PORT 3010)
```

- MCP endpoint: `POST http://localhost:3010/mcp` (streamable-HTTP, **no auth** — Fleet connects with no bearer).
- Health: `GET http://localhost:3010/health`.

Quick check:

```bash
curl -s -X POST http://localhost:3010/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Test with LangSmith Fleet

See [`FLEET-SMOKE-TEST.md`](./FLEET-SMOKE-TEST.md) — expose the server over HTTPS, add it to a Fleet agent as a remote MCP server (no auth), prompt the agent, and capture the chat.

## Making it real (production)

To turn this into a real buyer, each tool would perform the actual purchase against the seller (the seller verifies + settles). For **Exa** (`web_search`), mint an x402 **card-delegation** token and POST it to Exa, which returns an API key:

```ts
const { accessToken } = await payments.x402.getX402AccessToken(
  EXA_PLAN_ID,
  undefined,
  {
    scheme: "nvm:card-delegation",
    delegationConfig: { providerPaymentMethodId, spendingLimitCents: 700, durationSecs: 3600 },
  },
);
const { apiKey } = await (
  await fetch("https://admin-api.exa.ai/team-management/nevermined/purchase-key", {
    method: "POST",
    headers: { "payment-signature": accessToken },
  })
).json();
// then search: POST https://api.exa.ai/search  with header  x-api-key: <apiKey>
```

(See Exa's docs: `exa.ai/docs/integrations/nevermined.md` — a $7 purchase provisions or tops up the key.) **Baselayer** (`company_lookup`) follows the same pattern against its own agent-payment endpoint. The delegation — an enrolled card + spend caps — is authorized once via the Nevermined embed; the agent then buys inside those caps with no human in the loop.
