/**
 * @fileoverview Minimal client (free) that sends three questions to the free agent
 * without Nevermined protection, storing and reusing sessionId.
 */
import "dotenv/config";

async function main(): Promise<void> {
  const baseUrl = process.env.AGENT_URL || "http://localhost:3001";

  const questions: string[] = [
    "I have a sore throat and mild fever. What could it be and what should I do?",
    "I also noticed nasal congestion and fatigue. Does that change your assessment?",
    "When should I see a doctor, and are there any red flags I should watch for?",
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

async function askAgent(
  baseUrl: string,
  input: string,
  sessionId?: string
): Promise<{ output: string; sessionId: string }> {
  const res = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, sessionId }),
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
