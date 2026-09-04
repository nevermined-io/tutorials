// Live buyer behind the "see it run" panels — the REAL counterpart to demo-agent.mjs.
// It speaks the same response contract the panel expects ({status, body, state}), but performs
// genuine x402 / MPP purchases against a deployed weather agent, paying with a sandbox account
// held server-side (NVM_API_KEY never reaches the browser). Enabled per-slug only when the env is
// present; otherwise the route falls back to the pure simulator.
//
// ponytail: one shared delegation + a per-session credit counter — enough for a demo. Per-viewer
// delegations / real on-chain balance readback if this ever needs to bill distinct visitors.

import { Payments } from "@nevermined-io/payments";
import { X402_HEADERS } from "@nevermined-io/payments/express";

const AGENT_URL = process.env.WEATHER_AGENT_URL || "";
const NVM_API_KEY = process.env.NVM_API_KEY || "";
const START_BALANCE = 10;

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
  "http-simple-agent-py": {
    protocol: "mpp",
    route: "/weather/credits",
    planId: process.env.PLAN_ID_CREDITS || "",
    credits: 1,
    pill: "MPP · sandbox",
    greeting:
      "I'm a live weather agent paid over MPP (Machine Payments Protocol). Ask for a city — the buyer runs the challenge→credential handshake against the real sandbox.",
    suggestions: ["What's the weather in Madrid?", "Weather in Berlin"],
  },
};

export function isLiveSlug(slug) {
  return !!(AGENT_URL && NVM_API_KEY && LIVE[slug] && LIVE[slug].planId);
}

// ── lazy singletons ─────────────────────────────────────────────────────────
let _payments;
function payments() {
  if (!_payments) _payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY });
  return _payments;
}
let _delegationId;
async function delegationId() {
  if (!_delegationId) {
    const { delegationId: id } = await payments().delegation.createDelegation({
      provider: "erc4337",
      spendingLimitCents: 10000,
      durationSecs: 604800,
      currency: "usdc",
    });
    _delegationId = id;
  }
  return _delegationId;
}

function cityOf(message) {
  const inCity = message.match(/\bin\s+([A-Za-zÀ-ſ][A-Za-zÀ-ſ .'-]+)/);
  if (inCity) return inCity[1].trim().replace(/[.?!]+$/, "");
  const cap = message.match(/\b([A-Z][A-Za-zÀ-ſ]{2,})\b/);
  return cap ? cap[1] : "Lisbon";
}

function formatWeather(w) {
  const parts = [];
  const place = w.country ? `${w.city}, ${w.country}` : w.city;
  if (w.tmaxC != null || w.tminC != null) parts.push(`${w.tmaxC ?? "?"}° / ${w.tminC ?? "?"}°C`);
  if (w.weatherText) parts.push(String(w.weatherText).toLowerCase());
  if (w.precipitationMm != null) parts.push(`${w.precipitationMm}mm precip`);
  return `${place} — ${parts.join(", ")}`;
}

const freshState = () => ({ authorized: false, balance: START_BALANCE });

async function buyX402(cfg, city) {
  const { accessToken } = await payments().x402.getX402AccessToken(cfg.planId, undefined, {
    delegationConfig: { delegationId: await delegationId() },
  });
  const res = await fetch(`${AGENT_URL}${cfg.route}`, {
    method: "POST",
    headers: { "content-type": "application/json", [X402_HEADERS.PAYMENT_SIGNATURE]: accessToken },
    body: JSON.stringify({ city }),
  });
  if (res.status !== 200) throw new Error(`agent returned ${res.status}: ${await res.text()}`);
  const settled = !!res.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
  return { weather: await res.json(), settled, note: settled ? "settled in one x402 round-trip" : "served (settlement async)" };
}

async function buyMpp(cfg, city) {
  const { response, paid, settled, credentialsPresented } = await payments().mpp.fetch(
    `${AGENT_URL}${cfg.route}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city }) },
    { delegationConfig: { delegationId: await delegationId() }, planId: cfg.planId },
  );
  if (response.status !== 200) throw new Error(`agent returned ${response.status}`);
  return {
    weather: await response.json(),
    settled: !!settled,
    note: paid
      ? "settled via MPP credential"
      : `MPP handshake served (credential presented=${credentialsPresented}); settlement pending on this backend`,
  };
}

/**
 * Real buyer, mirroring demo-agent.mjs's respond() contract.
 * @returns {Promise<{status:number, body:object, state:{authorized:boolean,balance:number}}>}
 */
export async function liveRespond(state, req) {
  const s = state && typeof state.balance === "number" ? { ...state } : freshState();
  const cfg = LIVE[req.slug];
  if (!cfg) return { status: 404, body: { error: "unknown live agent" }, state: s };

  if (req.action === "intro") {
    return {
      status: 200,
      body: {
        greeting: cfg.greeting,
        suggestions: cfg.suggestions,
        pill: cfg.pill,
        credits: cfg.credits,
        hasFreeTier: false,
        authorized: s.authorized,
        balance: s.balance,
      },
      state: s,
    };
  }

  if (req.action === "authorize") {
    try {
      await delegationId(); // create the real erc4337 delegation now
    } catch (e) {
      return { status: 502, body: { error: `could not create delegation: ${e.message}` }, state: s };
    }
    const next = { authorized: true, balance: s.balance };
    return { status: 200, body: { ok: true, method: "erc4337 delegation", balance: next.balance }, state: next };
  }

  if (req.action === "reset") {
    return { status: 200, body: { ok: true }, state: freshState() };
  }

  if (req.action === "ask") {
    const message = (req.message || "").trim();
    if (!message) return { status: 400, body: { error: "empty message" }, state: s };
    if (!s.authorized) {
      return { status: 402, body: { kind: "payment_required", credits: cfg.credits, method: cfg.protocol }, state: s };
    }
    if (s.balance < cfg.credits) {
      return { status: 402, body: { kind: "insufficient", balance: s.balance }, state: s };
    }
    const city = cityOf(message);
    try {
      const { weather, note } = cfg.protocol === "mpp" ? await buyMpp(cfg, city) : await buyX402(cfg, city);
      const next = { authorized: true, balance: s.balance - cfg.credits };
      return {
        status: 200,
        body: { kind: "paid", answer: `${formatWeather(weather)}\n\n(${note})`, credits: cfg.credits, balance: next.balance },
        state: next,
      };
    } catch (e) {
      return { status: 502, body: { kind: "error", error: `live agent call failed: ${e.message}` }, state: s };
    }
  }

  return { status: 400, body: { error: "unknown action" }, state: s };
}
