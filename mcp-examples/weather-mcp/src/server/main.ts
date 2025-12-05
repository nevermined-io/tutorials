/**
 * Weather MCP Server with Nevermined Payments Integration
 *
 * This file demonstrates the API where the library handles everything:
 * - McpServer creation
 * - Express app setup
 * - OAuth endpoints
 * - Session/Transport management
 * - HTTP handlers (POST/GET/DELETE /mcp)
 */
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import type { CreditsContext } from "@nevermined-io/payments";
import { z } from "zod";
import {
  getTodayWeather,
  sanitizeCity,
  TodayWeather,
} from "../services/weather.service.js";
import OpenAI from "openai";

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.PORT || "3000", 10);
const NVM_API_KEY = process.env.NVM_API_KEY;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID;
const NVM_ENVIRONMENT =
  (process.env.NVM_ENVIRONMENT as EnvironmentName) || "staging";

if (!NVM_API_KEY) {
  throw new Error("NVM_API_KEY environment variable is required");
}

if (!NVM_AGENT_ID) {
  throw new Error("NVM_AGENT_ID environment variable is required");
}

// =============================================================================
// INITIALIZE NEVERMINED PAYMENTS
// =============================================================================

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// =============================================================================
// TOOL HANDLER (Business Logic Only)
// =============================================================================

/**
 * Generate a well-formatted weather forecast using OpenAI with Nevermined observability
 */
async function generateWeatherForecast(
  weather: TodayWeather,
  context?: any
): Promise<string> {
  // Set up observability metadata for tracking this operation
  const customProperties: Record<string, string> = {
    operation: "weather_forecast",
  };
  if (context?.extra?.agentRequest) {
    customProperties.agentId = context.extra.agentRequest.agentId;
    customProperties.sessionId = context.extra.agentRequest.agentRequestId;
  }

  // Create OpenAI client with Nevermined observability integration
  const openai = new OpenAI(
    context?.extra?.agentRequest
      ? payments.observability.withOpenAI(
          process.env.OPENAI_API_KEY!,
          context.extra.agentRequest,
          customProperties
        )
      : { apiKey: process.env.OPENAI_API_KEY! }
  );

  const systemPrompt = `You are a professional meteorologist. Create well-formatted, informative weather forecasts.

Please provide:
1. Current weather conditions with appropriate emojis
2. Temperature analysis (comfort level, comparison to average)
3. Precipitation information and what it means

Make it informative but easy to understand, using natural language. Answer in English.`;

  const userPrompt = `Weather Data:
- City: ${weather.city}, ${weather.country ?? "Unknown"}
- Timezone: ${weather.timezone}
- High Temperature: ${weather.tmaxC ?? "N/A"}°C
- Low Temperature: ${weather.tminC ?? "N/A"}°C
- Precipitation: ${weather.precipitationMm ?? "N/A"}mm
- Weather Conditions: ${weather.weatherText ?? "N/A"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return (
      completion.choices[0]?.message?.content || "Error generating forecast"
    );
  } catch (error) {
    console.error("Error generating weather forecast with LLM:", error);
    // Fallback to basic format if LLM fails
    return (
      `Weather forecast for ${weather.city}, ${
        weather.country ?? ""
      } (timezone: ${weather.timezone})\n` +
      `Maximum temperature: ${weather.tmaxC ?? "N/A"}°C, Minimum temperature: ${
        weather.tminC ?? "N/A"
      }°C\n` +
      `Precipitation: ${weather.precipitationMm ?? "N/A"}mm\n` +
      `Conditions: ${weather.weatherText ?? "N/A"}`
    );
  }
}

// =============================================================================
// CREDITS CALCULATOR (Dynamic based on city name length)
// =============================================================================

/**
 * Calculate credits dynamically based on the city name length.
 * This function is called AFTER the handler executes, so it has access to both args and result.
 */
const weatherToolCreditsCalculator = (ctx: CreditsContext): bigint => {
  const args = ctx.args as { city?: string } | undefined;
  const city = args?.city || "";
  // Longer city names cost more credits. Randomly between 2 and 20 credits, depending on the city name length.
  return city.length <= 5 ? 1n : BigInt(Math.floor(Math.random() * 18) + 2);
};

// =============================================================================
// REGISTER TOOLS, RESOURCES, AND PROMPTS
// =============================================================================

// Register weather.today tool with dynamic credits
payments.mcp.registerTool(
  "weather.today",
  {
    title: "Today's Weather",
    description: "Get today's weather summary for a city",
    inputSchema: z.object({
      city: z.string().min(2).max(80).describe("City name"),
    }) as any,
  },
  async (args, authContext) => {
    // You can access authContext for logging/observability
    if (authContext) {
      console.log(
        `📊 Request ID: ${authContext.extra.agentRequest.agentRequestId}`
      );
    }

    const { city } = args as { city: string };
    if (!city) {
      throw { code: -32003, message: "City is required" };
    }

    const sanitized = sanitizeCity(city);
    const weather: TodayWeather = await getTodayWeather(sanitized);

    // Generate enhanced weather forecast using LLM with Nevermined observability
    const forecast = await generateWeatherForecast(weather, authContext);

    // Ensure forecast is a string (not an object)
    const forecastText =
      typeof forecast === "string" ? forecast : JSON.stringify(forecast);

    return {
      content: [
        { type: "text", text: forecastText },
        {
          type: "resource_link",
          uri: `weather://today/${encodeURIComponent(weather.city)}`,
          name: `weather today ${weather.city}`,
          mimeType: "application/json",
          description: "Raw JSON for today's weather",
        },
      ],
      structuredContent: {
        city: weather.city,
        country: weather.country,
        timezone: weather.timezone,
        temperatureMax: weather.tmaxC,
        temperatureMin: weather.tminC,
        precipitation: weather.precipitationMm,
        weatherConditions: weather.weatherText,
        forecast: forecastText,
      },
    };
  },
  { credits: weatherToolCreditsCalculator } // Dynamic credits function
);

