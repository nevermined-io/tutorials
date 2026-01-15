/**
 * @fileoverview Financial Agent Server - Unprotected Version
 *
 * HTTP server for a financial-advice agent using OpenAI SDK directly.
 * Exposes a `/ask` endpoint with per-session conversational memory.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import crypto from "crypto";

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const AGENT_URL = process.env.AGENT_URL || `http://localhost:${PORT}`;

// ============================================================================
// Validation
// ============================================================================

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to run the agent.");
  process.exit(1);
}

// ============================================================================
// SDK Initialization
// ============================================================================

/**
 * Initialize OpenAI client
 */
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ============================================================================
// Session Management
// ============================================================================

/**
 * Store conversation history for each session
 * Key: sessionId, Value: array of message objects
 */
const sessions = new Map<string, any[]>();

// ============================================================================
// Express App Initialization
// ============================================================================

const app = express();
app.use(express.json());

// ============================================================================
// Prompt Configuration
// ============================================================================

/**
 * Get the system prompt for the financial agent
 * @param maxTokens - Maximum tokens for the response
 * @returns System prompt string
 */
function getSystemPrompt(maxTokens: number): string {
  return `
You are FinGuide, a friendly financial education AI designed to help people learn about investing, 
personal finance, and market concepts. 
Your goal is to provide comprehensive, one-shot answers whenever possible, 
anticipating the user's needs and providing all relevant information in a single, well-structured response.

Your role is to provide:

1.  **Financial education:** Explain investing concepts, terminology, and strategies in simple, beginner-friendly language.
2.  **General market insights:** Discuss historical trends, market principles, and how different asset classes typically behave.
3.  **Investment fundamentals:** Teach about diversification, risk management, dollar-cost averaging, and long-term investing principles.
4.  **Personal finance guidance:** Help with budgeting basics, emergency funds, debt management, and retirement planning concepts.

Response style:
Write in a natural, conversational tone as if you're chatting with a friend over coffee. 
Be encouraging and educational rather than giving specific investment advice. 
Use analogies and everyday examples to explain complex concepts in a way that feels relatable. 
Always focus on teaching principles rather than recommending specific investments. 
Avoid using formal lists or rigid bullet points; instead, weave information into flowing, natural sentences that feel like genuine conversation.
Adjust your response length based on the complexity of the question - for simple questions,
keep responses concise (50-100 words), but for complex topics that need thorough explanation, feel free to use 
up to ${maxTokens} tokens to provide comprehensive educational value

**One-Shot Response Policy:**
Your primary objective is to provide a complete and detailed answer in your first response, 
anticipating the user's potential follow-up questions. **Do not ask for more details** unless 
the user's query is so vague that it's impossible to provide a meaningful educational response (e.g., "Tell me about finance"). 
If the user asks a specific question like "What is an ETF?", provide a full explanation covering the definition, 
how they work, their pros and cons, and a relevant analogy, all in one go.

**Proactive Engagement:**
After delivering the main response, proactively offer further assistance. 
Gently prompt the user for follow-up questions or offer to explain a related concept in more detail. 
Your final sentence should always express a readiness to help further. 
For example, "Does that make sense? I can also tell you more about how ETFs are different from mutual funds," 
or "Let me know if you want to dive deeper into any of these topics!"

Important disclaimers:
Remember to naturally work into your conversations that you're an educational AI guide,
 not a licensed financial advisor. You don't have access to real-time market data or current prices. 
 All the information you share is for educational purposes only, not personalized financial advice. 
 Always encourage users to consult with qualified financial professionals for actual investment decisions. 
 Naturally remind them that past performance never guarantees future results and all investments carry risk, including potential loss of principal.

When discussing investments:
Focus on general principles and educational concepts while explaining both potential benefits and risks in a conversational way. 
Naturally emphasize the importance of diversification and long-term thinking. 
Gently remind users to only invest what they can afford to lose and suggest they research thoroughly while considering their personal financial situation. 
Make these important points feel like natural parts of the conversation rather than formal warnings.`;
}

// ============================================================================
// Credit Calculation
// ============================================================================

/**
 * Calculate dynamic credit amount based on token usage
 * Note: In unprotected version, this is not used but kept for structural consistency
 * @param tokensUsed - Number of tokens actually used
 * @param maxTokens - Maximum tokens allowed
 * @returns Credit amount to charge (minimum 1)
 */
function calculateCreditAmount(tokensUsed: number, maxTokens: number): number {
  // Formula: 10 * (actual_tokens / max_tokens)
  // This rewards shorter responses with lower costs
  const tokenUtilization = Math.min(tokensUsed / maxTokens, 1); // Cap at 1
  const baseCreditAmount = 10 * tokenUtilization;
  const creditAmount = Math.max(Math.ceil(baseCreditAmount), 1); // Minimum 1 credit

  console.log(
    `Token usage: ${tokensUsed}/${maxTokens} (${(
      tokenUtilization * 100
    ).toFixed(1)}%) - Credits: ${creditAmount}`
  );

  return creditAmount;
}

// ============================================================================
// Additional Features
// ============================================================================

// Additional feature sections can be added here (e.g., rate limiting, analytics, etc.)

// ============================================================================
// LLM Integration (OpenAI Direct)
// ============================================================================

/**
 * Generate response using OpenAI API directly
 * @param messages - Conversation messages
 * @param maxTokens - Maximum tokens for response
 * @returns Object with response text and tokens used
 */
async function generateLLMResponse(
  messages: any[],
  maxTokens: number
): Promise<{ response: string; tokensUsed: number }> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    temperature: 0.3,
    max_tokens: maxTokens,
  });

  const response =
    completion.choices[0]?.message?.content || "No response generated";
  const tokensUsed = completion.usage?.completion_tokens || 0;

  return { response, tokensUsed };
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * Handle financial advice requests
 */
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // Extract and validate the user's input
    const input = String(req.body?.input_query ?? "").trim();
    if (!input) {
      return res.status(400).json({ error: "Missing input" });
    }

    // Get or create a session ID for conversation continuity
    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Define the maximum number of tokens for the completion response
    const maxTokens = 250;

    // Retrieve existing conversation history or start fresh
    let messages = sessions.get(sessionId) || [];

    // Add system prompt if this is a new conversation
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: getSystemPrompt(maxTokens),
      });
    }

    // Add the user's question to the conversation
    messages.push({ role: "user", content: input });

    // Generate response using OpenAI
    const { response, tokensUsed } = await generateLLMResponse(
      messages,
      maxTokens
    );

    // Save the AI's response to conversation history
    messages.push({ role: "assistant", content: response });
    sessions.set(sessionId, messages);

    // Return response
    res.json({
      output: response,
      sessionId,
    });
  } catch (error: any) {
    console.error("Error handling /ask", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * Health check endpoint
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ============================================================================
// Server Initialization
// ============================================================================

/**
 * Start the Express server
 */
app.listen(PORT, () => {
  console.log(`Agent listening on http://localhost:${PORT}`);
});
