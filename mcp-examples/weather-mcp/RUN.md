# RUN.md - Running Instructions

Complete guide for setting up and running the Weather MCP Server.

## Prerequisites

- **Node.js** >= 18
- **Yarn** (Berry or Classic)
- **Nevermined Account** with API key
- **OpenAI API Key** (for LLM-enhanced forecasts)

## Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Set up environment variables (see below)
cp .env.example .env  # if exists, or create manually

# 3. Start the server
yarn start
```

## Environment Setup

Create a `.env` file in the project root:

```bash
# Required - Nevermined Configuration
NVM_API_KEY=your_nevermined_api_key
NVM_AGENT_ID=did:nv:your_agent_id
NVM_ENVIRONMENT=sandbox

# Required - OpenAI (for LLM forecasts)
OPENAI_API_KEY=your_openai_api_key

# Optional - Server Configuration
PORT=3000

# External URL (required for production/Docker deployments)
# Used in OAuth metadata endpoints (.well-known/oauth-protected-resource)
# Leave unset for local development (defaults to http://localhost:PORT)
# BASE_URL=https://your-external-domain.com
```

### Getting Nevermined Credentials

1. Sign up at [Nevermined App](https://app.nevermined.io)
2. Create an API key in the dashboard
3. Register an agent and get its DID
4. Note the environment (`sandbox` for testing, `live` for production)

### Environment Options

| Environment | Description |
|-------------|-------------|
| `sandbox` | Testing environment (recommended for development) |
| `live` | Production environment |

## Running the Server

### Development Mode

```bash
yarn start
```

This runs `tsx src/main.ts` which:
- Loads environment variables from `.env`
- Initializes Nevermined Payments
- Registers MCP tools, resources, and prompts
- Starts HTTP server on configured port

### Expected Output

```
🚀 Weather MCP Server with Nevermined Payments Integration Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MCP Endpoint:     http://localhost:3000/mcp
🏥 Health Check:     http://localhost:3000/health
ℹ️  Server Info:      http://localhost:3000/

🛠️  Tools: weather.today
📦 Resources: weather://today
💬 Prompts: weather.ensureCity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Verifying the Server

### Health Check

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}` or similar

### Server Info

```bash
curl http://localhost:3000/
```

Returns server metadata.

### List Tools (requires auth)

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Client Setup

To call the protected MCP server, you need a subscriber account with credits.

### Client Environment Variables

```bash
export NVM_API_KEY=subscriber_api_key
export NVM_PLAN_ID=plan_id_with_credits
export NVM_AGENT_ID=did:nv:agent_id
```

### Getting an Access Token

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

console.log("Access Token:", accessToken);
```

### Calling a Tool

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  {
    requestInit: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  }
);

const client = new Client({ name: "weather-client" });
await client.connect(transport);

const result = await client.callTool({
  name: "weather.today",
  arguments: { city: "London" },
});

console.log(result);
await client.close();
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector connect http://localhost:3000/mcp
```

**Note**: The inspector doesn't send `Authorization` headers, so paywall validation will fail. Use it only for testing the MCP protocol structure, not the full authentication flow.

## Troubleshooting

### Server won't start

**Problem**: Missing environment variables
```
Error: NVM_API_KEY is required
```
**Solution**: Ensure all required variables are set in `.env`

---

**Problem**: Port already in use
```
Error: listen EADDRINUSE: address already in use :::3002
```
**Solution**: Change `PORT` in `.env` or kill the existing process

---

### Authentication errors

**Problem**: `-32003` Authorization required
```json
{"jsonrpc":"2.0","error":{"code":-32003,"message":"Authorization required"}}
```
**Solution**: Include `Authorization: Bearer <token>` header

---

**Problem**: `-32003` Payment required
```json
{"jsonrpc":"2.0","error":{"code":-32003,"message":"Payment required"}}
```
**Solution**: Ensure subscriber has valid subscription and credits

---

### Weather API errors

**Problem**: City not found
```
CityNotFoundError: City not found: xyz
```
**Solution**: Use a valid city name (2-80 characters)

---

**Problem**: Downstream API error
```
DownstreamError: Failed to reach Open-Meteo API
```
**Solution**: Check network connectivity; Open-Meteo may be temporarily unavailable

---

### OpenAI errors

**Problem**: LLM forecast generation fails
```
Error generating weather forecast with LLM: ...
```
**Solution**:
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI API status
- The server will fall back to basic forecast format

## Logs

The server logs:
- Server startup information
- Open-Meteo API latency for each weather request
- Resource request IDs (from `extra.agentRequest`)
- LLM errors (falls back gracefully)

## Stopping the Server

Press `Ctrl+C` for graceful shutdown:

```
🛑 Shutting down...
```

The server will:
1. Stop accepting new connections
2. Close all active transports
3. Exit cleanly

## Docker Deployment

### Build the Image

```bash
docker build -t weather-mcp .
```

### Run the Container

```bash
docker run -d \
  -p 3000:3000 \
  -e NVM_API_KEY=your_api_key \
  -e NVM_AGENT_ID=your_agent_id \
  -e NVM_ENVIRONMENT=live \
  -e OPENAI_API_KEY=your_openai_key \
  -e BASE_URL=https://your-external-domain.com \
  weather-mcp
```

**Important**: Set `BASE_URL` to your external domain so OAuth metadata endpoints return correct URLs for MCP clients.

### Verify Deployment

```bash
# Health check
curl https://your-external-domain.com/health

# OAuth metadata (should show external URL)
curl https://your-external-domain.com/.well-known/oauth-protected-resource
```

Expected OAuth metadata response:
```json
{
  "resource": "https://your-external-domain.com",
  "authorization_servers": ["https://your-external-domain.com"],
  "scopes_supported": ["openid", "profile", "credits", "mcp:read", "mcp:write", "mcp:tools"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://your-external-domain.com/"
}
```

## Production Considerations

1. **Environment**: Use `live` for production
2. **BASE_URL**: Always set `BASE_URL` to your external domain when deploying
3. **Secrets**: Use proper secret management (not `.env` files)
4. **Monitoring**: Add logging/monitoring integration
5. **Scaling**: The server is stateless; scale horizontally behind a load balancer
6. **HTTPS**: Use a reverse proxy (nginx, Caddy) for TLS termination
