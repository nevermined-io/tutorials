/**
 * GET /api/x402/probe
 *
 * Discover the payment requirements the LangGraph agent will demand by
 * issuing a real probe request against it without a `payment-signature`
 * header. The agent's middleware emits a 402 with the canonical x402
 * envelope in the `payment-required` response header — we decode it
 * and hand it back to the chat client.
 *
 * This is the only safe source of `scheme` / `network` / `planId` for
 * the token mint flow: derive them from the agent's actual response,
 * never from server-side env guesswork (env values may drift from
 * what the running middleware enforces, e.g. wrong scheme for a fiat
 * plan).
 *
 * Side effect: creates one disposable thread per probe. `langgraph dev`
 * keeps threads in-memory and they're cheap, but in a high-volume
 * deployment we'd want to either cache the envelope or clean up.
 */

import { NextResponse } from "next/server";

import { getLanggraphApiUrl } from "@/lib/env-server";

export const runtime = "nodejs";

const ASSISTANT_ID = "echo";

export async function GET() {
  const langgraphUrl = getLanggraphApiUrl();

  // 1. Mint a disposable thread. Unprotected endpoint — no payment
  //    middleware involved.
  let threadId: string;
  try {
    const threadRes = await fetch(`${langgraphUrl}/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!threadRes.ok) {
      return NextResponse.json(
        {
          error: "probe_thread_failed",
          message: `Could not create probe thread: HTTP ${threadRes.status} — ${await threadRes.text()}`,
        },
        { status: 502 },
      );
    }
    const threadJson = (await threadRes.json()) as { thread_id: string };
    threadId = threadJson.thread_id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "probe_thread_failed", message },
      { status: 502 },
    );
  }

  // 2. Trigger the gated route without payment-signature. We expect a
  //    402 carrying the payment-required envelope header. Use /runs/wait
  //    (cheap and deterministic) even though the chat UI streams via
  //    /runs/stream — the middleware emits the same envelope for both.
  let envelopeB64: string | null;
  try {
    const probeRes = await fetch(
      `${langgraphUrl}/threads/${threadId}/runs/wait`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assistant_id: ASSISTANT_ID,
          input: { messages: [{ type: "human", content: "probe" }] },
        }),
      },
    );

    if (probeRes.status !== 402) {
      // Either the agent isn't gated (misconfigured middleware) or
      // something else went wrong. Surface the status verbatim so
      // the operator can diagnose.
      return NextResponse.json(
        {
          error: "probe_unexpected_status",
          message: `Expected 402 from gated route, got ${probeRes.status}: ${await probeRes.text()}`,
        },
        { status: 502 },
      );
    }
    envelopeB64 = probeRes.headers.get("payment-required");
    if (!envelopeB64) {
      return NextResponse.json(
        {
          error: "probe_no_envelope",
          message:
            "Agent returned 402 but no payment-required header — middleware may be misconfigured.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "probe_run_failed", message },
      { status: 502 },
    );
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(Buffer.from(envelopeB64, "base64").toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "probe_envelope_parse_failed",
        message: `payment-required header is not valid base64-encoded JSON: ${message}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(envelope);
}
