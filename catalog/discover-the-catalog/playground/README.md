# Catalog Discovery playground

One search box, three synchronized views of the **live** Nevermined Agent Services Catalog:

- **By eye** — the cards a person browses (REST catalog).
- **By an agent** — the exact call an agent makes, tabbed across **MCP**, **REST**, and **ARD `/search`**, with the JSON reply.
- **By a crawler** — the matching `/.well-known/ard.json` entry.

…plus a live **ARD `/explore`** histogram of the payment rails, media types, and tags behind your results.

## Run it

```bash
node server.mjs                 # → http://localhost:8080   (sandbox)
NVM_TIER=live node server.mjs   # the production catalog
PORT=3000 node server.mjs
```

Node 18+ (uses the built-in `fetch`). **No dependencies, no build step.** `npm start` works too.

## Deep links

State is shareable and drives the demo capture:

```
/?q=which agents can enrich a company?&tab=ard&rails=x402
```

`q` = the question · `tab` = `mcp` | `ard` | `rest` · `rails` = `x402`, `mpp` (comma-separated).

## Why there's a server (and not just an HTML file)

The catalog API is public, but its CORS policy only allows browser calls from `*.nevermined.app`. A page served from anywhere else (localhost, a static host) would be blocked. `server.mjs` sits **same-origin** with the page and forwards the discovery calls server-side — the same small proxy you'd add to your own app. It relays only to the two fixed Nevermined upstreams (`api.<tier>` and `mcp.<tier>`), so it can't be used as an open relay.

## Deploying

- **Anywhere (Vercel, Render, a container, a VM):** ship this folder and run `node server.mjs` — the proxy handles CORS.
- **Under a `*.nevermined.app` origin:** the browser may call the API directly; the proxy becomes optional.

`NVM_TIER` (`sandbox` | `live`, default `sandbox`) and `PORT` (default `8080`) are the only configuration.
