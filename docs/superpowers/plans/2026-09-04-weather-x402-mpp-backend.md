# Weather x402 + MPP Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `http-simple-agent-ts` into a keyless weather service that exposes three payment-plan routes (fixed-credits, time-based, pay-as-you-go), each speaking **both** x402 and MPP, then containerize it and deploy it to the `agents` namespace as `weather-x402-agent.nevermined.app`.

**Architecture:** One Express app, one `paymentMiddleware(payments, routes)` call. Each route names a different plan and sets `mpp: true`, so a single 402 advertises x402 *and* MPP and either buyer works against the same URL. Weather comes from Open-Meteo (no API key). Plans are registered once by a script; the service reads their IDs from env. The image builds from `http-simple-agent-ts/` and deploys through the shared `helm-charts/agent` chart, mirroring the existing `demo-finance-agent` / `tutorials-showcase` deploy paths.

**Tech Stack:** TypeScript, Express 4, `@nevermined-io/payments` (x402 + MPP), Open-Meteo REST, Docker (node:20-alpine), GitHub Actions + GCP Artifact Registry + WIF, ArgoCD + Helm.

**Spec:** in-conversation spec dated 2026-09-04 ("weather-x402 — a live dual-protocol paid backend for the tutorials"). Read it alongside this plan.

## Global Constraints

