/**
 * Step 2 — the paid agent (the SELLER).
 *
 * An ordinary Express app whose only payment code is `paymentMiddleware`. It
 * holds no MPP secret: the middleware forwards opaque strings to the Nevermined
 * API, which mints the challenge and burns the credits.
 *
 * `mpp: { bindBody: true }` binds the challenge to a digest of the request body,
 * which is why the JSON parser runs with `verify: captureRawBody` — re-serializing
 * `req.body` would not reproduce the bytes the buyer sent.
 */
import { Payments } from '@nevermined-io/payments'
import { captureRawBody, paymentMiddleware } from '@nevermined-io/payments/express'
import express from 'express'
import { accountOf, loadConfig, readState } from './lib/config.mjs'

const cfg = loadConfig({ requireSubscriber: false })
const state = readState()
if (!state?.planId) throw new Error('no .demo-state.json — run `yarn provision` first')

const payments = Payments.getInstance({ nvmApiKey: cfg.builderApiKey })
const app = express()

app.use(express.json({ verify: captureRawBody }))

app.use((req, _res, next) => {
  const credential = req.headers.authorization ? 'Authorization: Payment …' : '(no credential)'
  console.log(`[seller] <- ${req.method} ${req.url}  ${credential}`)
  next()
})

app.use(
  paymentMiddleware(
    payments,
    {
      'POST /ask': {
        planId: state.planId,
        agentId: state.agentId,
        credits: cfg.credits,
        description: 'Dummy MPP-protected agent',
        mimeType: 'application/json',
        mpp: { bindBody: true },
      },
    },
    {
      onPaymentError: (error) => console.log(`[seller] payment refused: ${error.message}`),
      onAfterSettle: (_req, creditsUsed) =>
        console.log(`[seller] settled ${creditsUsed} credit(s) against plan ${state.planId}`),
    },
  ),
)

app.post('/ask', (req, res) => {
  const question = req.body?.question ?? '(none)'
  console.log(`[seller] -> answering "${question}"`)
  res.json({
    answer: `You asked "${question}". This agent is a dummy: it only proves the payment happened.`,
    agentId: state.agentId,
    servedAt: new Date().toISOString(),
  })
})

app.get('/health', (_req, res) => res.json({ ok: true, planId: state.planId }))

app.listen(cfg.port, () => {
  console.log(`[seller] account  ${accountOf(cfg.builderApiKey)}`)
  console.log(`[seller] plan     ${state.planId}`)
  console.log(`[seller] agent    ${state.agentId}`)
  console.log(
    `[seller] listening on http://localhost:${cfg.port}/ask (POST, ${cfg.credits} credit(s))`,
  )
})
