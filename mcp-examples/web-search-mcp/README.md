# Web Search MCP (Nevermined Payments) — demo

A minimal, **sandbox/demo** MCP server exposing two **paid** tools behind Nevermined x402 payments. It returns **mock** data (no external API, no keys) — it exists to demonstrate a LangChain Fleet agent buying tools mid-task against a card delegation.

## Tools

| Tool | Args | Returns |
|---|---|---|
| `web_search` | `{ query: string }` | Mock web-search results (title, url, snippet) — Exa-style |
| `company_lookup` | `{ name: string }` | Mock verified company data (registration, officers, standing) — Baselayer-style |

Both are gated with `payments.mcp.registerTool(..., { credits })`, so each call is a paid x402 request.

## Run

```bash
cp .env.example .env      # set NVM_API_KEY (sandbox: key) and NVM_PLAN_ID
yarn install
yarn dev                  # tsx src/main.ts  (default PORT 3010)
```

MCP endpoint: `http://localhost:3010/mcp` (streamable-HTTP). The transport is gated by `Authorization: Bearer <x402 token>`.

## Test with LangSmith Fleet

See [`FLEET-SMOKE-TEST.md`](./FLEET-SMOKE-TEST.md) — connect this server to a Fleet agent via a static bearer header so the agent buys `web_search` / `company_lookup` mid-task.

> **Demo/sandbox only.** Results are mock; the payment/gating is real Nevermined x402. This is **not** the production Exa / Baselayer integration — it stands in for those providers so the buying flow can be shown end-to-end.
