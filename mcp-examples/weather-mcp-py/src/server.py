"""
Weather MCP Server with Nevermined Payments Integration (Simplified API).

This file demonstrates the Simplified API where the library handles everything:
- MCP Server creation from SDK
- FastAPI app setup
- OAuth 2.1 endpoints (RFC 8414, 9728, 7591, OIDC)
- Session/Transport management (SSE)
- HTTP handlers (POST/GET/DELETE /mcp)

The developer only needs to:
1. Register tools/resources/prompts
2. Call payments.mcp.start()

Everything else is handled automatically by payments-py.
"""

import asyncio
import os
import signal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from payments_py import Payments

# Import existing handlers from local_mcp
from local_mcp.handlers.weather_tool import (
    weather_tool_credits_calculator,
    weather_tool_handler,
)
from local_mcp.handlers.weather_prompt import weather_prompt_handler
from local_mcp.handlers.weather_resource import weather_resource_handler


# =============================================================================
# CONFIGURATION
# =============================================================================

load_dotenv()

PORT = int(os.getenv("PORT", "5001"))
NVM_API_KEY = os.getenv("NVM_SERVER_API_KEY")
NVM_AGENT_ID = os.getenv("NVM_AGENT_ID")
NVM_ENVIRONMENT = os.getenv("NVM_ENV", "staging_sandbox")

if not NVM_API_KEY:
    raise ValueError("NVM_SERVER_API_KEY environment variable is required")

if not NVM_AGENT_ID:
    raise ValueError("NVM_AGENT_ID environment variable is required")


# =============================================================================
# PYDANTIC SCHEMAS (equivalent to Zod in TypeScript)
# =============================================================================


class WeatherToolInput(BaseModel):
    """Input schema for weather.today tool."""

    city: str = Field(..., min_length=2, max_length=80, description="City name")


class WeatherPromptInput(BaseModel):
    """Input schema for weather.ensureCity prompt."""

    city: str = Field(
        default="", min_length=0, max_length=80, description="City name (optional)"
    )


# =============================================================================
# INITIALIZE NEVERMINED PAYMENTS
# =============================================================================

payments = Payments(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)


# =============================================================================
# REGISTER TOOLS, RESOURCES, AND PROMPTS
# =============================================================================

# Tool: weather.today with dynamic credits
payments.mcp.registerTool(
    "weather.today",
    {
        "title": "Today's Weather",
        "description": "Get today's weather summary for a city with enhanced forecast",
        "inputSchema": WeatherToolInput.model_json_schema(),
    },
    weather_tool_handler,
    {"credits": weather_tool_credits_calculator},
)

# Resource: weather://today/{city} with fixed credits (5)
payments.mcp.registerResource(
    "weather://today/{city}",
    {
        "name": "Today's Weather Resource",
        "description": "Raw JSON weather data for a specific city",
        "mimeType": "application/json",
    },
    weather_resource_handler,
    {"credits": 5},
)

# Prompt: weather.ensureCity with fixed credits (1)
payments.mcp.registerPrompt(
    "weather.ensureCity",
    {
        "name": "Ensure city provided",
        "description": "Guide LLM to call weather.today with a city name",
        "inputSchema": WeatherPromptInput.model_json_schema(),
    },
    weather_prompt_handler,
    {"credits": 1},
)


# =============================================================================
# MAIN FUNCTION - START SERVER
# =============================================================================


async def main() -> None:
    """
    Start the MCP server using the Simplified API.

    The Nevermined Payments library automatically handles:
    - MCP Server creation from SDK
    - FastAPI app setup with CORS
    - OAuth 2.1 discovery endpoints (/.well-known/*)
    - Dynamic client registration (/register)
    - Health check and server info endpoints
    - Session management (SSE)
    - MCP handlers (POST/GET/DELETE /mcp)
    - Paywall protection for all registered handlers

    All handlers are automatically protected with Nevermined's paywall.
    """
    # Start server with all registered handlers
    result = await payments.mcp.start(
        {
            "port": PORT,
            "agentId": NVM_AGENT_ID,
            "serverName": "weather-mcp",
            "version": "0.1.0",
            "description": "Weather MCP server with Nevermined OAuth integration via Streamable HTTP",
            "onLog": print,  # Optional: enable logging
        }
    )

    info = result["info"]
    stop_fn = result["stop"]

    # Print startup information
    print(
        f"""
🚀 Weather MCP Server with Nevermined Integration Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MCP Endpoint:     {info['baseUrl']}/mcp
🏥 Health Check:     {info['baseUrl']}/health
ℹ️  Server Info:      {info['baseUrl']}/

🔐 OAuth Endpoints (auto-generated by Nevermined):
   ├─ Discovery:     {info['baseUrl']}/.well-known/oauth-authorization-server
   ├─ Protected:     {info['baseUrl']}/.well-known/oauth-protected-resource
   ├─ OIDC Config:   {info['baseUrl']}/.well-known/openid-configuration
   └─ Registration:  {info['baseUrl']}/register

🛠️  Tools: {', '.join(info['tools'])} (dynamic credits)
📦 Resources: {', '.join(info['resources'])} (5 credits)
💬 Prompts: {', '.join(info['prompts'])} (1 credit)
🌍 Environment: {NVM_ENVIRONMENT}
🆔 Agent ID: {NVM_AGENT_ID}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  All handlers are automatically protected with Nevermined paywall
ℹ️  OAuth 2.1 endpoints are automatically configured
ℹ️  Press Ctrl+C to stop the server gracefully

"""
    )

    # Setup graceful shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(sig, frame):
        """Handle shutdown signals (SIGINT, SIGTERM)."""
        print(f"\n🛑 Received signal {sig}, shutting down gracefully...")
        shutdown_event.set()

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Wait for shutdown signal
    await shutdown_event.wait()

    # Stop server gracefully
    print("🔄 Stopping server...")
    await stop_fn()
    print("✅ Server stopped successfully")


# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n✅ Server stopped")
    except Exception as error:
        print(f"❌ Fatal error: {error}")
        import traceback

        traceback.print_exc()
        exit(1)



