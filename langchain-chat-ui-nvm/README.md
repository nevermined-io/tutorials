# langchain-chat-ui-nvm

A LangGraph chat UI with **Nevermined x402** payment protection in front of the agent. The user authorizes a card delegation once via a popup, picks a budget (e.g. $10 / 24h), then chats freely until the budget runs out — every backend call is paid for transparently via the x402 protocol.

Fork of [`langchain-ai/agent-chat-ui`](https://github.com/langchain-ai/agent-chat-ui) (MIT, Copyright (c) 2025 Brace Sproul). See [`LICENSE`](./LICENSE) for the dual-attribution MIT license.

This is the **Sprint 5** deliverable of the LangChain integration epic — see [`nvm-monorepo#1781`](https://github.com/nevermined-io/nvm-monorepo/issues/1781) and the parent epic [`#1703`](https://github.com/nevermined-io/nvm-monorepo/issues/1703).

## What this adds on top of agent-chat-ui

| Surface | What changed |
|---|---|
| `src/app/api/[..._path]/route.ts` | Replaces `langgraph-nextjs-api-passthrough` with a 402-aware proxy that injects `payment-signature` from a `httpOnly` cookie and preserves `payment-required` / `payment-response` headers on the way back. |
| `src/app/api/x402/session/route.ts` | New — mints a self-mint widget session via `POST /api/v1/widgets/session/self` ([nvm-monorepo#1716](https://github.com/nevermined-io/nvm-monorepo/pull/1716)). |
| `src/app/api/x402/token/route.ts` | New — exchanges a `delegationId` for an x402 access token via `payments.x402.getX402AccessToken` (pattern B in `@nevermined-io/payments`), stores it in a `httpOnly` cookie. |
| `src/app/api/x402/init/route.ts` | New — exposes plan metadata + token-presence to the client at mount time. |
| `src/app/x402-callback/page.tsx` | New — popup target for the Nevermined white-label flow. Validates the CSRF `state` nonce and `postMessage`s the result to `window.opener`. |
| `src/hooks/useNvmPayment.tsx` | New — drives the popup + token-mint flow. |
| `src/components/thread/payment-banner.tsx` | New — always-visible status pill: "Authorize" → "Card delegation active" → "Reset delegation". |

The `NVM_API_KEY` never leaves the Next.js server. The browser only sees the short-lived widget `sessionToken` and never holds the x402 access token directly (cookie is `httpOnly`).

## Prerequisites

- [`Node.js`](https://nodejs.org) ≥ 20 and [`pnpm`](https://pnpm.io) ≥ 10.
- A Nevermined account at https://nevermined.app with:
  - An **API key** (Settings → API Keys).
  - An **organization id** you're a member of (Settings → Organizations).
  - A **plan** you've published, with at least one fiat or crypto payment route configured.
- A LangGraph agent gated by `payments_py.langsmith.PaymentMiddleware`. The companion tutorial [`langchain-langsmith-deployment-py`](https://github.com/nevermined-io/tutorials/tree/main/langchain-langsmith-deployment-py) (Sprint 3) provides one — clone and run it before starting this UI.

## Setup

```bash
git clone https://github.com/nevermined-io/tutorials.git
cd tutorials/langchain-chat-ui-nvm
pnpm install
cp .env.example .env.local
# Fill in NVM_API_KEY, NVM_ORG_ID, NVM_PLAN_ID
```

In a second terminal, start the Sprint 3 agent:

```bash
cd ../langchain-langsmith-deployment-py
poetry install
poetry run langgraph dev   # serves at http://127.0.0.1:2024
```

Back in the chat UI directory, start the dev server:

```bash
pnpm dev   # http://localhost:3000
```

## The flow

1. Open `http://localhost:3000`. The top banner reads **"Authorize a card delegation to chat with this paid agent"**.
2. Click **Authorize**. A popup opens at `{nevermined.app}/embed/cards/setup?sessionToken=…`.
3. Enrol a card if you haven't already, then pick a spending limit + duration. Submit.
4. The popup redirects to `/x402-callback`, validates the CSRF nonce, posts the `delegationId` back to the chat UI, and closes itself.
5. The chat UI mints an x402 access token from the delegation and stores it in a `httpOnly` cookie. The banner flips to **"Card delegation active"**.
6. Type a message and send. The proxy injects `payment-signature` from the cookie; the agent's middleware verifies, runs, settles, and returns `200 OK` with a `payment-response` settlement receipt header. The chat reply streams back.
7. Subsequent messages reuse the same delegation until the on-chain budget exhausts. After that, the next request returns 402 and the user clicks Authorize again.

To start fresh, click **Reset delegation** on the banner — it clears the cookie. The on-chain delegation itself stays valid until its duration expires; revoke it at https://nevermined.app if you want it gone.

## Architecture

```
                   ┌────────────────────────────────────────┐
                   │  Browser  (chat UI, port 3000)         │
                   │   useStream → /api/threads/.../runs    │
                   │   PaymentBanner → useNvmPayment        │
                   └─┬────────────────────────────────────┬─┘
                     │                                    │ popup
                     ▼                                    ▼
       ┌─────────────────────────┐         ┌─────────────────────────┐
       │ Next.js server (3000)   │         │ Nevermined frontend     │
       │ /api/x402/session       │         │ /embed/cards/setup      │
       │ /api/x402/token         │  ←→     │ (popup)                 │
       │ /api/x402/init          │         └─────────────┬───────────┘
       │ /api/[..._path]  proxy  │                       │ redirect
       │  └─ injects             │                       ▼
       │     payment-signature   │         ┌─────────────────────────┐
       └─────┬───────────────────┘         │ /x402-callback          │
             │                              │ (popup target)          │
             ▼                              │ window.opener.postMsg   │
       ┌─────────────────────────┐         └─────────────────────────┘
       │ LangGraph agent (2024)  │
       │ + payments_py.langsmith │
       │   PaymentMiddleware     │
       └─────────────────────────┘
```

## Limitations (MVP)

- **Single plan.** The chat UI assumes one `NVM_PLAN_ID`. Multi-plan agents would need a server-side plan resolver per route.
- **No auto-retry on 402.** If the user sends a message before authorizing, they get an error toast — they must click Authorize and re-type. Auto-retry tracked as a follow-up.
- **Local-only `returnUrl`.** The self-mint widget session (`POST /widgets/session/self`) restricts `returnUrl` to `localhost` / `127.0.0.1`. Deploying to a real domain requires the widget-key flow instead (out of scope for this demo).
- **Streaming responses are buffered.** Inherited from the Sprint 3 middleware — the agent's `payment-response` header is attached only after the response body completes.
- **No chat-UI-level auth.** A single `NVM_API_KEY` in the Next.js server env powers everything. Multi-user demos need an auth layer in front.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Missing required environment variable NVM_API_KEY` | `.env.local` not populated. Restart `pnpm dev` after editing. |
| `BCK.WIDGET_SESSION.0019` from `/api/x402/session` | Your `NVM_API_KEY` user is not a member of `NVM_ORG_ID`. |
| Popup blocked | Allow popups for `localhost:3000` in browser settings. The hook surfaces a clear error. |
| `state_mismatch` in callback | The CSRF nonce in `sessionStorage` was cleared between popup open and callback. Try again. |
| `delegationConfig is required for nvm:erc4337 token generation` | Sanity check — only fires if you bypass the popup and POST `/api/x402/token` directly without a `delegationId`. |
| Agent returns 402 forever after authorizing | Either the plan's payment-method requirements don't match your enrolled card, or the delegation's budget already ran out. Check the Sprint 3 agent logs. |

## License

MIT, dual attribution to Brace Sproul (upstream `agent-chat-ui`) and Nevermined AG (x402 integration). See [`LICENSE`](./LICENSE).
