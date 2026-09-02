# Song From the Headlines

**An AI agent that turns today's top tech headline into a finished song and album cover — and pays for everything itself.**

Imagine giving an assistant a small prepaid budget and a single instruction: *"turn today's top tech headline into a song."* It goes off, finds the tools it needs, uses them, pays each one directly, and comes back with a playable track and cover art. No accounts to create, no API keys to wire up, no buttons to click along the way.

That's this demo.

![The album cover the agent generated](./album-cover.jpg)

🎧 **The song it made:** [`song.mp3`](./song.mp3)
🎬 **Watch it happen:** [`song-from-the-headlines.mp4`](./song-from-the-headlines.mp4) — a ~70-second walkthrough (English + Spanish subtitles included)

> From our run on 2026-09-02 — headline: *"Whatever the AI Future Is, We're in It Right Now"* (The Atlantic). Total cost: **about 16 cents**. Human clicks: **zero**.

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

Each service is one it found in the **Nevermined Catalog** — a directory of pay-per-use services built for AI agents. It pays through the **Nevermined Router**, so the agent never has to learn how each provider wants to be paid; the Router sorts that out and settles the payment.

Across the four services, the agent paid using **two different payment methods** over **two different blockchains** — and it never once asked a human to pay.

## The one prompt

The agent is given exactly one ability — the Router it can pay through — and this instruction:

> *"Find today's #1 tech headline, write 90s-pop-anthem lyrics about it, generate a full song from those lyrics, and generate matching album cover art. Give me the audio link and the cover. Discover every service in the Nevermined Catalog and pay for each through the Router — never ask me to pay."*

It's not told which services to use or how to pay them. It works that out itself.

## The receipt (proof it really paid)

Every purchase is a real payment, recorded on a public blockchain, all under the single budget you set:

| Service | Step | Cost |
|---------|------|------|
| Brave | today's headline | $0.035 |
| 2s.io | the lyrics | $0.0025 |
| Suno | the song | $0.105 (+ small status checks) |
| fal.ai | the album cover | $0.003 |
| **Total** | | **~$0.16** |

Four vendors, two payment rails, two blockchains, sixteen cents — zero clicks.

## Try it yourself

**You'll need:** a Nevermined account API key, and a little real balance (this runs on live blockchains — about **$0.16** per run, so keep the budget small).

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
   The script sets up a small capped budget, then runs the four steps above, printing what it buys and downloading the finished `song.mp3` and `album-cover.jpg`.

> ⚠️ **Real money.** Each run spends ~$0.16 on live blockchains. The script caps the budget at 50¢ and 10 minutes so it can never overspend.

## The prompt file

The exact instruction handed to the agent is in [`demo-prompt.txt`](./demo-prompt.txt).

## Learn more

- **Nevermined Catalog** — the directory of pay-per-use services for agents.
- **The Router** — how one call lets an agent pay any listed service, whatever payment method it uses.

*Part of the Nevermined tutorials. This demo was executed live; see the video for the full run.*
