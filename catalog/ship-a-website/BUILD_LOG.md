# Build log — Ship It While I'm In the Shower

The agent's own `RUN.md`, verbatim except for a handful of wording edits noted in the tutorial README. Delegation and payment ids, transaction hashes and vendor ids are public by design; nothing under `private/` appears here.

Run started: 2026-09-15

## Bootstrap

- Delegation `e6c3e27f-5101-4da6-8fad-75cec7600c1d`: cap $40.00, active, expires 2026-09-16T13:36:07Z, wallet `0x8F60b3838e6C121FcDBdBc50e7B150F8560a670E`.
- Generated a fresh EVM keypair for the Doma `buyerAddress` with `cast wallet new`; address `0x415099126821Ffc49b4C3514F5B7e913B6F8BF0f`, private key saved to `private/.doma-wallet.json` (chmod 600, never printed).
- Domain name: keeping the rehearsed choice **shippeditself.com** (brief says trust the field notes).

## Domain — Doma attempt

- `POST /api/v1/router/route` slug `doma-domain-api`, path `register`, body `{domain: shippeditself.com, buyerAddress, contact}` (contact from `~/.nvm-doma-contact.json`, never echoed).
- Result: `201` router envelope, but `status: 500, body: null, paid: false` — matches the brief's field note ("Interstellar search failed: 401", Doma's registrar credential). **Nothing charged.** Falling back to Locus per the brief.

## Hosting — Locus

- Signed up (free, direct): `POST /v1/auth/mpp-sign-up`. `isNewWorkspace: false`, `claimUrl: null` — this wallet already had a workspace (`ws_542feb48`); operator already holds its claim URL, per the brief's note. Moved on.
- Domain availability (free, direct): `shippeditself.com` available, `$16.00` registration/renewal.
- Credit balance before top-up: `$0.50`.
- Topped up **$20** via Router x402 on Base (covers the $16 domain + ~$4 compute buffer), one call, not in dribbles.
  - `requestId: locus-topup-20-v1`, `paymentId: 40e5f639-2c39-411a-9dfd-58685370e21d`
  - `settlement.approxCents: 2000` (merchant leg, $20.00) · `fee.capChargedCents: 2040` (2% fee = $0.40)
  - `txHash: 0x9a9f2fcf9aaa473cfaed5f25664d42d3ea9869a375f620066833cf16dd501cee` · network `eip155:8453` (Base) · status `Settled`
  - New credit balance: `$20.50`.
  - **Friction note:** the top-up response body contained a fresh Locus session JWT under `body.jwt`. My redaction filter before printing only scrubbed `headers`/`Authorization` keys and missed it, so that JWT briefly appeared in visible terminal output (on camera). It was immediately saved to `private/.locus.json` (chmod 600) and not repeated. Flagging here for the operator: if that session token needs to be considered compromised, rotate/re-sign-up. All subsequent responses were redacted for the `jwt` key too.
- Created project `proj_mu2pyyg9ambsalze` ("shippeditself"), environment `env_mu2pz3fi1gfqvcvf` ("production").
- Domain purchase: first attempt `400` — Locus/registrar rejects a `state` field for Switzerland when set; second attempt `400` — but their own schema *requires* the `state` key to be present. Resolved by sending `state: ""` (present but empty) — accepted.
- `POST /v1/domains/purchase` → `202`, `domainId: domain_mu2q0malox4ztbel`, `operationId: 4e1e46b1-3aaa-430b-a099-fe0086cfe9d9`. Charged to Locus credit balance (not the Router/Delegation — no `paymentId` here). Polled `/registration-status` every ~25s; `registered` after ~11 minutes.
- Created service `svc_mu2q3owsh3mooosd` ("web", Dockerfile build, port 8080) via `POST /v1/services` — `source: {type: s3, rootDir: "."}` per the brief, actual bits arrive by git push.
- Deployed **site v1** (hero + story so far) by `git push` to `https://git.buildwithlocus.com/ws_542feb48/proj_mu2pyyg9ambsalze.git` (JWT as password, never printed/echoed — used a scratch git credential file instead of an inline URL). Deployment `deploy_mu2q4h27x3m4a44a` went `building → deploying → healthy` in a few minutes. Verified reachable at the Locus subdomain (`/health` → `ok`).
- Domain → service: first `attach` call `400`'d ("must be validated before attaching") while ACM cert validation was still in progress; retried after registration settled and it succeeded (`Domain attached to service svc_mu2q3owsh3mooosd`). DNS/TLS propagation polling below.

