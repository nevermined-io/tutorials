import { NextResponse } from "next/server";
import { getTutorial } from "@/content/tutorials";

// Merchant backend for the "Fiat checkout" showcase demo — the ONLY place the
// organization's Nevermined API key is used. The browser panel (FiatRunPanel)
// calls THIS route with just a packageId; we look up the price server-side and
// create the Order on the org's behalf. The key never reaches the browser bundle.
//
// Local dev points at the local Orders stack; in production, at the sandbox
// Orders API. Configure via env (see .env.example):
//   NVM_ORDER_API_KEY   the org's (sandbox) API key — SECRET, server-only
//   NVM_API_BASE_URL    the Orders API base (default http://localhost:3001)

const NVM_API_BASE_URL = process.env.NVM_API_BASE_URL ?? "http://localhost:3001";
const NVM_ORDER_API_KEY = process.env.NVM_ORDER_API_KEY;

// Single source of truth for prices: the fiat tutorial's own package list
// (content/tutorials.ts). The client sends only a packageId and we look the
// amount up here, so a tampered client can't name its own amount, and the
// displayed price (formatted from the same amountMinor) can't drift from the
// charged one. Built with a null prototype so the lookup is a real allowlist.
const CATALOG: Record<string, { amountMinor: number; description: string }> = Object.create(null);
{
  const fiat = getTutorial("fiat-checkout-chat");
  if (fiat && fiat.run.kind === "fiat") {
    for (const p of fiat.run.packages) CATALOG[p.id] = { amountMinor: p.amountMinor, description: p.name };
  }
}

// Fail-fast guard at import: every amount must be in the Orders API's window.
for (const id of Object.keys(CATALOG)) {
  const a = CATALOG[id].amountMinor;
  if (!Number.isInteger(a) || a < 100 || a > 99_999_999) {
    throw new Error(`Fiat catalog "${id}" amountMinor out of range: ${a}`);
  }
}

// ponytail: in-memory per-IP limiter — this is a PUBLIC route that spends the
// org's identity (creates real Orders), so it must be bounded. Ceiling: state is
// per-instance and resets on restart; a multi-instance deploy wants a shared
// store (Redis), but for a demo this turns "unbounded" into "bounded".
const HITS = new Map<string, number[]>();
const RL_WINDOW_MS = 10 * 60_000;
const RL_MAX = 8;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (HITS.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (recent.length >= RL_MAX) {
    HITS.set(ip, recent);
    return true;
  }
  recent.push(now);
  HITS.set(ip, recent);
  return false;
}

export async function POST(req: Request) {
  if (!NVM_ORDER_API_KEY) {
    return NextResponse.json(
      { error: "Server missing NVM_ORDER_API_KEY — set it to run the live demo (see .env.example)." },
      { status: 503 },
    );
  }

  // Same-origin guard: a browser always sends Origin; reject cross-site callers.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    let ok = false;
    try {
      ok = new URL(origin).host === host;
    } catch {
      ok = false;
    }
    if (!ok) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  // Rate limit per client IP (bounds scripted abuse that skips the Origin header).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many orders from this client — slow down." }, { status: 429 });
  }

  let packageId: unknown;
  try {
    ({ packageId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  // Object.hasOwn — a real own-property check, so "constructor"/"__proto__"/etc.
  // don't slip past the allowlist into an authenticated upstream call.
  if (typeof packageId !== "string" || !Object.hasOwn(CATALOG, packageId)) {
    return NextResponse.json({ error: `Unknown package: ${String(packageId)}` }, { status: 400 });
  }

  const pkg = CATALOG[packageId];
  let res: Response;
  try {
    res = await fetch(`${NVM_API_BASE_URL}/api/v1/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVM_ORDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountMinor: pkg.amountMinor, // price is OURS, never the client's
        currency: "usd",
        description: pkg.description,
        buyerRef: "showcase-fiat-checkout",
      }),
      signal: AbortSignal.timeout(15_000), // don't hang the caller on a stalled backend
    });
  } catch (err) {
    console.error(`[showcase/orders] Orders API unreachable: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ error: "Orders backend unreachable or timed out." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[showcase/orders] Nevermined API ${res.status}: ${detail}`);
    return NextResponse.json(
      { error: `Orders API returned ${res.status}. Is the Orders backend running?` },
      { status: 502 },
    );
  }

  // A 200 without an orderId (renamed/wrapped field) would otherwise become a
  // 200 {} the client can't detect — route it into the 502 it already handles.
  const { orderId } = await res.json().catch(() => ({}) as { orderId?: unknown });
  if (typeof orderId !== "string" || !orderId) {
    console.error("[showcase/orders] Orders API returned 200 with no orderId");
    return NextResponse.json({ error: "Orders API returned no orderId." }, { status: 502 });
  }

  // Only orderId is forwarded — the hosted checkout fetches the rest itself via
  // the no-auth GET /orders/:id, so clientSecret never touches the browser.
  return NextResponse.json({ orderId });
}
