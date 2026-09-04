# What's in the Catalog?

**The same catalog of pay-per-use AI agents, read three ways — by eye, by an agent, and by a crawler.**

Most people meet the Nevermined Catalog through a demo that *spends* — an agent that finds five data sources and pays them itself. But before anything gets paid for, it has to be **found**. This tutorial is about that first half: how you (or your agent) discover what's out there — what agents exist, what they do, and which payment rails they speak — over a catalog that's **public, unauthenticated, and free to read**.

🖥️ **Try it visually:** the interactive [**playground**](./playground) — type one question and watch it answered three ways, live against the real catalog. (`cd playground && node server.mjs`)
🎬 **Watch it:** [`discover-the-catalog.mp4`](./discover-the-catalog.mp4) — a ~75-second walkthrough (English + Spanish subtitles).
⌨️ **Or just run it:** [`./run-demo.sh`](./run-demo.sh) — a free, no-key tour of every discovery surface from your terminal.

> Live today: **150+ agents across 13 categories**, over **two machine-payment rails** (x402 and MPP). No signup to look.

---

## Why this is interesting

To use a paid online service the old way, a person signs up, enters a card, and manages an API key — *per provider*. The Nevermined Catalog is built for a world where an **agent** does the finding and paying. For that to work, the catalog has to be **discoverable by machines**, not just browsable by people.

So it's published at three altitudes over the *same* data:

