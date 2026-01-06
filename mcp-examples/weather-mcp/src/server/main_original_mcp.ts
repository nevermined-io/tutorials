/**
 * Weather MCP Server using Original MCP SDK
 *
 * This file demonstrates how to create an MCP server using the original
 * @modelcontextprotocol/sdk without Nevermined Payments integration.
 * - McpServer creation
 * - Express app setup
 * - HTTP handlers (POST/GET/DELETE /mcp)
 * - Manual session/transport management
 */

/*****************************************************************************
 * IMPORTS AND CONFIGURATION
 *****************************************************************************/

import "dotenv/config";
import express, { Request, Response } from "express";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  getTodayWeather,
  sanitizeCity,
  TodayWeather,
} from "../services/weather.service.js";
import OpenAI from "openai";

const PORT = parseInt(process.env.PORT || "3000", 10);

/*****************************************************************************
 * CREATE MCP SERVER
 *****************************************************************************/

const server = new McpServer({
  name: "weather-mcp",
  version: "0.1.0",
});

/*****************************************************************************
 * TOOL HANDLER CALLBACKS
 *****************************************************************************/

/**
 * Handler for the weather.today tool
 * Gets today's weather summary for a city and generates an enhanced forecast
 *
 * @param args - Tool arguments containing the city name
 * @param extra - Extra metadata (not used in original SDK, but kept for compatibility)
 * @returns Tool response with weather forecast and structured data
 */
async function handleWeatherTodayTool(args: any, extra?: any) {
  const { city } = args as { city: string };
  if (!city) {
    throw { code: -32003, message: "City is required" };
  }

  const sanitized = sanitizeCity(city);
  const weather: TodayWeather = await getTodayWeather(sanitized);

  // Generate enhanced weather forecast using LLM
  const forecast = await generateWeatherForecast(weather);

  // Ensure forecast is a string (not an object)
  const forecastText =
    typeof forecast === "string" ? forecast : JSON.stringify(forecast);

  return {
    content: [
      { type: "text" as const, text: forecastText },
      {
        type: "resource" as const,
        resource: {
          uri: `weather://today/${encodeURIComponent(weather.city)}`,
          text: JSON.stringify(weather),
          mimeType: "application/json",
        },
      },
    ],
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
 * @param extra - Extra metadata (not used in original SDK)
 * @returns Resource response with weather data
 */
async function handleWeatherTodayResource(
  uri: any,
  variables?: any,
  extra?: any
) {
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
 * @param extra - Extra metadata (not used in original SDK)
 * @returns Prompt response with guidance message
 */
function handleWeatherEnsureCityPrompt(args: any, extra?: any) {
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
 * WEATHER API ACCESS
 *****************************************************************************/

/**
 * Generate a well-formatted weather forecast using OpenAI
 *
 * @param weather - Today's weather data
 * @returns Formatted weather forecast as a string
 */
async function generateWeatherForecast(weather: TodayWeather): Promise<string> {
  // Create OpenAI client (without Nevermined observability)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

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
const weatherToolSchema = {
  city: z.string().min(2).max(80).describe("City name"),
};

/**
 * Register weather.today tool
 */
server.tool("weather.today", weatherToolSchema, async (args) => {
  return await handleWeatherTodayTool(args);
});

/**
 * Register weather://today/{city} resource
 */
server.resource(
  "weather://today/{city}",
  new ResourceTemplate("weather://today/{city}", { list: undefined }),
  handleWeatherTodayResource
);

/**
 * Register weather.ensureCity prompt
 */
server.prompt(
  "weather.ensureCity",
  { city: z.string() } as any,
  (({ city }: { city?: string }) => {
    return handleWeatherEnsureCityPrompt({ city });
  }) as any
);

/*****************************************************************************
 * SETUP EXPRESS AND HTTP TRANSPORT
 *****************************************************************************/

const app = express();
app.use(express.json());

// Store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Get or create a transport for a session
 *
 * @param sessionId - Session identifier
 * @returns StreamableHTTPServerTransport instance
 */
async function getOrCreateTransport(
  sessionId: string
): Promise<StreamableHTTPServerTransport> {
  if (transports.has(sessionId)) {
    return transports.get(sessionId)!;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  transport.onclose = () => {
    console.log(`🗑️ Transport closed for session ${sessionId}`);
    transports.delete(sessionId);
  };

  await server.connect(transport);
  transports.set(sessionId, transport);
  console.log(`✅ Created new transport for session ${sessionId}`);
  return transport;
}

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Server info endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "weather-mcp",
    version: "0.1.0",
    description: "Weather MCP server using original MCP SDK",
  });
});

// MCP endpoint - handles all MCP requests
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    // Validate request body exists and is valid JSON
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "Parse error: Invalid JSON-RPC request",
        },
        id: null,
      });
      return;
    }

    const headerVal = req.headers["mcp-session-id"];
    const clientSessionId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const isInit =
      req.body &&
      typeof req.body === "object" &&
      (req.body as Record<string, any>).method === "initialize";
    let sessionId = clientSessionId;

    if (isInit || !sessionId) {
      sessionId = randomUUID();
      console.log(`   🆕 Created new session: ${sessionId}`);
    }

    res.setHeader("Mcp-Session-Id", sessionId);

    // Set required Accept header if not present (for StreamableHTTPServerTransport)
    if (!req.headers.accept) {
      req.headers.accept = "application/json, text/event-stream";
    } else if (
      !req.headers.accept.includes("application/json") ||
      !req.headers.accept.includes("text/event-stream")
    ) {
      // Add required types if not present
      const accept = req.headers.accept.split(",").map((s) => s.trim());
      if (!accept.includes("application/json")) {
        accept.push("application/json");
      }
      if (!accept.includes("text/event-stream")) {
        accept.push("text/event-stream");
      }
      req.headers.accept = accept.join(", ");
    }

    // Get or create transport for this session
    const transport = await getOrCreateTransport(sessionId);

    // Handle the MCP request
    await transport.handleRequest(req, res, req.body);
  } catch (error: any) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: error.code || -32000,
          message: error.message || "Internal server error",
        },
      });
    }
  }
});

/*****************************************************************************
 * START SERVER
 *****************************************************************************/

/**
 * Main function to start the MCP server
 * Uses Express and StreamableHTTPServerTransport for HTTP communication
 */
async function main() {
  app.listen(PORT, () => {
    const baseUrl = `http://localhost:${PORT}`;
    console.log(`
🚀 Weather MCP Server (Original SDK) Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MCP Endpoint:     ${baseUrl}/mcp
🏥 Health Check:     ${baseUrl}/health
ℹ️  Server Info:      ${baseUrl}/

🛠️  Tools: weather.today
📦 Resources: weather://today/{city}
💬 Prompts: weather.ensureCity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    // Close all transports
    for (const transport of transports.values()) {
      await transport.close();
    }
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
