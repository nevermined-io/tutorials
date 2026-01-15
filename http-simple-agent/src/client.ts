/**
 * x402 Client - Demonstrates the full payment flow.
 *
 * This client shows the complete x402 HTTP protocol flow:
 * 1. Request without token -> 402 Payment Required
 * 2. Decode payment requirements from header
 * 3. Generate x402 access token
 * 4. Request with token -> Success
 * 5. Decode settlement response from header
 */
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import { X402_HEADERS } from "@nevermined-io/payments/express";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const NVM_API_KEY = process.env.NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "testing") as EnvironmentName;
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? "";

if (!NVM_API_KEY || !NVM_PLAN_ID) {
  console.error("NVM_API_KEY and NVM_PLAN_ID are required.");
  process.exit(1);
}

// Initialize Nevermined Payments SDK
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});

/**
 * Helper to decode base64 JSON from headers
 */
function decodeBase64Json(base64: string): unknown {
  const json = Buffer.from(base64, "base64").toString("utf-8");
  return JSON.parse(json);
}

/**
 * Helper to format JSON for console output
 */
function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

async function main() {
  console.log("=".repeat(60));
  console.log("x402 Payment Flow Demo");
  console.log("=".repeat(60));
  console.log(`\nServer: ${SERVER_URL}`);
  console.log(`Plan ID: ${NVM_PLAN_ID}`);

  // ============================================================
  // Step 1: Request without token -> Expect 402
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Request without payment token");
  console.log("=".repeat(60));

  const response1 = await fetch(`${SERVER_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "What is 2+2?" }),
  });

  console.log(`\nStatus: ${response1.status} ${response1.statusText}`);

  if (response1.status !== 402) {
    console.error("Expected 402 Payment Required, got:", response1.status);
    process.exit(1);
  }

  // ============================================================
  // Step 2: Decode payment requirements from header
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Decode payment requirements from header");
  console.log("=".repeat(60));

  const paymentRequiredHeader = response1.headers.get(X402_HEADERS.PAYMENT_REQUIRED);

  if (!paymentRequiredHeader) {
    console.error(`Missing '${X402_HEADERS.PAYMENT_REQUIRED}' header in 402 response`);
    process.exit(1);
  }

  console.log(`\nHeader '${X402_HEADERS.PAYMENT_REQUIRED}' (base64):`);
  console.log(paymentRequiredHeader.substring(0, 80) + "...");

  const paymentRequired = decodeBase64Json(paymentRequiredHeader);
  console.log("\nDecoded Payment Requirements:");
  console.log(prettyJson(paymentRequired));

  // Also print the JSON body
  const body1 = await response1.json();
  console.log("\nResponse body:");
  console.log(prettyJson(body1));

  // ============================================================
  // Step 3: Generate x402 access token
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Generate x402 access token");
  console.log("=".repeat(60));

  console.log("\nCalling payments.x402.getX402AccessToken()...");

  const tokenResult = await payments.x402.getX402AccessToken(NVM_PLAN_ID);
  const accessToken = tokenResult.accessToken;

  console.log("\nToken generated successfully!");
  console.log(`Token length: ${accessToken.length} characters`);
  console.log(`Token preview: ${accessToken.substring(0, 50)}...`);

  // Decode and show token structure (it's base64-encoded JSON)
  try {
    const decodedToken = decodeBase64Json(accessToken);
    console.log("\nDecoded token structure:");
    console.log(prettyJson(decodedToken));
  } catch {
    console.log("\n(Token is not base64 JSON - showing raw)");
  }

  // ============================================================
  // Step 4: Request with token -> Expect success
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("STEP 4: Request with payment token");
  console.log("=".repeat(60));

  console.log(`\nSending request with '${X402_HEADERS.PAYMENT_SIGNATURE}' header...`);

  const response2 = await fetch(`${SERVER_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken,
    },
    body: JSON.stringify({ query: "What is 2+2?" }),
  });

  console.log(`\nStatus: ${response2.status} ${response2.statusText}`);

  if (response2.status !== 200) {
    console.error("Expected 200 OK, got:", response2.status);
    const errorBody = await response2.text();
    console.error("Response:", errorBody);
    process.exit(1);
  }

  const body2 = await response2.json();
  console.log("\nResponse body:");
  console.log(prettyJson(body2));

  // ============================================================
  // Step 5: Check for settlement response header
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("STEP 5: Check settlement response header");
  console.log("=".repeat(60));

  const paymentResponseHeader = response2.headers.get(X402_HEADERS.PAYMENT_RESPONSE);

  if (paymentResponseHeader) {
    console.log(`\nHeader '${X402_HEADERS.PAYMENT_RESPONSE}' found!`);
    console.log(`(base64): ${paymentResponseHeader.substring(0, 80)}...`);

    try {
      const settlementResponse = decodeBase64Json(paymentResponseHeader);
      console.log("\nDecoded Settlement Response:");
      console.log(prettyJson(settlementResponse));
    } catch {
      console.log("\n(Could not decode as JSON)");
      console.log(paymentResponseHeader);
    }
  } else {
    console.log(`\nNo '${X402_HEADERS.PAYMENT_RESPONSE}' header in response.`);
    console.log("(Settlement happens asynchronously after response is sent)");
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("FLOW COMPLETE!");
  console.log("=".repeat(60));
  console.log(`
x402 Payment Flow Summary:
1. Request without token    -> 402 Payment Required
2. Decoded payment-required -> Plan ID, scheme, network
3. Generated access token   -> Using Nevermined SDK
4. Request with token       -> 200 OK + AI response
5. Settlement              -> Credits burned asynchronously
`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
