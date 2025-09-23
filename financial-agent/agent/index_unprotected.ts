/**
 * @fileoverview Free-access HTTP server for the financial-advice agent (no Nevermined protection).
 * Provides a `/ask` endpoint with per-session conversational memory.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import crypto from "crypto";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to run the agent.");
  process.exit(1);
}

// Initialize OpenAI client with API key
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Define the AI assistant's role and behavior
function getSystemPrompt(): string {
  return `You are FinGuide, a professional financial advisor and market analyst specializing in cryptocurrency and traditional markets.
Your role is to provide:

1. Real-time market data: current prices of cryptocurrencies, stock market performance, and key market indicators.
2. Investment analysis: monthly returns of major companies, market trends, and investment opportunities.
3. Financial advice: recommendations on whether to invest in specific assets based on current market conditions in a generic way.
4. Educational content: explain financial concepts, market dynamics, and investment strategies in simple terms.

Response requirements:
- Be accurate and rely on current market data where possible.
- Include specific numbers and percentages when relevant.
- Provide balanced advice considering both opportunities and risks.
- Be educational and explain the reasoning behind recommendations.
- Always include appropriate risk warnings.
- Maintain a professional but accessible tone for both beginners and experienced investors.

When providing investment advice:
- Consider the user's risk tolerance (no need to ask if not specified).
- Mention both potential gains and potential losses.
- Include time horizon recommendations.
- Suggest diversification strategies.
- Always remind: past performance does not guarantee future results.

Formatting:
- Use clear headings and bullet points.
- Display current market data prominently.
- Highlight risk warnings in bold.
- Provide actionable recommendations when appropriate.

Important constraints:
- You provide financial information and general advice, not personalized financial planning.
- Recommend consulting with a qualified financial advisor for personalized decisions.
- Avoid collecting personally identifiable information.
- Ask clarifying questions when the user intent or constraints (budget, risk tolerance, time horizon) are unclear.`;
}

// Store conversation history for each session
const sessions = new Map<string, any[]>();

// Handle financial advice requests with session-based conversation memory
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // Extract and validate the user's input
    const input = String(req.body?.input_query ?? "").trim();
    if (!input) return res.status(400).json({ error: "Missing input" });

    // Get or create a session ID for conversation continuity
    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) sessionId = crypto.randomUUID();

    // Retrieve existing conversation history or start fresh
    let messages = sessions.get(sessionId) || [];

    // Add system prompt if this is a new conversation
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: getSystemPrompt()
      });
    }

    // Add the user's question to the conversation
    messages.push({ role: "user", content: input });

    // Call OpenAI API to generate response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.3,
      max_tokens: 1000,
    });

    // Extract the AI's response
    const response = completion.choices[0]?.message?.content || "No response generated";

    // Save the AI's response to conversation history
    messages.push({ role: "assistant", content: response });
    sessions.set(sessionId, messages);

    // Return response to the client
    res.json({ output: response, sessionId });
  } catch (error: any) {
    console.error("Agent /ask error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Financial Agent listening on http://localhost:${PORT}`);
});
