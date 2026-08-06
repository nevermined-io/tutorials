/**
 * Paid web-search service — one x402 purchase returns a quota-bearing API key.
 *
 * This mirrors the Exa ↔ Nevermined integration pattern:
 *   POST /purchase-key  ← x402-protected; one call = one card charge
 *                          returns { status, apiKey, expiresAt }
 *   POST /search        ← gated on x-api-key header; provider's own metering
 *                          returns 402 + { tag: 'NO_MORE_CREDITS' } when exhausted
 *
 * Notes for readers comparing to `http-simple-agent-ts`:
 *   - That tutorial settles credits on every protected request via paymentMiddleware.
 *   - This tutorial settles on a *single* endpoint (`/purchase-key`) and uses
 *     the lower-level facilitator API so the "provision key between verify
 *     and settle" step is visible.
 *   - PAYG plan: there is no buyer-side credit balance to track. Every
 *     successful /purchase-key call triggers exactly one card charge.
 */
import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import {
  Payments,
  buildPaymentRequired,
  type EnvironmentName,
  type X402PaymentRequired,
  type VerifyPermissionsResult,
  type SettlePermissionsResult,
} from '@nevermined-io/payments'
import { provisionOrTopUp, consumeOneSearch } from './store.js'
import { stubSearch } from './search.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const NVM_API_KEY = process.env.NVM_API_KEY ?? ''
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT ?? 'sandbox') as EnvironmentName
const NVM_PLAN_ID = process.env.NVM_PLAN_ID ?? ''
const SEARCHES_PER_PURCHASE = process.env.SEARCHES_PER_PURCHASE
  ? Number(process.env.SEARCHES_PER_PURCHASE)
  : 100

if (!NVM_API_KEY || !NVM_PLAN_ID) {
  console.error('NVM_API_KEY and NVM_PLAN_ID are required. Copy .env.example to .env and fill them in.')
  process.exit(1)
}

const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
})

const paymentRequired: X402PaymentRequired = buildPaymentRequired(NVM_PLAN_ID, {
  endpoint: '/purchase-key',
  httpVerb: 'POST',
  scheme: 'nvm:card-delegation',
  environment: NVM_ENVIRONMENT,
})

const paymentRequiredHeader = Buffer.from(JSON.stringify(paymentRequired)).toString('base64')

function send402(res: Response, message: string): void {
  res
    .status(402)
    .setHeader('payment-required', paymentRequiredHeader)
    .json({ ...paymentRequired, error: message })
}

const app = express()
app.use(express.json())

/**
 * POST /purchase-key
 *
 * x402-protected. Verifies the access token, provisions or tops up an
 * API key for the payer wallet, then settles (one card charge).
 *
 * Response (200):
 *   { status: 'ok', apiKey, expiresAt: null, searchesGranted, totalRemaining }
 * Response (402):
 *   x402 PaymentRequired body + payment-required header
 */
app.post('/purchase-key', async (req: Request, res: Response) => {
  const token = req.header('payment-signature')
  if (!token) {
    return send402(res, 'Missing x402 payment token. Send token in payment-signature header.')
  }

  // Verify → settle → provision. Settle moves the money; provisioning
  // last means a settle failure (declined card, network blip) leaves the
  // store untouched, so the customer is neither charged nor served.
  // A production provider with a real DB should make provisioning
  // idempotent on the payer wallet (or on settlement.transaction) so a
  // transient store error after a successful settle can be retried.
  //
  // This tutorial also doesn't guard against the same access token being
  // presented twice in parallel. For an in-memory store the simplest
  // guard is a Set<tokenHash> of in-flight requests; for a real DB the
  // natural key is settlement.transaction. Omitted here for clarity.
  let verification: VerifyPermissionsResult
  try {
    verification = await payments.facilitator.verifyPermissions({
      paymentRequired,
      x402AccessToken: token,
      maxAmount: 1n,
    })
  } catch (err) {
    console.error(`[purchase-key] verify threw: ${err}`)
    return send402(res, 'Verification failed.')
  }

  if (!verification.isValid || !verification.payer) {
    return send402(res, verification.invalidReason ?? 'Payment token failed verification.')
  }

  let settlement: SettlePermissionsResult
  try {
    settlement = await payments.facilitator.settlePermissions({
      paymentRequired,
      x402AccessToken: token,
      maxAmount: 1n,
      agentRequestId: verification.agentRequestId,
    })
  } catch (err) {
    console.error(`[purchase-key] settle threw for payer ${verification.payer}: ${err}`)
    return res.status(502).json({
      status: 'error',
      tag: 'SETTLEMENT_FAILED',
      error: 'Settlement failed; no charge made.',
    })
  }

  if (!settlement.success) {
    console.error(`[purchase-key] settlement failed for payer ${verification.payer}: ${settlement.errorReason}`)
    return res.status(502).json({
      status: 'error',
      tag: 'SETTLEMENT_FAILED',
      error: settlement.errorReason ?? 'Settlement failed.',
    })
  }

  const { record, isNew } = provisionOrTopUp(verification.payer, SEARCHES_PER_PURCHASE)

  console.log(
    `[purchase-key] ${isNew ? 'issued new key' : 'topped up'} for payer ${verification.payer} — quota now ${record.remainingQuota}`,
  )

  res
    .setHeader('payment-response', Buffer.from(JSON.stringify(settlement)).toString('base64'))
    .json({
      status: 'ok',
      apiKey: record.apiKey,
      expiresAt: null,
      searchesGranted: SEARCHES_PER_PURCHASE,
      totalRemaining: record.remainingQuota,
    })
})

/**
 * POST /search
 *
 * Gated on the provider-issued API key. Decrements provider-side quota.
 * Returns HTTP 402 + { tag: 'NO_MORE_CREDITS' } when the key is exhausted —
 * the agent's cue to call /purchase-key to top up.
 */
app.post('/search', (req: Request, res: Response) => {
  // Validate auth shape and body before touching quota — a malformed
  // request must not burn a search the caller didn't actually make.
  const apiKey = req.header('x-api-key')
  if (!apiKey) {
    return res.status(401).json({ tag: 'MISSING_API_KEY', error: 'x-api-key header is required.' })
  }

  const { query, limit } = (req.body ?? {}) as { query?: string; limit?: number }
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ tag: 'BAD_REQUEST', error: 'Missing or invalid "query" field.' })
  }

  const result = consumeOneSearch(apiKey)
  if (!result.ok) {
    if (result.reason === 'depleted') {
      return res.status(402).json({
        tag: 'NO_MORE_CREDITS',
        error: 'API key has no remaining searches. Top up by calling POST /purchase-key.',
      })
    }
    return res.status(401).json({ tag: 'INVALID_API_KEY', error: 'API key not recognised.' })
  }

  const safeLimit = Math.min(Math.max(typeof limit === 'number' ? limit : 5, 1), 25)

  res.json({
    query,
    results: stubSearch(query, safeLimit),
    remaining: result.remaining,
  })
})

app.listen(PORT, () => {
  console.log(`paid web-search server listening on http://localhost:${PORT}`)
  console.log(`  POST /purchase-key  x402-protected; one call = one card charge`)
  console.log(`  POST /search        gated on x-api-key; ${SEARCHES_PER_PURCHASE} searches per purchase`)
  console.log(`Plan: ${NVM_PLAN_ID} (${NVM_ENVIRONMENT})`)
})
