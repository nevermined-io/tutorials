# BRIEF — ship a website about the agent that shipped it

**One sentence:** *Build and ship a small, beautiful website whose subject is you — an AI agent that bought
everything it needed to exist (a domain, hosting, a git repo, a screenshot, a tweet) from vendors it has no
account with, paid per call through the Nevermined Router, on a budget a human capped in advance.*

The site is the receipt. Everything it claims must be checkable: link every purchase to its Router payment
id and on-chain transaction, and anchor the final receipt's hash on-chain.

## What you have

| Thing | Where |
|---|---|
| Nevermined API key (Live) | `$NVM_API_KEY` — never print it |
| API base | `$NVM_API_URL` = `https://api.live.nevermined.app` |
| Delegation (your whole budget) | `$NVM_DELEGATION_ID` — read its cap and wallet with `GET /api/v1/delegation/$NVM_DELEGATION_ID` |
| Registrant contact for the domain | `~/.nvm-doma-contact.json` — read it, pass it along, never echo it |
| The `nevermined-router` skill | installed; it is the authority on the Router API and its error codes |
| Public catalog | `GET $NVM_API_URL/api/v1/catalog/services` (no key needed). Use `?search=` (matches title/description, NOT slugs) and `GET /catalog/services/{slug}` for one you know. `limit` caps at 20; page with `?page=`. |

Your wallet is funded on **Base (USDC, x402)** and **Tempo (USDC.e, MPP)**. Both rails are on.

## Deliverables

1. **A registered domain, pointing at your deployed site, over HTTPS.**
2. **The site** — static HTML/CSS/JS, sources in `./site/`. It is a product page for this outcome, not a
   diary. Sections, in order:
   - **Intro** — two or three lines: what this site is, who made it, what it cost. Then the one sentence.
   - **What I did** — the deliverables as a short list with the real names: the domain, the host, the repo,
     the screenshot, the receipt. Use the hero screenshot as the OG image and as a visual here.
   - **How it works** — the mechanics, for a developer: the public catalog (discovery, prices on the wire),
     the Delegation (a human-capped budget, the only guardrail), the Router paying each `402 Payment
     Required` and relaying the resource, the ledger. Show the run's real numbers (cap, spend, number of
     payments, vendors, chains). Add a simple inline-SVG diagram of `agent → Router → merchant (402 → pay →
     200)` with the Delegation cap beside the Router. Keep it accurate to what the `nevermined-router`
     skill says; no invented claims.
   - **What it cost** — the receipt (spec below).
   - **Watch it happen** — a video slot: leave a clearly marked `<!-- VIDEO_EMBED -->` placeholder inside a
     16:9 box (a YouTube embed will be dropped in later).
   - **Reproduce it** — the steps a developer follows: API key → fund the wallet → create a Delegation →
     install the plugin (`/plugin marketplace add nevermined-io/docs`, `/plugin install
     nevermined-router@nevermined`) → the prompt → what comes out. Link the tutorial repo (the operator will
     give you its URL in `$TUTORIAL_REPO_URL`; if unset, link `https://github.com/nevermined-io`).
   - **The site presents the outcome, not the troubleshooting.** Anything that refused you or failed goes in
     `RUN.md` only — never on the page. If a vendor fails and you use another, the page simply names the
     vendor you used.
   - Design: modern, calm, editorial, product-grade. One accent colour, large readable type, generous
     spacing, a receipt-paper motif ONLY for the receipt block, light and dark, works on a phone. No template
     look, no runtime frameworks; hand-written CSS. Hover states, focus states, a favicon (inline SVG data
     URI). Test it in a browser at 1280 and 400 px wide before you call it done.
3. **The receipt** (`./site/receipt.json`, rendered by the page from data). Exactly this shape:
   - one row per **settled** payment, in time order; nothing refused, failed or reserved-then-released;
   - columns: `Request` (your `requestId`) · `Merchant` · `Amount` (merchant leg, `$0.0000`) · `Fee` (the
     Router's 2%, `$0.0000`) · `Status` · `Transaction` (hash abbreviated `0xabcd…1234`, linked:
     Base → `https://basescan.org/tx/<hash>`, Tempo → `https://explore.tempo.xyz/receipt/<hash>`);
   - a totals row: `N payments · M vendors · $amount · $fee · all Settled · chains`;
   - tabular figures in a mono face, fixed column widths that fit inside ~960 px, cells never wrap (truncate
     with an ellipsis and a `title` attribute), a one-line caption above ("Every line is a real transaction…"),
     the table inside an `overflow-x: auto` wrapper so a phone scrolls the table, never the page.
   - Below it, one short paragraph: what the Nevermined fee is and that it is charged beside the merchant
     leg, never folded in.
