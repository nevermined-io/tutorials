/**
 * In-memory provider-side metering.
 *
 * One record per payer wallet. The provider's bookkeeping — entirely
 * separate from Nevermined credits. A real service would persist this
 * in its own database; an in-memory map keeps the tutorial focused on
 * the payment flow.
 *
 * Identifying a payer:
 *   verifyPermissions() returns the payer wallet address. The same
 *   payer hitting /purchase-key again means top-up the existing key,
 *   not issue a new one — same behaviour as Exa's reference integration.
 */

import { randomBytes } from 'node:crypto'

export interface CustomerRecord {
  payer: string
  apiKey: string
  remainingQuota: number
}

const byPayer = new Map<string, CustomerRecord>()
const byApiKey = new Map<string, CustomerRecord>()

function generateApiKey(): string {
  return `wsk_${randomBytes(24).toString('hex')}`
}

/**
 * On a successful purchase, either issue a fresh key for a new payer
 * or top up the existing key for a returning payer.
 */
export function provisionOrTopUp(
  payer: string,
  quotaPerPurchase: number,
): { record: CustomerRecord; isNew: boolean } {
  const existing = byPayer.get(payer)
  if (existing) {
    existing.remainingQuota += quotaPerPurchase
    return { record: existing, isNew: false }
  }

  const record: CustomerRecord = {
    payer,
    apiKey: generateApiKey(),
    remainingQuota: quotaPerPurchase,
  }
  byPayer.set(payer, record)
  byApiKey.set(record.apiKey, record)
  return { record, isNew: true }
}

export function lookupByApiKey(apiKey: string): CustomerRecord | undefined {
  return byApiKey.get(apiKey)
}

/**
 * Decrement quota on a /search call. Returns the new remaining count, or
 * a flag indicating the key is exhausted (and nothing was decremented).
 */
export function consumeOneSearch(
  apiKey: string,
): { ok: true; remaining: number } | { ok: false; reason: 'unknown' | 'depleted' } {
  const record = byApiKey.get(apiKey)
  if (!record) return { ok: false, reason: 'unknown' }
  if (record.remainingQuota <= 0) return { ok: false, reason: 'depleted' }
  record.remainingQuota -= 1
  return { ok: true, remaining: record.remainingQuota }
}