## Session 2 — resumed from this log

- Resumed in a fresh session from this log and the Router ledger: certificate issued, A record reported created; `registration-status` wrongly reports a cert-limit error — ignored it, used `GET /v1/domains/{id}` and `POST /v1/domains/{id}/verify` instead. Confirmed via ledger (`GET /api/v1/router/payments?delegationId=...`) that only the $20 top-up (`locus-topup-20-v1`) has settled so far — nothing to repeat.
- `verify` reported `certificateValidated: true`, `cnameVerified: false`, `"DNS not yet resolving."` Polled `dig shippeditself.com A` against 8.8.8.8 and 1.1.1.1 every few minutes for 20 minutes (14:41:34–15:01:47 UTC) — empty both times, every check.
- Per the brief's 20-minute rule: stopped waiting at the 20-minute mark. Domain stays on the page as the registered domain (`shippeditself.com`, registered + attached + cert validated); DNS is recorded here as **pending propagation**. All remaining work (screenshot, HTTPS verification) proceeds against the Locus service host URL `https://svc-mu2q3owsh3mooosd.buildwithlocus.com`, which is live and healthy (`/health` → `ok`, HTTP/2 200 on `/`).

## Screenshot — ScreenshotOne

- `POST /api/v1/router/route` slug `screenshotone`, no `path` (single-endpoint service per the brief's field notes), `body: {url: "https://svc-mu2q3owsh3mooosd.buildwithlocus.com/", format: "png"}`. First attempt omitted `method` and got a free (unpaid) `404` — cost nothing. Retried with `"method": "POST"` explicit and it settled.
  - `requestId: screenshotone-hero-v1`, `paymentId: 706a718a-a481-4741-a1b3-97726500cf88`
  - `settlement.approxCents: 6` (merchant leg, $0.06, Tempo/USDC.e) · `fee.capChargedCents: 6` (2% routing fee rounds to a whole cent minimum)
  - `txHash: 0xe6d5a59a15e34f98de74955c66b0841736a27b871c2a0f484fcdf015376a65bc` · network `tempo` (MPP) · status `Settled`
  - Saved decoded PNG to `site/hero.png` (1920×1080). A retry with the same `requestId` correctly returned `409 BCK.ROUTER.0002` with the original `paymentId` — did not mint a second charge.

## Receipt data

- Built `receipt/ledger.json` = raw `GET /api/v1/router/payments?delegationId=...` (2 Settled rows at this point: the Locus top-up and the ScreenshotOne capture).
- Built `receipt/receipt.json` (and copied to `site/receipt.json`) with the curated table: `requestId`, `merchant`, `amountCents` (merchant leg = `settlement.approxCents` from each paid call), `feeCents` (`fee.capChargedCents - settlement.approxCents`), `status`, `txHash`, `chain`. Totals: 2 payments · 2 vendors · $20.06 · $0.40 fee · all Settled · Base + Tempo.

## Anchor (optional) — failed, dropped per brief

- Computed sha256 of `receipt/receipt.json` at that point (`c9bcc011c4dc4d5748023889d2bd87c40ba65980a71c993569cc1f9fa5dc3a2a`).
- `POST /api/v1/router/route` slug `anchor-x402`, `path: "v1/anchor"`, `body: {hash: <64-hex>}`, `requestId: anchor-receipt-v1`. Router returned `201`, `paid: true`, but the merchant leg itself came back `502`; payment record left **`Issued`** (not `Settled`) — `"upstream returned 502 - settlement outcome unknown, record left Issued for reconciliation"`. `paymentId: 1277dbe4-932d-4237-a842-48c09a691ab1`, reserved `fee.capChargedCents: 1` (delegation `amountSpentCents` moved 2046→2047).
- Per the brief ("optional, silent... if it fails, drop it — no mention on the page"): excluded from `receipt.json`'s rows (not Settled, so it doesn't qualify anyway) and not mentioned on the site. Not retried — a 502 forwarded from the merchant isn't one of the Router's retryable codes (`0006`/`0007`), and this `requestId` already minted a payment record, so a retry would either 409 or double-spend with a fresh id. Logged here only.

## Site v2 — hero + final receipt, redeploy