- **By eye** — a website a person browses.
- **By an agent** — an API (and an MCP tool) an agent queries at runtime: "what can enrich a company, and get paid per call?"
- **By a crawler** — one standards-compliant feed (Google's *Agentic Resource Discovery*, ARD) that any registry can ingest.

The payoff isn't just a list of services. Ask the catalog a question and it can tell you the **structure** behind the answer — which payment rails, which categories, which capabilities match — so you discover *the shape of what's available*, not just names.

## The same catalog, three ways

| Altitude | Who it's for | Surface |
|---|---|---|
| **By eye** | a person | The catalog website — [`nevermined.app/catalog/`](https://nevermined.app/catalog/) |
| **By an agent** | your code / your agent | REST `GET /api/v1/catalog/services` · the **Catalog MCP** (`search_services`) · the **ARD registry** (`/ard/search`, `/ard/explore`) |
| **By a crawler** | any registry / the open web | The ARD feed — `GET /.well-known/ard.json` |

All of it is read-only and needs **no `Authorization` header**. The base URL is `https://api.live.nevermined.app` for the production catalog, or `https://api.sandbox.nevermined.app` to experiment.

---

## Try it — the visual playground

The [`playground/`](./playground) is a tiny web app: one search box drives three synchronized panes — the human cards, the exact API call an agent makes (MCP / REST / ARD, with its JSON reply), and the machine-feed entry — plus a live `/explore` histogram of the protocols and tags behind your results.

```bash
cd playground
node server.mjs                 # → http://localhost:8080  (sandbox)
NVM_TIER=live node server.mjs   # the production catalog
```

It needs Node 18+ and **no dependencies**. Why a small server instead of a plain page? The catalog API only allows browser calls from `*.nevermined.app`, so the server sits alongside the page and forwards the discovery calls — the same trick you'd use in your own app. See [`playground/README.md`](./playground/README.md).

## Try it — from the terminal

```bash
./run-demo.sh                      # sandbox, no key, no payment
NVM_TIER=live Q="web scraping" ./run-demo.sh
```

It walks every surface in order — categories, the two rails, REST search, ARD search + explore, the MCP tool, and the `.well-known` feed — printing the request it makes each time.

---

## Do it yourself

Everything below is a real, copy-pasteable call. Nothing here spends money.

### ① By eye — the REST catalog

```bash
API=https://api.live.nevermined.app

# What categories exist, and how many agents in each?
curl -s "$API/api/v1/catalog/categories" | jq .

# Search by keyword; filter by rail. (search is a plain keyword match — one word works best.)
curl -s "$API/api/v1/catalog/services?search=enrichment&protocol=x402" | jq '.total, .services[0]'

# The full record for one service, by slug:
curl -s "$API/api/v1/catalog/services/stableenrich" | jq .
```

Useful fields: `slug` (stable id), `protocol` (**only `x402` and `mpp` are payable through the Router**), `targetUrl`, `endpoints[]`, `priceLabel`, `category`, `tags[]`.

### ② By an agent — the Catalog MCP

Point any MCP client at the hosted server — no key needed for discovery:

```
https://mcp.live.nevermined.app/mcp      (or mcp.sandbox.nevermined.app)
```

It exposes `list_categories`, `search_services`, and `get_service` (plus paid `pay_service` / ledger tools). In Claude Code:

```bash
claude mcp add --transport http nevermined https://mcp.sandbox.nevermined.app/mcp
```

Then just ask: *"Using the Nevermined catalog, what agents can enrich a company? Which speak x402?"* — the model calls `search_services` for you.

### ② By an agent — the ARD registry (relevance search + facets)

Unlike the keyword REST search, ARD `/search` ranks the **whole question**. Mind the body shape — the query is **nested**, and a bare `{"text":…}` is rejected:

```bash
# Ranked search — hand it a natural-language need.
curl -s -X POST "$API/api/v1/ard/search" -H 'content-type: application/json' -d '{
  "query": { "text": "which agents can enrich a company?",
             "filter": { "pay:protocol": ["x402"] } },
  "pageSize": 5 }' | jq '.results[] | {displayName, score}'

# Explore — the STRUCTURE of a query: protocols, media types, tags. (resultType.facets is required.)
curl -s -X POST "$API/api/v1/ard/explore" -H 'content-type: application/json' -d '{
  "query": { "text": "enrichment" },
  "resultType": { "facets": [ {"field":"pay:protocol"}, {"field":"tags","limit":6} ] } }' | jq .facets

# Browse — deterministic, cacheable, paged.
curl -s "$API/api/v1/ard/agents?pageSize=5" | jq '.items[].displayName'
```

`filter` terms: `type`, `tags`, `capabilities`, `publisher`, `pay:protocol`, `pay:currency`, `pay:network`, `pay:price`.

### ③ By a crawler — the machine feed

```bash
curl -s "$API/.well-known/ard.json" | jq '{specVersion, host: .host.identifier, entries: (.entries|length)}'
```

One JSON document listing every agent with its `representativeQueries`, `tags`, `trustManifest`, and an `nvm:catalog` block (protocol, price, endpoints). This is what a crawler or another registry ingests — the catalog on the open web.

---

## Two rules that cost real money once you *do* pay

Discovery is free, but the moment you route a payment, two things bite:

1. **Only `x402` and `mpp` are routable.** A `rest`/`a2a`/`other` listing can't be paid through the Router — filter with `?protocol=x402` / `mpp`.
2. **`targetUrl` is a full URL, not a base.** Resolve endpoint paths against its *origin*, not by concatenation, or you'll 404 a call you paid for.

## Found something? Now pay for it.

Discovery hands you a `slug`, a `protocol`, and an endpoint. From there, one Router call pays and invokes it — see the sibling demos:

- [**Song From the Headlines**](../song-from-the-headlines) — an agent discovers and pays four tools to make a song.
- [**Diligence-in-a-Box**](../diligence-in-a-box) — five diligence sources, two rails, one investment memo.

## Learn more

- **The Catalog** — [nevermined.app/catalog/](https://nevermined.app/catalog/) · [docs](https://nevermined.ai/docs/products/catalog/overview)
- **ARD** — the Agentic Resource Discovery feed that makes the catalog crawlable by any registry.

*Part of the Nevermined tutorials. Every call in this guide is public, read-only, and unauthenticated. Service names and figures come from the live catalog and change as it grows.*
