[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Weather MCP Server (Python)

A Model Context Protocol (MCP) server that provides weather information with Nevermined Payments integration, written in Python.

This is the Python equivalent of the TypeScript `weather-mcp` example.

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
NVM_AGENT_ID=your_agent_id_here

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