- **Friction note (git push auth):** a `GIT_ASKPASS`/`core.askPass` script (never printing the JWT) never got invoked by `git credential fill`/`git push` in this environment — no explanation found, askpass was simply skipped and git fell straight to `fatal: unable to get password from user`. Worked around it by writing `http.extraHeader: Authorization: Basic base64(x:<jwt>)` directly into the *local* git config (never through a command line — built and written by a `python3` one-liner reading the JWT from `private/.locus.json`), which is exactly Basic auth the server's `www-authenticate: Basic realm="Locus Git"` asked for. Push succeeded; the header line was removed from `.git/config` again immediately after (same python-one-liner pattern) so the JWT doesn't sit in a plaintext repo config longer than needed. **Caught and stopped one leak:** an earlier attempt at the same fix used a `Bearer` header instead of `Basic` and I ran `cat .git/config` to debug it, which printed the JWT to the terminal once — flagging here per the same rule as the earlier Locus top-up JWT leak; no further printing after that, and both leaked tokens are the same session JWT already in `private/.locus.json`.
- Committed `site/hero.png` and updated `site/receipt.json` on top of v1 (hero + story). Pushed to `locus main` (`97a4fc74647e`) — deploy `deploy_mu2t2op1yljnkhw8` triggered automatically, went `healthy`.
- Verified the live page at 1280px and 400px with a local headless Chrome capture against the Locus host URL (no extra paid calls — this is a free local render, not ScreenshotOne). Found two layout bugs and fixed both, then pushed a second commit (`037139934fd8`, deploy `deploy_mu2tarkrdjbqz074`, healthy):
  - Receipt table's `Status` column was 1px too narrow for the "Settled" pill, so the browser drew a stray ellipsis next to it. Widened `col.c-status` (11%→13%), narrowed `c-req`/`c-merchant` slightly to compensate, trimmed pill padding.
  - The four-stat row (`$40.0000` / `$20.4600` / ...) clipped its own numbers at 400px width because `auto-fit minmax(120px,1fr)` packed 3 narrow columns. Added a `max-width:640px` rule: 2-column grid, smaller padding, smaller number font.
  - Re-verified both fixes with another headless capture — clean at both widths.

## GitHub repo

- `gh repo create nevermined-io/shippeditself --public --description "..." --source=. --remote=origin --push` from a clean checkout of `site/`, `receipt/` and a new `README.md` (no `private/`, no `BRIEF.md`, no Locus deploy scaffolding). One commit, pushed `main`.
- Live: https://github.com/nevermined-io/shippeditself
- Follow-up commit linking the "This site's source" button to the real repo URL, pushed to both Locus (deploy `deploy_mu2tid2x936v8r8d`) and GitHub.

## Final state

- **Domain:** `shippeditself.com` registered (Locus), attached to the service, ACM certificate validated. DNS never resolved during this run although the host reported the A record as created — checked every few minutes for the full 20-minute window (14:41:34–15:01:47 UTC) via `dig` against two public resolvers and the Locus `/verify` endpoint, all empty/"DNS not yet resolving". Recorded here as **pending**; the domain is still named on the site as the registered domain per the operator's instruction. A later check right before finishing (~17:24 UTC) still showed no A record.
- **Live URL used for everything (screenshot, verification, HTTPS):** https://svc-mu2q3owsh3mooosd.buildwithlocus.com — healthy, HTTPS, `/health` → `ok`.
- **Spend:** delegation cap $40.00, spent **$20.46** (`amountSpentCents: 2046`), remaining $19.54, 2 **Settled** payments (Locus top-up $20.00 + $0.40 fee; ScreenshotOne $0.06 + $0.00 fee) across 2 vendors, chains Base + Tempo. One attempted anchor (`anchor-x402`, $0.01) failed upstream (502) and was dropped per the brief — its 1-cent reserve was released back by the Router (`amountSpentCents` briefly touched 2047, settled back to 2046).
- **GitHub repo:** https://github.com/nevermined-io/shippeditself (public)
- **`private/handover.json`** written (chmod 600): Locus workspace/project/environment/service ids, service URL, git remote, the generated Doma wallet address (not its key), GitHub repo URL, delegation id and cap. Never printed to the terminal.
- Nothing was refused by the Router beyond the one merchant-side 502 above; no `BCK.ROUTER.0003`/`0009` stop conditions hit; no second Delegation created; every `requestId` used exactly once (idempotency confirmed live via the `screenshotone-hero-v1` retry returning `409 BCK.ROUTER.0002`).

## v3 polish (2026-09-15, no purchases)

Operator review of the live site asked for three fixes, no spend, same rules (`private/.locus.json` read
only via python, JWT never printed).

