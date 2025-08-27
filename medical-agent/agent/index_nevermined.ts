/**
 * @fileoverview HTTP server for a medical-advice agent using LangChain and OpenAI.
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
import { Payments, EnvironmentName } from "@nevermined-io/payments";

/**
 * In-memory session message store.
 */
class SessionStore {
  private sessions: Map<string, InMemoryChatMessageHistory> = new Map();

  /**
   * Get or create the message history for a session id.
   * @param {string} sessionId - Session identifier
   * @returns {InMemoryChatMessageHistory} The chat message history for the session
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

/**
 * Build the medical expert prompt.
 * The prompt is intentionally extensive and instructive for high-quality, safe guidance.
 */
/**
 * Build the medical expert prompt template.
 * @returns {ChatPromptTemplate} The composed chat prompt template
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

/**
 * Create LangChain pipeline with per-session memory.
 * @param {ChatOpenAI} model - Chat model instance
 * @returns {RunnableWithMessageHistory<any, any>} Runnable with history
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

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
if (!OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.error("OPENAI_API_KEY is required to run the agent.");
  process.exit(1);
}

// Nevermined required configuration
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENV = (process.env.NVM_ENV || "sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_AGENT_HOST = process.env.NVM_AGENT_HOST || `http://localhost:${PORT}`;

if (!NVM_API_KEY || !NVM_AGENT_ID) {
  // eslint-disable-next-line no-console
  console.error(
    "Nevermined environment is required: set NVM_API_KEY and NVM_AGENT_ID in .env"
  );
  process.exit(1);
}

/**
 * Build a singleton Payments client for Nevermined.
 */
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENV,
});

const sessionStore = new SessionStore();
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
  apiKey: OPENAI_API_KEY,
});
const runnable = createRunnable(model);

/**
 * Ensure the incoming request is authorized via Nevermined and return request data for redemption.
 * @param {Request} req - Express request object
 * @returns {{ agentRequestId: string, requestAccessToken: string }} identifiers to redeem credits later
 * @throws Error with statusCode 402 when not authorized
 */
async function ensureAuthorized(
  req: Request
): Promise<{ agentRequestId: string; requestAccessToken: string }> {
  const authHeader = (req.headers["authorization"] || "") as string;
  const requestedUrl = `${NVM_AGENT_HOST}${req.url}`;
  const httpVerb = req.method;
  const result = await payments.requests.startProcessingRequest(
    NVM_AGENT_ID,
    authHeader,
    requestedUrl,
    httpVerb
  );
  if (!result.balance.isSubscriber) {
    const error: any = new Error("Payment Required");
    error.statusCode = 402;
    throw error;
  }
  const requestAccessToken = authHeader.replace(/^Bearer\s+/i, "");
  return { agentRequestId: result.agentRequestId, requestAccessToken };
}

/**
 * POST /ask
 * Body: { input: string, sessionId?: string }
 * Returns: { output: string, sessionId: string }
 */
/**
 * Handle medical question requests.
 * Creates a session when one is not provided and reuses memory across calls.
 */
app.post("/ask", async (req: Request, res: Response) => {
  try {
    const { agentRequestId, requestAccessToken } = await ensureAuthorized(req);
    const input = String(req.body?.input ?? "").trim();
    if (!input) return res.status(400).json({ error: "Missing input" });

    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) sessionId = crypto.randomUUID();

    const result = await runnable.invoke(
      { input },
      { configurable: { sessionId } }
    );
    const text =
      result?.content ??
      (Array.isArray(result)
        ? result.map((m: any) => m.content).join("\n")
        : String(result));

    // After successful processing, redeem 1 credit for this request
    try {
      await payments.requests.redeemCreditsFromRequest(
        agentRequestId,
        requestAccessToken,
        1n
      );
    } catch (redeemErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to redeem credits:", redeemErr);
    }

    res.json({ output: text, sessionId });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error handling /ask", error);
    const status = error?.statusCode === 402 ? 402 : 500;
    res.status(status).json({
      error: status === 402 ? "Payment Required" : "Internal server error",
    });
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Agent listening on http://localhost:${PORT}`);
});
