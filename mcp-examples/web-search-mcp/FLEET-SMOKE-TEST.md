# Testing web-search-mcp with LangSmith Fleet (static bearer header)

[LangSmith Fleet](https://docs.langchain.com/langsmith/fleet) connects to any remote MCP server by URL and attaches a static `Authorization` header to every call. Point it at this Nevermined-paywalled server and pass a delegation-scoped x402 access token as the bearer — the Fleet agent then buys `web_search` / `company_lookup` mid-task, inside your delegation's caps, with no payment code in Fleet.

> **Demo/sandbox.** Use a Nevermined **sandbox** API key + a **test-card** delegation so nothing is really charged. Results are mock; the x402 payment/gating is real.

## Steps

1. **Run the server** (`.env`: `NVM_API_KEY=sandbox:...`, `NVM_PLAN_ID=...`, `PORT=3010`):
   ```bash
   yarn install && yarn dev
   # expose over HTTPS for cloud Fleet:
   ngrok http 3010     # copy the https URL, set BASE_URL to it, restart
   ```
2. **Mint a token** from the delegation you authorized in the embed pop-up (or headlessly):
   ```ts
   const { delegationId } = await payments.delegation.createDelegation({
     provider: "erc4337", spendingLimitCents: 700, durationSecs: 604800, currency: "usdc",
   });
   const { accessToken } = await payments.x402.getX402AccessToken(
     process.env.NVM_PLAN_ID!, undefined, { delegationConfig: { delegationId } },
   );
   ```
3. **Gating check** (before Fleet):
   ```bash
   curl -X POST https://<host>/mcp \
     -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
     -H "Authorization: Bearer <accessToken>" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"agentic payments 2026"}}}'
   ```
   Expect results + a `_meta["x402/payment-response"]` receipt + a one-time `[x402] … falling back to the Authorization header` server log.
4. **Connect in Fleet** → agent's **Toolbox → MCP → Add server**: URL `https://<host>/mcp`, Auth = Header `Authorization` = `Bearer <accessToken>`. Set the agent's identity to **Fixed**; optionally enable **approval** on the paid tools.
5. **Run it** — prompt the agent to research something (it calls `web_search`), then to get verified company data (it calls `company_lookup`) — each a paid buy against the delegation.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 … Authorization header required` | Send the header on **every** call incl. discovery (`initialize`/`tools/list`). |
| Header path breaks after an SDK upgrade | The deprecated header fallback may be gone — pin the SDK, or use the OAuth path. |
| `Invalid NVM API Key` at startup | A real (sandbox) key is required; the server builds the Payments client on boot. |
