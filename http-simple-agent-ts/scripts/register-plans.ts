import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName,
});
const plans = payments.plans;

// Crypto price so BOTH x402 (erc4337) and MPP can pay. Needs the builder's receiver wallet.
// If NVM_RECEIVER is unset, fall back to a free plan so the script still runs for a demo.
const receiver = process.env.NVM_RECEIVER ?? "";
const amount = BigInt(process.env.PLAN_PRICE_WEI ?? "0");
const price = receiver
  ? plans.getCryptoPriceConfig(amount, receiver as `0x${string}`)
  : plans.getFreePriceConfig();

async function main() {
  const { planId: credits } = await plans.registerCreditsPlan(
    { name: "Weather — Fixed Credits", description: "100 weather calls, 1 credit each" },
    price, plans.getFixedCreditsConfig(100n, 1n));
  const { planId: time } = await plans.registerTimePlan(
    { name: "Weather — Day Pass", description: "24h of weather access" },
    price, plans.getExpirableDurationConfig(86400n)); // 86400n = ONE_DAY (const not importable)
  const { planId: payg } = await plans.registerPlan(
    { name: "Weather — Pay As You Go", description: "1 credit current, up to 7 for a forecast" },
    price, plans.getDynamicCreditsConfig(1000n, 1n, 7n));

  console.log("PLAN_ID_CREDITS=" + credits);
  console.log("PLAN_ID_TIME=" + time);
  console.log("PLAN_ID_PAYG=" + payg);
}
main().catch((e) => { console.error(e); process.exit(1); });
