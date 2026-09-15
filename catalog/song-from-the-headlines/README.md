# Song From the Headlines

**An AI agent that turns today's top tech headline into a finished song and album cover — and pays for everything itself.**

Imagine giving an assistant a small prepaid budget and a single instruction: *"turn today's top tech headline into a song."* It goes off, finds the tools it needs, uses them, pays each one directly, and comes back with a playable track and cover art. No accounts to create, no API keys to wire up, no buttons to click along the way.

That's this demo.

![The album cover the agent generated](./album-cover.jpg)

🎧 **The song it made:** [`song.mp3`](./song.mp3)
🎬 **Watch it happen:** [`song-from-the-headlines.mp4`](./song-from-the-headlines.mp4) — a ~70-second walkthrough (English + Spanish subtitles included)

🖥️ **Explore it interactively:** two web recaps of this same run, in two different flavours —
- [**The interactive showcase**](https://claude.ai/code/artifact/160b776a-65c5-4059-be76-e8972190df89) — the album cover, the playable song, the prompt, and the on-chain receipt on one page.
- [**An alternative take, by Rod**](https://claude.ai/code/artifact/0a515c41-79e5-4a12-bd60-fe7805ffba25) — the same story, a different design.

> From our run on 2026-09-02 — headline: *"Whatever the AI Future Is, We're in It Right Now"* (The Atlantic). Total cost: **about 16 cents**. Human clicks: **zero**.

> Two bounded Live repeats on **2026-09-15** delivered audio and cover in the ignored `out/` folder. The first settled nine payments for **$0.1705**; the second, after receipt and timing fixes, settled seven for **$0.1605** and delivered its first headline in **8 seconds**. The second run consumed **20¢** of its 50¢ delegation cap because per-call cap accounting rounds up sub-cent charges. Different Suno status-check counts explain the spend difference. See [`BUILD_LOG.md`](./BUILD_LOG.md).

---

## Why this is interesting

Normally, for software to use a paid online service, a person has to sign up, enter a credit card, and manage secret API keys — for *every* provider. This demo shows a different way to work:

- The **agent itself** holds a small, capped budget — think of it as a prepaid card with a spending limit you set.
- It **pays each service directly, on demand**, only for what it actually uses.
- Nothing is arranged with any provider in advance. The agent **discovers** the services it needs and pays them as it goes.

The result is an agent that can genuinely *act on its own* in a paid world — safely, because you set the limit.

## What happens, step by step

You give the agent **one prompt**. Behind the scenes it does four things, in order, paying for each:

| Step | What the agent does | The kind of service it used |
|------|---------------------|-----------------------------|
| 1 | Finds today's #1 technology headline | a news search service |
| 2 | Writes 90s-pop-anthem lyrics about that headline | an AI writing service |
| 3 | Turns the lyrics into a full, sung song | an AI music service |
| 4 | Paints a matching album cover | an AI image service |

Each service is listed in the **Nevermined Catalog** — a directory of pay-per-use services built for AI agents. The script verifies each catalog slug before paying through the **Nevermined Router**. The Router resolves the merchant host and settles the payment.

Across the four services, the agent paid using **two different payment methods** over **two different blockchains** — and it never once asked a human to pay.

## The one prompt

The agent is given exactly one ability — the Router it can pay through — and this instruction:

> *"Find today's #1 tech headline, write 90s-pop-anthem lyrics about it, generate a full song from those lyrics, and generate matching album cover art. Give me the audio link and the cover. Discover every service in the Nevermined Catalog and pay for each through the Router — never ask me to pay."*

It's not told which services to use or how to pay them. It works that out itself.

## The receipt (proof it really paid)

The table below describes the **2026-09-02 example run**. The two September 15 repeats needed five and three paid status checks, costing $0.1705 and $0.1605 respectively. Each ran under its own capped delegation.

| Service | Step | Cost |
|---------|------|------|
| Brave | today's headline | $0.035 |
| 2s.io | the lyrics | $0.0025 |
| Suno | the song | $0.105 (+ paid status checks, currently listed at $0.005 each) |
| fal.ai | the album cover | $0.003 |
| **Total** | | **~$0.16** |

Four vendors, two payment rails, two blockchains, sixteen cents — zero clicks.

## Try it yourself

**You'll need:** `jq`, `curl`, a Nevermined account API key, a broker-enabled API that accepts Catalog `slug`/`path` routing, and real balance. The observed runs cost about **$0.16** (September 2), **$0.1705** and **$0.1605** (September 15); status polling, provider prices, and incomplete responses can change the spend and outcome.

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
   The script verifies the four Catalog slugs, creates a capped budget, and runs the four steps. A successful repeat downloads new artifacts to `out/song.mp3` and `out/album-cover.jpg`; the checked-in examples above remain intact. If lyrics, audio, cover, or a settled Router body is missing, it exits without claiming a completed song.

> ⚠️ **Real money.** The script caps delegation spending at 50¢ for 10 minutes. It can make up to 12 paid Suno status checks, so a run can cost more than either observed run. A returned `taskId` does not guarantee a downloadable song; check both files in `out/` and the payment receipt.

## The prompt file

The exact instruction handed to the agent is in [`demo-prompt.txt`](./demo-prompt.txt).

## Learn more

- **Nevermined Catalog** — the directory of pay-per-use services for agents.
- **The Router** — how one call lets an agent pay any listed service, whatever payment method it uses.

*Part of the Nevermined tutorials. This demo was executed live; see the video for the full run.*
