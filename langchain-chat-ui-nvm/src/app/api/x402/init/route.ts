/**
 * GET /api/x402/init
 *
 * Returns the chat-UI bootstrap config the client needs to mint an
 * x402 access token for the agent's `market_research` tool:
 *
 *   - `embedUrl`:    the standalone embed app's origin
 *     (`https://embed.<tier-host>`) the popup opens against. The
 *     webapp's old `/embed/*` routes were removed in
 *     nvm-monorepo#1787 / #1816 — the embed app is now its own deploy.
 *   - `hasToken`:    whether the server-side access token cookie is
 *     already set. When `true`, the chat client skips the Pay button
 *     preemptively; the proxy will inject the token on the next
 *     outgoing request.
 *   - `accepts`:     one payment-accepted descriptor per plan the agent
 *     charges against. Shape matches the x402 v2 `accepts` array so the
 *     chat client can stay protocol-aware even though there is no live
 *     402 envelope to discover.
 *
 * Why we resolve plan metadata server-side instead of probing the agent:
 *   The agent gates payments inside its `market_research` tool, not at
 *   the HTTP route layer, so there is no longer a 402 envelope to fetch.
 *   The plan id is operator-configured (NVM_PLAN_ID); scheme and
 *   network are derived from plan metadata via the SDK so the same
 *   code works for crypto and fiat plans without hand-tuning.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Payments,
  resolveNetwork,
  resolveScheme,
} from "@nevermined-io/payments";

import {
  getNvmAgentId,
  getNvmApiKey,
  getNvmEmbedUrl,
  getNvmEnvironment,
  getNvmPlanId,
} from "@/lib/env-server";
import { NVM_X402_TOKEN_COOKIE } from "@/lib/x402-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const planId = getNvmPlanId();
  const agentId = getNvmAgentId();

  const payments = Payments.getInstance({
    nvmApiKey: getNvmApiKey(),
    environment: getNvmEnvironment(),
  });

  let scheme: string;
  let network: string | undefined;
  try {
    scheme = await resolveScheme(payments, planId);
    network = await resolveNetwork(payments, planId);
  } catch (error) {
    return NextResponse.json(
      {
        error: "plan_metadata_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    embedUrl: getNvmEmbedUrl(),
    hasToken: Boolean(request.cookies.get(NVM_X402_TOKEN_COOKIE)?.value),
    accepts: [
      {
        scheme,
        network: network ?? "erc4337",
        planId,
        ...(agentId ? { extra: { agentId } } : {}),
      },
    ],
  });
}
