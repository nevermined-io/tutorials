/**
 * @fileoverview Medical Agent Server - Unprotected Version
 *
 * HTTP server for a medical-advice agent using LangChain and OpenAI.
 * Exposes a `/ask` endpoint with per-session conversational memory.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
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

// SDK initialization section - add external service integrations here if needed

// ============================================================================
// Session Management
// ============================================================================

/**
 * In-memory session message store using LangChain's InMemoryChatMessageHistory
 */
class SessionStore {
  private sessions: Map<string, InMemoryChatMessageHistory> = new Map();

  /**
   * Get or create the message history for a session id
   * @param sessionId - Session identifier
   * @returns The chat message history for the session
   */
  getHistory(sessionId: string): InMemoryChatMessageHistory {
    let history = this.sessions.get(sessionId);
    if (!history) {
      history = new InMemoryChatMessageHistory();
      this.sessions.set(sessionId, history);
    }
    return history;
  }
}

const sessionStore = new SessionStore();

// ============================================================================
// Express App Initialization
// ============================================================================

const app = express();
app.use(express.json());

// ============================================================================
// Prompt Configuration
// ============================================================================

/**
 * Build the medical expert prompt template
 * @returns The composed chat prompt template
 */
function buildMedicalPrompt(): ChatPromptTemplate {
  const systemText = `You are MedGuide, a board-certified medical expert assistant.
Provide accurate, evidence-based, and empathetic medical guidance.
Constraints and behavior:
- You are not a substitute for a licensed physician or emergency services.
- If symptoms are severe, sudden, or life-threatening, advise calling emergency services immediately.
- Be concise but thorough. Use plain language, avoid jargon, and explain reasoning.
- Always ask clarifying questions when the information is insufficient.
- Provide differential considerations when appropriate and list red flags.
- Include lifestyle guidance and self-care measures when relevant.
- When medication is discussed, include typical adult dosage ranges where safe and general, and warn to consult a clinician for personalized dosing, interactions, or contraindications.
- Suggest when to seek in-person evaluation and what tests a clinician might order.
- Never provide definitive diagnoses. Use probabilistic language (e.g., likely, possible).
- Respect privacy and avoid collecting personally identifiable information.
- If the request is outside medical scope, politely decline or redirect.
`;
  return ChatPromptTemplate.fromMessages([
    ["system", systemText],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);
}

// ============================================================================
// LLM Integration (LangChain)
// ============================================================================

/**
 * Create LangChain pipeline with per-session memory
 * @param model - Chat model instance
 * @returns Runnable with message history
 */
function createRunnable(model: ChatOpenAI) {
  const prompt = buildMedicalPrompt();
  const chain = prompt.pipe(model);
  const runnable = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: async (sessionId: string) =>
      sessionStore.getHistory(sessionId),
    inputMessagesKey: "input",
    historyMessagesKey: "history",
  });
  return runnable;
}

/**
 * Initialize LangChain model and runnable
 */
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
  apiKey: OPENAI_API_KEY,
});
const runnable = createRunnable(model);

/**
 * Generate response using LangChain
 * @param input - User's input query
 * @param sessionId - Session identifier for conversation continuity
 * @returns Generated response text
 */
async function generateLLMResponse(
  input: string,
  sessionId: string
): Promise<string> {
  const result = await runnable.invoke(
    { input },
    { configurable: { sessionId } }
  );
  const content =
    result?.content ??
    (Array.isArray(result)
      ? result.map((m: any) => m.content).join("\n")
      : String(result));
  return typeof content === "string" ? content : String(content);
}

// ============================================================================
// Additional Features
// ============================================================================

// Additional feature sections can be added here (e.g., rate limiting, analytics, etc.)

// ============================================================================
// API Routes
// ============================================================================

/**
 * Handle medical question requests
 */
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // Extract and validate the user's input
    const input = String(req.body?.input_query ?? req.body?.input ?? "").trim();
    if (!input) {
      return res.status(400).json({ error: "Missing input" });
    }

    // Get or create a session ID for conversation continuity
    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Generate response using LangChain
    const response = await generateLLMResponse(input, sessionId);

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