4. **`./receipt/ledger.json`** = the raw `GET /api/v1/router/payments?delegationId=…`; `./receipt/receipt.json`
   = the curated table data above.
5. **A hero screenshot** of the live site (ScreenshotOne) saved as `./site/hero.png`, used as OG image.
6. **A public GitHub repository** holding `site/`, `receipt/` and a short README (what this is, the live URL,
   how it was made, link to the tutorial repo): `gh repo create nevermined-io/<domain-name-without-tld>
   --public --description "…"` then push `main`. `gh` is authenticated on this machine — use it, never
   print its token. Never commit anything from `private/`.
7. *(Optional, silent)* anchor the receipt's sha256 on-chain with `anchor-x402` `/v1/anchor` ($0.005). If it
   answers 2xx, add the anchor tx to the receipt caption; if it fails, drop it — no mention on the page.
8. `RUN.md` — your log, every decision, every paid call with `paymentId`, `settlement.approxCents`,
   `fee.capChargedCents`, `txHash`, and every refusal or vendor failure (this is the friction log; keep it
   honest and complete). `./private/handover.json` (chmod 600, written by a python one-liner) — the Locus
   workspace/project/service ids, the claim URL if any, and any key you generated. Never print those.

## Naming

You researched and chose the name **`shippeditself`** in a rehearsal (web search found no brand collision;
`.com` was available). Keep it — buy **`shippeditself.com`** — unless it is no longer available, in which
case pick the closest good alternative and check it the same way (`glim-sh` web search, ~$0.01, then the
Locus availability check). Spend on the `.com`; do not shop premium TLDs.

## Field notes — verified today, they will save you money

The Router pays a cataloged service **by slug**: `POST /api/v1/router/route` with `{"slug": "...", "path": "...",
"method", "body", "headers", "requestId"}`. A raw `url` to a cataloged host is refused (`BCK.ROUTER.0014`).
Two rules about `path`: for a **single-endpoint** service (ScreenshotOne, Billboard) **omit `path`** — the stored
target already is that endpoint, and adding it 404s (free, no payment). For a **multi-endpoint** service (Locus,
glim.sh, anchor-x402, Deepgram) pass the path (`repos`, `api/v1/web/search`, `v1/anchor`,
`deepgram/speak`). Use `POST /router/route` for POSTs — the streaming `/svc/<slug>/<subpath>` surface answers
405 to a POST today. A response that
never 402s is never paid — so a wrong path costs nothing. **Through a slug, the body of a FREE (non-402)
response is nulled** to protect the merchant host; that is why the free Locus management calls go direct.

### Domain — try Doma first, fall back to Locus

- **Doma** (`doma-domain-api`, MPP/Tempo, ICANN registrar, the domain becomes an NFT you own):
  `POST` slug `doma-domain-api`, `path: "register"`, body `{"domain", "buyerAddress", "contact"}` where
  `contact` is exactly the fields in `~/.nvm-doma-contact.json` and `buyerAddress` is an EVM address **whose
  private key you hold** — generate one (`openssl rand -hex 32` → address via any EVM lib, or `cast wallet new`
  if present), save it in `private/handover.json`. DNS for a Doma domain is set on-chain by that key with the
  `doma` CLI (`npx skills add d3-inc/doma-skill`, `doma dns set <domain> @ A …`, gasless). Price is dynamic per
  TLD (com/xyz/ai/io/net/cash/live/fyi) and only known at the 402. **Doma's `/register` has been answering
  `500 "Interstellar search failed: 401"` (their registrar credential). Try once; if it fails, fall back to
  Locus and simply use Locus — the page names the vendor that worked, `RUN.md` records the failure.**
