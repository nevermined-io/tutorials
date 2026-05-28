/**
 * GET /api/x402/init
 *
 * Returns the chat-UI bootstrap config. Intentionally narrow:
 *
 * - `frontendUrl`: the Nevermined frontend the popup opens against
 *   (sandbox vs live host).
 * - `hasToken`: whether the server-side access token cookie is already
 *   set. When `true`, the chat client skips the Pay button preemptively;
 *   the proxy will inject the cookie on the next outgoing request.
 *
 * Plan metadata (`planId`, `scheme`, `network`) is NOT served here —
 * that comes from the agent's 402 envelope via `/api/x402/probe`. Using
 * env values would drift the moment the agent's middleware reconfigures
 * (e.g. fiat plan with `nvm:card-delegation` scheme vs a hardcoded
 * crypto default).
 */

import { NextRequest, NextResponse } from "next/server";

import { getNvmFrontendUrl } from "@/lib/env-server";
import { NVM_X402_TOKEN_COOKIE } from "@/lib/x402-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    frontendUrl: getNvmFrontendUrl(),
    hasToken: Boolean(request.cookies.get(NVM_X402_TOKEN_COOKIE)?.value),
  });
}
