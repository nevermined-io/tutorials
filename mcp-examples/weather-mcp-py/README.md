[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Weather MCP Server (Python)

A Model Context Protocol (MCP) server that provides weather information with Nevermined Payments integration, written in Python.

This is the Python equivalent of the TypeScript `weather-mcp` example.

> **Requires the x402 v2 in-band MCP transport** (SDK PRs nevermined-io/payments#384 / nevermined-io/payments-py#228 — not yet released). The published `@nevermined-io/payments` / `payments-py` packages use the `Authorization`-header approach; the in-band `_meta["x402/payment"]` client example below needs the in-band-capable SDK version. The `Authorization: Bearer` header continues to work as a deprecated fallback.

## Features

- **MCP Tools**: `weather.today` - Get current weather for any city
- **MCP Resources**: `weather://today` - Static weather data for London
- **MCP Prompts**: `weather.ensureCity` - Guide LLMs to request weather data
- **OAuth 2.1 Discovery**: Full RFC 8414/9728 compliant endpoints
- **Nevermined Payments**: Pay-per-use with credits via x402 tokens
- **OpenAI Integration**: Enhanced weather forecasts using GPT-4o-mini

## Prerequisites

- Python 3.10+
- Poetry (for dependency management)
- Nevermined API key
- OpenAI API key (optional, for enhanced forecasts)

## Installation

1. **Clone and navigate to the project**:
   ```bash
   cd /path/to/tutorials/mcp-examples/weather-mcp-py
   ```

2. **Install dependencies with Poetry**:
   ```bash
   poetry install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

## Configuration

Create a `.env` file with:

```env
# Nevermined Configuration
NVM_API_KEY=your_nvm_api_key_here
NVM_ENVIRONMENT=staging_sandbox
NVM_PLAN_ID=your_plan_id_here
# NVM_AGENT_ID=your_agent_id_here  # optional — informational only (plan-centric)

# OpenAI Configuration (optional)
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3002
```

## Running the Server

```bash
poetry run python src/main.py
```

The server will start and display:

```
Weather MCP Server with Nevermined Payments Integration Started! (Python)

    MCP Endpoint:     http://localhost:3002/mcp
    Health Check:     http://localhost:3002/health
    Server Info:      http://localhost:3002/

    Tools: weather.today
    Resources: weather://today
    Prompts: weather.ensureCity
```

## API Endpoints

### OAuth Discovery (RFC 8414/9728)

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/oauth-protected-resource` | Protected Resource Metadata |
| `GET /.well-known/oauth-authorization-server` | Authorization Server Metadata |
| `GET /.well-known/openid-configuration` | OpenID Connect Discovery |
| `POST /register` | Dynamic Client Registration (RFC 7591) |

### MCP Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP JSON-RPC endpoint |
| `GET /mcp` | SSE stream for MCP messages |
| `DELETE /mcp` | Close MCP session |

### Utility Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Server info with all endpoints |
| `GET /health` | Health check |

## MCP Capabilities

### Tool: `weather.today`

Get today's weather for a city.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "City name (2-80 characters)"
    }
  },
  "required": ["city"]
}
```

**Credits**: 1 per call

### Resource: `weather://today`

Static weather data for London (default city).

**Credits**: 5 per read

### Prompt: `weather.ensureCity`

Guides the LLM to call the weather.today tool with a city name.

**Credits**: 1 per use

## Client Usage

Send the payment **in band** via the MCP request `_meta["x402/payment"]` field (x402 v2 MCP transport). The access token is a base64-encoded `PaymentPayload`; `decode_access_token` turns it back into the plain-JSON object the server reads from `_meta`:

```python
from datetime import timedelta

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from payments_py import Payments, decode_access_token

payments = Payments.get_instance({
    "nvm_api_key": NVM_API_KEY,
    "environment": "staging_sandbox",
})

# agent_id is optional under the plan-centric model — the plan id is all you need
access_token = payments.x402.get_x402_access_token(NVM_PLAN_ID)["accessToken"]

# The MCP session is an OAuth-protected resource: authenticate it with the
# access token (without it, `initialize` returns 401). The per-call payment is
# sent in band via meta= below.
auth_headers = {"Authorization": f"Bearer {access_token}"}
async with streamablehttp_client("http://localhost:3002/mcp", headers=auth_headers) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        result = await session.call_tool(
            "weather.today",
            {"city": "London"},
            # In-band payment (plain-JSON PaymentPayload, not base64).
            meta={"x402/payment": decode_access_token(access_token)},
        )
        # On success, the settlement receipt is in result.meta["x402/payment-response"].
        print(result)
```

When payment is required or settlement fails, a **tool** result comes back with `isError=True` and a `PaymentRequired` object in `structuredContent` (and JSON-stringified in `content[0].text`). **Resources and prompts** have no tool-result error channel, so they still raise the `-32003` JSON-RPC error.

> **Session auth vs. payment**: the `Authorization: Bearer <access_token>` header set on the transport authenticates the MCP session (it's an OAuth-protected resource — `initialize` returns `401` without it). The **payment** is sent separately, in band, via `meta={"x402/payment": ...}`. Sending the token via the header *alone* (no `meta`) also settles the payment for one release — a deprecated fallback — but the in-band `meta` form is the spec-aligned approach.

## Architecture

```
weather-mcp-py/
├── pyproject.toml          # Poetry configuration
├── .env.example            # Environment template
├── README.md               # This file
└── src/
    ├── __init__.py
    ├── main.py             # MCP server entry point
    └── services/
        ├── __init__.py
        └── weather_service.py  # Weather API client
```

## Dependencies

- **payments-py**: Nevermined Payments Library (local)
- **httpx**: Async HTTP client for weather API
- **python-dotenv**: Environment variable management
- **openai**: OpenAI SDK for enhanced forecasts
- **pydantic**: Data validation

## Weather API

This server uses the free [Open-Meteo API](https://open-meteo.com/) for weather data:

- **Geocoding**: `https://geocoding-api.open-meteo.com/v1/search`
- **Forecast**: `https://api.open-meteo.com/v1/forecast`

No API key required for Open-Meteo.

## License

MIT
