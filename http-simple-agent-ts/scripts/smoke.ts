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
  // A delegation backs the buyer for BOTH protocols (erc4337). Create it once — in 1.11.2 even
  // the x402 token needs a delegationConfig, so this is not MPP-only.
  const { delegationId } = await payments.delegation.createDelegation({
    provider: "erc4337", spendingLimitCents: 10000, durationSecs: 604800, currency: "usdc",
  });

  // 1) Unpaid → 402 advertising BOTH protocols
  const r0 = await fetch(`${BASE}/weather/credits`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ city: "Lisbon" }),
  });
  assert(r0.status === 402, "unpaid → 402");
  assert(!!r0.headers.get(X402_HEADERS.PAYMENT_REQUIRED), "x402 challenge present");
  assert(!!r0.headers.get("www-authenticate"), "MPP WWW-Authenticate present");

  // 2) x402 buyer → 200 + settlement receipt (payment-response header)
  const { accessToken } = await payments.x402.getX402AccessToken(PLAN, undefined, {
    delegationConfig: { delegationId },
  });
  const r1 = await fetch(`${BASE}/weather/credits`, {
    method: "POST",
    headers: { "content-type": "application/json", [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken },
    body: JSON.stringify({ city: "Lisbon" }),
  });
  assert(r1.status === 200, `x402 paid → 200 (got ${r1.status})`);
  const w = await r1.json();
  assert(typeof w.city === "string", "x402 returned real weather");
  assert(!!r1.headers.get(X402_HEADERS.PAYMENT_RESPONSE), "x402 settlement receipt present");
  console.log(`✓ x402: 200 ${w.city} ${w.tmaxC}°C — settled (payment-response header present)`);

  // 3) MPP buyer → 200 + real weather. mpp.fetch runs the challenge→credential handshake.
  const { response, receipt, paid, settled, credentialsPresented } = await payments.mpp.fetch(
    `${BASE}/weather/credits`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: "Berlin" }) },
    { delegationConfig: { delegationId }, planId: PLAN },
  );
  assert(response.status === 200, `MPP served → 200 (got ${response.status})`);
  const mw = await response.json();
  assert(typeof mw.city === "string", "MPP returned real weather");
  assert(credentialsPresented >= 1, "MPP presented a credential");
  // Settlement completes server-side after the response is sent. Report it rather than hard-fail:
  // the verify+serve path is what the tutorial demonstrates; settlement outcome is backend-side
  // (`paid` = response.ok && settled; a served-but-unsettled response reports paid=false).
  const tag = paid ? "✓" : "⚠";
  console.log(
    `${tag} MPP: 200 ${mw.city} ${mw.tmaxC}°C — credentialsPresented=${credentialsPresented}, settled=${settled}, receipt=${!!receipt}` +
    (paid ? "" : " (served; settlement not confirmed — check the server's onAfterSettle / MPP settlement log)")
  );

  console.log(
    `\n✓ smoke: x402 settled end-to-end; MPP verify+serve OK${paid ? " and settled" : " (settlement pending — see note above)"}`,
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