- **Locus fallback** (`build-with-locus`): Locus can buy the domain itself and auto-wire DNS + SSL.
  `GET https://mpp.buildwithlocus.com/v1/domains/check-availability?domain=<name>` (free, JWT) → price
  (`.com` ≈ $16, `.xyz` ≈ $19, `.ai` far more). `POST /v1/domains/purchase` (JWT, direct) with
  `{"projectId", "domain", "contact": {firstName, lastName, email, phone: "+49.15902681632" style,
  addressLine1, city, state, countryCode, zipCode}, "autoRenew": false, "privacyProtection": true}` → `202`,
  then poll `GET /v1/domains/{domainId}/registration-status` every 20 s until `registered` (1–15 min), then
  `POST /v1/domains/{domainId}/attach {"serviceId"}`. Domain purchases are charged to the **Locus credit
  balance**, so top up first (below).

### Hosting — Locus (`build-with-locus`)

1. **Sign up (free, direct, never 402s):** `POST https://mpp.buildwithlocus.com/v1/auth/mpp-sign-up`
   `{"tempoAddress": "<your delegation's providerPaymentMethodId>"}` → `{jwt, workspaceId, claimUrl}`. The
   JWT is your `Authorization: Bearer` for every Locus call. Save `claimUrl` to `private/handover.json` — it is
   how the human later claims the workspace and the domain. If the response says `isNewWorkspace: false` and
   `claimUrl` is null, the workspace already existed for this wallet and the operator already holds its claim
   URL — note it and move on.
2. **Top up credits through the Router over x402 on Base** (the MPP top-up is broken today — the Router's
   MPP credential collides with the JWT header — do not use it):
   `POST /api/v1/router/route` `{"url": "https://api.buildwithlocus.com/v1/billing/x402-top-up", "method":
   "POST", "body": {"amount": <dollars>}, "headers": {"Authorization": "Bearer <jwt>"}, "requestId": ...}`.
   Min $1, max $100 per call. Creating a service needs **≥ $1.50** of credit; a domain needs its price on top.
   Top up once for what you need (domain price + $4 for compute), not in dribbles — every call is a settlement.
3. **Project → environment → service** (all direct, JWT): `POST /v1/projects {"name"}`,
   `POST /v1/projects/{id}/environments {"name":"production","type":"production"}`,
   `POST /v1/services {"projectId","environmentId","name":"web","source":{"type":"s3","rootDir":"."},
   "runtime":{"port":8080,"cpu":256,"memory":512,"minInstances":1,"maxInstances":1}}` → service `url`.
4. **Deploy by git push:** the container must listen on **8080** and answer **`/health`**. A `Dockerfile`
   with `nginx:alpine`, a `default.conf` on 8080 + `/health`, and your `site/` copied in works. Then
   `git push https://x:<jwt>@git.buildwithlocus.com/<workspaceId>/<projectId>.git main` (the JWT is the
   password — never echo the URL). Poll `GET /v1/deployments/{deploymentId}` until `healthy` (3–7 min).
   Deploy a first version early (hero + story so far), and redeploy at the end with the final receipt.

### The rest (all by slug through the Router)

- **ScreenshotOne** (`screenshotone`, ~$0.06, single endpoint → no `path`): `POST` body `{"url": "<your https
  URL>", "format": "png"}` → `{success, data}` (base64 PNG) — after the domain is live.
- **glim.sh** (`glim-sh`, $0.01): `POST` `path: "api/v1/web/search"` `{"query", "numResults"}` → `{results[]}`.
- **anchor-x402** (`anchor-x402`, x402/Base, $0.005): `POST` `path: "v1/anchor"` `{"hash": "<64 hex, no 0x>"}`.
  Optional; it has failed on the paid hop before — see deliverable 7.
- Do **not** use Billboard (its price is a bonding curve, $40+ per post today) or Code Storage (GitHub is the
  repo). Read the catalog entry (`GET /catalog/services/{slug}`) for the exact body before the first call.

### Reading your spend

`GET /api/v1/delegation/$NVM_DELEGATION_ID` → `amountSpentCents` is the truth. The ledger:
`GET /api/v1/router/payments?delegationId=$NVM_DELEGATION_ID`. Sum `fee.capChargedCents`, not
`settlement.approxCents`, and show the 2% Router fee as its own column on the site.

## Order of work (suggested)

bootstrap → availability check for shippeditself.com → Locus sign-up + one top-up → domain (Doma once,
then Locus) → project/env/service → site v1 → git push → poll healthy → domain registered → attach → HTTPS
check → screenshot → receipt.json + ledger.json → (anchor) → site v2 with the final receipt → redeploy →
verify at 1280 and 400 px → GitHub repo + push → RUN.md → handover.json → `RUN COMPLETE`.
