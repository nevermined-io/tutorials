# Testing web-search-mcp with LangSmith Fleet

This is a **fully-mock** server: **no auth, no credentials**. Fleet connects to it as a plain remote MCP server (no bearer) and the agent calls the two tools; the point is to capture the agent *buying* Exa / Baselayer access mid-task.

## Steps

1. **Run + expose over HTTPS** (cloud Fleet needs an HTTPS URL):
   ```bash
   yarn install && yarn dev        # PORT 3010
   ngrok http 3010                 # copy the https URL
   ```
2. **Sanity check** the endpoint returns the two tools:
   ```bash
   curl -s -X POST https://<host>/mcp \
     -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```
   You should see `web_search` and `company_lookup`.
3. **Connect in Fleet** → the agent's **Toolbox → MCP → Add server**: URL `https://<host>/mcp`, **no authentication**.
4. **Run it** — prompt the agent to research a topic (it calls `web_search`), then to get verified company data (it calls `company_lookup`). Each reply ends with a footer showing the buy, e.g. `✓ Exa API access purchased · $7 charged to your card via Nevermined delegation` — capture the chat for the cookbook (image1 / image5).

## Making it real (production)

This mock stands in for the sellers. The real buyer flow mints an x402 **card-delegation** token via `payments.x402.getX402AccessToken(EXA_PLAN_ID, undefined, { scheme: "nvm:card-delegation", delegationConfig })` and POSTs it (`payment-signature` header) to Exa's `admin-api.exa.ai/team-management/nevermined/purchase-key` — **Exa** verifies + settles and returns the API key; then `api.exa.ai/search` with `x-api-key`. Baselayer follows the same pattern. See the README's "Making it real (production)" section.
