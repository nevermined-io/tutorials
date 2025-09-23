/**
 * @fileoverview Minimal client (free) that sends three questions to the free agent
 * without Nevermined protection, storing and reusing sessionId.
 */
import "dotenv/config";

// Configuration: Agent URL from environment or default
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

// Define demo conversation to show chatbot-style interaction
const DEMO_CONVERSATION_QUESTIONS = [
  "Hi there! I'm new to investing and keep hearing about diversification. Can you explain what that means in simple terms?",
  "That makes sense! So if I want to start investing but only have $100 a month, what should I focus on first?",
  "I've been thinking about cryptocurrency. What should a beginner like me know before investing in crypto?",
];

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

// Send a question to the financial agent
async function askAgent(input: string, sessionId?: string): Promise<{ output: string; sessionId: string }> {
  // Start loading animation
  const stopLoading = startLoadingAnimation();

  try {
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
  } finally {
    // Stop loading animation
    stopLoading();
  }
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

  // Send each demo question and maintain conversation context
  for (let i = 0; i < DEMO_CONVERSATION_QUESTIONS.length; i++) {
    const question = DEMO_CONVERSATION_QUESTIONS[i];

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
