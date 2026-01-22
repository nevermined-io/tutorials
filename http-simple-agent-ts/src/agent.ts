/**
 * Protected HTTP Agent - Express server with Nevermined payment middleware.
 *
 * This demonstrates how to protect an endpoint using the x402 protocol.
 * The /ask endpoint requires a valid x402 access token and burns credits.
 *
 * x402 HTTP Transport Headers:
 * - Client sends token in: `payment-signature` header
 * - Server returns 402 with: `payment-required` header (base64-encoded)
 */
import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import OpenAI from "openai";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import { paymentMiddleware, X402_HEADERS } from "@nevermined-io/payments/express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const NVM_API_KEY = process.env.NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "testing") as EnvironmentName;
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required. Set it in .env file.");
  process.exit(1);
}

if (!NVM_API_KEY || !NVM_PLAN_ID) {
  console.error("NVM_API_KEY and NVM_PLAN_ID are required for payment protection.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Initialize Nevermined Payments SDK
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// Apply payment middleware to protect the /ask endpoint
// x402-compliant: expects `payment-signature` header with access token
// Note: Type cast needed due to Express type overload resolution
app.use(
  paymentMiddleware(payments, {
    "POST /ask": {
      planId: NVM_PLAN_ID,
      credits: 1,
    },
  }, {
    onBeforeVerify: (req) => {
      console.log(`[Payment] Verifying request to ${req.path}`);
    },
    onAfterSettle: (req, creditsUsed) => {
      console.log(`[Payment] Settled ${creditsUsed} credits for ${req.path}`);
    },
  }) as RequestHandler
);

/**
 * POST /ask - Send a query to the AI (protected by payment middleware)
 */
app.post("/ask", async (req: Request, res: Response) => {
  try {
    const { query } = req.body as { query?: string };

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'query' field" });
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

    res.json({ response });
  } catch (error) {
    console.error("Error in /ask:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Protected HTTP Agent running on http://localhost:${PORT}`);
  console.log(`\nPayment protection enabled for POST /ask`);
  console.log(`Plan ID: ${NVM_PLAN_ID}`);
  console.log(`\nTo test, send requests with x402 token in '${X402_HEADERS.PAYMENT_SIGNATURE}' header.`);
});
