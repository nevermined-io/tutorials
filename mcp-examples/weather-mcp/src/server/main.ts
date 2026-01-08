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
import express, { Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  getTodayWeather,
  sanitizeCity,
  TodayWeather,
} from "../services/weather.service.js";
import OpenAI from "openai";
// Import MCP Server and Transport
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { Payments, EnvironmentName } from "@nevermined-io/payments";

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: process.env.NVM_ENVIRONMENT! as EnvironmentName,
});

const PORT = parseInt(process.env.PORT || "3002", 10);

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
  { credits: 1n }
);

/**
 * Register weather://today resource
 */
payments.mcp.registerResource(
  "Today's Weather Resource",
  "weather://today",
  {
    title: "Today's Weather Resource",
    description: "JSON for today's weather (default city: London)",
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
    title: "Ensure city provided",
    description: "Guide to call weather.today with a city",
    argsSchema: weatherToolSchema,
  },
  handleWeatherEnsureCityPrompt,
  { credits: (ctx) => (ctx.result.length > 100 ? 2n : 1n) }
);

/*****************************************************************************
 * TOOL HANDLER CALLBACKS
 *****************************************************************************/

/**
 * Handler for the weather.today tool
 * Gets today's weather summary for a city and generates an enhanced forecast
 *
 * @param args - Tool arguments containing the city name
 * @param extra - MCP request handler extra context
 * @returns Tool response with weather forecast and structured data
 */
async function handleWeatherTodayTool(
  args: any,
  extra?: any
): Promise<{
  content: Array<
    | { type: "text"; text: string }
    | {
        type: "resource_link";
        uri: string;
        name: string;
        mimeType: string;
        description: string;
      }
  >;
  structuredContent: {
    city: string;
    country?: string;
    timezone: string;
    temperatureMax?: number;
    temperatureMin?: number;
    precipitation?: number;
    weatherConditions?: string;
    forecast: string;
  };
}> {
  // You can access extra for logging/observability

  const { city } = args as { city: string };
  if (!city) {
    throw { code: -32003, message: "City is required" };
  }

  const sanitized = sanitizeCity(city);
  const weather: TodayWeather = await getTodayWeather(sanitized);

  // Generate enhanced weather forecast using LLM with Nevermined observability
  const forecast = await generateWeatherForecast(weather);

  // Ensure forecast is a string (not an object)
  const forecastText =
    typeof forecast === "string" ? forecast : JSON.stringify(forecast);

  return {
    content: [
      { type: "text" as const, text: forecastText },
      {
        type: "resource_link" as const,
        uri: "weather://today",
        name: "weather today",
        mimeType: "application/json",
        description: "Raw JSON for today's weather (default city)",
      },
    ],
    structuredContent: {
      city: weather.city,
      country: weather.country ?? undefined,
      timezone: weather.timezone,
      temperatureMax: weather.tmaxC ?? undefined,
      temperatureMin: weather.tminC ?? undefined,
      precipitation: weather.precipitationMm ?? undefined,
      weatherConditions: weather.weatherText ?? undefined,
      forecast: forecastText,
    },
  };
}

/*****************************************************************************
 * RESOURCE HANDLER CALLBACKS
 *****************************************************************************/

/**
 * Handler for the weather://today resource (static, no template variables)
 * Returns raw JSON weather data for the default city
 *
 * @param uri - Resource URI
 * @param extra - MCP request handler extra context
 * @returns Resource response with weather data
 */
async function handleWeatherTodayResource(uri: URL, extra?: any) {
  // You can access extra for logging/observability
  if (extra) {
    console.log(
      `📊 Resource Request ID: ${extra.agentRequest?.agentRequestId}`
    );
  }

  // Default city for the static weather resource
  const DEFAULT_WEATHER_CITY = "London";
  const sanitized = sanitizeCity(DEFAULT_WEATHER_CITY);
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
 * @param context - Prompt context from Nevermined
 * @returns Prompt response with guidance message
 */
function handleWeatherEnsureCityPrompt(
  args: Record<string, string>,
  context?: any
) {
  const city = args?.city || "";
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please call the tool weather.today with { "city": "${sanitizeCity(
            city
          )}" }`,
        },
      },
    ],
  };
}

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
async function generateWeatherForecast(weather: TodayWeather): Promise<string> {
  // Create OpenAI client (without Nevermined observability)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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
 * START SERVER
 *****************************************************************************/

/**
 * Main function to start the MCP server
 * Uses Express and StreamableHTTPServerTransport for HTTP communication
 */
async function main() {
  const { info, stop } = await payments.mcp.start({
    port: PORT,
    agentId: process.env.NVM_AGENT_ID!,
    serverName: "weather-mcp",
    version: "0.1.0",
    description: "Weather MCP server with Nevermined Payments integration",
  });

  console.log(`
🚀 Weather MCP Server with Nevermined Payments Integration Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MCP Endpoint:     ${info.baseUrl}/mcp
🏥 Health Check:     ${info.baseUrl}/health
ℹ️  Server Info:      ${info.baseUrl}/

🛠️  Tools: weather.today
📦 Resources: weather://today
💬 Prompts: weather.ensureCity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    // Close all transports
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
