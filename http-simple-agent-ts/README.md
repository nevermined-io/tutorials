# HTTP Weather Agent (TypeScript) — x402 + MPP

A minimal Express server whose weather endpoints are gated by Nevermined's payment middleware. One `paymentMiddleware` call protects three routes, each backed by a different payment plan and each accepting **both** payment protocols — [x402](https://github.com/coinbase/x402) and **MPP** (Machine Payments Protocol). Weather comes from the free, keyless [Open-Meteo](https://open-meteo.com) API, so the agent needs no third-party keys to run.

> **Note:** For a Python version of the x402 flow, see [http-simple-agent-py](../http-simple-agent-py/). MPP is TypeScript-only.

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?logo=discord&logoColor=white)](https://discord.com/invite/GZju2qScKq)

## Overview

- **Agent** (`src/agent.ts`) — an Express server exposing three payment-protected weather routes plus an unprotected `/health`.
- **Weather service** (`src/services/weather.service.ts`) — current weather + multi-day forecast from Open-Meteo (no API key).
- **Plan registration** (`scripts/register-plans.ts`) — one-shot script that registers the three plans and prints their IDs.
- **Smoke test / buyer example** (`scripts/smoke.ts`) — drives the full x402 and MPP buyer round-trips against the agent.

### Routes, plans and protocols

| Route | Plan type | Cost | Protocols |
| --- | --- | --- | --- |
| `POST /weather/credits` | fixed credits | 1 credit / request | x402 + MPP |
| `POST /weather/subscription` | time-based (24h pass) | time-boxed access | x402 + MPP |
| `POST /weather/payg` | dynamic (pay-as-you-go) | 1 for today, up to 7 for a forecast | x402 + MPP |

`mpp: true` on each route makes the `402` advertise **both** protocols, so an x402 buyer and an MPP buyer work against the same URL.

## Payment headers

| Protocol | Challenge (402) | Client → server | Receipt (200) |
| --- | --- | --- | --- |
| **x402** | `payment-required` | `payment-signature` | `payment-response` |
| **MPP** | `WWW-Authenticate: Payment` | `Authorization: Payment` | `Payment-Receipt` |

## Quick start

### 1. Install

```bash
yarn install
```

### 2. Register the plans

Registers the three plans against your Nevermined account and prints their IDs. The environment (sandbox/live) is derived from your API-key prefix. Set `NVM_RECEIVER` to your builder wallet so the plans are **crypto-priced (payable)** — without it the script registers FREE plans and warns loudly.

```bash
NVM_API_KEY=sandbox:your-api-key NVM_RECEIVER=0xYourBuilderWallet yarn register-plans
# -> PLAN_ID_CREDITS=... / PLAN_ID_TIME=... / PLAN_ID_PAYG=...
```

### 3. Configure environment

```bash
cp .env.example .env
```

```bash
# Nevermined (required). Environment is derived from the key prefix (sandbox:/live:).
NVM_API_KEY=sandbox:your-api-key

# Plan IDs from `yarn register-plans`
PLAN_ID_CREDITS=...
PLAN_ID_TIME=...
PLAN_ID_PAYG=...

PORT=3000
```

### 4. Run the agent

```bash
yarn agent          # dev (tsx)
# or: yarn build && yarn start   # compiled (dist/agent.js) — same as the Docker image
```

### 5. Run the smoke test (buyer, in another terminal)

Exercises the x402 and MPP buyer flows against the running agent. Needs a Nevermined key and an `erc4337` delegation (created by the script); point it at the server with `SERVER_URL`.

```bash
SERVER_URL=http://localhost:3000 NVM_API_KEY=sandbox:your-api-key PLAN_ID_CREDITS=... yarn smoke
```

## Agent code

One middleware protects all three routes; `mpp: true` opts each into MPP alongside x402:

```typescript
import { Payments } from "@nevermined-io/payments";
import { paymentMiddleware } from "@nevermined-io/payments/express";

// Environment is derived from the API-key prefix — no `environment` option.
const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY });

app.use(
  paymentMiddleware(payments, {
    "POST /weather/credits": { planId: PLAN_ID_CREDITS, credits: 1, mpp: true },
    "POST /weather/subscription": { planId: PLAN_ID_TIME, credits: 1, mpp: true },
    "POST /weather/payg": {
      planId: PLAN_ID_PAYG,
      credits: (req) => priceForRequest(req.body), // 1 for today, up to 7 for a forecast
      mpp: true,
    },
  }),
);

app.post("/weather/credits", async (req, res) => {
  const { city } = parseWeatherRequest(req.body); // 400 on invalid input
  res.json(await getTodayWeather(city));           // keyless Open-Meteo
});
```

## Buyer code

A delegation backs the buyer for both protocols (in 1.11.2 even the x402 token needs one):

```typescript
import { X402_HEADERS } from "@nevermined-io/payments/express";

const { delegationId } = await payments.delegation.createDelegation({
  provider: "erc4337", spendingLimitCents: 10000, durationSecs: 604800, currency: "usdc",
});

// --- x402 ---
const { accessToken } = await payments.x402.getX402AccessToken(
  PLAN_ID_CREDITS, undefined, { delegationConfig: { delegationId } },
);
const res = await fetch(SERVER_URL + "/weather/credits", {
  method: "POST",
  headers: { "content-type": "application/json", [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken },
  body: JSON.stringify({ city: "Lisbon" }),
});
// -> 200 + weather, with a `payment-response` settlement receipt

// --- MPP (same route; one call runs the challenge -> credential handshake) ---
const { response, receipt } = await payments.mpp.fetch(
  SERVER_URL + "/weather/payg",
  { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ city: "Berlin", days: 5 }) },
  { delegationConfig: { delegationId }, planId: PLAN_ID_PAYG, maxCredits: 7 },
);
```

## API reference

All weather routes take `{ "city": "<name>", "days"?: <1-7> }` and return the weather as JSON. `days > 1` (on `/weather/payg`) returns a multi-day forecast.

| Method | Route | Auth |
| --- | --- | --- |
| `POST` | `/weather/credits` | payment (x402 or MPP) |
| `POST` | `/weather/subscription` | payment (x402 or MPP) |
| `POST` | `/weather/payg` | payment (x402 or MPP) |
| `GET` | `/health` | none — returns `{ "ok": true }` |

An unpaid request returns `402` with the x402 `payment-required` header and the MPP `WWW-Authenticate: Payment` challenge. Invalid input (missing/short `city`) returns `400`; an unknown city returns `404`.

## Scripts

| Script | Description |
| --- | --- |
| `yarn agent` | Run the agent (dev, tsx) |
| `yarn register-plans` | Register the credits / time / pay-as-you-go plans |
| `yarn smoke` | Buyer round-trips (x402 + MPP) against a running agent |
| `yarn pricing:selfcheck` | Unit self-check for the pay-as-you-go pricing function |
| `yarn request:selfcheck` | Unit self-check for request input validation |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run the compiled agent (`node dist/agent.js`) |

## Project structure

```
http-simple-agent-ts/
├── src/
│   ├── agent.ts                    # Express server — three dual-protocol weather routes
│   ├── pricing.ts                  # priceForRequest (pay-as-you-go)
│   ├── request.ts                  # parseWeatherRequest (boundary validation)
│   └── services/weather.service.ts # Open-Meteo current weather + forecast (keyless)
├── scripts/
│   ├── register-plans.ts           # register the three plans
│   └── smoke.ts                    # x402 + MPP buyer smoke test
├── deploy/argocd/                  # ArgoCD deploy manifests + runbook (agents namespace)
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

## Deployment

Deployment reference (Dockerfile → GCP Artifact Registry via the CI workflow → ArgoCD in the `agents` namespace) lives in [`deploy/argocd/`](./deploy/argocd/README.md), including the required chart env patch, the secret, `replicaCount: 1` (MPP single-use is in-process), and the startup-probe timing.

## Learn more

- [Nevermined Documentation](https://nevermined.ai/docs)
- [Nevermined x402 Smart Accounts Spec](https://nevermined.ai/docs/specs/x402-smart-accounts)
- [x402 Protocol Specification](https://github.com/coinbase/x402)
- [@nevermined-io/payments SDK](https://github.com/nevermined-io/payments)
