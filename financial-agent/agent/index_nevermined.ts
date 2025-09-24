/**
 * @fileoverview HTTP server for a financial-advice agent using LangChain and OpenAI.
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
import {
  Payments,
  EnvironmentName,
  StartAgentRequest,
} from "@nevermined-io/payments";

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
 * Build the financial advisor prompt template.
 * @returns {ChatPromptTemplate} The composed chat prompt template
 */
function buildFinancialPrompt(): ChatPromptTemplate {
  const systemText = `You are FinGuide, a professional financial advisor and market analyst specializing in cryptocurrency and traditional markets.
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
- Ask clarifying questions when the user intent or constraints (budget, risk tolerance, time horizon) are unclear.
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
  const prompt = buildFinancialPrompt();
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
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ||
  "sandbox") as EnvironmentName;
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
  environment: NVM_ENVIRONMENT,
});

const sessionStore = new SessionStore();

/**
 * Create a model with dynamic sessionId and custom properties for each request
 * @param {string} sessionId - The session ID for this request
 * @param {Record<string, string>} customProperties - Additional custom properties to include as headers
 * @returns {ChatOpenAI} Configured ChatOpenAI model
 */
function createModelWithSessionId(
  agentRequest: StartAgentRequest,
  customProperties: Record<string, string> = {}
): ChatOpenAI {
  return new ChatOpenAI(
    payments.observability.withHeliconeLangchain(
      "gpt-4o-mini",
      OPENAI_API_KEY,
      agentRequest,
      customProperties
    )
  );
}

/**
 * Ensure the incoming request is authorized via Nevermined and return request data for redemption.
 * @param {Request} req - Express request object
 * @returns {{ agentRequestId: string, requestAccessToken: string }} identifiers to redeem credits later
 * @throws Error with statusCode 402 when not authorized
 */
async function ensureAuthorized(
  req: Request
): Promise<{ agentRequest: StartAgentRequest; requestAccessToken: string }> {
  const authHeader = (req.headers["authorization"] || "") as string;
  const requestedUrl = `${NVM_AGENT_HOST}${req.url}`;
  const httpVerb = req.method;
  const result = await payments.requests.startProcessingBatchRequest(
    NVM_AGENT_ID,
    authHeader,
    requestedUrl,
    httpVerb
  );
  if (!result.balance.isSubscriber || result.balance.balance < 1n) {
    const error: any = new Error("Payment Required");
    error.statusCode = 402;
    throw error;
  }
  const requestAccessToken = authHeader.replace(/^Bearer\s+/i, "");
  return { agentRequest: result, requestAccessToken };
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
    const { agentRequest, requestAccessToken } = await ensureAuthorized(req);
    console.log("agentRequestId", agentRequest.agentRequestId);
    console.log("requestAccessToken", requestAccessToken);
    const inputs = req.body?.input_query ?? [];
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0)
      return res.status(400).json({ error: "Missing input" });

    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) sessionId = crypto.randomUUID();

    // Create model and runnable with the dynamic sessionId
    const model = createModelWithSessionId(agentRequest);
    const runnable = createRunnable(model);

    let outputs = [];
    for (const input of inputs) {
      console.log("Sending question to the agent", input);
      const result = await runnable.invoke(
        { input },
        { configurable: { sessionId } }
      );
      const text =
        result?.content ??
        (Array.isArray(result)
          ? result.map((m: any) => m.content).join("\n")
          : String(result));
      outputs.push(text);
    }
    // After successful processing, redeem 1 credit for this request
    let redemptionResult: any;
    try {
      redemptionResult = await payments.requests.redeemCreditsFromBatchRequest(
        agentRequest.agentRequestId,
        requestAccessToken,
        BigInt(inputs.length)
      );
      redemptionResult.creditsRedeemed = inputs.length;
      console.log("redemptionResult", redemptionResult);
    } catch (redeemErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to redeem credits:", redeemErr);
      redemptionResult = {
        creditsRedeemed: 0,
        error: redeemErr,
      };
    }

    res.json({ output: outputs, sessionId, redemptionResult });
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
  console.log("NVM_API_KEY", process.env.BUILDER_NVM_API_KEY);
  console.log("NVM_ENVIRONMENT", process.env.NVM_ENVIRONMENT);
  console.log("NVM_AGENT_ID", process.env.NVM_AGENT_ID);
  console.log("NVM_PLAN_ID", process.env.NVM_PLAN_ID);
});
