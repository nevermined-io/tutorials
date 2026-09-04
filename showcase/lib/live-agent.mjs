// Live buyer behind the "see it run" panels — the REAL counterpart to demo-agent.mjs.
// It speaks the same response contract the panel expects ({status, body, state}), but performs
// genuine x402 / MPP purchases against a deployed weather agent.
//
// The buyer identity is the VIEWER's own Nevermined API key: the panel obtains it via the
// "Connect with Nevermined" flow, stores it in localStorage, and sends it on each request. The key
// only travels to this same-origin API route (never cross-origin) and is used server-side to mint
// tokens on the viewer's behalf. A shared NVM_API_KEY env var is a dev fallback when no per-user
// key is supplied.
//
// ponytail: per-key Payments + one delegation cached per key — enough for a demo. Real on-chain
// balance readback / per-viewer credit accounting later if needed.

import { Payments } from "@nevermined-io/payments";
import { X402_HEADERS } from "@nevermined-io/payments/express";

const AGENT_URL = process.env.WEATHER_AGENT_URL || "";
// Shared-key fallback is DEV-ONLY and off unless explicitly enabled. In production it stays empty,
// so a request with no per-user key cannot spend the shared account (the cookie is UX-only and
// unsigned — it must never gate real spend). Every real purchase uses the VIEWER's own key.
const ENV_KEY = process.env.ALLOW_SHARED_KEY_DEV === "1" ? process.env.NVM_API_KEY || "" : "";
const START_BALANCE = 10;

// The deployed weather agent's source (the "server" behind these live demos). Both live slugs
// hit the same TS agent (MPP is TS-only), so they share these links.
const AGENT_CODE = [
  { label: "agent server", url: "https://github.com/nevermined-io/tutorials/tree/main/http-simple-agent-ts" },
  { label: "agent.ts", url: "https://github.com/nevermined-io/tutorials/blob/main/http-simple-agent-ts/src/agent.ts" },
  { label: "weather.service.ts", url: "https://github.com/nevermined-io/tutorials/blob/main/http-simple-agent-ts/src/services/weather.service.ts" },
];

// slug → how to buy from it. Add a row to wire another tutorial to the live agent.
const LIVE = {
  "http-simple-agent-ts": {
    protocol: "x402",
    route: "/weather/credits",
    planId: process.env.PLAN_ID_CREDITS || "",
    credits: 1,
    pill: "x402 · sandbox",
    greeting:
      "I'm a live weather agent. Ask for the weather in any city — each call is paid over x402 (1 credit) against the real Nevermined sandbox.",
    suggestions: ["What's the weather in Lisbon?", "Weather in Tokyo"],
  },
  "mpp-weather-payg": {
    protocol: "mpp",
    route: "/weather/payg",
    planId: process.env.PLAN_ID_PAYG || "",
    payg: true, // variable price per request (no fixed credit count)
    credits: 1, // fallback only; paygCost() computes the real per-request amount
    pill: "MPP · pay-as-you-go",
    greeting:
      "I'm a live weather agent paid over MPP (Machine Payments Protocol), priced pay-as-you-go. Ask for a city — add a number of days for a forecast (e.g. '5-day forecast in Berlin'). The buyer runs the challenge→credential handshake against the real sandbox.",
    suggestions: ["5-day forecast in Berlin", "Weather in Madrid"],
  },
};

// A slug is live-capable when the agent URL + a plan id are configured. Whether a given REQUEST
// runs live also needs a key (per-user or the env fallback) — see resolveKey / liveRespond.
export function isLiveSlug(slug) {
  return !!(AGENT_URL && LIVE[slug] && LIVE[slug].planId);
}
export function hasEnvKey() {
  return !!ENV_KEY;
}
function resolveKey(reqApiKey) {
  return (reqApiKey && String(reqApiKey).trim()) || ENV_KEY;
}

// ── per-key singletons ────────────────────────────────────────────────────────
const _payments = new Map(); // key -> Payments
const _delegation = new Map(); // key -> delegationId
function paymentsFor(key) {
  if (!_payments.has(key)) _payments.set(key, Payments.getInstance({ nvmApiKey: key }));
  return _payments.get(key);
}
async function delegationFor(key) {
  if (!_delegation.has(key)) {
    const { delegationId } = await paymentsFor(key).delegation.createDelegation({
      provider: "erc4337",
      spendingLimitCents: 10000,
      durationSecs: 604800,
      currency: "usdc",
    });
    _delegation.set(key, delegationId);
  }
  return _delegation.get(key);
}

