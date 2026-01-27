"""
Weather MCP Server with Nevermined Payments Integration (Python)

This example demonstrates the Decorator API using PaymentsMCP,
which provides:
- OAuth 2.1 authentication endpoints
- Client registration
- Credit redemption (paywall)
- Full MCP protocol support

Usage:
    python src/main.py

The decorators work like FastMCP but with:
- `credits` parameter to monetize tools/resources/prompts
- Full OAuth infrastructure included automatically
"""

import asyncio
import json
import os
import sys
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

# Add parent directory to path for local development
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.weather_service import (
    TodayWeather,
    get_today_weather,
    sanitize_city,
)

# Load environment variables
load_dotenv()

# Import Nevermined Payments
from payments_py import Payments
from payments_py.common.types import PaymentOptions
from payments_py.mcp import PaymentsMCP

# =============================================================================
# CONFIGURATION
# =============================================================================

NVM_API_KEY = os.getenv("NVM_API_KEY")
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "staging_sandbox")
NVM_AGENT_ID = os.getenv("NVM_AGENT_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PORT = int(os.getenv("PORT", "3002"))

if not NVM_API_KEY:
    raise ValueError("NVM_API_KEY environment variable is required")
if not NVM_AGENT_ID:
    raise ValueError("NVM_AGENT_ID environment variable is required")

# Initialize Payments
payments = Payments(
    PaymentOptions(
        nvm_api_key=NVM_API_KEY,
        environment=NVM_ENVIRONMENT,
    )
)

# Initialize PaymentsMCP with OAuth and paywall support
mcp = PaymentsMCP(
    payments,
    name="weather-mcp-py",
    agent_id=NVM_AGENT_ID,
    version="0.1.0",
    description="Weather MCP server with Nevermined Payments integration",
)


# =============================================================================
# LLM FORECAST GENERATION
# =============================================================================


async def generate_weather_forecast(weather: TodayWeather) -> str:
    """Generate a well-formatted weather forecast using OpenAI."""
    if not OPENAI_API_KEY:
        return (
            f"Weather forecast for {weather.city}, {weather.country or ''} "
            f"(timezone: {weather.timezone})\n"
            f"Maximum temperature: {weather.tmax_c or 'N/A'}C, "
            f"Minimum temperature: {weather.tmin_c or 'N/A'}C\n"
            f"Precipitation: {weather.precipitation_mm or 'N/A'}mm\n"
            f"Conditions: {weather.weather_text or 'N/A'}"
        )

    openai = OpenAI(api_key=OPENAI_API_KEY)

    system_prompt = """You are a professional meteorologist. Create well-formatted, informative weather forecasts.

Please provide:
1. Current weather conditions with appropriate emojis
2. Temperature analysis (comfort level, comparison to average)
3. Precipitation information and what it means

Make it informative but easy to understand, using natural language. Answer in English."""

    user_prompt = f"""Weather Data:
- City: {weather.city}, {weather.country or 'Unknown'}
- Timezone: {weather.timezone}
- High Temperature: {weather.tmax_c or 'N/A'}C
- Low Temperature: {weather.tmin_c or 'N/A'}C
- Precipitation: {weather.precipitation_mm or 'N/A'}mm
- Weather Conditions: {weather.weather_text or 'N/A'}"""

    try:
        completion = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=500,
        )

        return completion.choices[0].message.content or "Error generating forecast"

    except Exception as error:
        print(f"Error generating weather forecast with LLM: {error}")
        return (
            f"Weather forecast for {weather.city}, {weather.country or ''} "
            f"(timezone: {weather.timezone})\n"
            f"Maximum temperature: {weather.tmax_c or 'N/A'}C, "
            f"Minimum temperature: {weather.tmin_c or 'N/A'}C\n"
            f"Precipitation: {weather.precipitation_mm or 'N/A'}mm\n"
            f"Conditions: {weather.weather_text or 'N/A'}"
        )


# =============================================================================
# TOOLS - Using @mcp.tool() decorator with credits
# =============================================================================


