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

/*****************************************************************************
 * IMPORTS AND CONFIGURATION
 *****************************************************************************/

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

/*****************************************************************************
 * INITIALIZE NEVERMINED PAYMENTS
 *****************************************************************************/

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

/*****************************************************************************
 * TOOL HANDLER CALLBACKS
 *****************************************************************************/

/**
 * Handler for the weather.today tool
 * Gets today's weather summary for a city and generates an enhanced forecast
 *
 * @param args - Tool arguments containing the city name
 * @param authContext - Authentication context from Nevermined
 * @returns Tool response with weather forecast and structured data
 */
async function handleWeatherTodayTool(args: any, authContext?: any) {
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
}

/*****************************************************************************
 * RESOURCE HANDLER CALLBACKS
 *****************************************************************************/

/**
 * Handler for the weather://today/{city} resource
 * Returns raw JSON weather data for a specific city
 *
 * @param uri - Resource URI
 * @param variables - URI variables (e.g., city)
 * @param context - Authentication context from Nevermined
 * @returns Resource response with weather data
 */
async function handleWeatherTodayResource(
  uri: any,
  variables?: any,
  context?: any
) {
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
}

/*****************************************************************************
 * PROMPT HANDLER CALLBACKS
 *****************************************************************************/

/**
 * Handler for the weather.ensureCity prompt
 * Guides the LLM to call weather.today with a city name
 *
 * @param args - Prompt arguments containing the city name
 * @param context - Authentication context from Nevermined
 * @returns Prompt response with guidance message
 */
function handleWeatherEnsureCityPrompt(args: any, context?: any) {
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

/*****************************************************************************
 * CREDITS CALCULATOR
 *****************************************************************************/

/**
 * Calculate credits dynamically based on the city name length.
 * This function is called AFTER the handler executes, so it has access to both args and result.
 *
 * @param ctx - Credits context containing args and result
 * @returns Number of credits to charge for this operation
 *
 * context example:
 * {
 * args: {
 *   city: "London"
 * },
 * result: {
 *   structuredContent: {
 *     city: "London",
 *     country: "United Kingdom",
 *     timezone: "UTC",
 *     temperatureMax: 20,
 *     temperatureMin: 10,
 *     precipitation: 10,
 *     weatherConditions: "sunny",
 *     forecast: "Today's weather is sunny with a temperature of 20°C."
 *   }
 * }
 */
const weatherToolCreditsCalculator = (ctx: CreditsContext): bigint => {
  const result = ctx.result as
    | { structuredContent?: { forecast?: string } }
    | undefined;
  const forecast = result?.structuredContent?.forecast || "";
  const forecastLength = forecast.length;
  return forecastLength <= 100
    ? 1n
    : BigInt(Math.floor(Math.random() * 18) + 2);
};

/*****************************************************************************
 * WEATHER API ACCESS
 *****************************************************************************/

/**
 * Generate a well-formatted weather forecast using OpenAI with Nevermined observability
 *
 * @param weather - Today's weather data
 * @param context - Authentication context from Nevermined (for observability)
 * @returns Formatted weather forecast as a string
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

/*****************************************************************************
 * REGISTER TOOLS, RESOURCES, AND PROMPTS
 *****************************************************************************/

/**
 * Weather Tool Schema
 */
const weatherToolSchema = z.object({
  city: z.string().min(2).max(80).describe("City name"),
}) as any;

/**
 * Register weather.today tool with dynamic credits
 */
payments.mcp.registerTool(
  "weather.today",
  {
    title: "Today's Weather",
    description: "Get today's weather summary for a city",
    inputSchema: weatherToolSchema,
  },
  handleWeatherTodayTool,
  { credits: weatherToolCreditsCalculator }
);

/**
 * Register weather://today/{city} resource
 */
payments.mcp.registerResource(
  "weather://today/{city}",
  {
    name: "Today's Weather Resource",
    description: "JSON for today's weather by city",
    mimeType: "application/json",
  },
  handleWeatherTodayResource,
  { credits: 5n }
);

/**
 * Register weather.ensureCity prompt (1 credit)
 */
payments.mcp.registerPrompt(
  "weather.ensureCity",
  {
    name: "Ensure city provided",
    description: "Guide to call weather.today with a city",
    inputSchema: weatherToolSchema,
  },
  handleWeatherEnsureCityPrompt,
  { credits: 1n }
);

/*****************************************************************************
 * START SERVER
 *****************************************************************************/

/**
 * Main function to start the MCP server
 * The Nevermined Payments library handles everything:
 * - McpServer creation
 * - Express app setup
 * - OAuth endpoints
 * - Session/Transport management
 * - HTTP handlers
 */
async function main() {
  const { info, stop } = await payments.mcp.start({
    port: PORT,
    agentId: NVM_AGENT_ID!,
    serverName: "weather-mcp",
    version: "0.1.0",
    description:
      "Weather MCP server with Nevermined OAuth integration via Streamable HTTP",
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

/*****************************************************************************
 * RUN
 *****************************************************************************/

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
