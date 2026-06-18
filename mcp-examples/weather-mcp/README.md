[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Weather MCP Server with Nevermined Payments

A minimal MCP server demonstrating how to protect AI tools with Nevermined Payments. Exposes a `weather.today(city)` tool, a `weather://today` resource, and a `weather.ensureCity` prompt — all protected with credit-based access control.

> Uses the **x402 v2 in-band MCP transport** with plan-centric config (`planId` required, `agentId` optional). Requires `@nevermined-io/payments` **≥ 1.9.0**. The `Authorization: Bearer` header authenticates the MCP session; a header-only payment (no `_meta`) still works as a deprecated fallback for one release.

## Documentation

| Document | Description |
|----------|-------------|
| [RUN.md](RUN.md) | Setup and running instructions |
| [CLAUDE.md](CLAUDE.md) | AI agent context and technical reference |

## What is MCP?

The **Model Context Protocol (MCP)** is a standardized communication layer for AI. It allows agents to discover and use server capabilities through:

- **Tools**: Actions the agent can execute (e.g., fetch weather data)
- **Resources**: Stable data pointers identified by URI (e.g., JSON weather data)
- **Prompts**: Pre-defined templates guiding agent behavior

## Why Nevermined Payments?

While MCP defines *what* an agent can do, it doesn't specify *who* can access it or *how* to charge for it. **Nevermined Payments** adds:

- **Authentication**: The MCP session is OAuth-protected — the client authenticates with an `Authorization: Bearer <accessToken>` header — and the per-call payment is read in band from the MCP request `_meta["x402/payment"]` (a header-only payment, with no `_meta`, is still accepted as a deprecated fallback)
- **Credit System**: Checks and deducts credits per request
- **Automatic Setup**: Handles Express, sessions, OAuth endpoints

## Project Structure

```
src/
├── main.ts                  # MCP server with Nevermined Payments
└── services/
    └── weather.service.ts   # Weather API service (Open-Meteo)
```

## Quick Start

```bash
# Install
yarn install

# Configure environment
export NVM_API_KEY=...
export NVM_PLAN_ID=...
export NVM_ENVIRONMENT=sandbox
export OPENAI_API_KEY=...

# Run
yarn start
```

See [RUN.md](RUN.md) for complete setup instructions.

## Features Demonstrated

| Type | Name | Credits | Description |
|------|------|---------|-------------|
| Tool | `weather.today` | 1 | Get weather summary for a city |
| Resource | `weather://today` | 5 | Raw JSON weather data |
| Prompt | `weather.ensureCity` | 1-2 | Guide to call weather.today |

## How It Works

### 1. Initialize Nevermined Payments

```typescript
import { Payments, EnvironmentName } from "@nevermined-io/payments";

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: process.env.NVM_ENVIRONMENT! as EnvironmentName,
});
```

### 2. Register Protected Tools

```typescript
import { z } from "zod";

const schema = z.object({
  city: z.string().describe("City name"),
}) as any;

payments.mcp.registerTool(
  "weather.today",
  {
    title: "Today's Weather",
    description: "Get weather for a city",
    inputSchema: schema,
  },
  async (args) => {
    const { city } = args as { city: string };
    return {
      content: [{ type: "text", text: `Weather for ${city}: Sunny, 25C` }],
    };
  },
  { credits: 1n }
);
```

### 3. Register Protected Resources

```typescript
payments.mcp.registerResource(
  "Weather Data",
  "weather://today",
  {
    title: "Today's Weather",
    description: "JSON weather data",
    mimeType: "application/json",
  },
  async (uri) => {
    return {
      contents: [{ uri: uri.href, text: "{...}", mimeType: "application/json" }],
    };
  },
  { credits: 5n }
);
```

### 4. Register Protected Prompts

```typescript
payments.mcp.registerPrompt(
  "weather.ensureCity",
  {
    title: "Ensure city",
    description: "Guide to call weather.today",
    argsSchema: schema,
  },
  (args) => {
    return {
      messages: [{ role: "user", content: { type: "text", text: "..." } }],
    };
  },
  { credits: (ctx) => ctx.result.length > 100 ? 2n : 1n }  // Dynamic credits
);
```

### 5. Start the Server

```typescript
const PORT = parseInt(process.env.PORT || "3000", 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const { info, stop } = await payments.mcp.start({
  port: PORT,
  baseUrl: BASE_URL,  // External URL for OAuth metadata
  planId: process.env.NVM_PLAN_ID!,  // required — the plan tool calls settle against
  serverName: "weather-mcp",
  version: "0.1.0",
});
```

The `baseUrl` parameter is important for production deployments. It determines the URLs returned in OAuth metadata endpoints like `/.well-known/oauth-protected-resource`.

## Credit Configuration

All registration functions support fixed or dynamic credits:

```typescript
// Fixed credits
{ credits: 1n }
{ credits: 5n }

// Dynamic credits based on input
{ credits: (ctx) => ctx.args.premium ? 5n : 1n }

// Dynamic credits based on result
{ credits: (ctx) => ctx.result.length > 1000 ? 3n : 1n }

// Tiered pricing
{ credits: (ctx) => {
  const size = JSON.stringify(ctx.result).length;
  if (size > 1000) return 5n;
  if (size > 500) return 3n;
  return 1n;
}}
```

## Client Usage

### Get Access Token

```typescript
import { Payments } from "@nevermined-io/payments";

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: "sandbox",
});

// agentId is optional under the plan-centric model — the plan id is all you need
const { accessToken } = await payments.agents.getAgentAccessToken(
  process.env.NVM_PLAN_ID!
);
```

### Call Protected Tools

Send the payment **in band** via the MCP request `_meta["x402/payment"]` field (x402 v2 MCP transport). The access token is a base64-encoded `PaymentPayload`; `decodeAccessToken` turns it back into the plain-JSON object the server reads from `_meta`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { decodeAccessToken } from "@nevermined-io/payments";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3002/mcp"),
  // The MCP session is an OAuth-protected resource: authenticate it with the
  // access token (without it, `initialize` returns 401). The per-call payment
  // is sent in band via `_meta` below.
  { requestInit: { headers: { Authorization: `Bearer ${accessToken}` } } }
);

