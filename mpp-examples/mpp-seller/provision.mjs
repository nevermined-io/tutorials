/**
 * Step 1 — the BUILDER registers a credits plan and a dummy agent, and records
 * the pair in `.demo-state.json` so the agent and the buyer can find them.
 *
 * The plan is free (`getFreePriceConfig`) on purpose: this tutorial is about the
 * MPP handshake and the credit burn, and a priced plan would need the buyer to
 * hold testnet USDC before anything else could be shown.
 */
import { Payments, PlanRedemptionType } from '@nevermined-io/payments'
import { accountOf, loadConfig, readState, writeState } from './lib/config.mjs'

/**
 * Retries `fn` while the backend answers `code`, which here always means "the
 * chain has not caught up yet" rather than "the request was wrong".
 */
async function withRetry(code, fn, attempts = 6, delayMs = 3000) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (error?.code !== code || attempt >= attempts) throw error
      console.log(`           ${code} - retrying in ${delayMs / 1000}s (${attempt}/${attempts - 1})`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

const cfg = loadConfig()
const payments = Payments.getInstance({ nvmApiKey: cfg.builderApiKey })

const existing = readState()
if (existing?.planId && process.env.FORCE_PROVISION !== 'yes') {
  console.log(`already provisioned — plan ${existing.planId}, agent ${existing.agentId}`)
  console.log('re-run with FORCE_PROVISION=yes to publish a fresh pair')
  process.exit(0)
}

console.log(`builder    ${accountOf(cfg.builderApiKey)}`)
console.log(`api        ${cfg.apiBase}`)
console.log(`endpoint   ${cfg.agentUrl}`)

const priceConfig = payments.plans.getFreePriceConfig()
const creditsConfig = payments.plans.setRedemptionType(
  payments.plans.getFixedCreditsConfig(BigInt(cfg.creditsGranted), BigInt(cfg.credits)),
  PlanRedemptionType.ONLY_SUBSCRIBER,
)

const plan = await payments.plans.registerCreditsPlan(
  {
    name: `MPP demo plan ${new Date().toISOString().slice(0, 16)}`,
    description: `Credits plan protecting the dummy MPP agent. ${cfg.creditsGranted} credits per purchase, ${cfg.credits} per request.`,
    tags: ['demo', 'mpp'],
  },
  priceConfig,
  creditsConfig,
)
const planId = plan.planId ?? plan.data?.planId
if (!planId) throw new Error(`plan registration returned no planId: ${JSON.stringify(plan)}`)
console.log(`plan       ${planId}`)

// The plan is registered on-chain asynchronously, so an agent created in the
// same breath can be refused with `BCK.PROTOCOL.0055` ("Payment plan does not
// exist on-chain") — a race, not a bad request. Observed once in three runs.
const agent = await withRetry('BCK.PROTOCOL.0055', () =>
  payments.agents.registerAgent(
    {
      name: `MPP demo agent ${new Date().toISOString().slice(0, 16)}`,
      description: 'Dummy agent protected by the Nevermined MPP Express middleware.',
      tags: ['demo', 'mpp'],
    },
    {
      endpoints: [{ POST: cfg.agentUrl }],
      openEndpoints: [],
      authType: 'none',
    },
    [planId],
  ),
)
const agentId = agent.agentId ?? agent.data?.agentId
if (!agentId) throw new Error(`agent registration returned no agentId: ${JSON.stringify(agent)}`)
console.log(`agent      ${agentId}`)

writeState({
  apiBase: cfg.apiBase,
  builder: accountOf(cfg.builderApiKey),
  planId,
  agentId,
  agentUrl: cfg.agentUrl,
  credits: cfg.credits,
  provisionedAt: new Date().toISOString(),
})
console.log(`state      ${new URL('.demo-state.json', import.meta.url).pathname}`)
