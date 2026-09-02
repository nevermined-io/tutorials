# Diligence-in-a-Box

**An AI agent that assembles a VC-grade investment memo on a startup — and pays for every source it needs, itself.**

Imagine giving an assistant a small prepaid budget and a single instruction: *"build me an investment memo on Perplexity."* It goes off, finds the data sources it needs, uses them, pays each one directly, and comes back with a finished memo — company overview, a founder deep-dive, hiring and news momentum, SEC filings, and web research. No accounts to create, no API keys to wire up, no buttons to click along the way.

That's this demo. It replaces an analyst's morning of tab-hopping with one prompt.

🖥️ **Explore the memo it produced:** [**the interactive showcase**](https://claude.ai/code/artifact/8f5df009-8a3f-4d39-86dd-5f1c61efb22b) — the whole one-page memo, plus the on-chain receipt of everything the agent paid for.
🎬 **Watch it happen:** [`diligence-in-a-box.mp4`](./diligence-in-a-box.mp4) — an ~80-second walkthrough (English + Spanish subtitles included).

> From our run on 2026-09-02 — target: **Perplexity** (`perplexity.ai`). Total cost: **about 49 cents**. Human clicks: **zero**.

---

## Why this is interesting

Normally, for software to use a paid online service, a person has to sign up, enter a credit card, and manage secret API keys — for *every* provider. This demo shows a different way to work:

- The **agent itself** holds a small, capped budget — think of it as a prepaid card with a spending limit you set.
- It **pays each source directly, on demand**, only for what it actually uses.
- Nothing is arranged with any provider in advance. The agent **discovers** the sources it needs and pays them as it goes.

The result is an agent that can genuinely *do research on its own* in a paid world — safely, because you set the limit.

## What happens, step by step

You give the agent **one prompt**. Behind the scenes it does five things, in order, paying for each:

| Step | What the agent does | The kind of service it used |
|------|---------------------|-----------------------------|
| 1 | Pulls the company's funding, size, and founder roster | a company-data service (Aviato) |
| 2 | Runs a deep-dive on the CEO | a person-research service (OneShot) |
| 3 | Gauges hiring and news momentum | a company-signals service (PredictLeads) |
| 4 | Checks for any SEC filings | SEC EDGAR full-text search |
| 5 | Scrapes the live website for product research | a web-scraping service (Riveter) |

Each source is one it found in the **Nevermined Catalog** — a directory of pay-per-use services built for AI agents. It pays through the **Nevermined Router**, so the agent never has to learn how each provider wants to be paid; the Router sorts that out and settles the payment.

Across the five sources, the agent paid using **two different payment methods** over **two different blockchains** — and it never once asked a human to pay.

## The one prompt

The agent is given exactly one ability — the Router it can pay through — and this instruction:

> *"Build me an investment memo on Perplexity (perplexity.ai): a company + funding overview, a founder deep-dive on the CEO, hiring & news momentum, any SEC filings, and web/product research. Discover every source in the Nevermined Catalog and pay for each through the Router — never ask me to pay."*

It's not told which services to use or how to pay them. It works that out itself.

## What the memo found (from our run)

- **Company** — Perplexity AI, Inc., an AI answer engine in San Francisco; ~1,466 staff; **$933.9M** raised across 5 rounds; last round a $500M Series D.
- **Founder** — CEO **Aravind Srinivas**, Ph.D. from UC Berkeley, dual degree from IIT Madras.
- **Momentum** — 100+ open roles (engineering-heavy, with a notable legal ramp) and a fast news trail: Hybrid Compute, Enterprise Spaces, partnerships with Intuit and Dun & Bradstreet.
- **SEC filings** — none directly (Perplexity is private) — but **309** third-party hits: dozens of Form-D investment vehicles created just to hold Perplexity equity. The *absence* of direct filings, plus that SPV demand, is itself a signal.
- **Product** — "Ask anything," now expanding from search into agentic work ("Computer").

## The receipt (proof it really paid)

Every purchase is a real payment, recorded on a public blockchain, all under the single budget you set:

| Source | What it provided | Rail · Chain | Cost |
|--------|------------------|--------------|------|
| Aviato | company overview | MPP · Tempo | $0.120 |
| Aviato | founder roster | MPP · Tempo | $0.020 |
| OneShot | founder deep-dive | x402 · Base | $0.050 |
| PredictLeads | hiring signals | MPP · Tempo | $0.040 |
| PredictLeads | news & events | MPP · Tempo | $0.040 |
| EDGAR | SEC full-text | MPP · Tempo | $0.008 |
| Riveter | web research | MPP · Tempo | $0.209 |
| **Total** | | **2 rails · 2 chains** | **~$0.49** |

Five sources, seven payments, two payment rails, two blockchains, about fifty cents — zero clicks.

## Try it yourself

**You'll need:** a Nevermined account API key, and a little real balance (this runs on live blockchains — about **$0.49** per run, so keep the budget small).

1. Save your key in a file the script can read:
   ```bash
   umask 077
   cat > ~/.nvm-router-buyer.json <<'EOF'
   { "apiBase": "https://api.live.nevermined.app", "apiKey": "live:YOUR_KEY_HERE" }
   EOF
   ```
2. Run the demo:
   ```bash
   ./run-demo.sh
   ```
   The script sets up a small capped budget, then runs the five steps above — printing what it buys, saving each source's raw response to `./out/`, and ending with the on-chain receipt. To profile a different company: `DOMAIN=stripe.com COMPANY_NAME=Stripe ./run-demo.sh`.

> ⚠️ **Real money.** Each run spends ~$0.49 on live blockchains. The script caps the budget at $1.00 and 15 minutes so it can never overspend.

## The prompt file

The exact instruction handed to the agent is in [`demo-prompt.txt`](./demo-prompt.txt).

## Learn more

- **Nevermined Catalog** — the directory of pay-per-use services for agents.
- **The Router** — how one call lets an agent pay any listed service, whatever payment method it uses.

*Part of the Nevermined tutorials. This demo was executed live; see the video for the full run. The memo is an automated demonstration built from third-party data and is not investment advice, nor affiliated with Perplexity.*
