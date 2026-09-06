import { NextResponse } from 'next/server'
import { getPackage } from '@/lib/packages'

// The MERCHANT backend. This is the ONLY place the organization's Nevermined
// API key is ever used — it stays on the server and never reaches the browser
// bundle. The chat calls THIS route with just a packageId; we look up the price
// and call the Nevermined Orders API on the org's behalf.

const NVM_API_BASE_URL = process.env.NVM_API_BASE_URL ?? 'http://localhost:3001'
const NVM_ORDER_API_KEY = process.env.NVM_ORDER_API_KEY

export async function POST(req: Request) {
  if (!NVM_ORDER_API_KEY) {
    // Misconfiguration, not a user error — say so loudly, leak nothing.
    return NextResponse.json(
      { error: 'Server missing NVM_ORDER_API_KEY. See .env.example.' },
      { status: 500 },
    )
  }

  let packageId: unknown
  let idempotencyKey: unknown
  try {
    ({ packageId, idempotencyKey } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof packageId !== 'string') {
    return NextResponse.json({ error: 'packageId (string) is required.' }, { status: 400 })
  }
  if (idempotencyKey !== undefined && typeof idempotencyKey !== 'string') {
    return NextResponse.json({ error: 'idempotencyKey must be a string.' }, { status: 400 })
  }

  const pkg = getPackage(packageId)
  if (!pkg) {
    return NextResponse.json({ error: `Unknown package: ${packageId}` }, { status: 400 })
  }

  // Create the order server-side with the org key. The buyer never sees this call.
  const res = await fetch(`${NVM_API_BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NVM_ORDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amountMinor: pkg.amountMinor, // price is OURS, never the client's
      currency: 'usd',
      description: pkg.name,
      buyerRef: 'fiat-checkout-chat',
      // Retried/double-clicked creates with the same key return the same Order
      // + clientSecret instead of a fresh PaymentIntent. A production merchant
      // keys this on its OWN order id; here it's a per-session + package key.
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error(`[orders] Nevermined API ${res.status}: ${detail}`)
    return NextResponse.json(
      { error: 'Could not create the order. Check the merchant backend logs.' },
      { status: 502 },
    )
  }

  // The API returns { orderId, clientSecret, status }. The chat only needs
  // orderId — the hosted checkout iframe fetches everything else itself via the
  // no-auth GET /orders/:id, so we deliberately DON'T forward clientSecret.
  const { orderId } = await res.json()
  return NextResponse.json({ orderId })
}