- **Receipt table truncation:** the table's fixed `%`-width columns plus `overflow:hidden; text-overflow:
  ellipsis` were clipping the full `requestId`, merchant name, and `$X.XXXX` amounts at 1280px. Reordered
  columns to Merchant, Request, Amount, Fee, Status, Transaction; sized columns in `ch` units matched to
  the longest real value in each column (merchant 25ch, request 22ch, amount 9ch, fee 8ch, status 12ch,
  tx 20ch) instead of arbitrary percentages; dropped the base font to 11px and tightened cell padding to
  `7px 6px`; removed the `overflow:hidden`/`text-overflow:ellipsis` rules entirely so nothing is ever
  silently clipped. `app.js` now appends Merchant before Request per row, and the totals row's label cell
  spans both columns (`colSpan = 2`) instead of leaving the old Request column blank. Removed the stale
  mobile-only `min-width:620px; font-size:11.5px` override that fought the new sizing. Verified with local
  headless Chrome captures (`google-chrome --headless --screenshot`, no paid call) at 1280px — every
  requestId, merchant name, and amount renders in full, no ellipsis anywhere, table fits inside the card
  with room to spare — and at 400px — the table now exceeds the card width and the `.receipt-scroll`
  wrapper clips/scrolls it horizontally as intended, again no ellipsis, just an honest edge.
- **Failure narrative removed:** the Domain card's "Doma was tried first and declined, so I used the
  vendor that actually said yes" line is gone; it now just names Locus and the domain. The Hosting card's
  "DNS attached to the domain" became "attached to the domain above" — no mention of DNS state at all.
- **What the $20 bought:** added a line under the receipt: the $20.00 Locus top-up covered the $16.00
  `shippeditself.com` registration, the rest went to hosting compute. Receipt totals/rows unchanged.
- `<!-- VIDEO_EMBED -->` placeholder left in place, untouched.
- Committed and pushed to Locus (`git push locus main`, commit `8af4a2e`) using the same
  short-lived-Basic-auth-header-via-python trick as the v2 push (header written and unset immediately,
  never on a command line, never printed). Deploy `deploy_mu2w1whvb97oeytc` polled via `GET
  /v1/deployments/{id}` (direct Locus API, JWT bearer, free) every 20s: `building` → `deploying` →
  `healthy` in ~4 minutes. Verified the live host (`https://svc-mu2q3owsh3mooosd.buildwithlocus.com`)
  serves the updated `app.js`/`index.html`.
- Same commit pushed to `github.com/nevermined-io/shippeditself` (`61d740a`).
- No Router calls, no new payments, no new Delegation, nothing charged — spend remains $20.46 of the
  $40.00 cap, unchanged from the run above.

**POLISH COMPLETE**

## v4 final receipt (2026-09-15, no purchases)

Operator note: the video's narration and music were bought earlier through the same Delegation
(off-camera, before this pass); this pass folds those payments into the site's receipt. No new purchases —
same rules (`private/.locus.json` read only via python, JWT never printed).

- **Rebuilt the ledger from source of truth:** `GET /api/v1/router/payments?delegationId=$NVM_DELEGATION_ID`
  → 42 payment records total (was 3 last time). 41 **Settled**, 1 **Failed** — the `anchor-receipt-v1`
  attempt from the earlier pass, previously `Issued`/pending reconciliation, has now resolved to `Failed`
  (`feeFailureReason: "upstream returned 502 — resource not delivered"`, fee released). Confirms the anchor
  never delivered; correctly excluded from the receipt (not Settled).
- **Matched the 39 new Settled rows to `video-purchases.json`** by `paymentId`: 36 Deepgram Aura-2
  narration lines (`vo-*`, slug `deepgram-via-mpp`, protocol MPP, chain Tempo) + 3 Suno calls (1 generate +
  2 status polls, `bgm-*`, slug `suno-mpp`, MPP/Tempo). All matched cleanly, no unknown rows.
- **Kept the two original site rows' figures exactly as they were** (Locus top-up $20.00/$0.40 fee,
  ScreenshotOne $0.06/$0.00 fee) per the instruction — did not recompute them from the raw ledger atomics
  (which would show ScreenshotOne as $0.0550/$0.0011, a cosmetic difference from a stablecoin-price-at-
  settlement vs. quoted-price artifact, not worth relitigating on a receipt that already shipped).
