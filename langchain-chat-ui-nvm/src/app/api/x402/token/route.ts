/**
 * POST /api/x402/token
 *
 * Mints an x402 access token by reusing an existing Nevermined delegation
 * (pattern B in `@nevermined-io/payments`'s `X402TokenAPI.getX402AccessToken`).
 * The delegation was just created by the user in the white-label popup;
 * its UUID arrived via `postMessage` on the chat surface.
 *
 * The token is set on a **httpOnly** cookie. The browser never sees the
 * raw token — the catch-all proxy reads the cookie and forwards it as a
 * `payment-signature` header on outgoing LangGraph requests. This means
 * the token can't be exfiltrated by XSS in the chat UI's component tree.
 *
 * NVM_API_KEY stays server-side. The client passes only `planId` +
 * `delegationId`; both are echoed from `/api/x402/init` and the popup
 * callback, neither is a privileged secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  Payments,
  getDefaultNetwork,
  type X402SchemeType,
} from "@nevermined-io/payments";

import {
  getNvmApiKey,
  getNvmEnvironment,
} from "@/lib/env-server";
import { NVM_X402_TOKEN_COOKIE } from "@/lib/x402-server";

export const runtime = "nodejs";

const RequestBody = z.object({
  planId: z.string().min(1),
  delegationId: z.string().min(1),
  agentId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const environment = getNvmEnvironment();
  const scheme: X402SchemeType = "nvm:erc4337";
  const network = getDefaultNetwork(scheme, environment);

  const payments = Payments.getInstance({
    nvmApiKey: getNvmApiKey(),
    environment,
  });

  let accessToken: string;
  try {
    const result = await payments.x402.getX402AccessToken(
      body.planId,
      body.agentId,
      {
        scheme,
        network,
        delegationConfig: { delegationId: body.delegationId },
      },
    );
    accessToken = result.accessToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "token_mint_failed", message },
      { status: 502 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(NVM_X402_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

/**
 * DELETE /api/x402/token
 *
 * Clears the cached access token cookie. Lets the demo show "reset
 * delegation" without restarting the server. Doesn't revoke the
 * underlying on-chain delegation — the user does that on nevermined.app.
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(NVM_X402_TOKEN_COOKIE);
  return response;
}
