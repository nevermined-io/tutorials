/**
 * Demo agent — walks through the full discovery → purchase → search → top-up flow.
 *
 * Mirrors the TypeScript sample from Exa's nevermined.md integration page:
 *   1. Mint an x402 access token via the Nevermined SDK (card-delegation scheme).
 *   2. POST it to /purchase-key. Receive a provider-issued API key.
 *   3. Use the key against /search until the provider's quota is exhausted.
 *   4. On HTTP 402 + NO_MORE_CREDITS, top up by re-running step 1.
 *
 * The interesting bit is step 4: from Nevermined's perspective each top-up is
 * a fresh purchase (one card charge). From the provider's perspective the
 * payer wallet is the same, so the same API key is returned with a refilled
 * quota.
 */
import 'dotenv/config'
import { Payments, type EnvironmentName } from '@nevermined-io/payments'

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3001'
const NVM_API_KEY = process.env.NVM_API_KEY ?? ''
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ?? 'sandbox') as EnvironmentName
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? ''
const NVM_CARD_PM_ID = process.env.NVM_CARD_PM_ID ?? ''
const SPENDING_LIMIT_CENTS = Number(process.env.NVM_SPENDING_LIMIT_CENTS ?? '100')
const DELEGATION_DURATION_SECS = Number(process.env.NVM_DELEGATION_DURATION_SECS ?? '3600')
const DEMO_SEARCH_CALLS = Number(process.env.DEMO_SEARCH_CALLS ?? '105')

if (!NVM_API_KEY || !NVM_PLAN_ID || !NVM_CARD_PM_ID) {
  console.error('NVM_API_KEY, NVM_PLAN_ID and NVM_CARD_PM_ID are required. See .env.example.')
  process.exit(1)
}

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
})

async function mintAccessToken(): Promise<string> {
  const { accessToken } = await payments.x402.getX402AccessToken(NVM_PLAN_ID, undefined, {
    scheme: 'nvm:card-delegation',
    delegationConfig: {
      providerPaymentMethodId: NVM_CARD_PM_ID,
      spendingLimitCents: SPENDING_LIMIT_CENTS,
      durationSecs: DELEGATION_DURATION_SECS,
    },
  })
  return accessToken
}

interface PurchaseResponse {
  status: string
  apiKey: string
  expiresAt: string | null
  searchesGranted: number
  totalRemaining: number
}

async function purchaseOrTopUp(label: string): Promise<PurchaseResponse> {
  console.log(`\n[${label}] minting x402 access token...`)
  const accessToken = await mintAccessToken()

  console.log(`[${label}] POST ${SERVER_URL}/purchase-key`)
  const res = await fetch(`${SERVER_URL}/purchase-key`, {
    method: 'POST',
    headers: { 'payment-signature': accessToken },
  })

  if (res.status === 402) {
    const required = res.headers.get('payment-required')
    if (required) {
      const decoded = JSON.parse(Buffer.from(required, 'base64').toString())
      console.error(`[${label}] 402 from /purchase-key. payment-required:`, JSON.stringify(decoded, null, 2))
    }
    throw new Error(`/purchase-key returned 402: ${await res.text()}`)
  }
  if (!res.ok) throw new Error(`/purchase-key failed: HTTP ${res.status} — ${await res.text()}`)

  const settlementHeader = res.headers.get('payment-response')
  if (settlementHeader) {
    const settlement = JSON.parse(Buffer.from(settlementHeader, 'base64').toString())
    console.log(`[${label}] settled — tx ${settlement.transaction}, credits ${settlement.creditsRedeemed ?? '(n/a)'}`)
  }

  const body = (await res.json()) as PurchaseResponse
  console.log(`[${label}] received apiKey ${body.apiKey.slice(0, 12)}…, remaining ${body.totalRemaining}`)
  return body
}

type SearchOutcome =
  | { ok: true; remaining: number }
  | { ok: false; depleted: boolean }

async function search(apiKey: string, query: string): Promise<SearchOutcome> {
  const res = await fetch(`${SERVER_URL}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ query, limit: 3 }),
  })

  if (res.status === 402) {
    const body = (await res.json()) as { tag?: string; error?: string }
    return { ok: false, depleted: body.tag === 'NO_MORE_CREDITS' }
  }
  if (!res.ok) throw new Error(`/search failed: HTTP ${res.status} — ${await res.text()}`)

  const body = (await res.json()) as { remaining: number }
  return { ok: true, remaining: body.remaining }
}

async function main(): Promise<void> {
  console.log('demo agent — paid web-search via Nevermined x402')
  console.log(`  server  : ${SERVER_URL}`)
  console.log(`  plan    : ${NVM_PLAN_ID}`)
  console.log(`  card pm : ${NVM_CARD_PM_ID}`)

  // First purchase — fresh payer wallet, new API key.
  const first = await purchaseOrTopUp('purchase #1')
  let apiKey = first.apiKey
  let topUpsRemaining = 1 // how many extra purchases to demonstrate

  for (let i = 1; i <= DEMO_SEARCH_CALLS; i++) {
    const outcome = await search(apiKey, `agentic payments search ${i}`)
    if (outcome.ok) {
      if (i % 20 === 0 || i === 1) {
        console.log(`[search ${i}] ok, remaining ${outcome.remaining}`)
      }
      continue
    }
    if (!outcome.depleted) {
      throw new Error(`/search failed in unexpected way at call ${i}`)
    }

    console.log(`[search ${i}] 402 NO_MORE_CREDITS — top up`)
    // In production an agent should retry the failed query after the top-up succeeds.
    // This demo just advances the loop because the queries are placeholders.
    if (topUpsRemaining <= 0) {
      console.log('demo top-up budget exhausted, stopping')
      break
    }
    topUpsRemaining--
    const next = await purchaseOrTopUp('top-up')
    if (next.apiKey !== apiKey) {
      throw new Error(`expected same apiKey on top-up, got a new one (${next.apiKey})`)
    }
    apiKey = next.apiKey
  }

  console.log('\ndone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
