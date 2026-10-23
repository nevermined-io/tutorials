# Testing weather-mcp with LangSmith Fleet (static bearer header)

[LangSmith Fleet](https://docs.langchain.com/langsmith/fleet) is LangChain's no-code agent builder. It can connect to a **remote MCP server by URL** and attach a **static `Authorization` header** to every request. This runbook proves, with the least setup, that a Fleet agent can pay this Nevermined-gated MCP server through that static-header path.

> **What this proves:** a Fleet agent pays a Nevermined-gated MCP tool with an operator-provisioned, spend-capped token in a static header.
> **What it does not prove:** per-user, agent-driven delegation setup (the card-enroll popup) — that's a separate, OAuth-based flow.

## How the payment travels

This server implements the **x402 v2 MCP transport**: it prefers the in-band payment payload in `_meta["x402/payment"]`, and **falls back to the `Authorization: Bearer <token>` header** when `_meta` is absent (a one-time deprecation warning, not an error). Fleet injects static headers but not per-call `_meta`, so the smoke test rides that header fallback.

> ⚠️ The header fallback is **deprecated**. For a Fleet-backed deployment, pin an exact SDK version (this tutorial uses `@nevermined-io/payments@^1.10.0`) and track the fallback's removal. A first-class OAuth path is the durable integration.

## Prerequisites

- A **sandbox NVM API key** (subscriber) — its account auto-has an `erc4337` smart-account wallet (no card needed). The key prefix now selects the environment (`sandbox:…`), so the `environment` option is no longer required.
- `node` + `yarn`, and **`ngrok`** (Fleet needs an HTTPS URL).
- A Fleet workspace with the **"MCP Server Create"** permission.
- Optional `OPENAI_API_KEY` for richer forecasts.

## Steps

### 1. Install (already on the latest SDK)
```bash
cd mcp-examples/weather-mcp
yarn install          # resolves @nevermined-io/payments@1.10.0
```

### 2. Register a plan + agent (sandbox, crypto, fixed-credits)
Use the SDK's `payments.agents.registerAgentAndPlan(...)` (a crypto ERC-20 price config + a fixed-credits config) to get an `{ agentId, planId }`. The `nvm-deploy-e2e` skill in the `nevermined-io/nvm-monorepo` repo (`register-test.ts`) is a ready-made script for this.

### 3. Run the server + expose it over HTTPS
```bash
# .env:  NVM_API_KEY=sandbox:...  NVM_AGENT_ID=<agentId>  PORT=3002  [OPENAI_API_KEY=...]
yarn dev                 # tsx src/main.ts   (use `yarn dev`, not `yarn start`)
# second terminal:
ngrok http 3002          # copy the https URL
```
Set `BASE_URL=https://<ngrok>` in `.env` and restart — `BASE_URL` is what the server's OAuth metadata advertises. Transport is streamable-HTTP at `POST /mcp`.

### 4. Mint a token (crypto delegation — no card)
```ts
const { delegationId } = await payments.delegation.createDelegation({
  provider: "erc4337", spendingLimitCents: 10000, durationSecs: 604800, currency: "usdc",
});
const { accessToken } = await payments.x402.getX402AccessToken(
  planId, agentId, { delegationConfig: { delegationId } },
);
```
(`getX402AccessToken` **requires** a `delegationConfig`; there is no delegation-free mint. `erc4337` is headless — no popup.)

### 5. Gating check — confirm the header path works *before* touching Fleet
```bash
curl -X POST https://<ngrok>/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"weather.today","arguments":{"city":"London"}}}'
```
Expect a forecast, a `_meta["x402/payment-response"]` settlement receipt, and a one-time `[x402] … falling back to the Authorization header` warning in the server log. **If the weather comes back, the static-header contract Fleet needs is proven.**

### 6. Wire it into Fleet
Add a **remote MCP server**: URL = `https://<ngrok>/mcp`, Auth = Header `Authorization` = `Bearer <accessToken>`. Then chat *"what's the weather in London?"* — the agent calls the tool and the server charges against the delegation.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 … Authorization header required` | The header must be on **every** call including discovery (`initialize`/`tools/list`). Ensure Fleet attaches it to both. |
| `getAgentAccessToken is not a function` | Removed method — use `payments.x402.getX402AccessToken(planId, agentId, { delegationConfig })`. |
| `delegationConfig is required …` | Pass `delegationConfig: { delegationId }` (create the delegation first). |
| `Invalid NVM API Key` at startup | A real sandbox key is required; the server constructs the Payments client on boot. |
| Header path breaks after an SDK upgrade | The deprecated header fallback may have been removed — pin the SDK version, or move to the OAuth path. |
| `[DEPRECATED] The 'environment' option …` | 1.10.0 derives the environment from the API-key prefix; drop the `environment` option. |
