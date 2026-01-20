/**
 * HTTP Agent with Observability - Express server with Nevermined payment middleware and observability logging.
 *
 * This demonstrates how to:
 * 1. Protect an endpoint using the x402 protocol with the standard paymentMiddleware
 * 2. Access agentRequest from the payment context for observability
 * 3. Route OpenAI calls through Nevermined observability for logging and analytics
 *
 * The agentRequest (available via req.paymentContext.agentRequest) contains:
 * - agentRequestId: Unique identifier for this request
 * - agentName: Name of the AI agent
 * - agentId: ID of the AI agent
 * - balance: Subscriber's credit balance info
 * - urlMatching: The matched endpoint pattern
 * - verbMatching: The matched HTTP verb
 */
import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import OpenAI from "openai";
import {
  Payments,
  EnvironmentName,
  StartAgentRequest,
} from "@nevermined-io/payments";
import {
  paymentMiddleware,
  X402_HEADERS,
  PaymentContext,
} from "@nevermined-io/payments/express";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const NVM_API_KEY = process.env.NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "staging_sandbox") as EnvironmentName;
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required. Set it in .env file.");
  process.exit(1);
}

if (!NVM_API_KEY || !NVM_PLAN_ID) {
  console.error("NVM_API_KEY and NVM_PLAN_ID are required for payment protection.");
  process.exit(1);
}

// Initialize Nevermined Payments SDK
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// Extend Express Request to include payment context
declare global {
  namespace Express {
    interface Request {
      paymentContext?: PaymentContext;
    }
  }
}

// Apply payment middleware with observability hooks
app.use(
  paymentMiddleware(payments, {
    "POST /ask": {
      planId: NVM_PLAN_ID,
      agentId: NVM_AGENT_ID || undefined,
      credits: 1,
    },
  }, {
    onAfterVerify: (req, verification) => {
      // Log observability info after verification
      const agentRequest = verification.agentRequest;
      if (agentRequest) {
        console.log("[Observability] Verification successful");
        console.log(`  Agent: ${agentRequest.agentName} (${agentRequest.agentId})`);
        console.log(`  Request ID: ${agentRequest.agentRequestId}`);
        console.log(`  Plan: ${agentRequest.balance.planName} (${agentRequest.balance.planId})`);
        console.log(`  Balance: ${agentRequest.balance.balance} credits`);
      }
    },
    onAfterSettle: (req, creditsUsed, result) => {
      console.log(`[Payment] Settled ${creditsUsed} credits`);
    },
  }) as RequestHandler
);

/**
 * POST /ask - Send a query to the AI with Nevermined observability
 *
 * When agentRequest is available from payment verification, OpenAI calls
 * are routed through Nevermined observability for:
 * - Cost tracking per agent/plan
 * - Usage analytics
 * - Request tracing
 */
app.post("/ask", async (req: Request, res: Response) => {
  try {
    const { query } = req.body as { query?: string };

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'query' field" });
    }

    // Get agentRequest from payment context (set by middleware)
    const agentRequest = req.paymentContext?.agentRequest;

    let openai: OpenAI;

    if (agentRequest) {
      // With observability - routes through Nevermined observability for logging
      const config = payments.observability.withOpenAI(
        OPENAI_API_KEY,
        agentRequest,
        { sessionid: randomUUID() }
      );
      openai = new OpenAI(config);

      console.log("[Observability] Using Nevermined observability logging");
    } else {
      // Fallback without observability
      openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      console.log("[Observability] Nevermined observability not available, using direct OpenAI");
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Be concise and informative.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content ?? "No response generated";

    // Settlement happens automatically via middleware after res.json()
    res.json({
      response,
      observability: agentRequest ? {
        agentRequestId: agentRequest.agentRequestId,
        agentName: agentRequest.agentName,
        planId: agentRequest.balance.planId,
      } : null,
    });
  } catch (error) {
    console.error("Error in /ask:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /health - Health check endpoint (unprotected)
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", observability: "enabled" });
});

app.listen(PORT, () => {
  console.log(`HTTP Agent with Observability running on http://localhost:${PORT}`);
  console.log(`\nPayment protection enabled for POST /ask`);
  console.log(`Plan ID: ${NVM_PLAN_ID}`);
  if (NVM_AGENT_ID) {
    console.log(`Agent ID: ${NVM_AGENT_ID}`);
  }
  console.log(`\nObservability: OpenAI calls are logged to Nevermined when agentRequest is available.`);
  console.log(`\nTo test, send requests with x402 token in '${X402_HEADERS.PAYMENT_SIGNATURE}' header.`);
});
