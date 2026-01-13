[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Weather MCP Server with Nevermined Payments

A minimal MCP server demonstrating how to protect AI tools with Nevermined Payments. Exposes a `weather.today(city)` tool, a `weather://today` resource, and a `weather.ensureCity` prompt — all protected with credit-based access control.

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

- **Authentication**: Validates user tokens via `Authorization` header
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
export NVM_AGENT_ID=...
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
const { info, stop } = await payments.mcp.start({
  port: 3002,
  agentId: process.env.NVM_AGENT_ID!,
  serverName: "weather-mcp",
  version: "0.1.0",
});
```

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

const { accessToken } = await payments.agents.getAgentAccessToken(
  process.env.NVM_PLAN_ID!,
  process.env.NVM_AGENT_ID!
);
```

### Call Protected Tools

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3002/mcp"),
  { requestInit: { headers: { Authorization: `Bearer ${accessToken}` } } }
);

const client = new Client({ name: "my-client" });
await client.connect(transport);

const result = await client.callTool({
  name: "weather.today",
  arguments: { city: "London" },
});
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP JSON-RPC requests |
| `GET /mcp` | SSE stream for notifications |
| `DELETE /mcp` | Session termination |
| `GET /health` | Health check |
| `GET /` | Server info |

## Error Codes

| Code | Description |
|------|-------------|
| `-32003` | Authorization required / Payment required / Insufficient credits |
| `-32002` | Server error |

## Environment Variables

### Server

```bash
NVM_API_KEY=...            # Builder/agent owner API key
NVM_AGENT_ID=...           # Agent ID registered in Nevermined
NVM_ENVIRONMENT=sandbox    # sandbox, live
PORT=3002                  # Optional, defaults to 3002
OPENAI_API_KEY=...         # For LLM-enhanced forecasts
```

### Client (Subscriber)

```bash
NVM_API_KEY=...            # Subscriber's API key
NVM_PLAN_ID=...            # Subscription plan ID
NVM_AGENT_ID=...           # Agent ID linked to plan
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
