/**
 * @fileoverview Minimal client (free) that sends three questions to the free agent
 * without Nevermined protection, storing and reusing sessionId.
 */
import "dotenv/config";

/**
 * Run the unprotected demo client.
 * Sends predefined financial questions to the agent and reuses sessionId to preserve context.
 * @returns {Promise<void>} Resolves when the run finishes
 */
async function main(): Promise<void> {
  const baseUrl = process.env.AGENT_URL || "http://localhost:3001";

  const questions: string[] = [
    "What is your market outlook for Bitcoin over the next month?",
    "How are major stock indices performing today and what trends are notable?",
    "What risks should I consider before increasing exposure to tech stocks?",
  ];

  let sessionId: string | undefined;

  for (let i = 0; i < questions.length; i += 1) {
    const input = questions[i];
    // eslint-disable-next-line no-console
    console.log(`\n[FREE CLIENT] Sending question ${i + 1}: ${input}`);
    const response = await askAgent(baseUrl, input, sessionId);
    sessionId = response.sessionId;
    // eslint-disable-next-line no-console
    console.log(`[FREE AGENT] (sessionId=${sessionId})\n${response.output}`);
  }
}

/**
 * Perform a POST /ask to the free agent.
 * @param {string} baseUrl - Base URL of the agent service
 * @param {string} input - User question text
 * @param {string} [sessionId] - Optional existing session id to keep context
 * @returns {Promise<{ output: string; sessionId: string }>} Response with model output and session id
 */
async function askAgent(
  baseUrl: string,
  input: string,
  sessionId?: string
): Promise<{ output: string; sessionId: string }> {
  const res = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_query: input, sessionId }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `Free agent request failed: ${res.status} ${res.statusText} ${errorText}`
    );
  }
  return (await res.json()) as { output: string; sessionId: string };
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[FREE CLIENT] Error:", err);
  process.exit(1);
});
