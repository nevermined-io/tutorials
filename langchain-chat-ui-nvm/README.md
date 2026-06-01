# langchain-chat-ui-nvm

A LangGraph chat UI for a **freemium market-research agent** gated by **Nevermined x402**. Users chat freely with the agent to discover what it does; when they ask it to actually perform research, the agent's tool checks for a Nevermined payment, prompts the user to authorize a card delegation, and on retry verifies + analyses + settles credits in one round-trip.

Fork of [`langchain-ai/agent-chat-ui`](https://github.com/langchain-ai/agent-chat-ui) (MIT, Copyright (c) 2025 Brace Sproul). See [`LICENSE`](./LICENSE) for the dual-attribution MIT license.

Pairs with the [`langchain-research-agent-py`](../langchain-research-agent-py/) tutorial — clone and run that agent first, then point this UI at it.

## What this adds on top of agent-chat-ui

| Surface | What changed |
|---|---|
| `src/app/api/[..._path]/route.ts` | Replaces `langgraph-nextjs-api-passthrough` with a payment-aware proxy that JSON-injects the buyer's x402 access token (held in a `httpOnly` cookie) into the run body at `config.configurable.payment_token`. The agent's tool reads it from there. |
| `src/app/api/x402/session/route.ts` | Mints a self-mint widget session via `POST /api/v1/widgets/session/self` ([nvm-monorepo#1716](https://github.com/nevermined-io/nvm-monorepo/pull/1716)). |
| `src/app/api/x402/token/route.ts` | Exchanges a `delegationId` for an x402 access token via `payments.x402.getX402AccessToken` (pattern B in `@nevermined-io/payments`), stores it in a `httpOnly` cookie. |
| `src/app/api/x402/init/route.ts` | Resolves plan metadata server-side from `NVM_PLAN_ID` (scheme + network via the SDK) and reports cookie presence. The chat client uses this in lieu of a 402-envelope probe. |
| `src/app/x402-callback/page.tsx` | Popup target for the Nevermined white-label flow. Validates the CSRF `state` nonce and `postMessage`s the result to `window.opener`. |
| `src/hooks/useNvmPayment.tsx` | Drives the popup + token-mint flow. |
| `src/components/thread/payment-banner.tsx` | Always-visible status pill: "Authorize" → "Card delegation active" → "Reset delegation". |
| `src/components/thread/index.tsx` | Intro card (visible before the first user message) that describes the agent's free vs paid capabilities. |

The `NVM_API_KEY` never leaves the Next.js server. The browser only sees the short-lived widget `sessionToken` and never holds the x402 access token directly (cookie is `httpOnly`).

## Prerequisites

- [`Node.js`](https://nodejs.org) ≥ 20 and [`pnpm`](https://pnpm.io) ≥ 10.
- A Nevermined account at https://nevermined.app with:
  - An **API key** (Settings → API Keys).
  - An **organization id** you're a member of (Settings → Organizations).
  - A **plan** you've published, with at least one fiat or crypto payment route configured.
- A LangGraph agent that reads `config.configurable.payment_token` from inside one of its tools (verify → execute → settle). The companion tutorial [`langchain-research-agent-py`](https://github.com/nevermined-io/tutorials/tree/main/langchain-research-agent-py) ships a ready-to-run market-research agent — clone and run it before starting this UI.

## Setup

```bash
git clone https://github.com/nevermined-io/tutorials.git
cd tutorials/langchain-chat-ui-nvm
pnpm install
cp .env.example .env.local
# Fill in NVM_API_KEY, NVM_ORG_ID, NVM_PLAN_ID
```

In a second terminal, start the market-research agent:

```bash
cd ../langchain-research-agent-py
poetry install
cp .env.example .env       # fill in NVM_API_KEY, NVM_PLAN_ID, OPENAI_API_KEY
poetry run langgraph dev   # serves at http://127.0.0.1:2024
```

Back in the chat UI directory, start the dev server:

```bash
pnpm dev   # http://localhost:3000
```

## The flow

1. Open `http://localhost:3000`. You see an intro card explaining the agent's free (introspection) vs paid (`market_research`) capabilities.
2. **Free chat first.** Type "what can you do?". The proxy forwards the run; the agent's LLM concierge answers from its system prompt without invoking the paid tool. No card needed.
3. **Trigger the paywall.** Type "research the EV market in Europe". The LLM calls the `market_research` tool, which returns a `PAYMENT_REQUIRED:` notice (no token in `config.configurable.payment_token` yet). The LLM relays the notice to you.
4. **Authorize.** Click **Authorize** in the top banner. A popup opens at `{nevermined.app}/embed/cards/setup?sessionToken=…`.
5. Enrol a card if you haven't already, then pick a spending limit + duration. Submit. The popup redirects to `/x402-callback`, validates the CSRF nonce, posts the `delegationId` back to the chat UI, and closes itself.
6. The chat UI mints an x402 access token from the delegation and stores it in a `httpOnly` cookie. The banner flips to **"Card delegation active"**.
7. **Retry the research request.** This time the proxy injects the cookie into `config.configurable.payment_token`. The tool verifies, runs an LLM market-analyst, settles credits, and returns the structured analysis with a settlement-receipt footer.
8. Subsequent paid requests reuse the same delegation until the on-chain budget exhausts. After that, the tool returns a `PAYMENT_REQUIRED:` notice with the invalid-token reason and the user re-authorizes.

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
       │     config.configurable │         ┌─────────────────────────┐
       │     .payment_token  │         │ /x402-callback          │
       └─────┬───────────────────┘         │ (popup target)          │
             │                              │ window.opener.postMsg   │
             ▼                              └─────────────────────────┘
       ┌─────────────────────────┐
       │ LangGraph agent (2024)  │
       │  market_research tool   │
       │   verify→analyse→settle │
       └─────────────────────────┘
```

## Limitations (MVP)

- **Single plan.** The chat UI assumes one `NVM_PLAN_ID`. Multi-tool agents with different prices per tool would need the init route to return one `accepts` entry per tool and the chat UI to track which one the latest request hit.
- **No auto-retry on 402-equivalent.** If the user asks for research before authorizing, the agent's `PAYMENT_REQUIRED:` notice lands in the chat history; they must click Authorize and re-ask. Auto-retry tracked as a follow-up.
- **Local-only `returnUrl`.** The self-mint widget session (`POST /widgets/session/self`) restricts `returnUrl` to `localhost` / `127.0.0.1`. Deploying to a real domain requires the widget-key flow instead (out of scope for this demo).
- **Outer LLM may paraphrase tool output.** The agent's system prompt asks it to relay verbatim, but `gpt-4o-mini` sometimes rewrites markdown headers or drops the settlement footer. Swap to a stronger model or use a deterministic output node if you need byte-stable responses.
- **No chat-UI-level auth.** A single `NVM_API_KEY` in the Next.js server env powers everything. Multi-user demos need an auth layer in front.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Missing required environment variable NVM_API_KEY` | `.env.local` not populated. Restart `pnpm dev` after editing. |
| `BCK.WIDGET_SESSION.0019` from `/api/x402/session` | Your `NVM_API_KEY` user is not a member of `NVM_ORG_ID`. |
| Popup blocked | Allow popups for `localhost:3000` in browser settings. The hook surfaces a clear error. |
| `state_mismatch` in callback | The CSRF nonce in `sessionStorage` was cleared between popup open and callback. Try again. |
| `delegationConfig is required for nvm:erc4337 token generation` | Sanity check — only fires if you bypass the popup and POST `/api/x402/token` directly without a `delegationId`. |
| Agent keeps returning `PAYMENT_REQUIRED:` after authorizing | Either the plan's payment-method requirements don't match your enrolled card, or the delegation's budget already ran out. Check the agent's stdout for `verify_permissions failed: …`. |

## License

MIT, dual attribution to Brace Sproul (upstream `agent-chat-ui`) and Nevermined AG (x402 integration). See [`LICENSE`](./LICENSE).
