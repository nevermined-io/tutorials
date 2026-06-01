/**
 * POST /api/x402/session
 *
 * Mints a Nevermined widget session token bound to the server-side
 * `NVM_API_KEY` user, scoped to `NVM_ORG_ID`. The browser uses the returned
 * `sessionToken` to open the white-label card-delegation flow at
 * `{embedUrl}/cards/setup?sessionToken=...&returnUrl=...&state=...` on
 * the standalone embed app (`https://embed.<tier-host>`).
 *
 * Auth model: the NVM_API_KEY never leaves this server. Callers from the
 * browser see only the short-lived `sessionToken`.
 *
 * Upstream endpoint contract: `POST /api/v1/widgets/session/self`
 * (nvm-monorepo PR #1716, merged 2026-05-25). Self-mint requires
 * `returnUrl` to be a localhost-class host (`localhost`, `127.0.0.1`,
 * `[::1]`). Remote return URLs require the widget-key flow, out of scope
 * for this demo.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getNvmApiKey,
  getNvmBackendUrl,
  getNvmOrgId,
} from "@/lib/env-server";

export const runtime = "nodejs";

const RequestBody = z.object({
  // The browser tells us where the popup should redirect after the user
  // finishes the delegation flow. Validated by the upstream API too
  // (self-mint sessions reject non-localhost hosts) — we mirror the check
  // client-side so we fail fast.
  returnUrl: z.string().url(),
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

  const upstream = await fetch(
    `${getNvmBackendUrl()}/api/v1/widgets/session/self`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getNvmApiKey()}`,
      },
      body: JSON.stringify({
        orgId: getNvmOrgId(),
        returnUrl: body.returnUrl,
      }),
    },
  );

  if (!upstream.ok) {
    // Forward the upstream status + body so the caller can see which
    // BCK.WIDGET_SESSION.* code fired (e.g. 0019 for non-member org).
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const json = await upstream.json();
  return NextResponse.json(json);
}
