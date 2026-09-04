import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import { X402_HEADERS } from "@nevermined-io/payments/express";

const BASE = process.env.SERVER_URL || "http://localhost:3000";
const PLAN = process.env.PLAN_ID_CREDITS!;
const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName,
});
const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };

async function main() {
  // 1) Unpaid → 402 advertising BOTH protocols
  const r0 = await fetch(`${BASE}/weather/credits`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ city: "Lisbon" }),
  });
  assert(r0.status === 402, "unpaid → 402");
  assert(!!r0.headers.get(X402_HEADERS.PAYMENT_REQUIRED), "x402 challenge present");
  assert(!!r0.headers.get("www-authenticate"), "MPP WWW-Authenticate present");

  // 2) x402 buyer → 200
  const { accessToken } = await payments.x402.getX402AccessToken(PLAN);
  const r1 = await fetch(`${BASE}/weather/credits`, {
    method: "POST",
    headers: { "content-type": "application/json", [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken },
    body: JSON.stringify({ city: "Lisbon" }),
  });
  assert(r1.status === 200, `x402 paid → 200 (got ${r1.status})`);
  const w = await r1.json();
  assert(typeof w.city === "string", "x402 returned real weather");

  // 3) MPP buyer → 200 + receipt
  const { delegationId } = await payments.delegation.createDelegation({
    provider: "erc4337", spendingLimitCents: 10000, durationSecs: 604800, currency: "usdc",
  });
  const { response, receipt, paid } = await payments.mpp.fetch(
    `${BASE}/weather/credits`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: "Berlin" }) },
    { delegationConfig: { delegationId }, planId: PLAN },
  );
  assert(response.status === 200, `MPP paid → 200 (got ${response.status})`);
  assert(paid && !!receipt, "MPP settled with a receipt");

  console.log("✓ smoke: x402 + MPP both paid a real weather response");
}
main().catch((e) => { console.error(e); process.exit(1); });
