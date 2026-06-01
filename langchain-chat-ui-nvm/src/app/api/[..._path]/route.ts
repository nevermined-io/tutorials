/**
 * Catch-all proxy from `/api/*` → the LangGraph deployment behind
 * `LANGGRAPH_API_URL`. Replaces `langgraph-nextjs-api-passthrough` so we can:
 *
 *   1. Inject the x402 access token from a httpOnly cookie
 *      (`NVM_X402_TOKEN_COOKIE`) into the run body at
 *      `config.configurable.payment_token` — the contract
 *      `payments_py.x402.langchain.requires_payment` reads from. The
 *      token is NOT forwarded as the `payment-signature` HTTP header
 *      because the agent no longer runs an ASGI middleware; gating
 *      happens inside the tool, and config-level injection works
 *      identically against local `langgraph dev` and LangSmith
 *      Deployment.
 *   2. Stream SSE bodies (`/runs/stream`) without buffering. Only POSTs
 *      to `runs`-shaped paths get JSON-rewritten; everything else is
 *      passed through verbatim.
 *
 * Runtime: Node (NOT edge). The sibling `/api/x402/*` routes import the
 * full `@nevermined-io/payments` package, which relies on Node-only APIs.
 * Keeping every `/api/*` route on the same runtime simplifies env loading.
 */

import { NextRequest, NextResponse } from "next/server";

import { getLanggraphApiUrl } from "@/lib/env-server";
import { NVM_X402_TOKEN_COOKIE } from "@/lib/x402-server";

export const runtime = "nodejs";

// Hop-by-hop headers must not be forwarded across the proxy boundary; the
// Node fetch implementation manages these per-connection. Lower-case match.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-authenticate",
  "upgrade",
  "host",
  // `content-length` is recomputed by fetch — passing the browser's value
  // confuses upstream when the body is buffered or rewritten.
  "content-length",
]);

/**
 * Match `/threads/{id}/runs[/wait|/stream]` and variants the LangGraph
 * SDK uses when submitting a run. These are the only requests where it
 * makes sense to merge `config.configurable.payment_token` into the
 * body — every other route (CRUD on threads, assistants, store, etc.)
 * has no such field and rewriting it would risk corrupting the payload.
 */
function isRunSubmissionPath(segments: string[]): boolean {
  if (segments.length < 3) return false;
  if (segments[0] !== "threads") return false;
  if (segments[2] !== "runs") return false;
  if (segments.length === 3) return true; // POST /threads/{id}/runs
  return ["wait", "stream"].includes(segments[3] ?? "");
}

function mergePaymentToken(
  body: unknown,
  paymentToken: string,
): Record<string, unknown> {
  const base =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const existingConfig =
    base.config && typeof base.config === "object"
      ? (base.config as Record<string, unknown>)
      : {};
  const existingConfigurable =
    existingConfig.configurable && typeof existingConfig.configurable === "object"
      ? (existingConfig.configurable as Record<string, unknown>)
      : {};
  return {
    ...base,
    config: {
      ...existingConfig,
      configurable: {
        ...existingConfigurable,
        payment_token: paymentToken,
      },
    },
  };
}

async function buildOutgoingBody(
  request: NextRequest,
  segments: string[],
  cookieToken: string | undefined,
  outgoingHeaders: Headers,
): Promise<BodyInit | undefined> {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  // For run-submission POSTs we JSON-rewrite to inject payment_token.
  // Everything else streams the body through unchanged so SSE / file
  // uploads / etc. continue to work.
  if (
    request.method === "POST" &&
    cookieToken &&
    isRunSubmissionPath(segments)
  ) {
    const raw = await request.text();
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      // Not JSON — bail back to streaming the raw bytes.
      outgoingHeaders.set("content-type", "application/octet-stream");
      return raw;
    }
    const merged = mergePaymentToken(parsed, cookieToken);
    outgoingHeaders.set("content-type", "application/json");
    return JSON.stringify(merged);
  }
  return request.body as BodyInit;
}

async function proxy(request: NextRequest, params: { _path?: string[] }) {
  const upstreamBase = getLanggraphApiUrl();
  const segments = params._path ?? [];
  const upstreamPath = "/" + segments.map(encodeURIComponent).join("/");
  const search = request.nextUrl.search;
  const upstreamUrl = `${upstreamBase}${upstreamPath}${search}`;

  const outgoingHeaders = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      outgoingHeaders.set(key, value);
    }
  }

  const cookieToken = request.cookies.get(NVM_X402_TOKEN_COOKIE)?.value;
  const body = await buildOutgoingBody(
    request,
    segments,
    cookieToken,
    outgoingHeaders,
  );

  const init: RequestInit = {
    method: request.method,
    headers: outgoingHeaders,
    body,
    // Required when forwarding a ReadableStream body in undici/Node fetch.
    duplex: "half",
  } as RequestInit & { duplex?: "half" };

  const upstream = await fetch(upstreamUrl, init);

  // Mirror response headers verbatim — strip hop-by-hop on the way back too.
  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ _path?: string[] }> };

async function handle(request: NextRequest, ctx: RouteContext) {
  const params = await ctx.params;
  return proxy(request, params);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
