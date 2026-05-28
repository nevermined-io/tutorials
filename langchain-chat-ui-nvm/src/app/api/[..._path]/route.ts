/**
 * Catch-all proxy from `/api/*` → the LangGraph deployment behind
 * `LANGGRAPH_API_URL`. Replaces `langgraph-nextjs-api-passthrough` so we can:
 *
 *   1. Inject `payment-signature` from a httpOnly cookie (`NVM_X402_TOKEN_COOKIE`)
 *      on outgoing requests — the cookie is set server-side by
 *      `POST /api/x402/token` after a successful delegation flow.
 *   2. Preserve the `payment-required` (402) and `payment-response` (settlement
 *      receipt) headers on the way back to the browser.
 *   3. Stream SSE bodies (`/runs/stream`) without buffering.
 *
 * Runtime: Node (NOT edge). The sibling `/api/x402/token` route imports the
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
  // confuses upstream when the body is buffered.
  "content-length",
]);

async function proxy(request: NextRequest, params: { _path?: string[] }) {
  const upstreamBase = getLanggraphApiUrl();
  const segments = params._path ?? [];
  const upstreamPath = "/" + segments.map(encodeURIComponent).join("/");
  const search = request.nextUrl.search;
  const upstreamUrl = `${upstreamBase}${upstreamPath}${search}`;

  // Forward client headers, stripping hop-by-hop. Inject `payment-signature`
  // from the cookie if present — the browser cannot send this header itself
  // because the token is httpOnly.
  const outgoingHeaders = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      outgoingHeaders.set(key, value);
    }
  }
  const cookieToken = request.cookies.get(NVM_X402_TOKEN_COOKIE)?.value;
  if (cookieToken && !outgoingHeaders.has("payment-signature")) {
    outgoingHeaders.set("payment-signature", cookieToken);
  }

  const init: RequestInit = {
    method: request.method,
    headers: outgoingHeaders,
    // `body` is only valid on methods that have one. Next.js converts
    // request.body to a Node ReadableStream; we pass it through so SSE
    // upstreams aren't buffered.
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    // Required when forwarding a ReadableStream body in undici/Node fetch.
    duplex: "half",
  } as RequestInit & { duplex?: "half" };

  const upstream = await fetch(upstreamUrl, init);

  // Mirror response headers verbatim — including `payment-required` (402)
  // and `payment-response` (200 settlement receipt) which the chat client
  // needs to react to. Strip hop-by-hop on the way back too.
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
