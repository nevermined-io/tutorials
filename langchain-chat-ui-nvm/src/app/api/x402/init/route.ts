/**
 * GET /api/x402/init
 *
 * One-shot config endpoint the chat client reads on mount. Returns the
 * static metadata it needs to drive the Pay flow without having to parse
 * the 402 envelope from a `useStream` error (which doesn't expose response
 * headers).
 *
 * - `planId` / `scheme` / `network` — what the eventual `payments_py`
 *   middleware will demand on the 402.
 * - `frontendUrl` — base host of the white-label embed page (e.g.
 *   `https://nevermined.app` or `https://nevermined.dev`).
 * - `hasToken` — whether the client already has a server-side access token
 *   cookie. When `true`, the client skips the Pay button preemptively;
 *   the next request will pick up the cookie via the proxy.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultNetwork } from "@nevermined-io/payments";

import {
  getLanggraphApiUrl,
  getNvmEnvironment,
  getNvmFrontendUrl,
  getNvmPlanId,
} from "@/lib/env-server";
import { NVM_X402_TOKEN_COOKIE } from "@/lib/x402-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Confirm the LangGraph URL is configured up-front so a typo in
  // .env.local surfaces as a clean 500 here, not a confusing proxy
  // error later.
  getLanggraphApiUrl();

  const scheme = "nvm:erc4337" as const;
  const environment = getNvmEnvironment();
  const network = getDefaultNetwork(scheme, environment);

  return NextResponse.json({
    planId: getNvmPlanId(),
    scheme,
    network,
    frontendUrl: getNvmFrontendUrl(),
    hasToken: Boolean(request.cookies.get(NVM_X402_TOKEN_COOKIE)?.value),
  });
}