// Register weather resource
payments.mcp.registerResource(
  "weather://today/{city}",
  {
    name: "Today's Weather Resource",
    description: "JSON for today's weather by city",
    mimeType: "application/json",
  },
  async (uri, variables, context) => {
    // You can access context for logging/observability
    if (context) {
      console.log(
        `📊 Resource Request ID: ${context.extra.agentRequest.agentRequestId}`
      );
    }

    const cityParamRaw = variables?.city;
    const cityParam: string = Array.isArray(cityParamRaw)
      ? cityParamRaw[0]
      : (cityParamRaw as string);
    const decodedCity = (() => {
      try {
        return decodeURIComponent(cityParam);
      } catch {
        return cityParam;
      }
    })();
    const sanitized = sanitizeCity(decodedCity);
    const weather = await getTodayWeather(sanitized);
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(weather),
          mimeType: "application/json",
        },
      ],
    };
  },
  { credits: weatherToolCreditsCalculator } // Dynamic credits function
);

// Register weather prompt (5 credits)
payments.mcp.registerPrompt(
  "weather.ensureCity",
  {
    name: "Ensure city provided",
    description: "Guide to call weather.today with a city",
    inputSchema: z.object({
      city: z.string().min(2).max(80).describe("City name"),
    }) as any,
  },
  (args, context) => {
    const city = (args as { city: string })?.city || "";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please call the tool weather.today with { "city": "${sanitizeCity(
              city
            )}" }`,
          },
        },
      ],
    };
  }
);

// =============================================================================
// START SERVER - Library handles EVERYTHING else
// =============================================================================

async function main() {
  const { info, stop } = await payments.mcp.start({
    port: PORT,
    agentId: NVM_AGENT_ID!,
    serverName: "weather-mcp",
    version: "0.1.0",
    description:
      "Weather MCP server with Nevermined OAuth integration via Streamable HTTP",
    // Enable logging for debugging
    onLog: (msg) => console.log(`[NVM] ${msg}`),
  });

  console.log(`
🚀 Weather MCP Server with Nevermined Integration Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MCP Endpoint:     ${info.baseUrl}/mcp
🏥 Health Check:     ${info.baseUrl}/health
ℹ️  Server Info:      ${info.baseUrl}/

🔐 OAuth Endpoints (auto-generated by Nevermined):
   ├─ Discovery:     ${info.baseUrl}/.well-known/oauth-authorization-server
   ├─ Protected:     ${info.baseUrl}/.well-known/oauth-protected-resource
   ├─ OIDC Config:   ${info.baseUrl}/.well-known/openid-configuration
   └─ Registration:  ${info.baseUrl}/register

🛠️  Tools: ${info.tools.join(", ")} (dynamic credits)
📦 Resources: ${info.resources.join(", ")} (dynamic credits)
💬 Prompts: ${info.prompts.join(", ")} (0 credits)
🌍 Environment: ${NVM_ENVIRONMENT}
🆔 Agent ID: ${NVM_AGENT_ID}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    await stop();
    process.exit(0);
  });
}

// =============================================================================
// RUN
// =============================================================================

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