- **Computed the 39 video rows' Amount/Fee directly from the ledger's atomic `amount`/`feeAtomic` ÷
  10^assetDecimals** (all USDC.e, 6 decimals) — e.g. each narration line: $0.0230 amount, $0.0005 fee. This
  is the most honest source available (matches the on-chain transfer exactly) since no capChargedCents was
  recorded for these at purchase time.
- **New receipt totals:** 41 payments · 4 vendors (Locus, ScreenshotOne, Deepgram via MPP, Suno) ·
  $21.0030 amount · $0.4189 fee · all Settled · protocols x402 + MPP · chains Base + Tempo. Cross-checked
  against `GET /api/v1/delegation/$NVM_DELEGATION_ID`: `amountSpentCents: 2167` ($21.67) — the ~25¢ gap
  versus the table's own $21.42 (amount+fee) sum is the Router's documented whole-cent-rounding-per-call
  reserve behavior (each of the 41 calls rounds its cap reservation up to the next whole cent; the table
  shows the exact atomic amounts, the delegation shows the rounded-up reservations). Stat tile "spent" uses
  the delegation's `amountSpentCents` (the authoritative figure per the router skill); the table's own
  totals row sums its own rows (self-consistent and checkable against each row above it).
- **Site changes:** added `Protocol` (x402/MPP) and `Chain` (Base/Tempo) columns to the receipt table;
  grouped the 36 narration rows under a "The video's voice — 36 lines" sub-heading and the 3 music rows
  under "The video's music — 3 calls" (each row still its own line with its own tx link); added a
  `protocols` stat tile (6 tiles total: cap, spent, payments, vendors, protocols, chains); restated "two
  protocols / two chains / one Delegation / no vendor accounts" in both the hero intro and "How it works";
  added a "Video" line to "What I did" (six things now, not five).
- **Layout fixes found during verification** (local headless Chrome, no paid calls): the 6-tile stat grid
  first tried `auto-fit minmax(120px,1fr)` and clipped `$40.0000`/`$21.6700` at 1280px (tile too narrow for
  the mono digits) — fixed with `clamp()` font-sizing and a fixed 3-column grid. The totals row's joined
  `"MPP, x402"` / `"Base, Tempo"` values then overflowed the 7–8ch Protocol/Chain columns, forcing the
  whole table into unwanted horizontal scroll at 1280px — fixed by letting only the totals row wrap
  (`white-space: normal` on `tr.totals td`) instead of widening every row's columns for a summary line.
  Widened `c-req` from 22ch to 30ch (the longest real requestId, `bgm-shippeditself-generate-v1`, is 29
  chars) and widened the `#cost` section's container to 960px so the 8-column table fits at 1280px without
  scrolling; confirmed the `.receipt-scroll` wrapper still scrolls the table (not the page) at 400px, with
  every full value intact — no ellipsis anywhere, an honest edge-cut only.
- Verified with local headless Chrome captures at 1280px (stat tiles clean, table fits without scrolling,
  group headings render, all 41 rows + totals fully legible) and 400px (stat tiles 2-column, table
  honestly scrolls horizontally in its wrapper, no clipping).
- Copied the rebuilt `site/*` and `receipt/*` into both `deploy/` (Locus) and `github-repo/`. Updated
  `github-repo/README.md`: one new paragraph naming the two protocols/two chains/one Delegation and that
  the video's narration and music were bought the same way; `<!-- VIDEO_EMBED -->` untouched.
- Pushed to GitHub (`nevermined-io/shippeditself`, commit `0367275`). Pushed to Locus (`git push locus
  main`, commit `4ec3e08`) using the same short-lived Basic-auth-header-via-python trick as v2/v3 (written
  and unset immediately, JWT never on a command line, never printed) — deploy `deploy_mu3056no1pdkzwia`
  triggered. Polled `GET /v1/deployments/{id}` every 15s: `building` → `deploying` → `healthy`, but this
  time `deploying` held for well past the documented 3–7 minute window (~13 minutes total this run) before
  resolving — slower than every prior deploy in this run, cause unclear (no error surfaced). While it was
  still reporting `deploying`, independently confirmed the new bits were already live and correct —
  `/health` returned `ok` and `receipt.json`/`index.html` already served the v4 content (41 rows,
  protocols/chains totals) — so content-served was never actually in doubt, just the status field lagging.
- No Router calls, no new payments, no new Delegation — spend remains **$21.67 of the $40.00 cap**
  (`amountSpentCents: 2167`), unchanged by this pass; the earlier video purchases (narration + music) were
  already reflected in that figure before this pass started, only their appearance on the site changed.

**FINAL COMPLETE**