@mcp.tool(
    name="weather.today",
    description="Get today's weather summary for a city",
    credits=1,  # Charge 1 credit per call
)
async def weather_today(city: str) -> dict:
    """
    Get today's weather for a city with an AI-enhanced forecast.

    :param city: City name (2-80 characters)
    """
    sanitized = sanitize_city(city)
    weather = await get_today_weather(sanitized)

    # Generate enhanced weather forecast using LLM
    forecast = await generate_weather_forecast(weather)

    # Ensure forecast is a string (not an object)
    forecast_text = forecast if isinstance(forecast, str) else json.dumps(forecast)

    # Return MCP-formatted response (same structure as TypeScript)
    return {
        "content": [
            {"type": "text", "text": forecast_text},
            {
                "type": "resource_link",
                "uri": "weather://today",
                "name": "weather today",
                "mimeType": "application/json",
                "description": "Raw JSON for today's weather (default city)",
            },
        ],
        "structuredContent": {
            "city": weather.city,
            "country": weather.country,
            "timezone": weather.timezone,
            "temperatureMax": weather.tmax_c,
            "temperatureMin": weather.tmin_c,
            "precipitation": weather.precipitation_mm,
            "weatherConditions": weather.weather_text,
            "forecast": forecast_text,
        },
    }


# =============================================================================
# RESOURCES - Using @mcp.resource() decorator with credits
# =============================================================================


@mcp.resource(
    "weather://today",
    name="Today's Weather Resource",
    description="JSON for today's weather (default city: London)",
    mime_type="application/json",
    credits=5,  # Charge 5 credits per read
)
async def weather_today_resource() -> dict:
    """Get raw weather data for the default city (London)."""
    DEFAULT_WEATHER_CITY = "London"
    sanitized = sanitize_city(DEFAULT_WEATHER_CITY)
    weather = await get_today_weather(sanitized)

    weather_dict = {
        "city": weather.city,
        "country": weather.country,
        "latitude": weather.latitude,
        "longitude": weather.longitude,
        "timezone": weather.timezone,
        "updatedAt": weather.updated_at,
        "tmaxC": weather.tmax_c,
        "tminC": weather.tmin_c,
        "precipitationMm": weather.precipitation_mm,
        "weatherCode": weather.weather_code,
        "weatherText": weather.weather_text,
    }

    # Return MCP-formatted response (same structure as TypeScript)
    # Note: The decorator handles the uri automatically
    return {
        "contents": [
            {
                "uri": "weather://today",
                "text": json.dumps(weather_dict),
                "mimeType": "application/json",
            }
        ]
    }


# =============================================================================
# PROMPTS - Using @mcp.prompt() decorator with credits
# =============================================================================


@mcp.prompt(
    name="weather.ensureCity",
    description="Guide to call weather.today with a city",
    credits=1,  # Charge 1 credit per use
)
def ensure_city_prompt(city: Optional[str] = None) -> list:
    """Generate a prompt that guides the LLM to call weather.today."""
    sanitized = sanitize_city(city) if city else "London"

    return [
        {
            "role": "user",
            "content": {
                "type": "text",
                "text": f'Please call the tool weather.today with {{ "city": "{sanitized}" }}',
            },
        }
    ]


# =============================================================================
# MAIN
# =============================================================================


async def main():
    """Main function to start the MCP server."""

    print(f"""
Weather MCP Server with Nevermined Payments Integration (Python)

Starting server on port {PORT}...
Agent ID: {NVM_AGENT_ID}
Environment: {NVM_ENVIRONMENT}

Registered handlers:
  - Tool: weather.today (1 credit)
  - Resource: weather://today (5 credits)
  - Prompt: weather.ensureCity (1 credit)
""")

    # Start the server with OAuth and paywall
    result = await mcp.start(port=PORT)

    info = result["info"]
    stop = result["stop"]

    print(f"""
Server started successfully!

Endpoints:
  MCP Endpoint:     {info['baseUrl']}/mcp
  Health Check:     {info['baseUrl']}/health
  Server Info:      {info['baseUrl']}/
  OAuth Discovery:  {info['baseUrl']}/.well-known/oauth-authorization-server

Press Ctrl+C to stop...
""")

    # Wait forever (until interrupted)
    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass
    finally:
        await stop()
        print("Server stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down...")
