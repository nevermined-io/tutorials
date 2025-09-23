/**
 * @fileoverview Minimal client (free) that sends three questions to the free agent
 * without Nevermined protection, storing and reusing sessionId.
 */
import "dotenv/config";

// Configuration: Agent URL from environment or default
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

// Define test questions to demonstrate conversation continuity
const TEST_QUESTIONS = [
  "What is your market outlook for Bitcoin over the next month?",
  "How are major stock indices performing today and what trends are notable?",
  "What risks should I consider before increasing exposure to tech stocks?",
];

// Send a question to the financial agent
async function askAgent(input: string, sessionId?: string): Promise<{ output: string; sessionId: string }> {
  // Prepare request payload
  const requestBody = {
    input_query: input,
    sessionId: sessionId
  };

  // Make HTTP request to agent
  const response = await fetch(`${AGENT_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  // Handle HTTP errors
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Agent request failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  // Parse and return JSON response
  return await response.json() as { output: string; sessionId: string };
}

/**
 * Run the unprotected demo client.
 * Sends predefined financial questions to the agent and reuses sessionId to preserve context.
 * @returns {Promise<void>} Resolves when the run finishes
 */
async function runDemo(): Promise<void> {
  console.log("🚀 Starting Financial Agent Demo (Unprotected)\n");

  // Track session across multiple questions
  let sessionId: string | undefined;

  // Send each test question and maintain conversation context
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const question = TEST_QUESTIONS[i];

    console.log(`📝 Question ${i + 1}: ${question}`);

    try {
      // Send question to agent (reusing sessionId for context)
      const result = await askAgent(question, sessionId);

      // Update sessionId for next question
      sessionId = result.sessionId;

      // Display agent response
      console.log(`🤖 FinGuide (Session: ${sessionId}):`);
      console.log(result.output);
      console.log("\n" + "=".repeat(80) + "\n");

    } catch (error) {
      console.error(`❌ Error processing question ${i + 1}:`, error);
      break;
    }
  }

  console.log("✅ Demo completed!");
}

// Run the demo and handle any errors
runDemo().catch((error) => {
  console.error("💥 Demo failed:", error);
  process.exit(1);
});
