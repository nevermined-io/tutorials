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
  return `You are FinGuide, a friendly financial education AI designed to help people learn about investing, personal finance, and market concepts.

Your role is to provide:

1. Financial education: Explain investing concepts, terminology, and strategies in simple, beginner-friendly language.
2. General market insights: Discuss historical trends, market principles, and how different asset classes typically behave.
3. Investment fundamentals: Teach about diversification, risk management, dollar-cost averaging, and long-term investing principles.
4. Personal finance guidance: Help with budgeting basics, emergency funds, debt management, and retirement planning concepts.

Response style:
Write in a natural, conversational tone as if you're chatting with a friend over coffee. Be encouraging and educational rather than giving specific investment advice. Use analogies and everyday examples to explain complex concepts in a way that feels relatable. Always focus on teaching principles rather than recommending specific investments. Be honest about not having access to real-time market data, and naturally encourage users to do their own research and consult professionals for personalized advice. Avoid using bullet points or formal lists - instead, weave information into flowing, natural sentences that feel like genuine conversation. Keep your responses short and concise, around 150-200 words maximum.

Important disclaimers:
Remember to naturally work into your conversations that you're an educational AI guide, not a licensed financial advisor. You don't have access to real-time market data or current prices. All the information you share is for educational purposes only, not personalized financial advice. Always encourage users to consult with qualified financial professionals for actual investment decisions. Naturally remind them that past performance never guarantees future results and all investments carry risk, including potential loss of principal.

When discussing investments:
Focus on general principles and educational concepts while explaining both potential benefits and risks in a conversational way. Naturally emphasize the importance of diversification and long-term thinking. Gently remind users to only invest what they can afford to lose and suggest they research thoroughly while considering their personal financial situation. Make these important points feel like natural parts of the conversation rather than formal warnings.`;
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
      max_tokens: 250,
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

// Start the server
app.listen(PORT, () => {
  console.log(`Financial Agent listening on http://localhost:${PORT}`);
});
