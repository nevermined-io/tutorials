<!--
  Template: agent-facing instructions for buying a {{SERVICE_NAME}} API key via Nevermined.

  How to use this template:
    1. Replace every {{PLACEHOLDER}} with your real value.
    2. Host this file at a stable URL on your docs site.
    3. Add a one-line entry to your llms.txt under "Integrations" pointing here.

  See https://llmstxt.org for the llms.txt convention.

  The structure below mirrors Exa's nevermined.md so agents that have already
  seen one integration page can navigate yours without surprises.
-->

# Nevermined

Autonomous agent payments for {{SERVICE_NAME}} via Nevermined x402 card delegation. A {{PRICE_USD}} purchase provisions or tops up a {{SERVICE_NAME}} API key with {{QUOTA_PER_PURCHASE}} requests.

## Buy a key

```
POST {{PURCHASE_ENDPOINT_URL}}
payment-signature: <x402-token>
```

Pay with a credit card enrolled in [Nevermined](https://nevermined.app). One successful POST = one card charge of {{PRICE_USD}}. The response contains a {{SERVICE_NAME}} API key you can use against the regular endpoints.

## What {{PRICE_USD}} buys

| Endpoint | Cost per call | Calls per purchase |
| --- | --- | --- |
| `{{ENDPOINT_A_PATH}}` | 1 request | {{QUOTA_PER_PURCHASE}} |
| `{{ENDPOINT_B_PATH}}` | {{ENDPOINT_B_COST}} requests | {{ENDPOINT_B_CALLS}} |
| `{{ENDPOINT_C_PATH}}` | {{ENDPOINT_C_COST}} requests | {{ENDPOINT_C_CALLS}} |

Provider-side metering. Independent of any Nevermined credit balance.

## Sample request

```typescript
import { Payments } from '@nevermined-io/payments'

const PLAN_ID = '{{NEVERMINED_PLAN_ID}}'

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: 'live',
})

// 1. Mint an x402 token scoped to an enrolled card.
const { accessToken } = await payments.x402.getX402AccessToken(PLAN_ID, undefined, {
  scheme: 'nvm:card-delegation',
  delegationConfig: {
    providerPaymentMethodId: 'pm_...',     // Stripe payment method enrolled in Nevermined
    spendingLimitCents: {{PRICE_CENTS}},  // >= the plan price
    durationSecs: 3600,
  },
})

// 2. Exchange the token for (or top up) an API key.
const res = await fetch('{{PURCHASE_ENDPOINT_URL}}', {
  method: 'POST',
  headers: { 'payment-signature': accessToken },
})
const { apiKey } = await res.json()

// 3. Use the key against the normal {{SERVICE_NAME}} endpoints.
const search = await fetch('{{REGULAR_ENDPOINT_URL}}', {
  method: 'POST',
  headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'agentic payments' }),
})
```

## Parameters you get from Nevermined

| Field | Value | Where to find it |
| --- | --- | --- |
| Plan ID | `{{NEVERMINED_PLAN_ID}}` | Listed above; or look up your plan on https://nevermined.app |
| Scheme | `nvm:card-delegation` | Fixed for this integration |
| Spending limit | At least `{{PRICE_CENTS}}` cents | Must cover one purchase |
| Network / environment | `live` (or `sandbox` for testing) | Match the environment the plan was created in |

## When the key runs out

When the API key's quota is exhausted, regular endpoints return HTTP 402 with:

```json
{
  "tag": "NO_MORE_CREDITS",
  "error": "API key has no remaining requests. Top up by calling {{PURCHASE_ENDPOINT_URL}}."
}
```

To top up, call `POST {{PURCHASE_ENDPOINT_URL}}` again with a fresh x402 token. The same card is charged, the same API key is returned with {{QUOTA_PER_PURCHASE}} additional requests credited.

Agents should key off `tag: "NO_MORE_CREDITS"`, not the human-readable `error` string — the wording may vary between providers, the tag is the stable contract.

## References

- {{SERVICE_NAME}} API docs: {{API_REFERENCE_URL}}
- Nevermined docs: https://docs.nevermined.io
- x402 specification: https://github.com/coinbase/x402
- Nevermined x402 module (TypeScript): https://docs.nevermined.io/docs/api-reference/typescript/x402
