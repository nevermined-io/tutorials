/**
 * @fileoverview HTTP server for a financial-advice agent using OpenAI.
 * Exposes a `/ask` endpoint with per-session conversational memory and Nevermined protection.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import crypto from "crypto";
import { Payments, EnvironmentName, StartAgentRequest } from "@nevermined-io/payments";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENV = (process.env.NVM_ENV || "staging_sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_AGENT_HOST = process.env.NVM_AGENT_HOST || `http://localhost:${PORT}`;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to run the agent.");
  process.exit(1);
}

if (!NVM_API_KEY || !NVM_AGENT_ID) {
  console.error("Nevermined environment is required: set NVM_API_KEY and NVM_AGENT_ID in .env");
  process.exit(1);
}

// Initialize Nevermined Payments SDK for access control and observability
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENV,
});

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

// Handle financial advice requests with Nevermined payment protection and observability
app.post("/ask", async (req: Request, res: Response) => {
  try {
    // Extract authorization details from request headers
    const authHeader = (req.headers["authorization"] || "") as string;
    const requestedUrl = `${NVM_AGENT_HOST}${req.url}`;
    const httpVerb = req.method;

    // Check if user is authorized and has sufficient balance
    const agentRequest = await payments.requests.startProcessingRequest(
      NVM_AGENT_ID,
      authHeader,
      requestedUrl,
      httpVerb
    );

    // Reject request if user doesn't have credits or subscription
    if (!agentRequest.balance.isSubscriber || agentRequest.balance.balance < 1n) {
      return res.status(402).json({ error: "Payment Required" });
    }

    // Extract access token for credit redemption
    const requestAccessToken = authHeader.replace(/^Bearer\s+/i, "");

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

    // Set up observability metadata for tracking this operation
    const customProperties = {
      agentid: NVM_AGENT_ID,
      sessionid: sessionId,
      operation: "financial_advice",
    };

    // Create OpenAI client with Helicone observability integration
    const openai = new OpenAI(payments.observability.withHeliconeOpenAI(
      OPENAI_API_KEY,
      agentRequest,
      customProperties
    ));

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

    // Initialize redemption result
    let redemptionResult: any;

    // Define the amount of credits to redeem for this request
    const credit_amount = 1;

    // Redeem credits after successful API call
    try {
      redemptionResult = await payments.requests.redeemCreditsFromRequest(
        agentRequest.agentRequestId,
        requestAccessToken,
        BigInt(credit_amount)
      );
      redemptionResult.creditsRedeemed = 1;
    } catch (redeemErr) {
      console.error("Failed to redeem credits:", redeemErr);
      redemptionResult = {
        creditsRedeemed: 0,
        error: redeemErr,
      };
    }

    // Return response with session info and payment details
    res.json({ output: response, sessionId, redemptionResult });
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
  console.log(`Financial Agent listening on http://localhost:${PORT}`);
});
