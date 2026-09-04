# Nevermined Tutorials — Showcase

A visual showcase of the Nevermined Payments tutorials. Every paid-agent and catalog
tutorial in this repo is presented in one normalized shape — **what you'll learn · how it
works · under the hood · see it run** — behind a persistent left sidebar, with an
individual page for each. (`langchain-chat-ui-nvm` is the browser *buyer* front-end for the
LangChain agents rather than a paid agent itself, so it's referenced inside those pages
instead of getting its own entry.)

Built with Next.js (App Router) + TypeScript. Clean, light, docs-style UI on a white
ground with a restrained Nevermined-teal accent. Intended to become the canonical
replacement for `examples.nevermined.app`.

## Quick start

```bash
cd showcase
npm install
npm run sync:media   # copy catalog demo video/audio into public/ (recap panels)
npm run dev          # http://localhost:3000
```

Build the production bundle:

```bash
npm run build && npm start
```

## Docker (for ArgoCD / k8s)

The app builds to a Next.js **standalone** server. Build the image from the **repo
root** (so the committed `catalog/` demo videos are in context):

```bash
docker build -f showcase/Dockerfile -t nvm-tutorials-showcase .
docker run -p 3000:3000 nvm-tutorials-showcase
```

The container listens on `$PORT` (default `3000`) on `0.0.0.0`, runs as a non-root
user, and needs no build args or secrets — point a k8s Service / ArgoCD Deployment
at it.

### CI → Artifact Registry

`.github/workflows/showcase-image.yml` has two jobs:

- **`verify`** runs on every **pull request** (and every push): `npm ci`, the sandbox
  self-check (`node lib/demo-agent.mjs`), and `npm run build` — which type-checks
  `content/tutorials.ts`. It needs no credentials, so a broken change fails the PR
  instead of landing on `main` and breaking the image build.
- **`build-push`** runs only on **push to `main`** touching `showcase/**` (and on manual
  dispatch), never on a PR. It builds the image and pushes it to
  `europe-west3-docker.pkg.dev/nevermined-eu-dev/nevermined-io/tutorials-showcase`
  (keyless, via Workload Identity Federation).

Tags: an immutable `sha-<short>` per build (**pin this in ArgoCD for production**) and an
optional semver when dispatched with a `version` input. There is no moving `latest` tag —
the registry has `immutableTags=true`, which would reject a second `latest` push.

## How content works

All tutorial content lives in one typed array: [`content/tutorials.ts`](./content/tutorials.ts),
shaped by [`lib/types.ts`](./lib/types.ts). Each entry is sourced from that tutorial's own README.
Adding or editing a tutorial is a data change — no new components. Pages are generated statically
from the array (`generateStaticParams`).

Each tutorial declares a **tier**:

- **`live`** — the `See it run` panel is **functional in the browser**: it does real fetch
  round-trips through `/api/agent` and runs the actual x402 handshake — `402 → authorize →
  200 + settlement` — with a real per-session credit balance that decrements per call and
  responses that react to what you type. It talks to a **local sandbox agent**
  (`lib/demo-agent.mjs`), so it spends no real money and needs no credentials or backend.
- **`recap`** — the two `catalog/` demos spend real crypto autonomously across chains, so they are
  **watch-only**: embedded video, playable outputs, the on-chain receipt, and a "run it locally"
  note.

## The sandbox agent, and going fully real

`/api/agent` (backed by `lib/demo-agent.mjs`) is a local sandbox: it speaks the real x402 shape
and tracks a real per-session balance in an httpOnly cookie, but calls no external service. That
makes every "see it run" panel functional out of the box, with no credentials.

To make a tutorial run against the **real** Nevermined flow (visitor pays via a card delegation,
real agent responds):

1. Deploy its agent backend and note the URL + plan id.
2. In `app/api/agent/route.ts`, proxy that tutorial's requests to the backend instead of the
   sandbox, porting the four x402 proxy routes from `../langchain-chat-ui-nvm/src/app/api/`
   (session → token → init → passthrough) — they inject the buyer's x402 token server-side, so
   `NVM_API_KEY` never reaches the browser.

The panel code doesn't change — only what `/api/agent` talks to.

Unit test for the handshake logic: `node lib/demo-agent.mjs`.

## Media

`npm run sync:media` copies the catalog `.mp4/.mp3/.jpg` into `public/media/`. The large `.mp4`s are
gitignored; the cover art and song are small enough to commit so a fresh clone still shows them.

## Structure

```
showcase/
├── app/
│   ├── layout.tsx            # builds the sidebar groups + wraps every page in AppShell
│   ├── page.tsx              # overview — intro + grouped index of all tutorials
│   ├── t/[slug]/page.tsx     # tutorial page — the 4 normalized sections
│   ├── api/agent/route.ts    # the "see it run" endpoint (cookie state → sandbox agent)
│   └── globals.css           # the light, docs-style design system (tokens)
├── components/
│   ├── AppShell.tsx          # persistent left sidebar + mobile drawer + active state
│   ├── LiveRunPanel.tsx      # the interactive "see it run" panel (real fetches → /api/agent)
│   └── RecapPanel.tsx        # video + outputs + receipt (recap tier)
├── content/tutorials.ts      # ← all tutorial content + sidebar grouping live here
└── lib/
    ├── types.ts              # the normalized content model
    └── demo-agent.mjs        # sandbox agent logic (x402 handshake) + `node` self-test
```
