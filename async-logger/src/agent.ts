import "dotenv/config";
import { getEnvOrThrow } from "./utils.js";
import { Payments, type EnvironmentName } from "@nevermined-io/payments";
import OpenAI from "openai";

const OPENAI_API_KEY = getEnvOrThrow("OPENAI_API_KEY");
const NVM_API_KEY = getEnvOrThrow("NVM_API_KEY");
const NVM_AGENT_ID = getEnvOrThrow("NVM_AGENT_ID");
const NVM_PLAN_ID = getEnvOrThrow("NVM_PLAN_ID");
const NVM_ENVIRONMENT = getEnvOrThrow("NVM_ENVIRONMENT");

// This is not meant to be a full fledged example, it is just to show how to use the async logger
// For a complete example of how to monetize an agent with Nevermined, see the financial-agent example
const EXAMPLE_REQUEST_URL = "https://example.com/ask";

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT as EnvironmentName,
});

const getAccessToken = async () => {
  const balanceInfo = await payments.plans.getPlanBalance(NVM_PLAN_ID);
  if (!balanceInfo.isSubscriber || balanceInfo.balance <= 0) {
    console.log(
      "User is not a subscriber or has no credits. Purchasing plan..."
    );
    await payments.plans.orderPlan(NVM_PLAN_ID);
  }
  const { accessToken } = await payments.agents.getAgentAccessToken(
    NVM_PLAN_ID,
    NVM_AGENT_ID
  );
  if (!accessToken) {
    throw new Error("Failed to obtain access token");
  }
  return accessToken;
};

const agent = async (accessToken: string) => {
  // validate request is authorized
  console.log("Validating request is authorized...");
  const agentRequest = await payments.requests.startProcessingRequest(
    NVM_AGENT_ID,
    accessToken,
    EXAMPLE_REQUEST_URL,
    "POST"
  );
  if (
    !agentRequest.balance.isSubscriber ||
    agentRequest.balance.balance <= 0n
  ) {
    throw new Error("Payment Required");
  }

  // Initialize the async logger
  const logger = payments.observability.withAsyncLogger(
    {
      openAI: OpenAI,
    },
    agentRequest
  );
  logger.init();

  console.log("Making OpenAI LLM call...");
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello, world!" }],
  });

  // redeem credits
  console.log("Redeeming credits...");
  await payments.requests.redeemCreditsFromRequest(
    agentRequest.agentRequestId,
    accessToken,
    1n
  );

  return completion.choices[0]?.message?.content;
};

const main = async () => {
  console.log("Getting access token...");
  const accessToken = await getAccessToken();
  console.log("Calling agent...");
  const response = await agent(accessToken);
  console.log(response);
};

main().then(() => {
  process.exit(0);
});
