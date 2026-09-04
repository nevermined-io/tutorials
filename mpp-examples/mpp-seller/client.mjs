/**
 * Step 3 — a SECOND account (the SUBSCRIBER) buys the plan and calls the agent
 * over MPP.
 *
 * Four acts, in this order, because each proves something the next one hides:
 *
 *   1. the raw wire — plain `fetch`, the 402 challenge, the credential, the receipt
 *   2. the same call through `payments.mpp.fetch`, which is what a buyer writes
 *   3. the negatives — a replayed credential and a swapped body
 *   4. the ledger — the credits that actually burned, on both addresses
 */
import {
  Payments,
  buildCredentialHeader,
  parseChallengeHeader,
  parseReceiptHeader,
} from '@nevermined-io/payments'
import { accountOf, loadConfig, payerOf, readState } from './lib/config.mjs'

const cfg = loadConfig()
const state = readState()
if (!state?.planId) throw new Error('no .demo-state.json — run `yarn provision` first')

const payments = Payments.getInstance({ nvmApiKey: cfg.subscriberApiKey })
const buyer = accountOf(cfg.subscriberApiKey)
const url = state.agentUrl
const body = JSON.stringify({ question: 'What is the Machine Payments Protocol?' })
const headers = { 'content-type': 'application/json' }

const short = (s, n = 72) => (s && s.length > n ? `${s.slice(0, n)}...` : s)
const rule = (title) => console.log(`\n== ${title} ${'='.repeat(Math.max(0, 62 - title.length))}`)
const balanceOf = async (holder) =>
  (await payments.plans.getPlanBalance(state.planId, holder)).balance

/** How many credits this plan has burned for the buyer, from the buyer's own ledger. */
async function burnedCredits() {
  const res = await fetch(`${cfg.apiBase}/api/v1/transactions/search`, {
    method: 'POST',
    headers: { ...headers, authorization: `Bearer ${cfg.subscriberApiKey}` },
    body: JSON.stringify({ planId: String(state.planId), page: 1, offset: 1000 }),
  })
  if (!res.ok) return null
  const rows = (await res.json()).planTransactions ?? []
  return rows
    .filter((r) => r.txType === 'CreditBurn' && String(r.planId) === String(state.planId))
    .reduce((total, r) => total + BigInt(r.numCredits ?? 0), 0n)
}

rule('who')
console.log(`buyer      ${buyer}`)
console.log(`builder    ${state.builder}`)
if (buyer === state.builder) throw new Error('the buyer and the builder are the same account')
console.log(`plan       ${state.planId}`)
console.log(`agent      ${state.agentId} @ ${url}`)

rule('budget - the buyer creates a spend-capped delegation')
const delegation = await payments.delegation.createDelegation({
  provider: 'erc4337',
  spendingLimitCents: cfg.delegationLimitCents,
  durationSecs: cfg.delegationDurationSecs,
  currency: 'usdc',
})
const delegationId = delegation.delegationId
console.log(
  `delegation ${delegationId} (cap ${cfg.delegationLimitCents}c, ${cfg.delegationDurationSecs}s)`,
)

// Minted up front, not at the moment of use: the token names the address that
// SIGNS the payment, which act 4 prints next to the one that holds the credits.
const token = await payments.mpp.getMppAccessToken(state.planId, state.agentId, {
  delegationConfig: { delegationId },
})
const payer = payerOf(token.accessToken)
console.log(`payer      ${payer} (the address that signs the payment)`)

rule('order - the buyer purchases the plan')
const order = await payments.plans.orderPlan(state.planId)
console.log(`ordered    success=${order.success} tx=${short(order.txHash ?? '-', 20)}`)
const before = { account: await balanceOf(buyer), payer: await balanceOf(payer) }
const burnedBefore = await burnedCredits()
console.log(`balance    account ${buyer} -> ${before.account} credits`)
console.log(`           payer   ${payer} -> ${before.payer} credits`)
if (before.account !== before.payer) {
  console.log(
    '           NOTE: credits live on the ACCOUNT address; the PAYER only signs the payment',
  )
}

rule('act 1 - the raw MPP wire')
const unpaid = await fetch(url, { method: 'POST', headers, body })
const challengeHeader = unpaid.headers.get('www-authenticate')
console.log(`request 1  ${unpaid.status} ${unpaid.statusText}`)
console.log(`challenge  ${short(challengeHeader ?? '(none)')}`)
if (unpaid.status !== 402 || !challengeHeader) {
  throw new Error(`expected a 402 with a Payment challenge, got ${unpaid.status}`)
}
const challenge = parseChallengeHeader(challengeHeader)
console.log(
  `           plan=${short(challenge.request.planId, 24)} credits=${challenge.request.credits} bound-to-body=${Boolean(challenge.digest)}`,
)

const credential = buildCredentialHeader(challenge, { accessToken: token.accessToken })
console.log(`credential ${short(credential)}`)

const paid = await fetch(url, {
  method: 'POST',
  headers: { ...headers, authorization: credential },
  body,
})
const receiptHeader = paid.headers.get('payment-receipt')
console.log(`request 2  ${paid.status} ${paid.statusText}`)
console.log(
  `receipt    ${receiptHeader ? JSON.stringify(parseReceiptHeader(receiptHeader)) : '(none)'}`,
)
console.log(`body       ${JSON.stringify(await paid.json())}`)
if (!paid.ok) throw new Error(`the paid request failed with ${paid.status}`)

rule('act 2 - the same call through payments.mpp.fetch')
const result = await payments.mpp.fetch(
  url,
  { method: 'POST', headers, body },
  { delegationConfig: { delegationId }, planId: state.planId, maxCredits: cfg.credits * 4 },
)
console.log(`status     ${result.response.status}`)
console.log(
  `accounting paid=${result.paid} settled=${result.settled} credentialsPresented=${result.credentialsPresented} creditsPresented=${result.creditsPresented ?? '-'}`,
)
console.log(`receipt    ${result.receipt ? JSON.stringify(result.receipt) : '(none)'}`)
console.log(`body       ${JSON.stringify(await result.response.json())}`)

rule('act 3 - the negatives')
const replay = await fetch(url, {
  method: 'POST',
  headers: { ...headers, authorization: credential },
  body,
})
console.log(
  `replay     ${replay.status} ${replay.statusText}  (the act-1 credential presented a second time)`,
)
if (replay.status === 200) console.log('           WARNING: a replayed credential was accepted')

const tampered = await fetch(url, {
  method: 'POST',
  headers: { ...headers, authorization: credential },
  body: JSON.stringify({ question: 'A DIFFERENT question the challenge was not bound to' }),
})
console.log(`body-swap  ${tampered.status} ${tampered.statusText}  (same credential, different body)`)

rule('act 4 - the ledger')
const after = { account: await balanceOf(buyer), payer: await balanceOf(payer) }
const burnedAfter = await burnedCredits()
console.log(`payer      ${before.payer} -> ${after.payer} credits`)
console.log(`account    ${before.account} -> ${after.account} credits`)
console.log(
  `burned     ${burnedBefore === null || burnedAfter === null ? '(ledger unreadable)' : `${burnedAfter - burnedBefore} credit(s) this run, ${burnedAfter} total for this plan`}`,
)

if (process.env.KEEP_DELEGATION !== 'yes') {
  const revoked = await fetch(`${cfg.apiBase}/api/v1/delegation/${delegationId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${cfg.subscriberApiKey}` },
  })
  console.log(`delegation revoked (${revoked.status})`)
}
console.log()
