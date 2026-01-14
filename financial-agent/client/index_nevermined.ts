/**
 * @fileoverview x402 client that implements the full payment flow:
 * 1. Makes initial request without token
 * 2. Receives 402 with PAYMENT-REQUIRED header
 * 3. Obtains x402 access token based on payment requirements
 * 4. Retries request with PAYMENT-SIGNATURE header
 */
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";

// Configuration: Load environment variables with defaults
const AGENT_URL = process.env.AGENT_URL || "http://localhost:4001";
const SUBSCRIBER_API_KEY = process.env.SUBSCRIBER_NVM_API_KEY as string;
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ||
  "staging_sandbox") as EnvironmentName;

// Define demo conversation to show chatbot-style interaction
const DEMO_CONVERSATION_QUESTIONS = [
  "Hi there! I'm new to investing and keep hearing about diversification. Can you explain what that means in simple terms?",
  "That makes sense! So if I want to start investing but only have $100 a month, what should I focus on first?",
  "I've been thinking about cryptocurrency. What should a beginner like me know before investing in crypto?",
];

// Validate required environment variables
function validateEnvironment(): void {
  if (!SUBSCRIBER_API_KEY) {
    throw new Error("SUBSCRIBER_NVM_API_KEY is required in environment");
  }
}

// Initialize Nevermined Payments SDK
const payments = Payments.getInstance({
  nvmApiKey: SUBSCRIBER_API_KEY,
  environment: NVM_ENVIRONMENT,
});

// Interface for parsed payment requirements
interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: Array<{
    scheme: string;
    network: string;
    planId: string;
    extra?: {
      version?: string;
      agentId?: string;
      httpVerb?: string;
    };
  }>;
  extensions: Record<string, unknown>;
}

// Parse the PAYMENT-REQUIRED header from a 402 response
function parsePaymentRequiredHeader(response: Response): PaymentRequired | null {
  const header = response.headers.get("payment-required");
  if (!header) {
    console.log("⚠️ No PAYMENT-REQUIRED header found in 402 response");
    return null;
  }

  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const paymentRequired = JSON.parse(decoded) as PaymentRequired;
    console.log("📋 Received payment requirements:");
    console.log(`   Plan ID: ${paymentRequired.accepts[0]?.planId}`);
    console.log(`   Agent ID: ${paymentRequired.accepts[0]?.extra?.agentId}`);
    console.log(`   Scheme: ${paymentRequired.accepts[0]?.scheme}`);
    return paymentRequired;
  } catch (error) {
    console.error("Failed to parse PAYMENT-REQUIRED header:", error);
    return null;
  }
}

// Get x402 access token based on payment requirements
async function getX402AccessToken(planId: string, agentId: string): Promise<string> {
  console.log("🔐 Obtaining x402 access token...");

  // Try to get token directly first
  try {
    const result = await payments.x402.getX402AccessToken(planId, agentId);
    if (result?.accessToken) {
      console.log("✅ x402 access token obtained successfully");
      return result.accessToken;
    }
  } catch (tokenError: any) {
    console.log("⚠️ Could not get x402 token directly, checking subscription...");

    // Check if we need to purchase a subscription
    const balanceInfo: any = await payments.plans.getPlanBalance(planId);
    const hasCredits = Number(balanceInfo?.balance ?? 0) > 0;
    const isSubscriber = balanceInfo?.isSubscriber === true;

    if (!isSubscriber && !hasCredits) {
      console.log("💳 No subscription or credits found. Purchasing plan...");
      await payments.plans.orderPlan(planId);
    }

    // Retry getting the x402 token after subscription
    const result = await payments.x402.getX402AccessToken(planId, agentId);
    if (result?.accessToken) {
      console.log("✅ x402 access token obtained successfully");
      return result.accessToken;
    }
  }

  throw new Error("Failed to obtain x402 access token");
}

