# Paid Web-Search API — pay-as-you-go API key pattern (TypeScript)

A minimal Express service demonstrating a different way to monetize an API for AI agents: **one x402-protected endpoint returns a quota-bearing API key, and the provider does its own metering everywhere else.**

This is the same pattern [Exa](https://exa.ai/docs/integrations/nevermined.md) shipped in production. Agents discover the integration through a static `llms.txt`, autonomously purchase access, and use the returned key against the provider's regular endpoints.

> **Looking for the "settle credits on every request" pattern?** See [`http-simple-agent-ts`](../http-simple-agent-ts/). That tutorial uses Nevermined's `paymentMiddleware`, which charges per-call. This tutorial does the opposite — Nevermined is only in the loop at *purchase* time.

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?logo=discord&logoColor=white)](https://discord.com/invite/GZju2qScKq)

## When to use this pattern

Pick this pattern when:

- You already have an API with its own keys, quotas, and rate limits, and you don't want to change any of that.
- A purchase maps cleanly to a fixed unit: "$7 buys 10,000 requests", "$1 buys 100 searches", etc.
- You want the integration cost to be a single new endpoint.

Pick the **burn-credits middleware** pattern (see `http-simple-agent-ts`) when:

- You want per-call settlement with variable cost.
- You don't have your own metering and want Nevermined to do it.

Both patterns use the same x402 protocol underneath; they differ only in *where* in the request flow the payment happens.

## Architecture

This tutorial ships two endpoints:

- `POST /purchase-key` — **x402-protected.** Returns a provider-issued API key. One successful call = one card charge of the plan price.
- `POST /search` — **gated on `x-api-key`.** Stub web-search results. Decrements the key's quota. When exhausted, returns HTTP 402 with `{ tag: "NO_MORE_CREDITS" }`.

```
┌─────────┐                                  ┌──────────┐                ┌─────────────┐
│  Agent  │                                  │  Server  │                │  Nevermined │
└────┬────┘                                  └────┬─────┘                └──────┬──────┘
     │                                            │                             │
     │  1. payments.x402.getX402AccessToken(...)  │                             │
     │ ─────────────────────────────────────────────────────────────────────────>
     │                                            │                             │
     │  <───────────────────────────  accessToken (signed delegation)  ─────────│
     │                                            │                             │
     │  2. POST /purchase-key                     │                             │
     │     payment-signature: <accessToken>       │                             │
     │ ──────────────────────────────────────────>│                             │
     │                                            │  facilitator.verify(...)    │
     │                                            │ ───────────────────────────>│
     │                                            │  <──── { isValid, payer }   │
     │                                            │                             │
     │                                            │  provisionOrTopUp(payer)    │
     │                                            │  (provider's own bookkeeping)
     │                                            │                             │
     │                                            │  facilitator.settle(...)    │
     │                                            │ ───────────────────────────>│
     │                                            │  <───── { transaction, … } ─│
     │                                            │      one card charge        │
     │                                            │                             │
     │  <─── 200 { apiKey, totalRemaining } ──────│                             │
     │                                            │                             │
     │  3. POST /search  x-api-key: <apiKey>      │                             │
     │ ──────────────────────────────────────────>│                             │
     │  <───── 200 { results, remaining } ────────│                             │
     │                                            │                             │
     │     ... many /search calls later ...       │                             │
     │                                            │                             │
     │  <───── 402 { tag: "NO_MORE_CREDITS" } ────│                             │
     │                                            │                             │
     │  4. Mint a fresh accessToken, POST /purchase-key again → same apiKey,    │
     │     refilled quota, one more card charge.                                │
     │                                            │                             │
```

The provider's quota (`SEARCHES_PER_PURCHASE` in `.env`) is independent of any Nevermined credit balance. **PAYG plans don't have a buyer-side credit balance**: every successful `/purchase-key` call triggers exactly one card charge of the plan price. The 1-credit-per-purchase grant inside Nevermined is just the redemption unit for `settlePermissions` — readers should not think of it as a topped-up balance on the agent side.

## Quick start

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `NVM_API_KEY` — your Nevermined API key from <https://nevermined.app>.
- `NVM_PLAN_ID` — a **pay-as-you-go** plan you've created (fixed price, 1 credit per purchase, redeems 1 credit per settle).
- `NVM_CARD_PM_ID` — the Stripe `pm_...` id of a card you've enrolled in Nevermined. The client uses this for the `nvm:card-delegation` scheme.
- `NVM_SPENDING_LIMIT_CENTS` — at least the plan price (e.g. `100` for a $1 sandbox plan).

The other variables have working defaults.

### 3. Run the server

```bash
yarn agent
```

### 4. Run the demo client in another terminal

```bash
yarn client
```

The client will:

1. Mint an x402 access token via the Nevermined SDK.
2. Call `/purchase-key` and receive an API key.
3. Loop calling `/search` until the provider's quota is exhausted (default 100 calls).
4. Detect the `NO_MORE_CREDITS` 402, mint another token, top up. Same API key is returned with a refilled quota — one more card charge.

## Server code — the interesting half

The protected handler does three things between receiving the token and returning the key.

```typescript
import { Payments, buildPaymentRequired } from '@nevermined-io/payments'

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: 'sandbox',
})

const paymentRequired = buildPaymentRequired(process.env.NVM_PLAN_ID!, {
  endpoint: '/purchase-key',
  httpVerb: 'POST',
  scheme: 'nvm:card-delegation',
})

app.post('/purchase-key', async (req, res) => {
  const token = req.header('payment-signature')
  if (!token) return send402(res)

  // 1. Verify with the Nevermined facilitator — cheap, idempotent,
  //    fails fast on invalid tokens.
  const verification = await payments.facilitator.verifyPermissions({
    paymentRequired,
    x402AccessToken: token,
    maxAmount: 1n,
  })
  if (!verification.isValid || !verification.payer) return send402(res)

  // 2. Settle — the card is charged here. If this fails, return early;
  //    no key has been issued, so the customer is neither charged nor
  //    out a key.
  const settlement = await payments.facilitator.settlePermissions({
    paymentRequired,
    x402AccessToken: token,
    maxAmount: 1n,
    agentRequestId: verification.agentRequestId,
  })
  if (!settlement.success) return res.status(502).json({ tag: 'SETTLEMENT_FAILED', ... })

  // 3. Provision or top up the key for this payer wallet. Last because
  //    it's local, fast, and easy to make idempotent on retry.
  //    `verification.payer` is the buyer's wallet address; same payer →
  //    same record gets topped up, mirroring Exa's behaviour.
  const { record } = provisionOrTopUp(verification.payer, SEARCHES_PER_PURCHASE)

  res
    .setHeader('payment-response', Buffer.from(JSON.stringify(settlement)).toString('base64'))
    .json({ status: 'ok', apiKey: record.apiKey, expiresAt: null })
})
```

Why **verify → settle → provision**? Verify is cheap and goes first to reject bad tokens before doing any real work. Settle is where the money moves: if it fails (declined card, network blip), no key has been issued, so the customer is neither charged nor served — a clean outcome. Provisioning happens last because it's local, fast, and easy to make idempotent. A production provider with a real database should also key its provisioning on the payer wallet (or the settlement transaction hash), so a transient DB error *after* a successful settle can be safely retried instead of leaving the customer paid-but-unserviced.

## API contract

### `POST /purchase-key`

Headers:
- `payment-signature: <x402-token>` (required)

Success (200):

```json
{
  "status": "ok",
  "apiKey": "wsk_…",
  "expiresAt": null,
  "searchesGranted": 100,
  "totalRemaining": 100
}
```

Also includes a `payment-response` header carrying the base64-encoded settlement receipt.

Failure (402): x402 `PaymentRequired` body, plus the same payload base64-encoded in a `payment-required` header.

### `POST /search`

Headers:
- `x-api-key: <wsk_…>` (required)
- `content-type: application/json`

Body: `{ "query": "...", "limit": 5 }`

Success (200): `{ query, results: [...], remaining: <int> }`

Exhausted (402): `{ tag: "NO_MORE_CREDITS", error: "..." }` — the agent's cue to top up via `/purchase-key`.

## Making your service agent-discoverable

This pattern is only useful if agents can *find* the integration on their own. The convention, lifted from Exa: publish a static `llms.txt` linking to a `nevermined.md` integration page on your docs site.

`src/llms-txt-template/` contains both files with `{{PLACEHOLDERS}}` you can fill in for your own service. Drop them at the root of your docs site (so they live at `https://yourservice.example/docs/llms.txt` and `https://yourservice.example/docs/integrations/nevermined.md`) and any LLM that knows the [llms.txt convention](https://llmstxt.org) can discover the integration.

The Nevermined docs cover this in more depth: see the **Use Cases → Agent discoverability** section.

## Project structure

```
web-search-paid-api-ts/
├── src/
│   ├── server.ts                 # Express server with /purchase-key + /search
│   ├── store.ts                  # In-memory payer → { apiKey, quota } map
│   ├── search.ts                 # Stub search results
│   ├── client.ts                 # Demo agent walking the full flow
│   └── llms-txt-template/
│       ├── llms.txt              # Template for the provider's docs root
│       └── nevermined.md         # Template for the integration page
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Scripts

| Script | Description |
| --- | --- |
| `yarn agent` | Run the server (tsx, dev mode) |
| `yarn client` | Run the demo client |
| `yarn build` | Type-check and emit to `dist/` |
| `yarn start:agent` | Run the built server |
| `yarn start:client` | Run the built client |

## Learn more

- [Nevermined documentation](https://docs.nevermined.io)
- [Use case: monetizing paid APIs for agents](https://docs.nevermined.io/docs/use-cases/monetize-paid-apis-for-agents)
- [x402 protocol specification](https://github.com/coinbase/x402)
- [Exa's live integration](https://exa.ai/docs/integrations/nevermined.md) — production reference
