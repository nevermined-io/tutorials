/**
 * @fileoverview HTTP server for a financial-advice agent using OpenAI.
 * Exposes a `/ask` endpoint with per-session conversational memory and Nevermined protection.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import crypto from "crypto";
import { Payments, EnvironmentName } from "@nevermined-io/payments";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const NVM_API_KEY = process.env.BUILDER_NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ||
  "staging_sandbox") as EnvironmentName;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID ?? "";
const NVM_AGENT_HOST = process.env.NVM_AGENT_HOST || `http://localhost:${PORT}`;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to run the agent.");
  process.exit(1);
}

if (!NVM_API_KEY || !NVM_AGENT_ID) {
  console.error(
    "Nevermined environment is required: set NVM_API_KEY and NVM_AGENT_ID in .env"
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
    if (
      !agentRequest.balance.isSubscriber ||
      agentRequest.balance.balance < 1n
    ) {
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

    // Set up observability metadata for tracking this operation
    const customProperties = {
      agentid: NVM_AGENT_ID,
      sessionid: sessionId,
      operation: "financial_advice",
    };

    // Create OpenAI client with Helicone observability integration
    const openai = new OpenAI(
      payments.observability.withOpenAI(
        OPENAI_API_KEY,
        agentRequest,
        customProperties
      )
    );

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

    // Initialize redemption result
    let redemptionResult: any;

    let useCreditAmount = undefined; // BigInt(creditAmount);
    let useMarginPercent = 0.2;

    // Redeem credits after successful API call
    try {
      redemptionResult = await payments.requests.redeemCreditsFromRequest(
        agentRequest.agentRequestId,
        requestAccessToken,
        useCreditAmount,
        useMarginPercent,
      );
      console.log("redemptionResult", redemptionResult);
      redemptionResult.creditsRedeemed = redemptionResult.data?.amountOfCredits;
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
  // eslint-disable-next-line no-console
  console.log(`Agent listening on http://localhost:${PORT}`);
  console.log("NVM_API_KEY", process.env.BUILDER_NVM_API_KEY);
  console.log("NVM_ENVIRONMENT", process.env.NVM_ENVIRONMENT);
  console.log("NVM_AGENT_ID", process.env.NVM_AGENT_ID);
  console.log("NVM_PLAN_ID", process.env.NVM_PLAN_ID);
});