const client = new Client({ name: "my-client" });
await client.connect(transport);

const result = await client.callTool({
  name: "weather.today",
  arguments: { city: "London" },
  // In-band payment (x402 v2 MCP transport): plain-JSON PaymentPayload, not base64.
  _meta: { "x402/payment": decodeAccessToken(accessToken) },
});
```

When payment is required or settlement fails, the tool result comes back with `isError: true` and a `PaymentRequired` object in `structuredContent` (and JSON-stringified in `content[0].text`); on success the settlement receipt is returned in the response `_meta["x402/payment-response"]`.

> **Session auth vs. payment**: the `Authorization: Bearer ${accessToken}` header authenticates the MCP session (it's an OAuth-protected resource — `initialize` returns `401` without it), which is why it's set on the transport above. The **payment** is sent separately, in band, via `_meta["x402/payment"]`. Sending the token via the header *alone* (no `_meta`) also settles the payment for one release — a deprecated fallback — but `_meta` is the spec-aligned payment form.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP JSON-RPC requests |
| `GET /mcp` | SSE stream for notifications |
| `DELETE /mcp` | Session termination |
| `GET /health` | Health check |
| `GET /` | Server info |
| `GET /.well-known/oauth-protected-resource` | OAuth metadata (uses `BASE_URL`) |

## Error Codes

| Code | Description |
|------|-------------|
| `-32003` | Authorization required / Payment required / Insufficient credits |
| `-32002` | Server error |

> Under the in-band transport, **tool** calls signal payment-required/settlement-failure as a tool result with `isError: true` + a `PaymentRequired` object in `structuredContent` (not a JSON-RPC error). **Resources and prompts** — which have no tool-result error channel — still raise the `-32003` JSON-RPC error above.

## Environment Variables

### Server

```bash
NVM_API_KEY=...            # Builder/agent owner API key
NVM_PLAN_ID=...            # Plan tool calls settle against (required)
# NVM_AGENT_ID=...         # Optional — informational only (plan-centric)
NVM_ENVIRONMENT=sandbox    # sandbox, live
PORT=3000                  # Optional, defaults to 3000
OPENAI_API_KEY=...         # For LLM-enhanced forecasts
BASE_URL=...               # External URL (required for production/Docker)
```

**Note on `BASE_URL`**: When deploying behind a reverse proxy or in Docker, set `BASE_URL` to your external domain (e.g., `https://weather-mcp-agent.nevermined.dev`). This ensures OAuth metadata endpoints return correct URLs. For local development, leave it unset to default to `http://localhost:PORT`.

### Client (Subscriber)

```bash
NVM_API_KEY=...            # Subscriber's API key
NVM_PLAN_ID=...            # Subscription plan ID
# NVM_AGENT_ID=...         # Optional — informational only (plan-centric)
```

## Migration from Original MCP SDK

| Original SDK | Nevermined Payments |
|-------------|---------------------|
| `new McpServer({...})` | `Payments.getInstance({...})` |
| `server.tool(name, schema, handler)` | `payments.mcp.registerTool(name, metadata, handler, {credits})` |
| `server.resource(...)` | `payments.mcp.registerResource(...)` |
| `server.prompt(...)` | `payments.mcp.registerPrompt(...)` |
| Manual Express setup | `payments.mcp.start({...})` |

## License

See [LICENSE](LICENSE) file.