- **Language is TypeScript, not Python.** MPP exists only in the TS SDK + backend; `payments-py` has x402 only. A dual-protocol service must be TS.
- **`@nevermined-io/payments` must be bumped from `^1.1.0` to a version that ships `payments.mpp` and the `mpp` route option, and pinned to an exact version** (the SDK doc labels the `payments.mpp.*` buyer surface `@experimental` and says fields may move in a minor release — pin so a redeploy can't drift). Resolve the exact version from `~/Projects/Nevermined/payments/package.json`.
- **MPP single-use guards are in-process (in-memory), not shared across replicas.** The Deployment MUST stay `replicaCount: 1`. Horizontal scaling would require a shared store (Redis) and is out of scope.
- **Plans use a crypto (erc4337-payable) price**, because `payments.mpp.fetch` mints `nvm:erc4337` only this release. A fiat/card plan would be payable by x402 card-delegation but **not** by MPP — so one plan payable by both protocols must be crypto-priced.
- **Environment is `sandbox`.** No real money.
- **No OpenAI dependency.** Weather is keyless; the service must run with no `OPENAI_API_KEY`.
- Match the surrounding tutorial style: plain `tsx` scripts, assert-based self-checks (as in `showcase/lib/demo-agent.mjs`), no test framework unless one already exists in the dir.

---

## File Structure

Everything lives in `http-simple-agent-ts/` (the deployed image builds from here) except the deploy manifests, which live in the separate `argocd` repo.

- `http-simple-agent-ts/src/agent.ts` — **modify**. The Express server: 3 dual-protocol weather routes + `/health`. This is the deployed entrypoint.
- `http-simple-agent-ts/src/services/weather.service.ts` — **create** (copied from `mcp-examples/weather-mcp/src/services/weather.service.ts`), extended with `getForecast(city, days)`.
- `http-simple-agent-ts/src/pricing.ts` — **create**. Pure `priceForRequest(body)` → credits, so pay-as-you-go pricing is unit-testable without HTTP or payments.
- `http-simple-agent-ts/src/pricing.selfcheck.ts` — **create**. Assert-based `node`/`tsx` self-check for `priceForRequest`.
- `http-simple-agent-ts/scripts/register-plans.ts` — **create**. One-shot: registers the three plans, prints their IDs.
- `http-simple-agent-ts/scripts/smoke.ts` — **create**. Runnable e2e: exercises x402 and MPP against a running server; the Plan 1 verification.
- `http-simple-agent-ts/package.json` — **modify**. Bump payments, add `start` + script entries, drop the OpenAI-only assumptions.
- `http-simple-agent-ts/.env.example` — **modify**. New env surface (plan IDs, no OpenAI).
- `http-simple-agent-ts/Dockerfile` — **create** (from `mcp-examples/weather-mcp/Dockerfile`), entrypoint fixed to run the server.
- `.github/workflows/weather-x402-image.yml` — **create** (from `.github/workflows/showcase-image.yml`).
- `argocd: eu/dev/argocd-apps/agents/weather-x402-agent.yaml` (+ `-staging.yaml`) — **create** (from `demo-finance-agent.yaml`).
- `argocd: helm-charts/agent/v1.0.0/.argocd-source-weather-x402-agent.yaml` — **create** (image-updater mirror; only if image-updater is used).

---

## Phase A — Keyless weather foundation

### Task 1: Dependencies, scripts, env surface

**Files:**
- Modify: `http-simple-agent-ts/package.json`
- Modify: `http-simple-agent-ts/.env.example`

**Interfaces:**
- Produces: a `yarn start` script (`node dist/agent.js`) that the Dockerfile entrypoint relies on; env vars `NVM_API_KEY`, `NVM_ENVIRONMENT`, `PLAN_ID_CREDITS`, `PLAN_ID_TIME`, `PLAN_ID_PAYG`, `PORT`.

- [ ] **Step 1: Bump payments and add scripts.** In `package.json`, set `@nevermined-io/payments` to the exact version resolved from `~/Projects/Nevermined/payments/package.json` (e.g. `"1.19.0"` — verify, no caret), and add scripts:

```json
"scripts": {
  "agent": "tsx src/agent.ts",
  "client": "tsx src/client.ts",
  "register-plans": "tsx scripts/register-plans.ts",
  "smoke": "tsx scripts/smoke.ts",
  "pricing:selfcheck": "tsx src/pricing.selfcheck.ts",
  "build": "tsc",
  "start": "node dist/agent.js"
}
```

Remove `openai` from `dependencies` (the service no longer calls an LLM). Leave `agent-observability.ts` alone for now — it is out of scope; if `tsc` fails on it because it still imports `openai`, exclude it in `tsconfig.json` (`"exclude": ["node_modules","dist","src/agent-observability.ts"]`) rather than fixing it here.

- [ ] **Step 2: Rewrite `.env.example`:**

```bash
# Nevermined (required)
NVM_API_KEY=nvm:your-api-key
NVM_ENVIRONMENT=sandbox

# Plan IDs — created by `yarn register-plans` (see scripts/register-plans.ts)
PLAN_ID_CREDITS=
PLAN_ID_TIME=
PLAN_ID_PAYG=

# Server
PORT=3000
```

- [ ] **Step 3: Install and verify it resolves.**

Run: `cd http-simple-agent-ts && yarn install`
Expected: installs without error; `yarn list @nevermined-io/payments` shows the pinned version.

- [ ] **Step 4: Verify MPP is present in the installed SDK.**

Run: `node -e "const p=require('@nevermined-io/payments'); console.log(typeof require('@nevermined-io/payments/express').paymentMiddleware, Object.keys(require('@nevermined-io/payments/express')))"`
Expected: prints `function` and the export list includes `MPP_HEADERS` and `X402_HEADERS`. If `MPP_HEADERS` is absent, the version is too old — raise it.

- [ ] **Step 5: Commit.**

```bash
git add http-simple-agent-ts/package.json http-simple-agent-ts/.env.example http-simple-agent-ts/yarn.lock
git commit -m "chore(http-ts): bump payments for MPP, drop OpenAI, add plan-id env"
```

### Task 2: Weather service + pure pricing function

**Files:**
- Create: `http-simple-agent-ts/src/services/weather.service.ts`
- Create: `http-simple-agent-ts/src/pricing.ts`
- Create: `http-simple-agent-ts/src/pricing.selfcheck.ts`

**Interfaces:**
- Produces:
  - `getTodayWeather(city: string): Promise<TodayWeather>` and `getForecast(city: string, days: number): Promise<ForecastWeather>` from `weather.service.ts`.
  - `priceForRequest(body: unknown): number` from `pricing.ts` — 1 credit for a current-weather/single-day request, `days` credits (capped 1..7) for a multi-day forecast.

- [ ] **Step 1: Copy the weather service verbatim, then extend it.** Copy `mcp-examples/weather-mcp/src/services/weather.service.ts` to `http-simple-agent-ts/src/services/weather.service.ts`. Drop the `console.log` latency line (repo style forbids `console.log` in production code). Append a multi-day forecast reader:

```typescript
export type ForecastDay = {
  date: string;
  tmaxC: number | null;
  tminC: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  weatherText: string | null;
};

export type ForecastWeather = {
  city: string;
  country: string | null;
  timezone: string;
  updatedAt: string;
  days: ForecastDay[];
};

export async function getForecast(city: string, days: number): Promise<ForecastWeather> {
  const n = Math.max(1, Math.min(7, Math.trunc(days)));
  const geo = await geocodeCity(city);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(geo.latitude));
  url.searchParams.set("longitude", String(geo.longitude));
  url.searchParams.set("forecast_days", String(n));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode");

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new DownstreamError("Failed to reach Open-Meteo forecast API");
  }
  if (!res.ok) throw new DownstreamError(`Forecast API returned HTTP ${res.status}`);

  const data = (await res.json()) as any;
  const d = data.daily ?? {};
  const time: string[] = Array.isArray(d.time) ? d.time : [];
  const daysOut: ForecastDay[] = time.map((date: string, i: number) => {
    const code = Array.isArray(d.weathercode) ? Number(d.weathercode[i]) : null;
    return {
      date,
      tmaxC: Array.isArray(d.temperature_2m_max) ? Number(d.temperature_2m_max[i]) : null,
      tminC: Array.isArray(d.temperature_2m_min) ? Number(d.temperature_2m_min[i]) : null,
      precipitationMm: Array.isArray(d.precipitation_sum) ? Number(d.precipitation_sum[i]) : null,
      weatherCode: code,
      weatherText: weatherCodeToText(code),
    };
  });

  return {
    city: geo.name,
    country: geo.country,
    timezone: data.timezone ?? geo.timezone ?? "unknown",
    updatedAt: new Date().toISOString(),
    days: daysOut,
  };
}
```

- [ ] **Step 2: Write the failing pricing self-check first.** Create `src/pricing.selfcheck.ts`:

```typescript
import { priceForRequest } from "./pricing.js";

const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };

assert(priceForRequest({ city: "Lisbon" }) === 1, "no days → 1 credit");
assert(priceForRequest({ city: "Lisbon", days: 1 }) === 1, "1 day → 1 credit");
assert(priceForRequest({ city: "Lisbon", days: 7 }) === 7, "7 days → 7 credits");
assert(priceForRequest({ city: "Lisbon", days: 99 }) === 7, "days capped at 7");
assert(priceForRequest({ city: "Lisbon", days: 0 }) === 1, "days floored at 1");
assert(priceForRequest({ city: "Lisbon", days: "3" as any }) === 3, "numeric string coerced");
assert(priceForRequest({}) === 1, "empty body → 1 credit");
console.log("✓ pricing self-check passed");
```

- [ ] **Step 3: Run it — must fail (module missing).**

Run: `cd http-simple-agent-ts && yarn pricing:selfcheck`
Expected: FAIL — cannot find `./pricing.js` / `priceForRequest` is not a function.

- [ ] **Step 4: Implement `src/pricing.ts` minimally.**

```typescript
/** Pay-as-you-go price: 1 credit for current weather, `days` credits (1..7) for a forecast. */
export function priceForRequest(body: unknown): number {
  const raw = (body as { days?: unknown } | null | undefined)?.days;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(7, Math.trunc(n)));
}
```

- [ ] **Step 5: Run the self-check — must pass.**

Run: `cd http-simple-agent-ts && yarn pricing:selfcheck`
Expected: `✓ pricing self-check passed`

- [ ] **Step 6: Commit.**

```bash
git add http-simple-agent-ts/src/services/weather.service.ts http-simple-agent-ts/src/pricing.ts http-simple-agent-ts/src/pricing.selfcheck.ts
git commit -m "feat(http-ts): keyless weather service + pay-as-you-go pricing fn"
```

---

## Phase B — Dual-protocol routes over three plans

### Task 3: Rewrite `agent.ts` as the dual-protocol weather server

**Files:**
- Modify: `http-simple-agent-ts/src/agent.ts` (full rewrite)

**Interfaces:**
- Consumes: `getTodayWeather`, `getForecast` (Task 2); `priceForRequest` (Task 2); `paymentMiddleware`, `X402_HEADERS`, `MPP_HEADERS` from `@nevermined-io/payments/express`.
- Produces: routes `POST /weather/credits`, `POST /weather/subscription`, `POST /weather/payg`, `GET /health` on `PORT`.

- [ ] **Step 1: Replace the file body.** Note the route→plan→credits mapping and that `mpp: true` is set on every paid route.

```typescript
import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import { paymentMiddleware, X402_HEADERS, MPP_HEADERS } from "@nevermined-io/payments/express";
import { getTodayWeather, getForecast, CityNotFoundError } from "./services/weather.service.js";
import { priceForRequest } from "./pricing.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const NVM_API_KEY = process.env.NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName;
const PLAN_ID_CREDITS = process.env.PLAN_ID_CREDITS ?? "";
const PLAN_ID_TIME = process.env.PLAN_ID_TIME ?? "";
const PLAN_ID_PAYG = process.env.PLAN_ID_PAYG ?? "";

if (!NVM_API_KEY || !PLAN_ID_CREDITS || !PLAN_ID_TIME || !PLAN_ID_PAYG) {
  console.error("NVM_API_KEY, PLAN_ID_CREDITS, PLAN_ID_TIME and PLAN_ID_PAYG are required.");
  process.exit(1);
}

const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENVIRONMENT });

const app = express();
app.use(express.json());

// /health stays unprotected — mount it before the paywall.
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

// One middleware, three plans, both protocols. `mpp: true` makes each 402 advertise
// x402 AND MPP, so either buyer works against the same URL.
app.use(
  paymentMiddleware(
    payments,
    {
      "POST /weather/credits": { planId: PLAN_ID_CREDITS, credits: 1, mpp: true },
      "POST /weather/subscription": { planId: PLAN_ID_TIME, credits: 1, mpp: true },
      "POST /weather/payg": {
        planId: PLAN_ID_PAYG,
        credits: (req: Request) => priceForRequest(req.body),
        mpp: true,
      },
    },
    {
      onBeforeVerify: (req) => console.log(`[pay] verify ${req.method} ${req.path}`),
      onAfterSettle: (req, credits) => console.log(`[pay] settled ${credits} on ${req.path}`),
    },
  ) as RequestHandler,
);

async function handleToday(req: Request, res: Response) {
  try {
    const { city } = req.body as { city?: string };
    if (!city) return res.status(400).json({ error: "Missing 'city'" });
    return res.json(await getTodayWeather(city));
  } catch (err) {
    if (err instanceof CityNotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    return res.status(502).json({ error: "weather upstream failed" });
  }
}

app.post("/weather/credits", handleToday);
app.post("/weather/subscription", handleToday);

app.post("/weather/payg", async (req: Request, res: Response) => {
  try {
    const { city, days } = req.body as { city?: string; days?: number };
    if (!city) return res.status(400).json({ error: "Missing 'city'" });
    return res.json(days && days > 1 ? await getForecast(city, days) : await getTodayWeather(city));
  } catch (err) {
    if (err instanceof CityNotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    return res.status(502).json({ error: "weather upstream failed" });
  }
});

app.listen(PORT, () => {
  console.log(`weather-x402 agent on http://localhost:${PORT}`);
  console.log(`x402 header: ${X402_HEADERS.PAYMENT_SIGNATURE} · MPP header: ${MPP_HEADERS.AUTHORIZATION}`);
});
```

> If `MPP_HEADERS`'s field for the `Authorization` credential is named differently in the installed SDK, adjust the log line — read the export from `node_modules/@nevermined-io/payments/dist/.../express`. Do not invent a name.

- [ ] **Step 2: Type-check.**

Run: `cd http-simple-agent-ts && yarn build`
Expected: `tsc` exits 0. (If it fails on `agent-observability.ts`, confirm Task 1 Step 1's exclude is in place.)

- [ ] **Step 3: Boot with dummy env to confirm the guard.**

Run: `cd http-simple-agent-ts && NVM_API_KEY=x PLAN_ID_CREDITS=x PLAN_ID_TIME=x PLAN_ID_PAYG=x PORT=3999 timeout 5 yarn start || true` (after `yarn build`)
Expected: prints the boot banner (SDK init may warn on the fake key — acceptable; we only assert it reaches `listen`).

- [ ] **Step 4: Commit.**

```bash
git add http-simple-agent-ts/src/agent.ts http-simple-agent-ts/tsconfig.json
git commit -m "feat(http-ts): dual-protocol weather routes over three plans"
```

---

## Phase C — Plan registration

### Task 4: `register-plans.ts`

**Files:**
- Create: `http-simple-agent-ts/scripts/register-plans.ts`

**Interfaces:**
- Produces: three plan IDs printed to stdout, to be pasted into `.env` / stored in Secret Manager.

> Verify every builder/register name against `~/Projects/Nevermined/payments/src/plans.ts` and `src/api/plans-api.ts` before running — the SDK is the source of truth. The shape below matches the surface documented in the spec's evidence table.

- [ ] **Step 1: Write the script.**

```typescript
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import {
  getFixedCreditsConfig,
  getExpirableDurationConfig,
  getDynamicCreditsConfig,
  getCryptoPriceConfig,
  ONE_DAY_DURATION,
} from "@nevermined-io/payments";

