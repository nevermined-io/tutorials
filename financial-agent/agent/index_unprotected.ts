/**
 * @fileoverview Free-access HTTP server for the medical-advice agent (no Nevermined protection).
 * Provides a `/ask` endpoint with per-session conversational memory.
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

class SessionStore {
  private sessions: Map<string, InMemoryChatMessageHistory> = new Map();
  getHistory(sessionId: string): InMemoryChatMessageHistory {
    let history = this.sessions.get(sessionId);
    if (!history) {
      history = new InMemoryChatMessageHistory();
      this.sessions.set(sessionId, history);
    }
    return history;
  }
}

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
- If the request is outside medical scope, politely decline or redirect.`;
  return ChatPromptTemplate.fromMessages([
    ["system", systemText],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);
}

function createRunnable(model: ChatOpenAI) {
  const prompt = buildMedicalPrompt();
  const chain = prompt.pipe(model);
  return new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: async (sessionId: string) =>
      sessionStore.getHistory(sessionId),
    inputMessagesKey: "input",
    historyMessagesKey: "history",
  });
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
if (!OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.error("OPENAI_API_KEY is required to run the free agent.");
  process.exit(1);
}

const sessionStore = new SessionStore();
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
  apiKey: OPENAI_API_KEY,
});
const runnable = createRunnable(model);

app.post("/ask", async (req: Request, res: Response) => {
  try {
    const input = String(req.body?.input_query ?? "").trim();
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
    res.json({ output: text, sessionId });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Free agent /ask error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Free Agent listening on http://localhost:${PORT}`);
});
