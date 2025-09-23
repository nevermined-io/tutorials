/**
 * @fileoverview Minimal client that sends three questions to the agent,
 * storing and reusing the returned sessionId to maintain conversation context.
 */
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";

// Configuration: Load environment variables with defaults
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3000";
const PLAN_ID = process.env.NVM_PLAN_ID as string;
const AGENT_ID = process.env.NVM_AGENT_ID as string;
const SUBSCRIBER_API_KEY = process.env.SUBSCRIBER_NVM_API_KEY as string;
const NVM_ENVIRONMENT = (process.env.NVM_ENV || "sandbox") as EnvironmentName;

// Define demo conversation to show chatbot-style interaction
const DEMO_CONVERSATION_QUESTIONS = [
  "Hi there! I'm new to investing and keep hearing about diversification. Can you explain what that means in simple terms?",
  "That makes sense! So if I want to start investing but only have $100 a month, what should I focus on first?",
  "I've been thinking about cryptocurrency. What should a beginner like me know before investing in crypto?",
];

// Validate required environment variables
function validateEnvironment(): void {
  if (!PLAN_ID || !AGENT_ID) {
    throw new Error("NVM_PLAN_ID and NVM_AGENT_ID are required in environment");
  }
  if (!SUBSCRIBER_API_KEY) {
    throw new Error("SUBSCRIBER_NVM_API_KEY is required in environment");
  }
}

// Get or purchase access token for protected agent
async function getorPurchaseAccessToken(): Promise<string> {
  console.log("🔐 Setting up Nevermined access...");

  // Initialize Nevermined Payments SDK
  const payments = Payments.getInstance({
    nvmApiKey: SUBSCRIBER_API_KEY,
    environment: NVM_ENVIRONMENT,
  });

  // Check current plan balance and subscription status
  const balanceInfo: any = await payments.plans.getPlanBalance(PLAN_ID);
  const hasCredits = Number(balanceInfo?.balance ?? 0) > 0;
  const isSubscriber = balanceInfo?.isSubscriber === true;

  // Purchase plan if not subscribed and no credits
  if (!isSubscriber && !hasCredits) {
    console.log("💳 No subscription or credits found. Purchasing plan...");
    await payments.plans.orderPlan(PLAN_ID);
  }

  // Get access token for the agent
  const credentials = await payments.agents.getAgentAccessToken(PLAN_ID, AGENT_ID);

  if (!credentials?.accessToken) {
    throw new Error("Failed to obtain access token");
  }

  console.log("✅ Access token obtained successfully");
  return credentials.accessToken;
}

// Simple loading animation for terminal
function startLoadingAnimation(): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} FinGuide is thinking...`);
    i = (i + 1) % frames.length;
  }, 100);

  return () => {
    clearInterval(interval);
    process.stdout.write('\r');
  };
}

// Send a question to the protected financial agent
async function askAgent(input: string, accessToken: string, sessionId?: string): Promise<{ output: string; sessionId: string; redemptionResult?: any }> {
  // Start loading animation
  const stopLoading = startLoadingAnimation();

  try {
    // Prepare request payload
    const requestBody = {
      input_query: input,
      sessionId: sessionId
    };

    // Prepare headers with authorization
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    };

    // Make HTTP request to protected agent
    const response = await fetch(`${AGENT_URL}/ask`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    // Handle HTTP errors (including payment required)
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      if (response.status === 402) {
        throw new Error("Payment Required - insufficient credits or subscription");
      }
      throw new Error(`Agent request failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    // Parse and return JSON response
    return await response.json() as { output: string; sessionId: string; redemptionResult?: any };
  } finally {
    // Stop loading animation
    stopLoading();
  }
}

/**
 * Run the protected demo client.
 * Sends predefined financial questions to the agent with Authorization and reuses sessionId to preserve context.
 * @returns {Promise<void>} Resolves when the run finishes
 */
