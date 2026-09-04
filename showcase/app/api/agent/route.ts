import { NextRequest, NextResponse } from "next/server";
// plain-JS sandbox logic (unit-tested via `node lib/demo-agent.mjs`)
import { respond } from "@/lib/demo-agent.mjs";
// real x402/MPP buyer against a deployed agent, enabled per-slug when env is present
import { isLiveSlug, liveRespond } from "@/lib/live-agent.mjs";

const COOKIE = "nvm_demo";

type Sub = { authorized: boolean; balance: number };

// The "see it run" panels post here. This is a local sandbox agent: it speaks the
// real x402 shape (402 → authorize → 200 + settlement) with a real per-session credit
// balance kept in an httpOnly cookie, but calls no external service and spends no real
// money. State is keyed per tutorial slug, so every tutorial has its own handshake and
// its own credits — authorizing on one does not skip the 402 on the others.
// To make a tutorial genuinely live, proxy to its hosted backend here instead (inject the
// buyer's x402 token server-side; see langchain-chat-ui-nvm's api routes) AND move
// `authorized`/`balance` server-side in the same change: this cookie is client-supplied
// and unsigned (httpOnly is not integrity), so it must never gate real spend — a raw
// `Cookie: nvm_demo={"x":{"authorized":true,"balance":1e9}}` would otherwise pass.
export async function POST(req: NextRequest) {
  let payload: { slug?: string; action?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const slug = payload.slug ?? "";

  // Per-slug state map: { [slug]: {authorized, balance} }. A pre-per-slug cookie was a
  // single {authorized, balance} object — detect it by the top-level `balance` and drop it.
  const raw = req.cookies.get(COOKIE)?.value;
  let all: Record<string, Sub> = {};
  try {
    const parsed = raw ? JSON.parse(raw) : undefined;
    if (parsed && typeof parsed === "object" && typeof parsed.balance !== "number") {
      all = parsed as Record<string, Sub>;
    }
  } catch {
    all = {};
  }

  const agentReq = {
    slug,
    action: (payload.action ?? "ask") as "intro" | "ask" | "authorize" | "reset",
    message: payload.message,
  };
  // Live slugs hit the real deployed agent (server-side buyer); everything else uses the
  // in-process simulator. isLiveSlug is false unless WEATHER_AGENT_URL + NVM_API_KEY + a plan id
  // are configured, so the site stays a pure simulator when unconfigured.
  const result = isLiveSlug(slug)
    ? await liveRespond(all[slug], agentReq)
    : respond(all[slug], agentReq);

  const res = NextResponse.json(result.body, { status: result.status });
  res.cookies.set(COOKIE, JSON.stringify({ ...all, [slug]: result.state }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
