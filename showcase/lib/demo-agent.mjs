// Sandbox agent behind the "see it run" panels. Pure logic — no HTTP, no cookies —
// so it's unit-testable and the route stays thin. It speaks the real x402 shape
// (402 without a token → authorize → 200 + settlement) with a real per-session
// credit balance, but talks to no external service and spends no real money.
//
// To point a tutorial at a REAL hosted agent instead, see app/api/agent/route.ts.

const START_BALANCE = 100;

/** crude "is this just chit-chat / introspection?" check for freemium agents */
function isIntrospection(m) {
  return /\b(what|who|how|help|hi|hello|hey|pricing|price|cost|can you|do you|capabilities)\b/i.test(
    m,
  );
}

function topicOf(m) {
  const t = m
    .replace(/^(please\s+)?(research|analyze|analyse|look\s+into|study|tell me about|give me)\s+/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  return t || "that market";
}

function cityOf(m) {
  const inCity = m.match(/\bin\s+([A-Z][a-zA-ZÀ-ſ]+)/);
  if (inCity) return inCity[1];
  const cap = m.match(/\b([A-Z][a-zA-ZÀ-ſ]{2,})\b/);
  return cap ? cap[1] : "Lisbon";
}

function marketAnswer(m) {
  const topic = topicOf(m);
  return (
    `Market snapshot — ${topic}\n\n` +
    `• Size — a multi-billion-dollar market, growing double digits year over year\n` +
    `• Leaders — a few incumbents plus a cohort of fast-moving challengers\n` +
    `• Momentum — hiring and funding have trended up over recent quarters\n\n` +
    `Structured analysis from the paid research tool.`
  );
}

// Per-tutorial behavior. hasFreeTier=true means introspection is free (freemium);
// otherwise every call is paid (route-level / minimal paywall tutorials).
const AGENTS = {
  "langchain-research-agent": {
    pill: "card delegation",
    credits: 5,
    hasFreeTier: true,
    greeting:
      "I'm a market-research agent. Ask me what I do for free; ask me to research a market and the paid tool runs. ",
    suggestions: ["What can you do?", "Research the EV market in Europe"],
    freeAnswer: () =>
      "I answer questions about myself for free. Ask me to research a market — that runs the paid tool.",
    paidAnswer: marketAnswer,
  },
  "langchain-deep-agent": {
    pill: "budget-capped",
    credits: 5,
    hasFreeTier: true,
    greeting:
      "I'm a research supervisor. Chatting is free; asking me to research something delegates to a paid subagent.",
    suggestions: ["What can you help with?", "Research the EV market in Europe"],
    freeAnswer: () =>
      "I delegate real research to a subagent whose tool is paid. Ask me to research something to see it.",
    paidAnswer: (m) =>
      marketAnswer(m) + "\n\nDelegated one task() hop away; the token survived the delegation.",
  },
  "langchain-paid-agent": {
    pill: "in-process",
    credits: 1,
    hasFreeTier: false,
    greeting: "Ask me to use the paid tool — every invocation is gated by @requires_payment.",
    suggestions: ["Use the paid tool"],
    paidAnswer: (m) =>
      `The paid tool ran on: "${m}". Settlement receipt is on configurable["payment_settlement"].`,
  },
  "http-simple-agent-ts": {
    pill: "x402 v2",
    credits: 1,
    hasFreeTier: false,
    greeting: "POST /ask is payment-gated. Send a question to run the x402 round-trip.",
    suggestions: ["What's the weather in Lisbon?", "Summarize today's AI news"],
    paidAnswer: (m) => `{ "answer": "Here's a concise take on: ${m}" }`,
  },
  "http-simple-agent-py": {
    pill: "x402 v2",
    credits: 1,
    hasFreeTier: false,
    greeting: "POST /ask is payment-gated. Send a question to run the x402 round-trip.",
    suggestions: ["What's the weather in Madrid?", "Summarize today's AI news"],
    paidAnswer: (m) => `{ "answer": "Here's a concise take on: ${m}" }`,
  },
  "langchain-langsmith-deployment": {
    pill: "route-level",
    credits: 1,
    hasFreeTier: false,
    greeting: "The runs/wait route is gated. Send input to run the 402 round-trip against the echo agent.",
    suggestions: ["hello from the buyer"],
    paidAnswer: (m) => `{ "output": "echo: ${m}" }`,
  },
  "weather-mcp": {
    pill: "MCP · x402 v2",
    credits: 1,
    hasFreeTier: false,
    greeting: "Call weather.today for a city — the MCP tool is payment-gated.",
    suggestions: ["What's the weather in Lisbon?", "weather.today Berlin"],
    paidAnswer: (m) => {
      const c = cityOf(m);
      const t = 14 + (c.length % 12);
      return `{ "city": "${c}", "tempC": ${t}, "summary": "clear" }`;
    },
  },
  "weather-mcp-py": {
    pill: "MCP · x402 v2",
    credits: 1,
    hasFreeTier: false,
    greeting: "Call weather.today for a city — the FastMCP tool is payment-gated.",
    suggestions: ["What's the weather in Madrid?", "weather.today Tokyo"],
    paidAnswer: (m) => {
      const c = cityOf(m);
      const t = 16 + (c.length % 12);
      return `{ "city": "${c}", "tempC": ${t}, "summary": "sunny" }`;
    },
  },
};

export function getAgent(slug) {
  return AGENTS[slug];
}

const freshState = () => ({ authorized: false, balance: START_BALANCE });

/**
 * @param {{authorized:boolean, balance:number}|undefined} state
 * @param {{slug:string, action:"intro"|"ask"|"authorize"|"reset", message?:string}} req
 * @returns {{status:number, body:object, state:{authorized:boolean,balance:number}}}
 */
export function respond(state, req) {
  const s = state && typeof state.balance === "number" ? { ...state } : freshState();
  const cfg = AGENTS[req.slug];
  if (!cfg) return { status: 404, body: { error: "unknown agent" }, state: s };

  if (req.action === "intro") {
    return {
      status: 200,
      body: {
        greeting: cfg.greeting,
        suggestions: cfg.suggestions,
        pill: cfg.pill,
        credits: cfg.credits,
        hasFreeTier: !!cfg.hasFreeTier,
        authorized: s.authorized,
        balance: s.balance,
      },
      state: s,
    };
  }

  if (req.action === "authorize") {
    const next = { authorized: true, balance: s.balance };
    return { status: 200, body: { ok: true, method: "visa *4242", balance: next.balance }, state: next };
  }

  if (req.action === "reset") {
    return { status: 200, body: { ok: true }, state: freshState() };
  }

  if (req.action === "ask") {
    const message = (req.message || "").trim();
    if (!message) return { status: 400, body: { error: "empty message" }, state: s };

    if (cfg.hasFreeTier && isIntrospection(message)) {
      return { status: 200, body: { kind: "free", answer: cfg.freeAnswer(message) }, state: s };
    }
    if (!s.authorized) {
      return {
        status: 402,
        body: { kind: "payment_required", credits: cfg.credits, method: "card delegation" },
        state: s,
      };
    }
    if (s.balance < cfg.credits) {
      return { status: 402, body: { kind: "insufficient", balance: s.balance }, state: s };
    }
    const next = { authorized: true, balance: s.balance - cfg.credits };
    return {
      status: 200,
      body: { kind: "paid", answer: cfg.paidAnswer(message), credits: cfg.credits, balance: next.balance },
      state: next,
    };
  }

  return { status: 400, body: { error: "unknown action" }, state: s };
}

// ── runnable self-check: `node lib/demo-agent.mjs` ───────────────────────────
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const assert = (c, m) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  // freemium: introspection is free, no balance change, no auth needed
  let r = respond(undefined, { slug: "langchain-research-agent", action: "ask", message: "What can you do?" });
  assert(r.status === 200 && r.body.kind === "free", "intro should be free");
  assert(r.state.balance === 100, "free call must not spend");

  // paid without auth → 402
  r = respond(r.state, { slug: "langchain-research-agent", action: "ask", message: "Research the EV market" });
  assert(r.status === 402 && r.body.kind === "payment_required", "paid w/o auth → 402");

  // authorize then pay → 200, balance -5
  r = respond(r.state, { slug: "langchain-research-agent", action: "authorize" });
  assert(r.state.authorized && r.state.balance === 100, "authorize keeps balance");
  r = respond(r.state, { slug: "langchain-research-agent", action: "ask", message: "Research the EV market" });
  assert(r.status === 200 && r.body.kind === "paid" && r.body.balance === 95, "paid → 200, -5 credits");

  // all-paid tutorial: first ask → 402 (no free tier)
  r = respond(undefined, { slug: "weather-mcp", action: "ask", message: "weather in Lisbon" });
  assert(r.status === 402, "all-paid first call → 402");
  r = respond(respond(r.state, { slug: "weather-mcp", action: "authorize" }).state, {
    slug: "weather-mcp",
    action: "ask",
    message: "weather in Lisbon",
  });
  assert(r.status === 200 && /Lisbon/.test(r.body.answer), "weather answers for the city");

  // insufficient balance path
  let st = { authorized: true, balance: 0 };
  r = respond(st, { slug: "weather-mcp", action: "ask", message: "weather in Paris" });
  assert(r.status === 402 && r.body.kind === "insufficient", "zero balance → insufficient");

  console.log("✓ demo-agent self-check passed");
}
