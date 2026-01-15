/**
 * @fileoverview Financial Agent Client - Unprotected Version
 *
 * Minimal client that sends questions to the unprotected financial agent,
 * storing and reusing sessionId for conversation continuity.
 */
import "dotenv/config";

// ============================================================================
// Configuration
// ============================================================================

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

// ============================================================================
// Demo Data
// ============================================================================

const DEMO_CONVERSATION_QUESTIONS = [
  "Hi there! I'm new to investing and keep hearing about diversification. Can you explain what that means in simple terms?",
  "That makes sense! So if I want to start investing but only have $100 a month, what should I focus on first?",
  "I've been thinking about cryptocurrency. What should a beginner like me know before investing in crypto?",
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
}

// ============================================================================
// SDK Initialization
// ============================================================================

// SDK initialization section - add external service integrations here if needed

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates that all required environment variables are set
 */
function validateEnvironment(): void {
  // Add validation logic here if needed
}

// ============================================================================
// Agent Communication
// ============================================================================

/**
 * Makes a request to the agent
 * @param input - The user's question/input
 * @param sessionId - Optional session identifier for conversation continuity
 * @returns The agent response
 */
async function askAgent(
  input: string,
  sessionId?: string
): Promise<AgentResponse> {
  const requestBody = {
    input_query: input,
    sessionId: sessionId,
  };

  const response = await fetch(`${AGENT_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Agent request failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  return (await response.json()) as AgentResponse;
}

// ============================================================================
// Demo Execution
// ============================================================================

/**
 * Displays the agent's response
 * @param result - The agent response
 * @param sessionId - The current session identifier
 */
function displayAgentResponse(result: AgentResponse, sessionId: string): void {
  console.log(`\n🤖 FinGuide (Session: ${sessionId}):`);
  console.log(result.output);
}

/**
 * Runs the demo client
 */
async function runDemo(): Promise<void> {
  console.log("🚀 Starting Financial Agent Demo\n");
  console.log("This demo sends questions to the agent.\n");

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