<<<<<<< HEAD
async function runDemo(): Promise<void> {
  console.log("🚀 Starting Financial Agent Demo (Protected with Nevermined)\n");
=======
async function main(): Promise<void> {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
  if (!PORT) {
    throw new Error("PORT is required in client env");
  }
  const baseUrl = process.env.AGENT_URL || `http://localhost:${PORT}`;
>>>>>>> main

  // Validate environment setup
  validateEnvironment();

  // Obtain access token for protected agent
  const accessToken = await getorPurchaseAccessToken();

  // Track session across multiple questions
  let sessionId: string | undefined;

<<<<<<< HEAD
  // Send each demo question and maintain conversation context
  for (let i = 0; i < DEMO_CONVERSATION_QUESTIONS.length; i++) {
    const question = DEMO_CONVERSATION_QUESTIONS[i];
=======
  const planId = process.env.NVM_PLAN_ID as string;
  const agentId = process.env.NVM_AGENT_ID as string;
  const nvmApiKey = process.env.SUBSCRIBER_NVM_API_KEY as string;
  const nvmEnv = (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName;
  if (!planId || !agentId) {
    throw new Error("NVM_PLAN_ID and NVM_AGENT_ID are required in client env");
  }
  if (!nvmApiKey) {
    throw new Error("SUBSCRIBER_NVM_API_KEY is required in client env");
  }
  bearer = await getOrBuyAccessToken({
    planId,
    agentId,
    nvmApiKey,
    nvmEnv,
  });
>>>>>>> main

    console.log(`📝 Question ${i + 1}: ${question}`);

    try {
      // Send question to protected agent (reusing sessionId for context)
      const result = await askAgent(question, accessToken, sessionId);

      // Update sessionId for next question
      sessionId = result.sessionId;

      // Display agent response and payment info
      console.log(`🤖 FinGuide (Session: ${sessionId}):`);
      console.log(result.output);

      if (result.redemptionResult) {
        console.log(`💰 Credits redeemed: ${result.redemptionResult.creditsRedeemed || 0}`);
      }

      console.log("\n" + "=".repeat(80) + "\n");

    } catch (error) {
      console.error(`❌ Error processing question ${i + 1}:`, error);
      break;
    }
  }

  console.log("✅ Demo completed!");
}

<<<<<<< HEAD
// Run the demo and handle any errors
runDemo().catch((error) => {
  console.error("💥 Demo failed:", error);
=======
/**
 * Perform a POST /ask to the protected agent.
 * @param {string} baseUrl - Base URL of the agent service
 * @param {string} input - User question text
 * @param {string} [sessionId] - Optional existing session id
 * @param {string} [bearer] - Authorization token to access protected endpoint
 * @returns {Promise<{ output: string; sessionId: string }>} The JSON response containing output and sessionId
 */
async function askAgent(
  baseUrl: string,
  input: string,
  sessionId?: string,
  bearer?: string
): Promise<{ output: string; sessionId: string }> {
  const res = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({ input_query: input, sessionId }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `Agent request failed: ${res.status} ${res.statusText} ${errorText}`
    );
  }
  const data = (await res.json()) as { output: string; sessionId: string };
  return data;
}

/**
 * Get a valid access token by checking plan balance/subscription first.
 * If not subscribed or no credits, purchase the plan and then fetch the token.
 * @param {Object} opts - Options object
 * @param {string} opts.planId - Plan identifier
 * @param {string} opts.agentId - Agent identifier
 * @param {string} opts.nvmApiKey - Nevermined API Key (subscriber)
 * @param {EnvironmentName} opts.nvmEnv - Nevermined environmentment
 * @returns {Promise<string>} The access token string
 */
async function getOrBuyAccessToken(opts: {
  planId: string;
  agentId: string;
  nvmApiKey: string;
  nvmEnv: EnvironmentName;
}): Promise<string> {
  const payments = Payments.getInstance({
    nvmApiKey: opts.nvmApiKey,
    environment: opts.nvmEnv,
  });
  const balanceInfo: any = await payments.plans.getPlanBalance(opts.planId);
  const hasCredits = Number(balanceInfo?.balance ?? 0) > 0;
  const isSubscriber = balanceInfo?.isSubscriber === true;
  if (!isSubscriber && !hasCredits) {
    console.log("Ordering plan with key: ", opts.nvmApiKey);
    await payments.plans.orderPlan(opts.planId);
  }
  const creds = await payments.agents.getAgentAccessToken(
    opts.planId,
    opts.agentId
  );
  if (!creds?.accessToken) throw new Error("Access token unavailable");
  return creds.accessToken;
}

// Run the client
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[CLIENT] Error:", err);
>>>>>>> main
  process.exit(1);
});
