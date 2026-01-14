/**
 * @fileoverview HTTP server for a financial-advice agent using OpenAI.
 * Exposes a `/ask` endpoint with per-session conversational memory and Nevermined protection.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import crypto from "crypto";
import { Payments, EnvironmentName, decodeAccessToken } from "@nevermined-io/payments";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ||
  "staging_sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";
const NVM_AGENT_HOST = process.env.NVM_AGENT_HOST || `http://localhost:${PORT}`;

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

// Initialize Nevermined Payments SDK for access control and observability
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// Define the AI's role and behavior
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

// Calculate dynamic credit amount based on token usage
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

// Store conversation history for each session
const sessions = new Map<string, any[]>();

// Build the x402 PaymentRequired object for this endpoint
function buildPaymentRequired(url: string, httpVerb: string) {
  return {
    x402Version: 2,
    error: "Payment required to access resource",
    resource: {
      url,
      description: "Financial advice agent",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "nvm:erc4337",
        network: "eip155:84532",
        planId: NVM_PLAN_ID,
        extra: {
          version: "1",
          agentId: NVM_AGENT_ID,
          httpVerb,
        },
      },
    ],
    extensions: {},
  };
}

// Return 402 Payment Required with PAYMENT-REQUIRED header
function returnPaymentRequired(res: Response, paymentRequired: any, errorMessage?: string) {
  const paymentRequiredBase64 = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return res
    .status(402)
    .set("PAYMENT-REQUIRED", paymentRequiredBase64)
    .json({ error: errorMessage || "Payment required" });
}

// Handle financial advice requests with Nevermined x402 payment protection
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // Build the x402 PaymentRequired object for this endpoint
    const requestedUrl = `${NVM_AGENT_HOST}${req.url}`;
    const paymentRequired = buildPaymentRequired(requestedUrl, req.method);

    // Check for PAYMENT-SIGNATURE header (x402 standard)
    const paymentSignature = req.headers["payment-signature"] as string | undefined;

    // If no payment signature, return 402 with PAYMENT-REQUIRED header
    if (!paymentSignature) {
      console.log("No PAYMENT-SIGNATURE header, returning 402 with PAYMENT-REQUIRED");
      return returnPaymentRequired(res, paymentRequired, "PAYMENT-SIGNATURE header is required");
    }

    // The x402 token is the base64-encoded PaymentPayload
    const x402Token = paymentSignature;

    // Decode the PAYMENT-SIGNATURE (base64-encoded PaymentPayload)
    let paymentPayload: any;
    try {
      paymentPayload = JSON.parse(Buffer.from(x402Token, "base64").toString("utf-8"));
    } catch {
      return returnPaymentRequired(res, paymentRequired, "Invalid PAYMENT-SIGNATURE format");
    }

    // Validate the payment payload structure
    if (!paymentPayload || paymentPayload.x402Version !== 2 || !paymentPayload.accepted) {
      return returnPaymentRequired(res, paymentRequired, "Invalid payment payload structure");
    }

    // Define expected credits for this operation (max 10 based on token usage formula)
    const expectedCredits = 10;

    // Verify user has permission to access this resource
    const verification = await payments.facilitator.verifyPermissions({
      paymentRequired,
      x402AccessToken: x402Token,
      maxAmount: BigInt(expectedCredits),
    });

    if (!verification.isValid) {
      return returnPaymentRequired(res, paymentRequired, verification.invalidReason || "Payment verification failed");
    }

    // Extract and validate the user's input
    const input = String(req.body?.input_query ?? "").trim();
    if (!input) return res.status(400).json({ error: "Missing input" });

    // Get or create a session ID for conversation continuity
    let { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) sessionId = crypto.randomUUID();

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

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Call OpenAI API to generate response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    // Extract the AI's response and token usage
    const response =
      completion.choices[0]?.message?.content || "No response generated";
    const tokensUsed = completion.usage?.completion_tokens || 0;

    // Save the AI's response to conversation history
    messages.push({ role: "assistant", content: response });
    sessions.set(sessionId, messages);

    // Calculate dynamic credit amount based on token usage
    const creditAmount = calculateCreditAmount(tokensUsed, maxTokens);

    // Initialize settlement result
    let settlementResult: any;

    // Settle permissions after successful API call
    try {
      settlementResult = await payments.facilitator.settlePermissions({
        paymentRequired,
        x402AccessToken: x402Token,
        maxAmount: BigInt(creditAmount),
      });
    } catch (settleErr: any) {
      console.error("Failed to settle permissions:", settleErr);
      return returnPaymentRequired(res, paymentRequired, "Settlement failed: " + (settleErr.message || "Unknown error"));
    }

    // Build PAYMENT-RESPONSE header (x402 standard settlement receipt)
    const paymentResponse = {
      success: settlementResult.success,
      transaction: settlementResult.transaction || "",
      network: paymentRequired.accepts[0].network,
      payer: paymentPayload.payload?.authorization?.from || "",
    };
    const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponse)).toString("base64");

    // Return response with PAYMENT-RESPONSE header and payment details in body
    res
      .set("PAYMENT-RESPONSE", paymentResponseBase64)
      .json({
        output: response,
        sessionId,
        payment: {
          creditsRedeemed: settlementResult.creditsRedeemed || creditAmount.toString(),
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

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Start the server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Agent listening on http://localhost:${PORT}`);
  console.log("NVM_API_KEY", process.env.BUILDER_NVM_API_KEY);
  console.log("NVM_ENVIRONMENT", process.env.NVM_ENVIRONMENT);
  console.log("NVM_AGENT_ID", process.env.NVM_AGENT_ID);
  console.log("NVM_PLAN_ID", process.env.NVM_PLAN_ID);
});
