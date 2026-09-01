/**
 * POST /api/x402/token
 *
 * Mints an x402 access token by reusing an existing Nevermined delegation
 * (pattern B in `@nevermined-io/payments`'s `X402TokenAPI.getX402AccessToken`).
 * The delegation was just created by the user in the white-label popup;
 * its UUID arrived via `postMessage` on the chat surface.
 *
 * `planId`, `scheme`, and `network` come from `/api/x402/init`, which
 * resolves them server-side from plan metadata via the SDK rather than
 * from env guesswork. The agent gates inside its tool, so there is no
 * 402 envelope to discover them from; the crypto vs card-delegation
 * scheme mismatch is the footgun that resolution exists to avoid.
 *
 * The minted token is set on a **httpOnly** cookie. The browser never
 * sees the raw token — the catch-all proxy reads the cookie and injects
 * it into the run body at `config.configurable.payment_token`, which is
 * what the agent's tool reads. NVM_API_KEY stays server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Payments, type X402SchemeType } from "@nevermined-io/payments";

import { getNvmApiKey, getNvmEnvironment } from "@/lib/env-server";
import { NVM_X402_TOKEN_COOKIE } from "@/lib/x402-server";

export const runtime = "nodejs";

const RequestBody = z.object({
  planId: z.string().min(1),
  scheme: z.enum(["nvm:erc4337", "nvm:card-delegation"]),
  network: z.string().min(1),
  delegationId: z.string().min(1),
  // Envelope's `extra.agentId` is often null rather than omitted, so
  // accept both shapes and pass through only when truthy.
  agentId: z.string().min(1).nullish(),
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

  const payments = Payments.getInstance({
    nvmApiKey: getNvmApiKey(),
    environment: getNvmEnvironment(),
  });

  let accessToken: string;
  try {
    const result = await payments.x402.getX402AccessToken(
      body.planId,
      body.agentId ?? undefined,
      {
        scheme: body.scheme as X402SchemeType,
        network: body.network,
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
