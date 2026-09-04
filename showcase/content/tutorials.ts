import type { Tutorial, Protocol } from "@/lib/types";

// Every entry is sourced from the tutorial's own README in this repo.
// Order here is the gallery order.
export const tutorials: Tutorial[] = [
  // ─────────────────────────────── 1. Research agent (featured) ──────────────
  {
    slug: "langchain-research-agent",
    title: "Freemium research agent, gated by x402",
    tagline:
      "Chat for free to learn what it does; it charges only when it actually runs the research. The paywall sits inside the tool, not the route.",
    protocol: "langchain",
    language: "py",
    tier: "live",
    repoPath: "langchain-research-agent-py/",
    featured: true,
    learn: {
      lead: "How to charge for one capability while everything around it stays free.",
      bullets: [
        "Wrap a LangChain @tool so it runs verify → work → settle on every paid call",
        'Let the LLM concierge answer "what can you do?" for free, and route only real work through payment',
        "Thread an x402 access token onto a run at config.configurable.payment_token",
        "Read the settlement receipt back and show the buyer credits burned and balance left",
      ],
    },
    how: {
      paragraphs: [
        "The @requires_payment decorator wraps the tool body with the canonical x402 lifecycle. The buyer's token rides on the run; the decorator finds it, verifies it, does the work, then settles credits — one round-trip.",
        "No free question ever enters that path — the concierge LLM handles introspection itself, so only the paid tool touches the facilitator.",
      ],
      flow: [
        { label: "verify", sub: "permissions" },
        { label: "tool body", sub: "the research", emphasis: true },
        { label: "settle", sub: "burn credits" },
      ],
    },
    tech: {
      stack: [
        "create_react_agent",
        "payments-py[langsmith]",
        "@requires_payment",
        "langgraph dev",
        "OpenAI gpt-4o-mini",
      ],
      samples: [
        {
          caption: "the token must sit here; the decorator reads it from the run",
          lang: "python",
          code: `{
  "assistant_id": "research",
  "input": {"messages": [ ... ]},
  "config": {"configurable": {"payment_token": access_token}}
}`,
        },
      ],
      files: [
        {
          path: "src/agent.py",
          desc: "the ReAct agent + the market_research tool, paid inner wrapped with @requires_payment",
        },
        {
          path: "src/buyer.py",
          desc: "CLI buyer exercising the free path and the paid path back-to-back",
        },
        {
          path: "langgraph.json",
          desc: "wires the graph at graphs.research — no http.app, gating is in-graph",
        },
      ],
    },
    run: {
      kind: "live",
      present: "chat",
      paymentPill: "card delegation active",
      endpointEnv: "NEXT_PUBLIC_RESEARCH_ENDPOINT",
      chat: [
        { role: "user", text: "What can you do?" },
        {
          role: "agent",
          free: true,
          text: "I'm a market-research agent. Ask me about a market and I'll pull together sizing, competitors and momentum. Introspection like this is free.",
        },
        { role: "user", text: "Research the EV market in Europe." },
      ],
      paidPrompt: {
        title: "This one's paid",
        body: "Running the research costs 5 credits. Authorize a small card delegation once and the agent pays per call — you're never asked again this session.",
        cta: "Authorize with card",
      },
      settle: "settled 5 credits · balance 95 · analysis below",
      paidAnswer:
        "## Market size — Europe's EV market reached ~2.0M new BEV units in 2024, led by Germany, the UK and France; charging density and fleet electrification are the fastest-moving segments…",
      note: "Live in the real showcase: the agent runs on a hosted LangGraph deployment; Authorize opens the Nevermined card-delegation popup and the token never leaves the server. If the backend is unreachable, this panel falls back to a recorded run.",
    },
  },

  // ─────────────────────────────── 2. HTTP simple agent (TS) ─────────────────
  {
    slug: "http-simple-agent-ts",
    title: "Protect an Express agent with x402",
    tagline:
      "A minimal Express server whose /ask endpoint is gated by the Nevermined payment middleware — one line per route.",
    protocol: "x402",
    language: "ts",
    tier: "live",
    repoPath: "http-simple-agent-ts/",
    learn: {
      lead: "The smallest possible paid HTTP agent: add a paywall to one route.",
      bullets: [
        "Protect an Express endpoint with paymentMiddleware from @nevermined-io/payments/express",
        "Return 402 with the payment-required envelope, verify the payment-signature, settle on success",
        "Generate an x402 access token on the client with the SDK and retry the call",
        "Optionally track OpenAI cost per call with Nevermined observability",
      ],
    },
    how: {
      paragraphs: [
        "The client calls /ask with no token and gets 402 Payment Required, carrying the payment-required header. It mints an x402 token with the SDK, retries with the payment-signature header, and the agent verifies, runs, and settles (burns credits) before returning 200 with a payment-response receipt.",
      ],
      flow: [
        { label: "POST /ask", sub: "no token" },
        { label: "402", sub: "payment-required" },
        { label: "sign + retry", sub: "payment-signature", emphasis: true },
        { label: "200", sub: "payment-response" },
      ],
    },
    tech: {
      stack: ["Express", "TypeScript", "@nevermined-io/payments/express", "OpenAI"],
      samples: [
        {
          caption: "one line gates the route",
          lang: "typescript",
          code: `import { paymentMiddleware } from '@nevermined-io/payments/express'

app.use(paymentMiddleware(payments, {
  'POST /ask': { planId: PLAN_ID, credits: 1 }
}))`,
        },
      ],
      files: [
        { path: "src/agent.ts", desc: "Express server with a payment-protected /ask endpoint" },
        {
          path: "src/agent-observability.ts",
          desc: "same agent, with Nevermined observability tracking OpenAI cost",
        },
        { path: "src/client.ts", desc: "demo client showing the full x402 payment flow" },
      ],
    },
    run: {
      kind: "live",
      present: "transcript",
      paymentPill: "x402 v2",
      transcript: [
        { t: "POST /ask   \"What's the weather in Lisbon?\"", kind: "req" },
        { t: "← 402 Payment Required", kind: "r402" },
        { t: "  payment-required: eyJ4NDAy…  plan · 1 credit", kind: "dim" },
        { t: "POST /ask   payment-signature: eyJ4NDAy…", kind: "req" },
        { t: "  verify → run → settle", kind: "dim" },
        { t: "← 200 OK   payment-response: settled", kind: "r200" },
        { t: "1 credit burned · agent answered", kind: "settle" },
      ],
      note: "Live in the real showcase: the browser mints a token via the SDK against a configured plan and calls a hosted instance of this agent. Without a reachable backend, this is a recorded round-trip.",
    },
  },

  // ─────────────────────────────── 3. HTTP simple agent (PY) ─────────────────
  {
    slug: "http-simple-agent-py",
    title: "The same paywall, on FastAPI",
    tagline:
      "A minimal FastAPI server with a payment-protected /ask endpoint using the payments-py SDK and ASGI middleware.",
    protocol: "x402",
    language: "py",
    tier: "live",
    repoPath: "http-simple-agent-py/",
    learn: {
      lead: "The Python twin of the Express tutorial — identical x402 flow, FastAPI stack.",
      bullets: [
        "Protect a FastAPI route with the payments-py ASGI payment middleware",
        "Handle the same 402 → sign → 200 round-trip the TypeScript version does",
        "Mint the x402 token on the client with the payments-py SDK",
        "Track OpenAI cost per call with Nevermined observability",
      ],
    },
    how: {
      paragraphs: [
        "Same contract as the TypeScript tutorial: no token yields 402 with a base64 payment-required header; the client mints an x402 token, retries with payment-signature; the agent verifies, executes, and settles credits before 200 with a payment-response receipt.",
      ],
      flow: [
        { label: "POST /ask", sub: "no token" },
        { label: "402", sub: "payment-required" },
        { label: "sign + retry", sub: "payment-signature", emphasis: true },
        { label: "200", sub: "payment-response" },
      ],
    },
    tech: {
      stack: ["FastAPI", "Python 3.10+", "payments-py", "OpenAI", "Poetry"],
      samples: [
        {
          caption: "src/agent.py — the protected endpoint (shape)",
          lang: "python",
          code: `# FastAPI app with the Nevermined ASGI payment middleware.
# /ask returns 402 until a valid x402 payment-signature is presented,
# then verifies, runs the LLM, and settles credits before responding.`,
        },
      ],
      files: [
        { path: "src/agent.py", desc: "FastAPI server with a payment-protected /ask endpoint" },
        {
          path: "src/agent_observability.py",
          desc: "same agent with Nevermined observability for OpenAI cost",
        },
        { path: "src/client.py", desc: "demo client showing the complete x402 payment flow" },
      ],
    },
    run: {
      kind: "live",
      present: "transcript",
      paymentPill: "x402 v2",
      transcript: [
        { t: "POST /ask   \"Summarize today's AI news\"", kind: "req" },
        { t: "← 402 Payment Required", kind: "r402" },
        { t: "  payment-required (base64) · plan · 1 credit", kind: "dim" },
        { t: "POST /ask   payment-signature: eyJ4NDAy…", kind: "req" },
        { t: "  verify → run → settle", kind: "dim" },
        { t: "← 200 OK   payment-response (base64)", kind: "r200" },
        { t: "1 credit burned · agent answered", kind: "settle" },
      ],
      note: "Live in the real showcase: the browser mints a token via the payments-py flow and calls a hosted instance. Without a reachable backend, this is a recorded round-trip.",
    },
  },

  // ─────────────────────────────── 4. LangChain paid agent ───────────────────
  {
    slug: "langchain-paid-agent",
    title: "Gate one LangChain tool with @requires_payment",
    tagline:
      "The minimal case: a single LangChain/LangGraph tool gated by Nevermined payments. No HTTP layer, no 402 round-trip — the buyer threads a token in-process.",
    protocol: "langchain",
    language: "py",
    tier: "live",
    repoPath: "langchain-paid-agent-py/",
    learn: {
      lead: "The payment flow with everything else stripped away, so it's the only signal.",
      bullets: [
        "Protect a LangChain @tool by wrapping it with @requires_payment",
        "Acquire an x402 access token with payments.x402.get_x402_access_token(plan_id=...)",
        'Thread the token through agent.invoke(..., config={"configurable": {"payment_token": ...}})',
        'Read the settlement receipt back from configurable["payment_settlement"]',
      ],
    },
    how: {
      paragraphs: [
        "It mirrors the x402 HTTP discovery pattern, in-process: the buyer invokes the agent with no token, the protected tool raises PaymentRequiredError carrying the full accepts block (scheme, network, plan id), and the buyer uses that to acquire a token before retrying.",
        "No plan id, scheme, or provider has to be configured on the buyer up front — the error tells it everything it needs.",
      ],
      flow: [
        { label: "invoke", sub: "no token" },
        { label: "PaymentRequiredError", sub: "accepts block" },
        { label: "get token", sub: "for that plan", emphasis: true },
        { label: "invoke", sub: "with token" },
      ],
    },
    tech: {
      stack: ["create_react_agent", "LangGraph", "payments-py[langchain]", "OpenAI gpt-4o-mini"],
      samples: [
        {
          caption: "the buyer retries with the token in configurable",
          lang: "python",
          code: `agent.invoke(
    {"messages": [...]},
    config={"configurable": {"payment_token": token}},
)`,
        },
      ],
      files: [
        { path: "src/agent.py", desc: "the agent + the single @requires_payment-protected tool" },
        { path: "src/buyer.py", desc: "buyer that hits the no-token path, then pays and retries" },
      ],
    },
    run: {
      kind: "live",
      present: "chat",
      paymentPill: "in-process",
      chat: [
        { role: "user", text: "Use the paid tool." },
        {
          role: "agent",
          text: "PaymentRequiredError — this tool needs payment. accepts: scheme=nvm:card-delegation, plan=plan-…",
        },
        { role: "user", text: "(buyer acquires token, retries)" },
      ],
      paidPrompt: {
        title: "Pay to invoke",
        body: "The buyer acquires an x402 access token for the plan named in the error, then invokes again with the token on config.configurable.payment_token.",
        cta: "Acquire token & retry",
      },
      settle: "tool ran · settlement receipt on configurable",
      paidAnswer: "The paid tool executed and returned its result; the settlement receipt is on configurable[\"payment_settlement\"].",
      note: "This tutorial runs entirely in-process (no server). The live panel mirrors the buyer script's two-phase call. Point it at your own account by following the README.",
    },
  },

  // ─────────────────────────────── 5. Deep agent ─────────────────────────────
  {
    slug: "langchain-deep-agent",
    title: "A paid tool inside a subagent",
    tagline:
      "A Deep Agents market-research agent where the paid capability lives inside a subagent. The x402 token survives the task() delegation hop, so @requires_payment needs no changes.",
    protocol: "langchain",
    language: "py",
    tier: "live",
    repoPath: "langchain-deep-agent-py/",
    learn: {
      lead: "Payment context survives one delegation hop — so paid tools can live where the work does.",
      bullets: [
        "Put a paid tool behind a task() delegation and keep the payment lifecycle intact",
        "Cap paid calls per run — a deep agent decides for itself how many subagent hops a request warrants",
        "Guard against the supervisor answering a paid question from its own knowledge (giving it away free)",
        "Compare harnesses side by side with the sibling create_react_agent research agent",
      ],
    },
    how: {
      paragraphs: [
        "The buyer attaches an x402 token to the run. The supervisor never touches it — it delegates via the built-in task tool, and LangGraph copies configurable down into the subagent's tool calls. So @requires_payment works unchanged one hop away from where the token was supplied.",
        "A deep agent can bill several times per user turn, so the tutorial caps it explicitly with NVM_MAX_PAID_CALLS_PER_RUN and sends a fresh nvm_run_id to scope the cap per-run rather than per-conversation.",
      ],
      flow: [
        { label: "main agent", sub: "supervisor" },
        { label: "task()", sub: "delegate" },
        { label: "research-sub", sub: "owns the tool", emphasis: true },
        { label: "market_research", sub: "PAID" },
      ],
    },
    tech: {
      stack: ["create_deep_agent", "LangChain v1 stack", "payments-py[langsmith]", "OpenAI gpt-4o-mini"],
      samples: [
        {
          caption: "the buyer scopes the per-run cap with a fresh run id",
          lang: "python",
          code: `"config": {"configurable": {
    "payment_token": token,
    "nvm_run_id": str(uuid.uuid4()),
}}`,
        },
      ],
      files: [
        { path: "src/agent.py", desc: "create_deep_agent supervisor + research-sub owning the paid tool" },
        { path: "src/buyer.py", desc: "sends token + nvm_run_id; prints the raw ToolMessage as source of truth" },
      ],
    },
    run: {
      kind: "live",
      present: "chat",
      paymentPill: "budget-capped · 3/run",
      chat: [
        { role: "user", text: "What can you help with?" },
        { role: "agent", free: true, text: "I'm a market-research supervisor. Ask me to research something and I'll delegate it to my research subagent." },
        { role: "user", text: "Research the EV market in Europe." },
      ],
      paidPrompt: {
        title: "Delegated & paid",
        body: "The supervisor delegates via task() to research-sub, whose paid tool runs verify → work → settle. Capped at 3 paid calls per run.",
        cta: "Authorize with card",
      },
      settle: "settled · raw ToolMessage is the source of truth",
      paidAnswer:
        "research-sub returned a structured market analysis; the buyer prints the raw ToolMessage, not the chat paraphrase, so nothing gets lost between the two LLM layers.",
      note: "Deep Agents needs its own virtualenv (LangChain v1). Live in the real showcase this runs on a hosted deployment; otherwise it's a recorded run.",
    },
  },

  // ─────────────────────────────── 6. LangSmith deployment ───────────────────
  {
    slug: "langchain-langsmith-deployment",
    title: "Every call is paid: route-level middleware",
    tagline:
      "Deploy a LangGraph agent to LangSmith Deployment and gate its runs/wait endpoint with the Nevermined x402 flow — a single env file plus four lines of glue.",
    protocol: "langchain",
    language: "py",
    tier: "live",
    repoPath: "langchain-langsmith-deployment-py/",
    learn: {
      lead: "When there's no free tier: gate the whole route, not a single tool.",
      bullets: [
        "Gate POST /threads/{id}/runs/wait with the payments-py ASGI PaymentMiddleware",
        "Keep POST /threads and discovery endpoints free; protect only the run",
        "Return 402 + the x402 envelope, then 200 + the settlement receipt on retry",
        "Deploy the graph to hosted LangSmith Deployment with langgraph up",
      ],
    },
    how: {
      paragraphs: [
        "The middleware follows the canonical x402 lifecycle: verify → agent runs → settle, and only settles if the agent succeeded. Failed runs don't bill the buyer; settlement failures after a successful run are logged but never surface to the client — the buyer already got the value.",
        "Use this pattern when every message is paid. For a free-introspection concierge, use the in-tool gating of the research agent instead.",
      ],
      flow: [
        { label: "verify", sub: "payment-signature" },
        { label: "agent runs", sub: "the graph", emphasis: true },
        { label: "settle", sub: "only if it succeeded" },
      ],
    },
    tech: {
      stack: ["LangSmith Deployment", "LangGraph", "payments-py", "Docker", "Python 3.11–3.13"],
      samples: [
        {
          caption: "the gated endpoint map",
          lang: "text",
          code: `POST /threads               → free
POST /threads/{id}/runs/wait → PAID (402 → 200 + receipt)
GET  /assistants/search, /info, /ok → pass through`,
        },
      ],
      files: [
        { path: "src/nvm_app.py", desc: "four lines of glue that wrap the app with PaymentMiddleware" },
        { path: "src/buyer.py", desc: "drives the 402 round-trip and prints the settlement receipt" },
      ],
    },
    run: {
      kind: "live",
      present: "transcript",
      paymentPill: "route-level",
      transcript: [
        { t: "POST /threads → thread_id = …", kind: "dim" },
        { t: "POST /threads/{id}/runs/wait  (no signature)", kind: "req" },
        { t: "← 402  scheme=nvm:erc4337, network=eip155:84532", kind: "r402" },
        { t: "  pick enrolled method · Visa *4242 · acquire token", kind: "dim" },
        { t: "POST /threads/{id}/runs/wait  payment-signature: eyJ…", kind: "req" },
        { t: "← 200  {output: 'echo: hello from the buyer'}", kind: "r200" },
        { t: "settlement receipt returned", kind: "settle" },
      ],
      note: "Live in the real showcase this calls a hosted LangSmith deployment. Without one reachable, this is a recorded round-trip.",
    },
  },

  // ─────────────────────────────── 7. Weather MCP (TS) ───────────────────────
  {
    slug: "weather-mcp",
    title: "Paywall MCP tools, resources & prompts",
    tagline:
      "A minimal MCP server exposing a weather.today tool, a weather://today resource and a weather.ensureCity prompt — all protected with credit-based access via the x402 v2 in-band MCP transport.",
    protocol: "mcp",
    language: "ts",
    tier: "live",
    repoPath: "mcp-examples/weather-mcp/",
    learn: {
      lead: "MCP says what an agent can do; Nevermined adds who can access it and how to charge.",
      bullets: [
        "Protect MCP tools, resources and prompts with a Nevermined paywall",
        "Authenticate the MCP session with Authorization: Bearer and read payment in-band from _meta[\"x402/payment\"]",
        "Compute credits dynamically per request",
        "Compare a high-level McpServer SDK build with a low-level JSON-RPC one",
      ],
    },
    how: {
      paragraphs: [
        "The MCP session is OAuth-protected: the client authenticates with an Authorization: Bearer access token, and the per-call payment is read in band from the MCP request _meta[\"x402/payment\"]. A header-only payment (no _meta) still works as a deprecated fallback for one release.",
        "Nevermined handles the Express server, sessions, OAuth discovery endpoints, credit checks and deduction — you expose the capability.",
      ],
      flow: [
        { label: "Bearer session", sub: "OAuth" },
        { label: "call tool", sub: "_meta x402/payment", emphasis: true },
        { label: "check + deduct", sub: "credits" },
        { label: "result", sub: "weather" },
      ],
    },
    tech: {
      stack: ["TypeScript", "Model Context Protocol", "@nevermined-io/payments ≥ 1.9", "Streamable HTTP"],
      samples: [
        {
          caption: "the capabilities this server exposes",
          lang: "text",
          code: `weather.today(city)        # tool
weather://today/{city}      # resource
weather.ensureCity          # prompt`,
        },
      ],
      files: [
        { path: "src/main.ts", desc: "MCP server with Nevermined Payments (withPaywall wrapper)" },
        { path: "src/services/weather.service.ts", desc: "weather data via Open-Meteo" },
        { path: "RUN.md", desc: "setup and running instructions" },
      ],
    },
    run: {
      kind: "live",
      present: "transcript",
      paymentPill: "MCP · x402 v2",
      transcript: [
        { t: "initialize session   Authorization: Bearer …", kind: "req" },
        { t: "tools/call weather.today { city: \"Lisbon\" }", kind: "req" },
        { t: "  no _meta[x402/payment] → 402", kind: "r402" },
        { t: "tools/call  _meta: { \"x402/payment\": … }", kind: "req" },
        { t: "  check + deduct credits", kind: "dim" },
        { t: "← result  { tempC: 21, summary: \"clear\" }", kind: "r200" },
        { t: "credits deducted · call authorized", kind: "settle" },
      ],
      note: "Live in the real showcase this connects to a hosted weather-mcp over Streamable HTTP; compatible with MCP Inspector. Without a reachable server, this is a recorded exchange.",
    },
  },

  // ─────────────────────────────── 8. Weather MCP (PY) ───────────────────────
  {
    slug: "weather-mcp-py",
    title: "The MCP paywall, in Python",
    tagline:
      "The Python equivalent of the Weather MCP server, built on FastMCP with the payments-py SDK — same tool, resource and prompt, same x402 v2 in-band transport.",
    protocol: "mcp",
    language: "py",
    tier: "live",
    repoPath: "mcp-examples/weather-mcp-py/",
    learn: {
      lead: "Everything the TypeScript MCP tutorial teaches, on FastMCP and payments-py.",
      bullets: [
        "Protect a Python MCP server with Nevermined using FastMCP",
        "Serve full OAuth 2.1 discovery (RFC 8414 / 9728) endpoints",
        "Pay per use with credits via x402 tokens",
        "Optionally enrich forecasts with OpenAI gpt-4o-mini",
      ],
    },
    how: {
      paragraphs: [
        "Same protocol surface as the TypeScript server — weather.today tool, weather://today resource, weather.ensureCity prompt — with the Bearer-authenticated session and in-band _meta payment. Requires payments-py[fastapi] ≥ 1.15.",
      ],
      flow: [
        { label: "Bearer session", sub: "OAuth 2.1" },
        { label: "call tool", sub: "_meta x402/payment", emphasis: true },
        { label: "check + deduct", sub: "credits" },
        { label: "result", sub: "weather" },
      ],
    },
    tech: {
      stack: ["Python 3.10+", "FastMCP", "payments-py[fastapi] ≥ 1.15", "Poetry", "OpenAI"],
      samples: [
        {
          caption: "MCP surface",
          lang: "text",
          code: `weather.today       # tool — current weather for any city
weather://today      # resource — static weather data
weather.ensureCity   # prompt — guide the LLM to request weather`,
        },
      ],
      files: [
        { path: "src/", desc: "FastMCP server with Nevermined payments + OAuth discovery" },
        { path: "README.md", desc: "installation and configuration" },
      ],
    },
    run: {
      kind: "live",
      present: "transcript",
      paymentPill: "MCP · x402 v2",
      transcript: [
        { t: "initialize session   Authorization: Bearer …", kind: "req" },
        { t: "tools/call weather.today { city: \"Madrid\" }", kind: "req" },
        { t: "  no _meta[x402/payment] → 402", kind: "r402" },
        { t: "tools/call  _meta: { \"x402/payment\": … }", kind: "req" },
        { t: "  check + deduct credits", kind: "dim" },
        { t: "← result  { tempC: 28, summary: \"sunny\" }", kind: "r200" },
        { t: "credits deducted · call authorized", kind: "settle" },
      ],
      note: "Live in the real showcase this connects to a hosted weather-mcp-py. Without a reachable server, this is a recorded exchange.",
    },
  },

  // ─────────────────────────────── 9. Song (recap) ──────────────────────────
  {
    slug: "song-from-the-headlines",
    title: "Song From the Headlines",
    tagline:
      "An agent turns today's #1 tech headline into a finished song and album cover — discovering four services in the Nevermined Catalog and paying each one itself, across two blockchains, for about 16 cents. Zero human clicks.",
    protocol: "catalog",
    language: "autonomous",
    tier: "recap",
    repoPath: "catalog/song-from-the-headlines/",
    learn: {
      lead: "An agent can act on its own in a paid world — safely, because you set the limit.",
      bullets: [
        "The agent holds a small capped budget, like a prepaid card with a spending limit",
        "It pays each service directly, on demand, only for what it uses",
        "Nothing is arranged with any provider in advance — it discovers services as it goes",
        "Every purchase is a real payment recorded on a public blockchain",
      ],
    },
    how: {
      paragraphs: [
        "One prompt, four paid steps, in order — each through a service the agent found in the Catalog and paid via the Router. Across the four it used two payment methods over two blockchains, and never once asked a human to pay.",
      ],
      table: {
        head: ["Step", "What the agent does", "Service"],
        rows: [
          ["1", "Finds today's #1 technology headline", "Brave"],
          ["2", "Writes 90s-pop-anthem lyrics about it", "2s.io"],
          ["3", "Turns the lyrics into a full, sung song", "Suno"],
          ["4", "Paints a matching album cover", "fal.ai"],
        ],
      },
    },
    tech: {
      stack: ["Nevermined Catalog", "the Router", "2 payment rails", "2 blockchains", "capped budget"],
      samples: [
        {
          caption: "the only ability it's given is the Router it can pay through",
          lang: "text",
          code: `"Find today's #1 tech headline, write 90s-pop-anthem lyrics
 about it, generate a full song and matching album cover.
 Discover every service in the Nevermined Catalog and pay
 for each through the Router — never ask me to pay."`,
        },
      ],
    },
    run: {
      kind: "recap",
      video: {
        src: "/media/song-from-the-headlines/song-from-the-headlines.mp4",
        subtitles: "/media/song-from-the-headlines/song-from-the-headlines.en.srt",
        caption: "song-from-the-headlines.mp4 · EN/ES subtitles",
        duration: "~70s",
      },
      outputs: {
        cover: { src: "/media/song-from-the-headlines/album-cover.jpg", label: "album-cover.jpg" },
        audio: { src: "/media/song-from-the-headlines/song.mp3", label: "song.mp3 — the finished track" },
      },
      receipt: {
        head: ["Service", "Step", "Cost"],
        rows: [
          ["Brave", "today's headline", "$0.035"],
          ["2s.io", "the lyrics", "$0.0025"],
          ["Suno", "the song", "$0.105"],
          ["fal.ai", "the album cover", "$0.003"],
          ["Total", "4 vendors · 2 chains", "~$0.16"],
        ],
        totalRow: 4,
      },
      warn: "Real money — the run-it-yourself script spends ~$0.16 on live blockchains, capped at 50¢ and 10 minutes so it can't overspend. That's why this tutorial is watch-only in the browser.",
      interactive: [
        { label: "Interactive showcase", href: "https://claude.ai/code/artifact/160b776a-65c5-4059-be76-e8972190df89" },
      ],
      takes: [
        {
          label: "Rod's take",
          byline: "An alternative recap of the very same run — same story, a different design — by Rod.",
          embedHref: "https://claude.ai/code/artifact/0a515c41-79e5-4a12-bd60-fe7805ffba25",
        },
      ],
    },
  },

  // ─────────────────────────────── 10. Diligence (recap) ────────────────────
  {
    slug: "diligence-in-a-box",
    title: "Diligence in a Box",
    tagline:
      "One prompt → a VC-grade investment memo on a startup. The agent finds and pays each data source through the Router itself — company overview, founder deep-dive, hiring momentum, SEC filings, web research. About 49 cents, zero clicks.",
    protocol: "catalog",
    language: "autonomous",
    tier: "recap",
    repoPath: "catalog/diligence-in-a-box/",
    learn: {
      lead: "It replaces an analyst's morning of tab-hopping with one prompt.",
      bullets: [
        "Give the agent a small prepaid budget and a single instruction",
        "It finds the data sources it needs and pays each one directly",
        "No accounts to create, no API keys to wire up, no buttons to click along the way",
        "It returns a finished memo, plus an on-chain receipt of everything it paid for",
      ],
    },
    how: {
      paragraphs: [
        "The agent assembles a company + funding overview, a founder deep-dive on the CEO, hiring & news momentum, any SEC filings, and web/product research — discovering every source in the Nevermined Catalog and paying for each through the Router.",
      ],
    },
    tech: {
      stack: ["Nevermined Catalog", "the Router", "multi-source", "capped budget"],
      samples: [
        {
          caption: "the prompt handed to the agent",
          lang: "text",
          code: `"Build me an investment memo on Perplexity (perplexity.ai):
 a company + funding overview, a founder deep-dive on the CEO,
 hiring & news momentum, any SEC filings, and web/product
 research. Discover every source in the Nevermined Catalog and
 pay for each through the Router — never ask me to pay."`,
        },
      ],
    },
    run: {
      kind: "recap",
      video: {
        src: "/media/diligence-in-a-box/diligence-in-a-box.mp4",
        subtitles: "/media/diligence-in-a-box/diligence-in-a-box.en.srt",
        caption: "diligence-in-a-box.mp4 · EN/ES subtitles",
        duration: "~80s",
      },
      warn: "Real money — this demo ran live on public blockchains (target: Perplexity, total ~$0.49). Watch-only in the browser; run it yourself from the repo with a small capped budget.",
      interactive: [
        { label: "Explore the memo it produced", href: "https://claude.ai/code/artifact/8f5df009-8a3f-4d39-86dd-5f1c61efb22b" },
      ],
    },
  },
];

export function getTutorial(slug: string): Tutorial | undefined {
  return tutorials.find((t) => t.slug === slug);
}

// Sidebar / index grouping — fixed group order, items keep content-array order.
export const GROUP_ORDER: { label: string; protocol: Protocol }[] = [
  { label: "Catalog", protocol: "catalog" },
  { label: "x402 HTTP", protocol: "x402" },
  { label: "MCP", protocol: "mcp" },
  { label: "LangChain", protocol: "langchain" },
];

export function groupedTutorials(): { label: string; protocol: Protocol; items: Tutorial[] }[] {
  return GROUP_ORDER.map(({ label, protocol }) => ({
    label,
    protocol,
    items: tutorials.filter((t) => t.protocol === protocol),
  })).filter((g) => g.items.length > 0);
}

// ponytail: one runnable check the type system can't give us — dup slugs would
// silently collide in generateStaticParams. Runs at import (i.e. during build).
const seen = new Set<string>();
for (const t of tutorials) {
  if (seen.has(t.slug)) throw new Error(`Duplicate tutorial slug: ${t.slug}`);
  seen.add(t.slug);
}
