import "dotenv/config";
import { getEnvOrThrow } from "./utils.js";
import { Payments, type EnvironmentName } from "@nevermined-io/payments";
import OpenAI from "openai";

const OPENAI_API_KEY = getEnvOrThrow("OPENAI_API_KEY");
const NVM_API_KEY = getEnvOrThrow("NVM_API_KEY");
const NVM_ENVIRONMENT = getEnvOrThrow("NVM_ENVIRONMENT");

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT as EnvironmentName,
});

const agent = async () => {
  console.log("Starting simulation request...");
  const agentRequest = await payments.requests.startSimulationRequest();

  console.log("Making OpenAI LLM call...");
  const openai = new OpenAI(
    payments.observability.withOpenAI(OPENAI_API_KEY, agentRequest, {})
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello, world!" }],
  });

  // redeem credits
  console.log("Redeeming credits...");
  await payments.requests.finishSimulationRequest(agentRequest.agentRequestId);

  return completion.choices[0]?.message?.content;
};

const main = async () => {
  console.log("Calling agent...");
  const response = await agent();
  console.log(response);
};

main().then(() => {
  process.exit(0);
});
