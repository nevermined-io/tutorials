/**
 * @fileoverview Minimal client that sends three questions to the agent,
 * storing and reusing the returned sessionId to maintain conversation context.
 */
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";

/**
 * Simple demo client that makes three HTTP requests to the agent.
 * It stores the sessionId returned by the first response and reuses it
 * for subsequent requests so the agent can leverage conversation history.
 */
async function main(): Promise<void> {
  const baseUrl = process.env.AGENT_URL || "http://localhost:3000";

  // Predefined questions for the demo client. The client is intentionally dumb.
  const questions: string[] = [
    "I have a sore throat and mild fever. What could it be and what should I do?",
    "I also noticed nasal congestion and fatigue. Does that change your assessment?",
    "When should I see a doctor, and are there any red flags I should watch for?",
  ];

  let sessionId: string | undefined;
  let bearer: string | undefined;

  const planId = process.env.NVM_PLAN_ID as string;
  const agentId = process.env.NVM_AGENT_ID as string;
  const nvmApiKey = process.env.SUBSCRIBER_NVM_API_KEY as string;
  const nvmEnv = (process.env.NVM_ENV || "sandbox") as EnvironmentName;
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

  for (let i = 0; i < questions.length; i += 1) {
    const input = questions[i];
    // eslint-disable-next-line no-console
    console.log(`\n[CLIENT] Sending question ${i + 1}: ${input}`);
    const response = await askAgent(baseUrl, input, sessionId, bearer);
    sessionId = response.sessionId;
    // eslint-disable-next-line no-console
    console.log(`[AGENT] (sessionId=${sessionId})\n${response.output}`);
  }
}

/**
 * Perform a POST /ask to the agent.
 * @param baseUrl Base URL of the agent service
 * @param input User question text
 * @param sessionId Optional existing session id
 * @returns The JSON response containing output and sessionId
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
    body: JSON.stringify({ input, sessionId }),
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
 * @param opts.planId Plan identifier
 * @param opts.agentId Agent identifier
 * @param opts.nvmApiKey Nevermined API Key (subscriber)
 * @param opts.nvmEnv Nevermined environment
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
  process.exit(1);
});