const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName,
});

// Crypto price so BOTH x402 (erc4337) and MPP can pay it. Use the builder's
// signature from the SDK; `receivers` is the builder's wallet address.
const price = getCryptoPriceConfig(/* amount */ 0n, /* receiver */ process.env.NVM_RECEIVER ?? "");

async function main() {
  const credits = await payments.plans.registerCreditsPlan(
    { name: "Weather — Fixed Credits", description: "100 weather calls, 1 credit each" },
    price,
    getFixedCreditsConfig(100n, 1n),
  );
  const time = await payments.plans.registerTimePlan(
    { name: "Weather — Day Pass", description: "24h of weather access" },
    price,
    getExpirableDurationConfig(ONE_DAY_DURATION),
  );
  const payg = await payments.plans.registerPlan(
    { name: "Weather — Pay As You Go", description: "1 credit current, up to 7 for a forecast" },
    price,
    getDynamicCreditsConfig(1000n, 1n, 7n),
  );

  console.log("PLAN_ID_CREDITS=" + (credits.planId ?? credits));
  console.log("PLAN_ID_TIME=" + (time.planId ?? time));
  console.log("PLAN_ID_PAYG=" + (payg.planId ?? payg));
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run against sandbox with a real builder key.**

Run: `cd http-simple-agent-ts && NVM_API_KEY=<real-sandbox-builder-key> NVM_RECEIVER=<builder-wallet> yarn register-plans`
Expected: three `PLAN_ID_*=...` lines. If a builder name/signature mismatches, fix against `plans.ts` (this is the one task that can't be dry-run).

- [ ] **Step 3: Record the IDs** in `.env` locally, and note them for the Secret Manager step (Task 8). Do **not** commit real IDs into `.env.example`.

- [ ] **Step 4: Commit the script only.**

```bash
git add http-simple-agent-ts/scripts/register-plans.ts
git commit -m "feat(http-ts): plan registration script (credits/time/payg)"
```

---

## Phase D — Local end-to-end verification

### Task 5: `smoke.ts` — x402 and MPP round-trips

**Files:**
- Create: `http-simple-agent-ts/scripts/smoke.ts`

**Interfaces:**
- Consumes: a running server (Task 3) and the three plan IDs (Task 4); a **funded sandbox buyer** `NVM_API_KEY` with an `erc4337` delegation.

- [ ] **Step 1: Write the smoke test.** It asserts: no-token → 402 advertising both protocols; x402 token → 200; MPP fetch → 200 + receipt.

```typescript
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import { X402_HEADERS } from "@nevermined-io/payments/express";

const BASE = process.env.SERVER_URL || "http://localhost:3000";
const PLAN = process.env.PLAN_ID_CREDITS!;
const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
  environment: (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName,
});
const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };

async function main() {
  // 1) Unpaid → 402 advertising BOTH protocols
  const r0 = await fetch(`${BASE}/weather/credits`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ city: "Lisbon" }),
  });
  assert(r0.status === 402, "unpaid → 402");
  assert(!!r0.headers.get(X402_HEADERS.PAYMENT_REQUIRED), "x402 challenge present");
  assert(!!r0.headers.get("www-authenticate"), "MPP WWW-Authenticate present");

  // 2) x402 buyer → 200
  const { accessToken } = await payments.x402.getX402AccessToken(PLAN);
  const r1 = await fetch(`${BASE}/weather/credits`, {
    method: "POST",
    headers: { "content-type": "application/json", [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken },
    body: JSON.stringify({ city: "Lisbon" }),
  });
  assert(r1.status === 200, `x402 paid → 200 (got ${r1.status})`);
  const w = await r1.json();
  assert(typeof w.city === "string", "x402 returned real weather");

  // 3) MPP buyer → 200 + receipt
  const { delegationId } = await payments.delegation.createDelegation({
    provider: "erc4337", spendingLimitCents: 10000, durationSecs: 604800, currency: "usdc",
  });
  const { response, receipt, paid } = await payments.mpp.fetch(
    `${BASE}/weather/credits`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: "Berlin" }) },
    { delegationConfig: { delegationId }, planId: PLAN },
  );
  assert(response.status === 200, `MPP paid → 200 (got ${response.status})`);
  assert(paid && !!receipt, "MPP settled with a receipt");

  console.log("✓ smoke: x402 + MPP both paid a real weather response");
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it against a locally running server.**

Run (two shells): `yarn start` in one; `SERVER_URL=http://localhost:3000 NVM_API_KEY=<funded-buyer> PLAN_ID_CREDITS=<id> yarn smoke` in the other.
Expected: `✓ smoke: x402 + MPP both paid a real weather response`. A `402` on step 2/3 usually means the buyer wallet is unfunded on sandbox — fund it, don't change the assert.

- [ ] **Step 3: Commit.**

```bash
git add http-simple-agent-ts/scripts/smoke.ts
git commit -m "test(http-ts): x402 + MPP smoke e2e"
```

---

## Phase E — Containerize and deploy

### Task 6: Dockerfile

**Files:**
- Create: `http-simple-agent-ts/Dockerfile`

- [ ] **Step 1: Write it** (from the weather-mcp Dockerfile; entrypoint runs the server via the new `start` script, and the build needs `tsconfig.json`):

```dockerfile
FROM node:20-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"
RUN apk add --no-cache libc6-compat yarn
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY src ./src
COPY tsconfig.json ./
RUN yarn build
EXPOSE 3000
ENTRYPOINT ["yarn", "start"]
```

- [ ] **Step 2: Build and run locally.**

Run: `cd http-simple-agent-ts && docker build -t weather-x402:dev . && docker run --rm -p 3000:3000 -e NVM_API_KEY=x -e PLAN_ID_CREDITS=x -e PLAN_ID_TIME=x -e PLAN_ID_PAYG=x weather-x402:dev &` then `sleep 4 && curl -fsS localhost:3000/health`
Expected: `{"ok":true}`. Stop the container afterward.

- [ ] **Step 3: Commit.**

```bash
git add http-simple-agent-ts/Dockerfile
git commit -m "build(http-ts): Dockerfile for weather-x402 service"
```

### Task 7: CI workflow

**Files:**
- Create: `.github/workflows/weather-x402-image.yml`

- [ ] **Step 1: Copy `showcase-image.yml`** and change only: workflow `name`; the `paths` filters to `http-simple-agent-ts/**` and this workflow file; `env.IMAGE` to `europe-west3-docker.pkg.dev/nevermined-eu-dev/nevermined-io/tutorials-weather-x402`; `defaults.run.working-directory` and the build `context`/`file` to `http-simple-agent-ts` / `http-simple-agent-ts/Dockerfile`. Keep the WIF `SERVICE_ACCOUNT` / `WORKLOAD_IDENTITY_PROVIDER` / `PROJECT_ID` blocks **unchanged** — this repo (`nevermined-io/tutorials`) is already allowlisted in the WIF pool (the showcase workflow proves it). Replace the `Sandbox agent self-check` step with `yarn pricing:selfcheck` (the smoke test needs live creds and does not run in CI).

- [ ] **Step 2: Validate the YAML.**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/weather-x402-image.yml'))"` (or `actionlint` if installed)
Expected: no error.

- [ ] **Step 3: Commit.** (Push happens with the PR; the image builds on merge to `main`.)

```bash
git add .github/workflows/weather-x402-image.yml
git commit -m "ci: build & push weather-x402 image to Artifact Registry"
```

### Task 8: ArgoCD Application + secrets (in the `argocd` repo)

**Files (separate repo `~/Projects/Nevermined/argocd`, its own PR):**
- Create: `eu/dev/argocd-apps/agents/weather-x402-agent.yaml`
- Create: `eu/dev/argocd-apps/agents/weather-x402-agent-staging.yaml`
- Create: `helm-charts/agent/v1.0.0/.argocd-source-weather-x402-agent.yaml` (only if using image-updater)

- [ ] **Step 1: Copy `demo-finance-agent.yaml`** and set: `image.repository=europe-west3-docker.pkg.dev/nevermined-eu-dev/nevermined-io/tutorials-weather-x402`, `image.tag=sha-<first-built-sha>` (the immutable tag the CI prints), `service.hostname=weather-x402-agent.nevermined.app`, `service.ports.*=3000`, `initCommand=yarn start`, **`replicaCount: 1` (do not scale — MPP single-use is in-process)**, `ingress.rateLimitEnabled=true`. Set env params `NVM_ENVIRONMENT=sandbox` and the three `PLAN_ID_*`; set `secrets.nvmApiKey=gcp:secretmanager:projects/112425687177/secrets/<tutorials-weather-nvm-api-key>` (create that Secret Manager secret first with the builder key from Task 4). Since the AR image is pinned by immutable `sha-*` tag, **prefer the pinned-tag path over image-updater** (drop the image-updater annotations and the `.argocd-source-*.yaml` mirror) — matches how the production apps pin AR tags. Repeat for `-staging` with `weather-x402-agent-staging.nevermined.app`.

- [ ] **Step 2: Verify chart rendering locally.**

Run: `helm template weather-x402-agent ~/Projects/Nevermined/argocd/helm-charts/agent/v1.0.0 --set image.repository=... --set service.hostname=weather-x402-agent.nevermined.app --set service.ports.port=3000 --set replicaCount=1`
Expected: renders a Deployment (1 replica), Service, and Ingress for `weather-x402-agent.nevermined.app` with no template errors.

- [ ] **Step 3: Open the argocd PR**, merge after review; ArgoCD auto-syncs the `agents` namespace.

- [ ] **Step 4: Verify the deployment is live.**

Run: `curl -fsS https://weather-x402-agent.nevermined.app/health` and `kubectl -n agents get deploy weather-x402-agent`
Expected: `{"ok":true}`; deployment `1/1` ready. Then re-run Task 5's `smoke.ts` with `SERVER_URL=https://weather-x402-agent.nevermined.app` — both protocols pay against the live service.

---

## Self-review (done against the spec)

- **Spec coverage:** dual-protocol on one route ✅ (Task 3 `mpp: true`); three plan types ✅ (Tasks 3–4); keyless weather ✅ (Tasks 1–2); Docker ✅ (Task 6); agents-namespace deploy ✅ (Tasks 7–8); acceptance criteria 1–7 map to Tasks 3/5/8 (criterion 8, showcase, is Plan 2). Not covered here by design: the frontend/tutorial rewrite (open question #5) → Plan 2 below.
- **Consistency:** `priceForRequest` signature identical in Tasks 2/3/5; `PLAN_ID_*` names identical across `.env.example`, `agent.ts`, `register-plans.ts`, `smoke.ts`, and the Application.
- **Known soft spots the implementer must confirm against the SDK, not invent:** exact pinned payments version; `MPP_HEADERS` field name; `getCryptoPriceConfig`/`registerPlan` signatures; the shape of the `registerPlan` return (`.planId` vs raw). All flagged inline.

---

## Roadmap: follow-on plans (2–4)

Plan 1 delivers a live, dual-protocol, deployed backend. The remaining spec scope (open question #5 — "the frontend must be the tutorials") is a second plan, written once Plan 1's URL exists so its tasks can reference the real endpoint:

- **Plan 2 — Tutorials consume the live backend.**
  - Rewrite `http-simple-agent-ts/src/client.ts` to buy weather over x402 from the three routes (replaces the `/ask` + `{query}` flow).
  - Rewrite `http-simple-agent-py` (server + client) as the **x402-only** weather service (Python has no MPP); its client can also target the deployed TS URL for x402, which is wire-compatible.
  - New **MPP tutorial** (`http-mpp-agent-ts/` or an `mpp-client.ts` in the TS dir): the MPP buyer flow via `payments.mpp.fetch` against the same deployed dual-protocol server. TS-only; crypto (erc4337) delegation only — call this out, since `mpp.fetch` can't use card delegation this release.
  - READMEs for each, kept in sync with code (repo rule).

- **Plan 3 — Showcase live-run against the real backend.**
  - Extend `showcase/app/api/agent/route.ts`: when a tutorial sets `endpointEnv` and the env var is present, do the buyer round-trip **server-side** (buyer NVM key + delegation held server-side, never in the browser — the route file's own header comment prescribes exactly this) instead of the `demo-agent.mjs` simulator; keep the simulator as the fallback.
  - Set `LiveRun.endpointEnv` on the x402 + MPP tutorial entries in `showcase/content/tutorials.ts`; add MPP tutorial cards (new `protocol` value or reuse `x402` with an MPP tag — decide in Plan 3).
  - Minor `LiveRunPanel` work to surface the real settlement receipt / MPP handshake.

- **Plan 4 (optional) — Retire the fabricated weather answers** in `demo-agent.mjs` for the deployed tutorials, or leave them as the offline fallback.

Dependencies: Plan 2 needs Plan 1's code; Plan 3 needs Plan 1's deployed URL and Plan 2's tutorial dirs. Recommend shipping Plan 1 as one PR, then Plan 2, then Plan 3.
