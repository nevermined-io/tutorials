import { NextResponse } from "next/server";

// Merchant backend for the "Fiat checkout" showcase demo — the ONLY place the
// organization's Nevermined API key is used. The browser panel (FiatRunPanel)
// calls THIS route with just a packageId; we look up the price server-side and
// create the Order on the org's behalf. The key never reaches the browser bundle.
//
// Local dev points at the local Orders stack; in production it points at the
// sandbox Orders API. Configure via env (see .env.example):
//   NVM_ORDER_API_KEY   the org's (sandbox) API key — SECRET, server-only
//   NVM_API_BASE_URL    the Orders API base (default http://localhost:3001)

const NVM_API_BASE_URL = process.env.NVM_API_BASE_URL ?? "http://localhost:3001";
const NVM_ORDER_API_KEY = process.env.NVM_ORDER_API_KEY;

// Server-owned prices (USD minor units). The client never names an amount, so it
// can't pay less. Display strings live in content/tutorials.ts (keep in sync).
const CATALOG: Record<string, { amountMinor: number; description: string }> = {
  barcelona: { amountMinor: 343795, description: "Barcelona City Break" },
  tokyo: { amountMinor: 1289900, description: "Tokyo Explorer" },
  safari: { amountMinor: 875000, description: "Kenya Safari" },
};

// Fail-fast guard at import: every amount must be in the Orders API's window.
for (const [id, p] of Object.entries(CATALOG)) {
  if (!Number.isInteger(p.amountMinor) || p.amountMinor < 100 || p.amountMinor > 99_999_999) {
    throw new Error(`Fiat catalog "${id}" amountMinor out of range: ${p.amountMinor}`);
  }
}

export async function POST(req: Request) {
  if (!NVM_ORDER_API_KEY) {
    return NextResponse.json(
      { error: "Server missing NVM_ORDER_API_KEY — set it to run the live demo (see .env.example)." },
      { status: 503 },
    );
  }

  let packageId: unknown;
  try {
    ({ packageId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof packageId !== "string" || !CATALOG[packageId]) {
    return NextResponse.json({ error: `Unknown package: ${String(packageId)}` }, { status: 400 });
  }

  const pkg = CATALOG[packageId];
  const res = await fetch(`${NVM_API_BASE_URL}/api/v1/orders`, {
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
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[showcase/orders] Nevermined API ${res.status}: ${detail}`);
    return NextResponse.json(
      { error: `Orders API returned ${res.status}. Is the Orders backend running?` },
      { status: 502 },
    );
  }

  // Only orderId is forwarded — the hosted checkout fetches the rest itself via
  // the no-auth GET /orders/:id, so clientSecret never touches the browser.
  const { orderId } = await res.json();
  return NextResponse.json({ orderId });
}
