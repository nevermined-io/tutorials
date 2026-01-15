/**
 * @fileoverview Medical Agent Client - x402 Payment Flow Demo
 *
 * This client demonstrates how to interact with a protected medical agent
 * using the x402 payment protocol. It implements the complete payment flow:
 * 1. Makes initial request without payment token
 * 2. Receives 402 Payment Required with PAYMENT-REQUIRED header
 * 3. Obtains x402 access token based on payment requirements
 * 4. Retries request with PAYMENT-SIGNATURE header
 * 5. Processes successful response with payment settlement
 */
import "dotenv/config";
import {
  Payments,
  EnvironmentName,
  decodeAccessToken,
  type X402PaymentRequired,
} from "@nevermined-io/payments";

// ============================================================================
// Configuration
// ============================================================================

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3000";
const SUBSCRIBER_API_KEY = process.env.SUBSCRIBER_NVM_API_KEY as string;
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ||
  "staging_sandbox") as EnvironmentName;

// ============================================================================
// Demo Data
// ============================================================================

const DEMO_CONVERSATION_QUESTIONS = [
  "I have a sore throat and mild fever. What could it be and what should I do?",
  "I also noticed nasal congestion and fatigue. Does that change your assessment?",
  "When should I see a doctor, and are there any red flags I should watch for?",
];

// ============================================================================
// Types
// ============================================================================

/**
 * Response from the agent API
 */
interface AgentResponse {
  output: string;
  sessionId: string;
  payment?: {
    creditsRedeemed?: number;
    remainingBalance?: number;
  };
}

/**
 * Payment scheme information extracted from PAYMENT-REQUIRED header
 */
interface PaymentScheme {
  planId: string;
  agentId: string;
}

// ============================================================================
// SDK Initialization
// ============================================================================

