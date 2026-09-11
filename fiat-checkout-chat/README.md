# Fiat Checkout Chat — pay a merchant by card, no account

A minimal **Next.js** chat UI + thin merchant backend that shows the Nevermined
**Orders** flow (epic [#3238](https://github.com/nevermined-io/nvm-monorepo/issues/3238), Phase 1):

> A web consumer with **no Nevermined account and no API key** pays a merchant an
> arbitrary **fiat** amount by **card via Stripe**, entirely in the browser.

The merchant is an **organization**. It creates the order server-side with its
Nevermined API key, then the buyer just pays a hosted Stripe form embedded in the
chat — no login, no wallet, no crypto.

## What this demonstrates

1. **A no-API-key buyer pays fiat by card.** The buyer never authenticates to
   Nevermined. They enter a card in a hosted checkout and that's it.
2. **The organization sets it up.** The org holds a Nevermined API key and calls
   `POST /api/v1/orders` to create a payable order. That key is a secret and lives
   only in the merchant backend.
3. **The chat flow** (below) mounts the hosted checkout inline and confirms the
   booking when the payment succeeds.

## The flow

```
 ┌─ browser ──────────────────────────────────────────────┐
 │ 1. "I want to book the Barcelona trip"                  │
 │           │                                             │
 │           ▼                                             │
 │    POST /api/orders { packageId }   ── your backend ──┐ │
 │                                                       │ │
 │  ┌─ merchant backend (Next.js route, holds ORG KEY) ─▼┐│
 │  │ 2. POST {NVM_API}/api/v1/orders  (Bearer ORG_KEY)  ││
 │  │    { amountMinor, currency, description }          ││
 │  │ 3. → { orderId, clientSecret, status }             ││
 │  └────────────────────────┬───────────────────────────┘│
 │           ┌───────────────┘ returns { orderId }         │
 │           ▼                                             │
 │ 4. <iframe src="{EMBED}/checkout/order/{orderId}        │
 │             ?parentOrigin={chat origin}">               │
 │ 5. buyer pays with 4242 4242 4242 4242 inside iframe    │
 │ 6. iframe postMessage → { type:'nvm:success', payload } │
 │    parent verifies event.origin, shows "booked!" card   │
 └─────────────────────────────────────────────────────────┘
```

## Architecture rules (why it's safe)

- **The org API key never reaches the browser.** It is read only inside
  [`src/app/api/orders/route.ts`](src/app/api/orders/route.ts) (a server route).
  The browser calls *your* `/api/orders`; your backend calls the Nevermined API.
- **The browser never names the price.** The chat sends only a `packageId`; the
  server looks the amount up in [`src/lib/packages.ts`](src/lib/packages.ts). A
  tampered client can't pay less.
- **The success message is verified.** The `message` listener in
  [`src/app/chat.tsx`](src/app/chat.tsx) trusts a `nvm:success` event **only** when
  `event.origin === NVM_EMBED_BASE_URL`, `event.data.type === 'nvm:success'`, **and**
  `event.data.version === '1'`. This mirrors the `origin` + envelope checks
  `@nevermined-io/ui-widgets` performs in its `parseMessage` — done here as a plain
  iframe so the whole mechanism is visible. (Its higher-level `startOrder()` helper is
  planned but not yet shipped, which is why this tutorial wires the iframe directly.)
- **`clientSecret` stays server-side.** The hosted checkout fetches the order itself
  via the no-auth `GET /orders/:id`, so the backend deliberately does **not** forward
  `clientSecret` to the chat.

> ⚠️ **The `nvm:success` message is a UX signal, not proof of settlement.** The
> origin/version checks make the *message* trustworthy; they don't make the *payment*
> final. Upstream, an Order only reaches `paid` via Stripe's `payment_intent.succeeded`
> **webhook** — a 3DS step-up, a late decline, or a closed tab can all leave this card
> ahead of the money. This demo shows the buyer-facing flow only. **A production
> merchant must fulfil (book the trip, send the itinerary) on the webhook or a
> server-side status read — never on this browser event.**

## Prerequisite: the Nevermined Orders backend

Orders (epic [#3238](https://github.com/nevermined-io/nvm-monorepo/issues/3238)) is
now deployed in **sandbox** — both the `POST/GET /api/v1/orders` **API** and the
hosted embed checkout route `/checkout/order/:orderId`
([#3249](https://github.com/nevermined-io/nvm-monorepo/issues/3249)). So you don't
need to run anything locally: point the two URLs at the deployed sandbox endpoints
and only the org key is yours to supply.

| Variable | Sandbox value | What it is |
|---|---|---|
| `NVM_API_BASE_URL` | `https://api.sandbox.nevermined.app` | serves `POST/GET /api/v1/orders` |
| `NVM_EMBED_BASE_URL` | `https://embed.nevermined.app` | the hosted Stripe form the chat iframes |

You still need a provisioned **merchant org**: an active organization with a
**validated Stripe Connect account** and an **org-scoped API key** with ordering
enabled (`canOrder`) — that is your `NVM_ORDER_API_KEY`.

<details>
<summary>Alternative: run the whole stack locally from <code>nvm-monorepo</code></summary>

You can also run the backend yourself — three things listening:

| Service | Port | What it is |
|---|---|---|
| Nevermined API | `3001` | serves `POST/GET /api/v1/orders` |
| Hosted embed checkout | `4250` | the Stripe form the chat iframes |
| Embed config server | `3000` | serves `/api/config` (Stripe publishable key, URLs) |

Then set `NVM_API_BASE_URL=http://localhost:3001` and
`NVM_EMBED_BASE_URL=http://localhost:4250`. See the epic and the `nvm-monorepo` run
docs for the build/migrate/seed steps. (Gotcha: the embed's dev server needs the
runtime `dist` of `@nevermined-io/commons`, `core-kit` and `ui-widgets` built first,
or it renders "Couldn't load the widget".)

</details>

Sanity-check the backend before running the chat:

```bash
curl -sX POST "$NVM_API_BASE_URL/api/v1/orders" \
  -H "Authorization: Bearer $NVM_ORDER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"amountMinor":343795,"currency":"usd","description":"Barcelona trip"}'
# → { "orderId": "ord_…", "status": "requires_payment", "clientSecret": "pi_…_secret_…" }
```

## Run the chat

```bash
# 1. install
pnpm install            # or npm install / yarn

# 2. configure — copy the example and paste your ORG key (never commit .env.local)
cp .env.example .env.local
#   NVM_ORDER_API_KEY   = the organization's Nevermined API key (SECRET)
#   NVM_API_BASE_URL    = https://api.sandbox.nevermined.app  (the Orders API)
#   NVM_EMBED_BASE_URL  = https://embed.nevermined.app        (the hosted checkout origin)

# 3. run  (http://localhost:3200)
pnpm dev                # or: pnpm build && pnpm start
```

Open **http://localhost:3200**, pick a trip (or type *"I want to book the Barcelona
trip"*), and pay in the embedded form with Stripe's test card:

- **Card**: `4242 4242 4242 4242`
- **Expiry**: any future date · **CVC**: any 3 digits · **ZIP**: any

The chat replaces the form with a green **"Payment confirmed — booked!"** card
carrying the Stripe `paymentIntent` id.

## Environment variables

All three are **server-side only** — none is `NEXT_PUBLIC_*`, so nothing here ships
to the browser bundle.

| Variable | Example | Notes |
|---|---|---|
| `NVM_ORDER_API_KEY` | `sandbox:…` | **Secret.** The org's Nevermined API key. Only used in `/api/orders`. |
| `NVM_API_BASE_URL` | `https://api.sandbox.nevermined.app` | The Nevermined API the backend calls (`http://localhost:3001` for a local stack). |
| `NVM_EMBED_BASE_URL` | `https://embed.nevermined.app` | Origin of the hosted checkout; also the value the success listener checks `event.origin` against (`http://localhost:4250` for a local stack). |

## The Orders API contract

- **`POST /api/v1/orders`** — `Authorization: Bearer <ORG_API_KEY>`.
  Body `{ amountMinor: <int USD cents 100..99_999_999>, currency: "usd",
  description?: string, buyerRef?: string, idempotencyKey?: string }` →
  `201 { orderId, clientSecret, status: "requires_payment" }`. A retried create with
  the same `idempotencyKey` returns the **same** Order + `clientSecret` instead of a
  new PaymentIntent — this backend passes one (`<session>:<packageId>`); a production
  merchant keys it on its own order id. Errors: `BCK.ORDER.0003` (caller not an active
  org), `0004` (org has no validated Connect account), `0001` (bad amount/currency).
- **`GET /api/v1/orders/:id`** — no auth (the id is the access control). Returns the
  buyer-safe projection `{ id, amountMinor, currency, status, amountRefundedMinor,
  description, buyerRef, merchantName, paymentIntentId, expiresAt, clientSecret? }`.
  The merchant's **internal identity and economics** (`merchantOrgId`, `merchantUserId`,
  `feeAmountMinor`) are intentionally **withheld** from this unauthenticated read;
  `merchantName` is the display name the checkout shows as the payee. The hosted
  checkout consumes this endpoint; the chat does not need to.

## Files

```
fiat-checkout-chat/
├── src/app/api/orders/route.ts   # merchant backend — the ONLY holder of the org key
├── src/app/page.tsx              # server component; passes the embed origin to the client
├── src/app/chat.tsx              # the chat UI + iframe + verified postMessage listener
├── src/lib/packages.ts           # server-owned catalog (prices live here, not the client)
├── src/app/globals.css           # on-brand styling
└── .env.example
```

## License

Apache-2.0 · © 2025 Nevermined AG
