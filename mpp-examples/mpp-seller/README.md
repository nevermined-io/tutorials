# MPP Seller — a paid agent bought by a second account

A complete, two-account run of the **Machine Payments Protocol (MPP)**: an ordinary
Express service becomes a paid agent by adding one middleware, is published to the
Nevermined catalog, and is then bought and called by a **different** account — with no
MPP secret on the seller and no protocol code on the buyer.

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?logo=discord&logoColor=white)](https://discord.com/invite/GZju2qScKq)

Nothing here is mocked. It runs against the deployed sandbox API, publishes a real plan
and a real agent, and burns real credits. The plan is free, so no testnet USDC is needed.

## What You'll Learn

- Protect an Express route with `paymentMiddleware` and `mpp: { bindBody: true }`
- Read an MPP `402` challenge off `WWW-Authenticate` and answer it with a credential
- Do the same thing in one call with `payments.mpp.fetch`
- See why a credential is single-use, and why it cannot be moved to another request body
- Tell your account address from your spend address, and know which one holds the credits

## MPP payment flow

```
┌─────────┐                                  ┌─────────┐            ┌────────────┐
│  Buyer  │                                  │  Seller │            │ Nevermined │
└────┬────┘                                  └────┬────┘            └─────┬──────┘
     │                                            │                       │
     │  1. POST /ask (no credential)              │                       │
     │───────────────────────────────────────────>│  mint challenge       │
     │                                            │──────────────────────>│
     │  2. 402 + WWW-Authenticate: Payment id=…   │                       │
     │<───────────────────────────────────────────│                       │
     │                                            │                       │
     │  3. buildCredentialHeader(challenge, token)                        │
     │                                            │                       │
     │  4. POST /ask + Authorization: Payment …   │                       │
     │───────────────────────────────────────────>│  verify + burn        │
     │                                            │──────────────────────>│
     │  5. 200 OK + Payment-Receipt               │                       │
     │<───────────────────────────────────────────│                       │
```

The seller never mints a challenge and never burns a credit itself: the middleware
forwards opaque strings to the Nevermined API, which does both. That is why a seller
needs no MPP secret of its own.

## Prerequisites

- Node.js 20+
- **Two Nevermined accounts** in the same environment, each with an API key
  (https://nevermined.app → Settings → API keys). One publishes, one buys — the tutorial
  refuses to run if the two keys are identical.

## Quick Start

```bash
# Install
npm install            # or: yarn install

# Configure
cp .env.example .env   # then fill in the two API keys

# Verify the offline guards (no network, no credentials, nothing written)
npm run selfcheck

# Run everything: provision (once) + serve + buy + tear down
./demo.sh
```

To publish a fresh plan/agent pair instead of reusing the one in `.demo-state.json`:

```bash
FORCE_PROVISION=yes ./demo.sh
```

Or drive the three steps yourself, in three terminals:

```bash
npm run provision      # account A: register the plan + the agent
npm run agent          # account A: serve the paid endpoint on :8790
npm run client         # account B: buy the plan and call the agent
```

## Project Structure

| File            | Who it is             | What it does                                                                |
| --------------- | --------------------- | --------------------------------------------------------------------------- |
| `provision.mjs` | builder (account A)   | Registers a free credits plan and a dummy agent; writes `.demo-state.json`. |
| `agent.mjs`     | builder (account A)   | The paid agent. `paymentMiddleware` with `mpp: { bindBody: true }`.         |
| `client.mjs`    | subscriber (account B)| Delegation, plan order, the MPP handshake, the negatives, the ledger.       |
| `demo.sh`       | —                     | Runs all three and prints the seller log.                                   |
| `selfcheck.mjs` | —                     | The guards, offline.                                                        |

## How It Works

### 1. The seller — one middleware, no protocol code

```javascript
app.use(express.json({ verify: captureRawBody }))

app.use(
  paymentMiddleware(payments, {
    'POST /ask': {
      planId: state.planId,
      agentId: state.agentId,
      credits: 1,
      mpp: { bindBody: true },
    },
  }),
)
```

`bindBody: true` binds the challenge to a digest of the request body. `captureRawBody` is
required for it: re-serializing `req.body` would not reproduce the bytes the buyer sent,
so the digest would never match.

### 2. The buyer — the raw wire

```javascript
const unpaid = await fetch(url, { method: 'POST', headers, body })       // 402
const challenge = parseChallengeHeader(unpaid.headers.get('www-authenticate'))
const credential = buildCredentialHeader(challenge, { accessToken })
const paid = await fetch(url, {                                          // 200
  method: 'POST',
  headers: { ...headers, authorization: credential },
  body,
})
parseReceiptHeader(paid.headers.get('payment-receipt'))
```

### 3. The buyer — the same thing, in one call

```javascript
const result = await payments.mpp.fetch(
  url,
  { method: 'POST', headers, body },
  { delegationConfig: { delegationId }, planId, maxCredits: 4 },
)
// result.paid / result.settled / result.credentialsPresented / result.creditsPresented
```

`payments.mpp.fetch` runs the whole 402-retry cycle behind one call. This is what a buyer
actually writes; act 1 exists only to show what it does.

## What the run proves

1. **The seller holds no MPP secret.** `agent.mjs` never mints a challenge.
2. **An unpaid request is challenged** — `402` with `WWW-Authenticate: Payment id="…"`.
3. **The credential pays** — `200` with a `Payment-Receipt` naming the challenge id.
4. **The buyer needs no protocol code** — `payments.mpp.fetch` reports
   `paid / settled / credentialsPresented / creditsPresented`.
5. **A credential is single-use.** Replaying it is re-challenged, not served.
6. **The challenge is bound to the body.** The same credential with a different body is
   refused — `bindBody: true` plus `captureRawBody` doing their job.
7. **The credits actually burn**, one per request, against the buyer's own ledger.

[`TRANSCRIPT.md`](./TRANSCRIPT.md) is a real, unedited run.

## Two things that will bite you

**You have two addresses, and only one of them holds credits.** Your API key's `sub` is
your **account** address: `plans.orderPlan` credits it, and every x402/MPP burn is charged
against it. The address inside a minted access token — `payerOf()` in `lib/config.mjs`
extracts it, act 4 prints it — is your **spend** account, the wallet that signs the
payment authorisation. It normally holds no credits at all. Read the balance for that one
and a run that burned credits reports `0 -> 0` while nothing looks wrong.

**`registerAgent` can lose a race with `registerPlan`.** The plan is written on-chain
asynchronously, so an agent created in the same breath is sometimes refused with
`BCK.PROTOCOL.0055` ("Payment plan does not exist on-chain"). It is a race, not a bad
request — `provision.mjs` retries that one code and nothing else.

## Environment Variables

| Variable                   | Required | Default                    | Purpose                                        |
| -------------------------- | -------- | -------------------------- | ---------------------------------------------- |
| `BUILDER_NVM_API_KEY`      | yes      | —                          | Account A: publishes the plan and the agent.   |
| `SUBSCRIBER_NVM_API_KEY`   | yes      | —                          | Account B: buys the plan and calls the agent.  |
| `NVM_API_BASE`             | no       | derived from the key prefix| Point at a different deployment.               |
| `PORT`                     | no       | `8790`                     | Port the agent listens on.                     |
| `AGENT_URL`                | no       | `http://localhost:$PORT/ask` | The endpoint registered in the catalog.      |
| `CREDITS_GRANTED`          | no       | `20`                       | Credits minted per plan purchase.              |
| `CREDITS`                  | no       | `1`                        | Credits burned per request.                    |
| `DELEGATION_LIMIT_CENTS`   | no       | `5000`                     | The buyer's spend cap.                         |
| `DELEGATION_DURATION_SECS` | no       | `3600`                     | How long that mandate lives.                   |
| `FORCE_PROVISION`          | no       | —                          | `yes` publishes a fresh plan/agent pair.       |
| `KEEP_DELEGATION`          | no       | —                          | `yes` keeps the delegation instead of revoking.|

The API base is **derived from the key prefix** — `sandbox:` resolves to
`api.sandbox.nevermined.app` — so nothing has to be configured by hand.

If you would rather keep the keys out of the project directory, put them in
`~/.nvm-mpp-demo.json` instead of `.env` (override the path with `DEMO_FILE`):

```bash
umask 077 && cat > ~/.nvm-mpp-demo.json <<'JSON'
{
  "builderApiKey": "sandbox:…",
  "subscriberApiKey": "sandbox:…"
}
JSON
```

## Safety

- **A live API key is refused outright**, whatever the deployment, and so is a live API
  base. This tutorial publishes real rows and creates a real spend mandate; on `sandbox`
  that costs nothing, on `live` it is real money.
- Provisioning writes real rows wherever it is pointed, and those count against the
  account's tier caps (10 plans, 20 agents). `FORCE_PROVISION=yes` publishes a new pair
  on **every** run — re-run without it to reuse the pair in `.demo-state.json`.
- The buyer's delegation is a live spend mandate ($50 for an hour by default) and is
  revoked at the end of every run. `KEEP_DELEGATION=yes` keeps it.

## Troubleshooting

| Symptom                                            | Cause                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `the builder and subscriber keys are identical`     | Both keys are the same account. MPP needs a seller and a *different* buyer.  |
| `BCK.PROTOCOL.0055` on provision                    | The plan is not on-chain yet. `provision.mjs` retries; it resolves in ~3–18s.|
| `no .demo-state.json`                               | Run `npm run provision` first — the agent reads the plan/agent ids from it.  |
| A balance that never moves                          | You read the payer (spend) address; credits live on the account address.    |
| `402` on **every** request, including the paid one  | The body was re-serialized between challenge and call — `bindBody` digest.   |

## Documentation

- [Nevermined Documentation](https://nevermined.ai/docs)
- [Nevermined Payments SDK](https://github.com/nevermined-io/payments)
