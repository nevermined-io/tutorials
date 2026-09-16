# Song From the Headlines — *Brake On The Code*

**An AI agent that turns a real news story into a finished song and album cover — and this time, an AI service wrote every word of the song, too. The agent pays for everything itself.**

Imagine giving an assistant a small prepaid budget and a single instruction: *"read the news, and turn today's AI-safety story into a song."* It goes off, finds the tools it needs, uses them, pays each one directly, and comes back with a playable track, lyrics, and cover art. No accounts to create, no API keys to wire up, no buttons to click along the way — and no human writing the lyrics.

That's this demo. The song is a 1930s Mississippi **delta blues** called ***Brake On The Code***.

![The album cover the agent generated](./album-cover.jpg)

🎧 **The song it made:** [`song.mp3`](./song.mp3) — take 1 of two (a second take, [`song-take2.mp3`](./song-take2.mp3), sits alongside it)
📝 **The words an AI wrote:** [`lyrics.txt`](./lyrics.txt) — the operator wrote none of these
🖥️ **Explore it interactively:** [`index.html`](./index.html) — the cover, the playable song, the lyrics, and the on-chain receipt on one page (it plays the media in this folder).
🎬 **Watch it happen:** a walkthrough video is being re-recorded for this take. The `song-from-the-headlines.mp4` currently in this folder is the **previous (90s-pop) take** and is left in place until the new cut lands — see the *video: follow-up* note at the bottom.

> From our run on **2026-09-16** — the real September 2026 story of the biggest AI "frontier" labs jointly calling to slow down development ("Pacing the Frontier"). Total cost: **36 cents** of a **$1.00** budget. Human clicks: **zero**. Human-written lyrics: **zero**.

---

## Why this is interesting

Two things make this run different from a normal "AI writes a song" demo.

**1. The agent paid for everything, itself.** Normally, for software to use a paid online service, a person has to sign up, enter a credit card, and manage secret API keys — for *every* provider. Here:

- The **agent itself** holds a small, capped budget — think of it as a prepaid card with a spending limit you set.
- It **pays each service directly, on demand**, only for what it actually uses.
- Nothing is arranged with any provider in advance. The agent **discovers** the services it needs in the Nevermined Catalog and pays them as it goes, through the Router.

**2. An AI service wrote the words.** The operator did not write a single lyric. The only human-authored text in the entire run was a **≤200-character factual brief** about the news and a handful of production prompts (genre, image style). A dedicated AI lyric service took that brief and wrote the verses, the chorus, and the bridge — Delta cadence and all. Every creative element here — words, melody, vocals, cover art, and even the cover's caption — was produced by an AI service and paid for autonomously.

The result is an agent that can genuinely *act on its own* in a paid world — safely, because you set the limit.

## What happens, step by step

You give the agent **one prompt**. Behind the scenes it makes a short sequence of paid calls, in order, paying for each:

| Step | What the agent does | The kind of service it used |
|------|---------------------|-----------------------------|
| 1 | Reads the news for the AI-safety "slow down" story | a news search service |
| 2 | Hands over a ≤200-char factual brief and has an AI **write the delta-blues lyrics** | an AI writing service |
| 3 | Turns those lyrics into a full, sung song (two takes) | an AI music service |
| 4 | Paints a matching album cover | an AI image service |
| 5 | Reads the cover back to caption it (alt-text) | an AI vision service |

Each service is listed in the **Nevermined Catalog** — a directory of pay-per-use services built for AI agents. The script verifies each catalog slug before paying through the **Nevermined Router**, which resolves the merchant host and settles the payment. Across these services the agent paid using **two different payment methods** over **two different blockchains** — and it never once asked a human to pay.

## The one prompt

The agent is given exactly one ability — the Router it can pay through — and this instruction (in [`demo-prompt.txt`](./demo-prompt.txt)):

> *"Find a current headline about the AI-safety 'slow down' story, write a ≤200-character factual brief about it, and have an AI service turn that brief into a 1930s delta-blues song — words and all — plus a matching album cover and a caption for the cover. Give me the audio link and the cover. Discover every service in the Nevermined Catalog and pay for each through the Router — never ask me to pay, and don't write a single lyric yourself."*

It's not told which services to use or how to pay them. It works that out itself.

## The receipt (proof it really paid)

This is the actual **2026-09-16 run**, against Production Live, under one server-enforced **$1.00** delegation. The transaction hashes below are public on-chain records — like any blockchain payment, they identify the settling wallet and its balances, which is inherent to publishing them. The delegation ID and the API credentials are **not** committed anywhere in this tutorial.