function cityOf(message) {
  const inCity = message.match(/\bin\s+([A-Za-zÀ-ſ][A-Za-zÀ-ſ .'-]+)/);
  if (inCity) return inCity[1].trim().replace(/[.?!]+$/, "");
  const cap = message.match(/\b([A-Z][A-Za-zÀ-ſ]{2,})\b/);
  return cap ? cap[1] : "Lisbon";
}

// "5-day forecast" / "next 3 days" / "7 day" → the number of forecast days (pay-as-you-go).
function daysOf(message) {
  const m = message.match(/(\d+)\s*[- ]?\s*day/i);
  return m ? Math.max(1, Math.min(7, parseInt(m[1], 10))) : undefined;
}

// Pay-as-you-go price for a request: 1 credit for today, up to 7 for a forecast.
// Mirrors the agent's priceForRequest so the UI can show the real, variable cost.
function paygCost(body) {
  const d = body.days;
  return typeof d === "number" && d > 1 ? Math.min(7, Math.trunc(d)) : 1;
}

function formatWeather(w) {
  const place = w.country ? `${w.city}, ${w.country}` : w.city;
  // multi-day forecast (pay-as-you-go /weather/payg with days > 1)
  if (Array.isArray(w.days)) {
    const lines = w.days.map((d) => {
      const t = `${d.tmaxC ?? "?"}° / ${d.tminC ?? "?"}°C`;
      return `  ${d.date}: ${t}${d.weatherText ? ", " + String(d.weatherText).toLowerCase() : ""}`;
    });
    return `${place} — ${w.days.length}-day forecast\n${lines.join("\n")}`;
  }
  // single-day current weather
  const parts = [];
  if (w.tmaxC != null || w.tminC != null) parts.push(`${w.tmaxC ?? "?"}° / ${w.tminC ?? "?"}°C`);
  if (w.weatherText) parts.push(String(w.weatherText).toLowerCase());
  if (w.precipitationMm != null) parts.push(`${w.precipitationMm}mm precip`);
  return `${place} — ${parts.join(", ")}`;
}

const freshState = () => ({ authorized: false, balance: START_BALANCE });

async function buyX402(key, cfg, body) {
  const { accessToken } = await paymentsFor(key).x402.getX402AccessToken(cfg.planId, undefined, {
    delegationConfig: { delegationId: await delegationFor(key) },
  });
  const res = await fetch(`${AGENT_URL}${cfg.route}`, {
    method: "POST",
    headers: { "content-type": "application/json", [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken },
    body: JSON.stringify(body),
  });
  if (res.status !== 200) throw new Error(`agent returned ${res.status}: ${await res.text()}`);
  const settled = !!res.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
  return { weather: await res.json(), note: settled ? "settled in one x402 round-trip" : "served (settlement async)" };
}

async function buyMpp(key, cfg, body) {
  const { response, paid, credentialsPresented } = await paymentsFor(key).mpp.fetch(
    `${AGENT_URL}${cfg.route}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    { delegationConfig: { delegationId: await delegationFor(key) }, planId: cfg.planId, maxCredits: 7 },
  );
  if (response.status !== 200) throw new Error(`agent returned ${response.status}`);
  return {
    weather: await response.json(),
    note: paid
      ? "settled via MPP credential"
      : `MPP handshake served (credential presented=${credentialsPresented}); settlement pending on this backend`,
  };
}

/**
 * Real buyer, mirroring demo-agent.mjs's respond() contract.
 * req: { slug, action, message?, apiKey? }
 * @returns {Promise<{status:number, body:object, state:{authorized:boolean,balance:number}}>}
 */
export async function liveRespond(state, req) {
  const s = state && typeof state.balance === "number" ? { ...state } : freshState();
  const cfg = LIVE[req.slug];
  if (!cfg) return { status: 404, body: { error: "unknown live agent" }, state: s };
  const key = resolveKey(req.apiKey);

  if (req.action === "intro") {
    return {
      status: 200,
      body: {
        live: true, // tells the panel to show the "Connect with Nevermined" flow
        greeting: cfg.greeting,
        suggestions: cfg.suggestions,
        pill: cfg.pill,
        credits: cfg.credits,
        hasFreeTier: false,
        connected: !!key,
        authorized: s.authorized,
        balance: s.balance,
        code: AGENT_CODE, // links to the deployed agent (server) source
      },
      state: s,
    };
  }

  // Every action past intro needs a buyer key.
  if (!key) {
    return { status: 401, body: { kind: "not_connected", error: "Connect with Nevermined to get an API key first." }, state: s };
  }

  if (req.action === "authorize") {
    try {
      await delegationFor(key); // create the real erc4337 delegation for this key now
    } catch (e) {
      return { status: 502, body: { error: `could not create delegation: ${e.message}` }, state: s };
    }
    return { status: 200, body: { ok: true, method: "erc4337 delegation", balance: s.balance }, state: { authorized: true, balance: s.balance } };
  }

  if (req.action === "reset") {
    return { status: 200, body: { ok: true }, state: freshState() };
  }

  if (req.action === "ask") {
    const message = (req.message || "").trim();
    if (!message) return { status: 400, body: { error: "empty message" }, state: s };
    const days = daysOf(message);
    const body = { city: cityOf(message), ...(days ? { days } : {}) };
    // Pay-as-you-go: the real cost depends on the request (1..7). Fixed plans use cfg.credits.
    const cost = cfg.payg ? paygCost(body) : cfg.credits;
    if (!s.authorized) {
      return {
        status: 402,
        body: { kind: "payment_required", credits: cost, payg: !!cfg.payg, method: cfg.protocol },
        state: s,
      };
    }
    if (s.balance < cost) {
      return { status: 402, body: { kind: "insufficient", balance: s.balance }, state: s };
    }
    try {
      const { weather, note } = cfg.protocol === "mpp" ? await buyMpp(key, cfg, body) : await buyX402(key, cfg, body);
      const next = { authorized: true, balance: s.balance - cost };
      return {
        status: 200,
        body: { kind: "paid", answer: `${formatWeather(weather)}\n\n(${note})`, credits: cost, payg: !!cfg.payg, balance: next.balance },
        state: next,
      };
    } catch (e) {
      return { status: 502, body: { kind: "error", error: `live agent call failed: ${e.message}` }, state: s };
    }
  }

  return { status: 400, body: { error: "unknown action" }, state: s };
}