// Simple loading animation for terminal
function startLoadingAnimation(): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} FinGuide is thinking...`);
    i = (i + 1) % frames.length;
  }, 100);

  return () => {
    clearInterval(interval);
    process.stdout.write("\r");
  };
}

// Cache for x402 tokens (keyed by planId:agentId)
const tokenCache = new Map<string, string>();

// Send a question to the protected financial agent using x402 flow
async function askAgent(
  input: string,
  sessionId?: string
): Promise<{ output: string; sessionId: string; payment?: any }> {
  // Start loading animation
  const stopLoading = startLoadingAnimation();

  try {
    // Prepare request payload
    const requestBody = {
      input_query: input,
      sessionId: sessionId,
    };

    // Step 1: Make initial request without PAYMENT-SIGNATURE header
    console.log("\n📤 Making request to agent...");
    const initialResponse = await fetch(`${AGENT_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Step 2: If we get 402, parse PAYMENT-REQUIRED header
    if (initialResponse.status === 402) {
      console.log("💳 Received 402 Payment Required");

      const paymentRequired = parsePaymentRequiredHeader(initialResponse);
      if (!paymentRequired || !paymentRequired.accepts[0]) {
        throw new Error("Invalid payment requirements in 402 response");
      }

      const scheme = paymentRequired.accepts[0];
      const planId = scheme.planId;
      const agentId = scheme.extra?.agentId;

      if (!planId || !agentId) {
        throw new Error("Missing planId or agentId in payment requirements");
      }

      // Step 3: Get x402 access token (use cache if available)
      const cacheKey = `${planId}:${agentId}`;
      let x402Token = tokenCache.get(cacheKey);

      if (!x402Token) {
        x402Token = await getX402AccessToken(planId, agentId);
        tokenCache.set(cacheKey, x402Token);
      } else {
        console.log("🔑 Using cached x402 access token");
      }

      // Step 4: Retry request with PAYMENT-SIGNATURE header (x402 standard)
      console.log("📤 Retrying request with PAYMENT-SIGNATURE header...");
      const retryResponse = await fetch(`${AGENT_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": x402Token, // x402 token is already base64 encoded
        },
        body: JSON.stringify(requestBody),
      });

      // Handle retry response
      if (!retryResponse.ok) {
        // If still 402, token might be invalid - clear cache and throw
        if (retryResponse.status === 402) {
          tokenCache.delete(cacheKey);
          const errorBody = await retryResponse.text().catch(() => "");
          throw new Error(`Payment still required after retry: ${errorBody}`);
        }
        throw new Error(
          `Agent request failed: ${retryResponse.status} ${retryResponse.statusText}`
        );
      }

      // Parse PAYMENT-RESPONSE header if present
      const paymentResponseHeader = retryResponse.headers.get("payment-response");
      if (paymentResponseHeader) {
        try {
          const paymentResponse = JSON.parse(
            Buffer.from(paymentResponseHeader, "base64").toString("utf-8")
          );
          console.log("✅ Payment settled:", paymentResponse.success ? "Success" : "Failed");
          if (paymentResponse.transaction) {
            console.log(`   Transaction: ${paymentResponse.transaction.substring(0, 20)}...`);
          }
        } catch {
          // Ignore parsing errors for payment response header
        }
      }

      return (await retryResponse.json()) as {
        output: string;
        sessionId: string;
        payment?: any;
      };
    }

    // If not 402, handle as normal response or error
    if (!initialResponse.ok) {
      throw new Error(
        `Agent request failed: ${initialResponse.status} ${initialResponse.statusText}`
      );
    }

    return (await initialResponse.json()) as {
      output: string;
      sessionId: string;
      payment?: any;
    };
  } finally {
    // Stop loading animation
    stopLoading();
  }
}

/**
 * Run the x402 demo client.
 * Demonstrates the full x402 payment flow with PAYMENT-REQUIRED and PAYMENT-SIGNATURE headers.
 */
async function runDemo(): Promise<void> {
  console.log("🚀 Starting Financial Agent Demo (x402 Payment Flow)\n");
  console.log("This demo implements the full x402 payment protocol:");
  console.log("  1. Client makes request without payment");
  console.log("  2. Server returns 402 with PAYMENT-REQUIRED header");
  console.log("  3. Client obtains x402 access token");
  console.log("  4. Client retries with PAYMENT-SIGNATURE header");
  console.log("  5. Server verifies, executes, settles, returns PAYMENT-RESPONSE\n");

  // Validate environment setup
  validateEnvironment();

  // Track session across multiple questions
  let sessionId: string | undefined;

  // Send each demo question using x402 flow
  for (let i = 0; i < DEMO_CONVERSATION_QUESTIONS.length; i++) {
    const question = DEMO_CONVERSATION_QUESTIONS[i];

    console.log("=".repeat(80));
    console.log(`📝 Question ${i + 1}: ${question}`);

    try {
      // Send question using x402 payment flow
      const result = await askAgent(question, sessionId);

      // Update sessionId for next question
      sessionId = result.sessionId;

      // Display agent response
      console.log(`\n🤖 FinGuide (Session: ${sessionId}):`);
      console.log(result.output);

      // Display payment info if available
      if (result.payment) {
        console.log(`\n💰 Payment Info:`);
        console.log(`   Credits used: ${result.payment.creditsRedeemed || "unknown"}`);
        console.log(`   Remaining balance: ${result.payment.remainingBalance || "unknown"}`);
      }

      console.log("\n");
    } catch (error) {
      console.error(`\n❌ Error processing question ${i + 1}:`, error);
      break;
    }
  }

  console.log("=".repeat(80));
  console.log("✅ Demo completed!");
}

// Run the demo and handle any errors
runDemo().catch((error) => {
  console.error("💥 Demo failed:", error);
  process.exit(1);
});
