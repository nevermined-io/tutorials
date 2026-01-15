/**
 * @fileoverview Medical Agent Server - x402 Payment Flow
 *
 * HTTP server for a medical-advice agent using LangChain and OpenAI.
 * Exposes a `/ask` endpoint with per-session conversational memory and Nevermined x402 protection.
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
  buildPaymentRequired,
} from "@nevermined-io/payments";

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ||
  "staging_sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";
const AGENT_URL = process.env.AGENT_URL || `http://localhost:${PORT}`;

// ============================================================================
// Validation
// ============================================================================

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to run the agent.");
  process.exit(1);
}

if (!NVM_API_KEY || !NVM_AGENT_ID || !NVM_PLAN_ID) {
  console.error(
    "Nevermined environment is required: set NVM_API_KEY, NVM_AGENT_ID, and NVM_PLAN_ID in .env"
  );
  process.exit(1);
}

// ============================================================================
// SDK Initialization
// ============================================================================

/**
 * Initialize Nevermined Payments SDK for access control and observability
 */
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

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
  return (
    result?.content ??
    (Array.isArray(result)
      ? result.map((m: any) => m.content).join("\n")
      : String(result))
  );
}

// ============================================================================
// Credit Calculation
// ============================================================================

/**
 * Get the fixed credit amount for medical advice requests
 * @returns Credit amount (1 credit per request)
 */
function getCreditAmount(): number {
  return 1;
}

// ============================================================================
// Payment Helpers
// ============================================================================

/**
 * Return 402 Payment Required response with PAYMENT-REQUIRED header
 * @param res - Express response object
 * @param paymentRequired - Payment requirements object
 * @param errorMessage - Optional error message
 */
function returnPaymentRequired(
  res: Response,
  paymentRequired: any,
  errorMessage?: string
): Response {
  const paymentRequiredBase64 = Buffer.from(
    JSON.stringify(paymentRequired)
  ).toString("base64");
  return res
    .status(402)
    .set("PAYMENT-REQUIRED", paymentRequiredBase64)
    .json({ error: errorMessage || "Payment required" });
}

/**
 * Decode and validate the PAYMENT-SIGNATURE header
 * @param x402Token - The base64-encoded payment token
 * @returns Decoded payment payload or null if invalid
 */
function decodePaymentToken(x402Token: string): any | null {
  try {
    const paymentPayload = JSON.parse(
      Buffer.from(x402Token, "base64").toString("utf-8")
    );

    // Validate the payment payload structure
    if (
      !paymentPayload ||
      paymentPayload.x402Version !== 2 ||
      !paymentPayload.accepted
    ) {
      return null;
    }

    return paymentPayload;
  } catch {
    return null;
  }
}

/**
 * Build the PAYMENT-RESPONSE header from settlement result
 * @param settlementResult - Result from settlePermissions
 * @param paymentRequired - Original payment requirements
 * @param paymentPayload - Decoded payment payload
 * @returns Base64-encoded payment response
 */
function buildPaymentResponse(
  settlementResult: any,
  paymentRequired: any,
  paymentPayload: any
): string {
  const paymentResponse = {
    success: settlementResult.success,
    transaction: settlementResult.transaction || "",
    network: paymentRequired.accepts[0].network,
    payer: paymentPayload.payload?.authorization?.from || "",
  };
  return Buffer.from(JSON.stringify(paymentResponse)).toString("base64");
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * Handle medical question requests with Nevermined x402 payment protection
 */
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // Build the x402 PaymentRequired object for this endpoint
    const requestedUrl = `${AGENT_URL}${req.url}`;
    const paymentRequired = buildPaymentRequired(NVM_PLAN_ID, {
      endpoint: requestedUrl,
      agentId: NVM_AGENT_ID,
      httpVerb: req.method,
    });

    // Check for PAYMENT-SIGNATURE header (x402 standard)
    const paymentSignature = req.headers["payment-signature"] as
      | string
      | undefined;

    // If no payment signature, return 402 with PAYMENT-REQUIRED header
    if (!paymentSignature) {
      console.log(
        "No PAYMENT-SIGNATURE header, returning 402 with PAYMENT-REQUIRED"
      );
      return returnPaymentRequired(
        res,
        paymentRequired,
        "PAYMENT-SIGNATURE header is required"
      );
    }

    // Decode and validate the payment token
    const paymentPayload = decodePaymentToken(paymentSignature);
    if (!paymentPayload) {
      return returnPaymentRequired(
        res,
        paymentRequired,
        "Invalid PAYMENT-SIGNATURE format"
      );
    }

    // Define expected credits for this operation (fixed 1 credit per request)
    const expectedCredits = getCreditAmount();

    // Verify user has permission to access this resource
    const verification = await payments.facilitator.verifyPermissions({
      paymentRequired,
      x402AccessToken: paymentSignature,
      maxAmount: BigInt(expectedCredits),
    });

    if (!verification.isValid) {
      return returnPaymentRequired(
        res,
        paymentRequired,
        verification.invalidReason || "Payment verification failed"
      );
    }

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

    // Get credit amount for settlement
    const creditAmount = getCreditAmount();

    // Settle permissions after successful API call
    let settlementResult: any;
    try {
      settlementResult = await payments.facilitator.settlePermissions({
        paymentRequired,
        x402AccessToken: paymentSignature,
        maxAmount: BigInt(creditAmount),
      });
    } catch (settleErr: any) {
      console.error("Failed to settle permissions:", settleErr);
      return returnPaymentRequired(
        res,
        paymentRequired,
        "Settlement failed: " + (settleErr.message || "Unknown error")
      );
    }

    // Build PAYMENT-RESPONSE header (x402 standard settlement receipt)
    const paymentResponseBase64 = buildPaymentResponse(
      settlementResult,
      paymentRequired,
      paymentPayload
    );

    // Return response with PAYMENT-RESPONSE header and payment details in body
    res.set("PAYMENT-RESPONSE", paymentResponseBase64).json({
      output: response,
      sessionId,
      payment: {
        creditsRedeemed:
          settlementResult.creditsRedeemed || creditAmount.toString(),
        remainingBalance: settlementResult.remainingBalance || "unknown",
      },
    });
  } catch (error: any) {
    console.error("Error handling /ask", error);
    const status = error?.statusCode === 402 ? 402 : 500;
    res.status(status).json({
      error: status === 402 ? "Payment Required" : "Internal server error",
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
  console.log("NVM_API_KEY", process.env.BUILDER_NVM_API_KEY);
  console.log("NVM_ENVIRONMENT", process.env.NVM_ENVIRONMENT);
  console.log("NVM_AGENT_ID", process.env.NVM_AGENT_ID);
  console.log("NVM_PLAN_ID", process.env.NVM_PLAN_ID);
});
