# CLAUDE.md - AI Agent Context

This file provides context for AI agents working with this repository.

## Project Overview

This is a **Weather MCP Server** demonstrating how to protect AI tools using **Nevermined Payments**. It's a reference implementation showing how to monetize MCP (Model Context Protocol) endpoints with credit-based access control.

## Key Concepts

### Model Context Protocol (MCP)

MCP is a standardized communication layer for AI that allows agents to discover and use server capabilities:

- **Tools**: Actions the agent can request (e.g., `weather.today` fetches weather data)
- **Resources**: Stable data pointers identified by URI (e.g., `weather://today` returns JSON)
- **Prompts**: Pre-defined templates guiding agent behavior

### Nevermined Payments Integration

The `@nevermined-io/payments` library adds a paywall layer:

1. **Authentication**: Validates `Authorization: Bearer <token>` header
2. **Credit Check**: Verifies user has sufficient credits
3. **Execution**: Runs the handler if authorized
4. **Credit Burn**: Deducts credits after successful execution

## Project Structure

```
weather-mcp/
├── src/
│   ├── main.ts                    # MCP server entry point
│   └── services/
│       └── weather.service.ts     # Weather API (Open-Meteo)
├── CLAUDE.md                      # This file (AI context)
├── RUN.md                         # Running instructions
├── README.md                      # Project documentation
├── package.json                   # Dependencies and scripts
└── .env                           # Environment variables (not committed)
```

## Key Files

### `src/main.ts`

Main server file containing:

- **Payments initialization**: `Payments.getInstance()` singleton
- **Tool registration**: `payments.mcp.registerTool()` with credit config
- **Resource registration**: `payments.mcp.registerResource()` with credit config
- **Prompt registration**: `payments.mcp.registerPrompt()` with dynamic credits
- **Server startup**: `payments.mcp.start()` handles Express, sessions, OAuth
- **LLM integration**: OpenAI for enhanced weather forecasts

### `src/services/weather.service.ts`

Weather data service:

- `getTodayWeather(city)`: Fetches weather from Open-Meteo API
- `sanitizeCity(city)`: Input validation
- `geocodeCity(city)`: City name to coordinates
- `weatherCodeToText(code)`: Weather code descriptions
- Custom errors: `CityNotFoundError`, `DownstreamError`

## API Patterns

### Registration Pattern

```typescript
payments.mcp.registerTool(
  "tool.name",           // Unique tool identifier
  {
    title: "...",        // Human-readable title
    description: "...",  // Tool description
    inputSchema: zodSchema,  // Zod validation schema
  },
  handlerFunction,       // async (args, extra?) => result
  { credits: 1n }        // Credit configuration (BigInt or function)
);
```

### Credit Configuration

```typescript
// Fixed credits
{ credits: 1n }

// Dynamic credits based on input
{ credits: (ctx) => ctx.args.premium ? 5n : 1n }

// Dynamic credits based on result
{ credits: (ctx) => ctx.result.length > 1000 ? 3n : 1n }
```

### Handler Response Format

```typescript
// Tool response
return {
  content: [
    { type: "text", text: "..." },
    { type: "resource_link", uri: "...", name: "...", mimeType: "..." },
  ],
  structuredContent: { /* optional structured data */ },
};

// Resource response
return {
  contents: [
    { uri: "...", text: "...", mimeType: "application/json" },
  ],
};

// Prompt response
return {
  messages: [
    { role: "user", content: { type: "text", text: "..." } },
  ],
};
```

## Environment Variables

### Required for Server

| Variable | Description |
|----------|-------------|
| `NVM_API_KEY` | Nevermined API key (builder/agent owner) |
| `NVM_AGENT_ID` | Agent ID registered in Nevermined |
| `NVM_ENVIRONMENT` | Environment: `sandbox`, `live` |
| `OPENAI_API_KEY` | OpenAI API key for LLM forecasts |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:PORT` | External URL for OAuth metadata. Required for production/Docker deployments (e.g., `https://weather-mcp-agent.nevermined.dev`) |

### Required for Client

| Variable | Description |
|----------|-------------|
| `NVM_API_KEY` | Subscriber's API key |
| `NVM_PLAN_ID` | Subscription plan ID |
| `NVM_AGENT_ID` | Agent ID linked to plan |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | MCP JSON-RPC requests |
| `GET` | `/mcp` | SSE stream for notifications |
| `DELETE` | `/mcp` | Session termination |
| `GET` | `/health` | Health check |
| `GET` | `/` | Server info |
| `GET` | `/.well-known/oauth-protected-resource` | OAuth metadata (uses `BASE_URL`) |

## Error Codes

| Code | Meaning |
|------|---------|
| `-32003` | Authorization required / Payment required / Insufficient credits |
| `-32002` | Server error |

## MCP Capabilities Exposed

| Type | Name | Credits | Description |
|------|------|---------|-------------|
| Tool | `weather.today` | 1 | Get weather for a city |
| Resource | `weather://today` | 5 | Raw JSON weather data |
| Prompt | `weather.ensureCity` | 1-2 (dynamic) | Guide to call weather.today |

## Development Guidelines

### Adding a New Tool

1. Define Zod schema for input validation
2. Create handler function with signature `async (args, extra?) => result`
3. Register with `payments.mcp.registerTool()`
4. Set appropriate credit cost

### Modifying Credit Logic

Credits can be:
- Fixed BigInt: `{ credits: 1n }`
- Function receiving `{ args, result }` context

### Testing Without Auth

The MCP Inspector (`yarn inspector`) doesn't send auth headers. For testing with authentication, create a client script using `payments.agents.getAgentAccessToken()`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nevermined-io/payments` | Payments SDK with MCP integration |
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `zod` | Schema validation |
| `openai` | LLM for weather forecast generation |
| `express` | HTTP server (used internally) |
| `dotenv` | Environment variable loading |

## Common Tasks

### Run the server
```bash
yarn start
```

### Check server health
```bash
curl http://localhost:3002/health
```

### Test MCP endpoint (without auth - will fail)
```bash
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```