| Step | Service · Catalog slug | What it did | Rail / chain | Settled |
|------|------------------------|-------------|--------------|--------:|
| Headlines | `brave-search-via-mpp` | News search: the AI-slowdown story | MPP / Tempo | $0.035 |
| Words | `suno-mpp` · generate-lyrics (+status) | **Suno wrote the lyrics** | MPP / Tempo | $0.030 |
| Song | `suno-mpp` · generate-music (+status ×4) | Two takes, V4.5 | MPP / Tempo | $0.125 |
| Cover | `fal-ai-mpp` · FLUX.1 [dev] | Album cover, 1024² | MPP / Tempo | $0.025 |
| Caption | `2s-io` · describe-image | Cover alt-text (Claude Haiku) | x402 / Base | $0.045 |

On-chain settlement (public tx hashes — Tempo unless noted; verify on each chain's explorer):

```
Headlines  Tempo  0xd4b21e0814b2fbf463f1fd04530491dc43b9d262353a3a85c06eafdd7b8c045b
Words      Tempo  0x94535961c84bf851631871a64dde0e4db0bd0af566e238b24f8441711f94001d
Song       Tempo  0x5663642a5b6bc1481e7e1469b744a73a66787ad4abb649f4c8e742e98ce9e5f5
Cover      Tempo  0x188eb7d32a5c3ba8c6867158c6365c845f8f38d179db7e40e8547b477c7054f5
Caption    Base   0x0c6a2d077b0d82595b4399ceaf7c635b71dfbf7bb1fc79f816b28a21a16dae4e
```

**Drawn: $0.36 of the $1.00 cap — $0.64 left over.** The five settled charges above total **$0.26**; the balance is a failed retry plus per-call routing (each call rounds up against the cap). The failed retry was a sixth call — an attempt to have `2s-io`'s chat model auto-write the brief — that hit a backend 502 and was abandoned for ~1.5¢, recorded on the ledger as `Issued`, not settled. So the operator supplied the ≤200-char brief by hand instead; every actual *lyric* was still written by Suno.

Four vendors, two payment rails, two blockchains, thirty-six cents — zero clicks, zero human-written lyrics.

## Try it yourself

**You'll need:** `jq`, `curl`, a Nevermined account API key, a broker-enabled Router API that accepts Catalog `slug`/`path` routing, and real balance on both rails. The observed run cost **$0.36**; status polling, provider prices, and incomplete responses can change the spend and outcome.

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
   The script verifies the four Catalog slugs and every POST path **before** spending, creates a capped budget, then runs the steps: news → brief → Suno writes the lyrics → Suno composes the song → fal.ai paints the cover → 2s.io captions it. New artifacts download to the gitignored `out/` folder (`song.mp3`, `album-cover.jpg`, `lyrics.txt`, `cover-caption.txt`); the checked-in examples above stay intact. If lyrics, audio, or a settled receipt is missing, it exits without claiming a completed song.

> ⚠️ **Real money.** The script caps delegation spending at **$1.00** for 15 minutes. Suno is asynchronous, so it can make several paid status checks; a returned `taskId` does not guarantee a downloadable song — the script only reports success once the audio file is on disk and at least four payments have `Settled` on the receipt.

## About the song

*Brake On The Code* is a novelty record built to demonstrate an agent discovering and paying for tools on its own. The lyrics reference real, dated news headlines (linked in [`index.html`](./index.html) and listed in the run's metadata); names of public figures appear only as they did in those headlines. Nothing here is an official statement by any company or person named.

## Learn more

- **Nevermined Catalog** — the directory of pay-per-use services for agents: <https://nevermined.app/catalog/>
- **The Router** — how one call lets an agent pay any listed service, whatever payment method it uses.

---

### video: follow-up

The walkthrough video for **this** take (delta blues, AI-written lyrics) is being re-recorded in the DevRel video studio. Until it lands, this folder keeps the **previous take's** `song-from-the-headlines.mp4` / `.en.srt` / `.es.srt` so nothing links to a missing file — but that video shows the older 90s-pop run, not *Brake On The Code*. A follow-up will replace the video and its subtitles here **and** refresh the showcase mirror (`showcase/public/media/song-from-the-headlines/`) and the showcase entry copy to this take, in one coordinated change.

*Part of the Nevermined tutorials. This demo was executed live on 2026-09-16.*