const payments = Payments.getInstance({
  nvmApiKey: SUBSCRIBER_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// ============================================================================
// Token Cache
// ============================================================================

/**
 * Cache for x402 access tokens, keyed by "planId:agentId"
 */
const tokenCache = new Map<string, string>();

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates that all required environment variables are set
 * @throws {Error} If SUBSCRIBER_NVM_API_KEY is missing
 */
function validateEnvironment(): void {
  if (!SUBSCRIBER_API_KEY) {
    throw new Error("SUBSCRIBER_NVM_API_KEY is required in environment");
  }
}

// ============================================================================
// Payment Header Parsing
// ============================================================================

/**
 * Extracts payment scheme information from X402PaymentRequired object
 * @param paymentRequired - The decoded payment requirements
 * @returns Payment scheme with planId and agentId
 * @throws {Error} If payment requirements are invalid or missing required fields
 */
function extractPaymentScheme(
  paymentRequired: X402PaymentRequired
): PaymentScheme {
  const scheme = paymentRequired.accepts?.[0];
  if (!scheme) {
    throw new Error("No payment scheme found in payment requirements");
  }

  const planId = scheme.planId;
  const agentId = scheme.extra?.agentId;

  if (!planId || !agentId) {
    throw new Error("Missing planId or agentId in payment requirements");
  }

  return { planId, agentId };
}

/**
 * Parses and decodes the PAYMENT-REQUIRED header from a 402 response
 * @param response - The HTTP response containing the 402 status
 * @returns Decoded payment requirements or null if header is missing/invalid
 */
function parsePaymentRequiredHeader(
  response: Response
): X402PaymentRequired | null {
  const header = response.headers.get("payment-required");
  if (!header) {
    console.log("⚠️ No PAYMENT-REQUIRED header found in 402 response");
    return null;
  }

  try {
    const paymentRequired = decodeAccessToken(header) as X402PaymentRequired;
    console.log("📋 Received payment requirements:");
    console.log(`   Plan ID: ${paymentRequired.accepts?.[0]?.planId}`);
    console.log(`   Agent ID: ${paymentRequired.accepts?.[0]?.extra?.agentId}`);
    console.log(`   Scheme: ${paymentRequired.accepts?.[0]?.scheme}`);
    return paymentRequired;
  } catch (error) {
    console.error("❌ Failed to parse PAYMENT-REQUIRED header:", error);
    return null;
  }
}

/**
 * Parses the PAYMENT-RESPONSE header from a successful payment response
 * @param response - The HTTP response containing the payment result
 */
function parsePaymentResponseHeader(response: Response): void {
  const paymentResponseHeader = response.headers.get("payment-response");
  if (!paymentResponseHeader) {
    return;
  }

  try {
    const paymentResponse = decodeAccessToken(paymentResponseHeader) as {
      success?: boolean;
      transaction?: string;
    };

    console.log(
      "✅ Payment settled:",
      paymentResponse.success ? "Success" : "Failed"
    );

    if (paymentResponse.transaction) {
      console.log(
        `   Transaction: ${paymentResponse.transaction.substring(0, 20)}...`
      );
    }
  } catch (error) {
    // Silently ignore parsing errors for payment response header
    console.debug("Could not parse payment response header:", error);
  }
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Checks if the user has an active subscription or credits for a plan
 * @param planId - The plan identifier to check
 * @returns Object with subscription and credit status
 */
async function checkPlanStatus(planId: string): Promise<{
  hasCredits: boolean;
  isSubscriber: boolean;
}> {
  const balanceInfo: any = await payments.plans.getPlanBalance(planId);
  return {
    hasCredits: Number(balanceInfo?.balance ?? 0) > 0,
    isSubscriber: balanceInfo?.isSubscriber === true,
  };
}

/**
 * Ensures the user has an active subscription or credits for the plan
 * @param planId - The plan identifier to purchase if needed
 */
async function ensureSubscription(planId: string): Promise<void> {
  const { hasCredits, isSubscriber } = await checkPlanStatus(planId);

  if (!isSubscriber && !hasCredits) {
    console.log("💳 No subscription or credits found. Purchasing plan...");
    await payments.plans.orderPlan(planId);
  }
}

/**
 * Obtains an x402 access token for the specified plan and agent
 * @param planId - The plan identifier
 * @param agentId - The agent identifier
 * @returns The x402 access token
 * @throws {Error} If token cannot be obtained
 */
async function getX402AccessToken(
  planId: string,
  agentId: string
): Promise<string> {
  console.log("🔐 Obtaining x402 access token...");

  // Try to get token directly first
  try {
    const result = await payments.x402.getX402AccessToken(planId, agentId);
    if (result?.accessToken) {
      console.log("✅ x402 access token obtained successfully");
      return result.accessToken;
    }
  } catch (tokenError: any) {
    console.log(
      "⚠️ Could not get x402 token directly, checking subscription..."
    );

    // Ensure subscription exists before retrying
    await ensureSubscription(planId);

    // Retry getting the x402 token after subscription
    const result = await payments.x402.getX402AccessToken(planId, agentId);
    if (result?.accessToken) {
      console.log("✅ x402 access token obtained successfully");
      return result.accessToken;
    }
  }

  throw new Error("Failed to obtain x402 access token");
}

/**
 * Gets a cached x402 token or fetches a new one if not in cache
 * @param planId - The plan identifier
 * @param agentId - The agent identifier
 * @returns The x402 access token
 */
async function getOrFetchToken(
  planId: string,
  agentId: string
): Promise<string> {
  const cacheKey = `${planId}:${agentId}`;
  const cachedToken = tokenCache.get(cacheKey);

  if (cachedToken) {
    console.log("🔑 Using cached x402 access token");
    return cachedToken;
  }

  const token = await getX402AccessToken(planId, agentId);
  tokenCache.set(cacheKey, token);
  return token;
}

// ============================================================================
// Agent Communication
// ============================================================================

/**
 * Makes the initial request to the agent without payment signature
 * @param input - The user's question/input
 * @param sessionId - Optional session identifier for conversation continuity
 * @returns The HTTP response
 */
async function makeInitialRequest(
  input: string,
  sessionId?: string
): Promise<Response> {
  console.log("\n📤 Making request to agent...");

  const requestBody = {
    input_query: input,
    sessionId: sessionId,
  };

  return fetch(`${AGENT_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
}

/**
 * Retries the agent request with the payment signature header
 * @param input - The user's question/input
 * @param sessionId - Optional session identifier
 * @param token - The x402 access token to include in PAYMENT-SIGNATURE header
 * @returns The HTTP response
 */
async function retryRequestWithPayment(
  input: string,
  sessionId: string | undefined,
  token: string
): Promise<Response> {
  console.log("📤 Retrying request with PAYMENT-SIGNATURE header...");

  const requestBody = {
    input_query: input,
    sessionId: sessionId,
  };

  return fetch(`${AGENT_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-SIGNATURE": token, // x402 token is already base64 encoded
    },
    body: JSON.stringify(requestBody),
  });
}

/**
 * Handles a 402 Payment Required response by obtaining token and retrying
 * @param response - The 402 response
 * @param input - The original user input
 * @param sessionId - Optional session identifier
 * @returns The agent response after successful payment
 * @throws {Error} If payment flow fails
 */
async function handlePaymentRequired(
  response: Response,
  input: string,
  sessionId: string | undefined
): Promise<AgentResponse> {
  console.log("💳 Received 402 Payment Required");

  const paymentRequired = parsePaymentRequiredHeader(response);
  if (!paymentRequired) {
    throw new Error("Invalid payment requirements in 402 response");
  }

  const { planId, agentId } = extractPaymentScheme(paymentRequired);
  const token = await getOrFetchToken(planId, agentId);

  const retryResponse = await retryRequestWithPayment(input, sessionId, token);

  // Handle retry response errors
  if (!retryResponse.ok) {
    // If still 402, token might be invalid - clear cache and throw
    if (retryResponse.status === 402) {
      const cacheKey = `${planId}:${agentId}`;
      tokenCache.delete(cacheKey);
      const errorBody = await retryResponse.text().catch(() => "");
      throw new Error(`Payment still required after retry: ${errorBody}`);
    }
    throw new Error(
      `Agent request failed: ${retryResponse.status} ${retryResponse.statusText}`
    );
  }

  // Parse and log payment response
  parsePaymentResponseHeader(retryResponse);

  return (await retryResponse.json()) as AgentResponse;
}

/**
 * Sends a question to the protected medical agent using the x402 payment flow
 * @param input - The user's question or input
 * @param sessionId - Optional session identifier for conversation continuity
 * @returns The agent's response with output, sessionId, and optional payment info
 * @throws {Error} If the request fails or payment cannot be processed
 */
async function askAgent(
  input: string,
  sessionId?: string
): Promise<AgentResponse> {
  // Step 1: Make initial request without PAYMENT-SIGNATURE header
  const initialResponse = await makeInitialRequest(input, sessionId);

  // Step 2: Handle 402 Payment Required response
  if (initialResponse.status === 402) {
    return handlePaymentRequired(initialResponse, input, sessionId);
  }

  // Step 3: Handle non-402 responses
  if (!initialResponse.ok) {
    throw new Error(
      `Agent request failed: ${initialResponse.status} ${initialResponse.statusText}`
    );
  }

  return (await initialResponse.json()) as AgentResponse;
}

// ============================================================================
// Demo Execution
// ============================================================================

/**
 * Displays the agent's response and payment information
 * @param result - The agent response
 * @param sessionId - The current session identifier
 */
function displayAgentResponse(result: AgentResponse, sessionId: string): void {
  console.log(`\nMedGuide (Session: ${sessionId}):`);
  console.log(result.output);

  if (result.payment) {
    console.log(`\n💰 Payment Info:`);
    console.log(
      `   Credits used: ${result.payment.creditsRedeemed ?? "unknown"}`
    );
    console.log(
      `   Remaining balance: ${result.payment.remainingBalance ?? "unknown"}`
    );
  }
}

/**
 * Runs the x402 demo client
 *
 * Demonstrates the full x402 payment flow:
 * 1. Client makes request without payment
 * 2. Server returns 402 with PAYMENT-REQUIRED header
 * 3. Client obtains x402 access token
 * 4. Client retries with PAYMENT-SIGNATURE header
 * 5. Server verifies, executes, settles, returns PAYMENT-RESPONSE
 */
async function runDemo(): Promise<void> {
  console.log("🚀 Starting Medical Agent Demo (x402 Payment Flow)\n");
  console.log("This demo implements the full x402 payment protocol:");
  console.log("  1. Client makes request without payment");
  console.log("  2. Server returns 402 with PAYMENT-REQUIRED header");
  console.log("  3. Client obtains x402 access token");
  console.log("  4. Client retries with PAYMENT-SIGNATURE header");
  console.log(
    "  5. Server verifies, executes, settles, returns PAYMENT-RESPONSE\n"
  );

  validateEnvironment();

  let sessionId: string | undefined;

  for (let i = 0; i < DEMO_CONVERSATION_QUESTIONS.length; i++) {
    const question = DEMO_CONVERSATION_QUESTIONS[i];

    console.log("=".repeat(80));
    console.log(`📝 Question ${i + 1}: ${question}`);

    try {
      const result = await askAgent(question, sessionId);
      sessionId = result.sessionId;
      displayAgentResponse(result, sessionId);
      console.log("\n");
    } catch (error) {
      console.error(`\n❌ Error processing question ${i + 1}:`, error);
      break;
    }
  }

  console.log("=".repeat(80));
  console.log("✅ Demo completed!");
}

// ============================================================================
// Entry Point
// ============================================================================

runDemo().catch((error) => {
  console.error("💥 Demo failed:", error);
  process.exit(1);
});
