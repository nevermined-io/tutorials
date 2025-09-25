/**
 * Weather tool handler
 */
import { z } from "zod";
import OpenAI from "openai";
import { Payments } from "@nevermined-io/payments";
import {
  getTodayWeather,
  sanitizeCity,
  TodayWeather,
} from "../../services/weather.service.js";
import { loadEnvironmentConfig } from "../../config/environment.js";
import type {
  CreditsContext,
  PaywallContext,
} from "@nevermined-io/payments/mcp";

/**
 * Generate a well-formatted weather forecast using OpenAI with Nevermined observability
 * @param weather Raw weather data from the service
 * @param context PaywallContext containing agentRequest and credits
 * @returns Formatted weather forecast text
 */
async function generateWeatherForecast(
  weather: TodayWeather,
  context: PaywallContext
): Promise<string> {
  const envConfig = loadEnvironmentConfig();
  const payments = Payments.getInstance({
    nvmApiKey: envConfig.nvmApiKey,
    environment: envConfig.nvmEnvironment as any,
  });

  // Set up observability metadata for tracking this operation
  const customProperties = {
    agentId: context.agentRequest.agentId,
    sessionId: context.agentRequest.agentRequestId,
    operation: "weather_forecast",
  };

  // Create OpenAI client with Helicone observability integration
  const openai = new OpenAI(
    payments.observability.withOpenAI(
      process.env.OPENAI_API_KEY!,
      context.agentRequest,
      customProperties
    )
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

/**
 * Params shape for weather tool input (Zod raw shape as required by registerTool)
 */
export const weatherToolParams = {
  city: z.string().min(2).max(80),
};

/**
 * Configuration for weather tool
 */
export const weatherToolConfig = {
  title: "Today's Weather",
  description: "Get today's weather summary for a city",
  inputSchema: weatherToolParams,
};

/**
 * Base weather tool handler (before paywall protection)
 */
export async function weatherToolHandler(
  args: unknown,
  extra: any,
  context?: PaywallContext
) {
  const { city } = args as { city: string };
  if (!city) {
    throw { code: -32003, message: "City is required" };
  }
  if (!context) {
    throw { code: -32003, message: "Context is required" };
  }
  const sanitized = sanitizeCity(city);
  const weather: TodayWeather = await getTodayWeather(sanitized);

  // Generate enhanced weather forecast using LLM with Nevermined observability
  const forecast = await generateWeatherForecast(weather, context);

  return {
    content: [
      { type: "text" as const, text: forecast },
      {
        type: "resource_link" as const,
        uri: `weather://today/${encodeURIComponent(weather.city)}`,
        name: `weather today ${weather.city}`,
        mimeType: "application/json",
        description: "Raw JSON for today's weather",
      },
    ],
  };
}
/**
 * Credits policy for the weather tool.
 * @param ctx CreditsContext provided by the payments library.
 * - ctx.args: original handler arguments
 * - ctx.result: handler result
 * - ctx.request: metadata (authHeader, logicalUrl, toolName)
 */
export function weatherToolCreditsCalculator(_ctx: CreditsContext): bigint {
  return BigInt(1);
}
