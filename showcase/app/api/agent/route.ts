import { NextRequest, NextResponse } from "next/server";
// plain-JS sandbox logic (unit-tested via `node lib/demo-agent.mjs`)
import { respond } from "@/lib/demo-agent.mjs";

const COOKIE = "nvm_demo";

// The "see it run" panels post here. This is a local sandbox agent: it speaks the
// real x402 shape (402 → authorize → 200 + settlement) with a real per-session credit
// balance kept in an httpOnly cookie, but calls no external service and spends no real
// money. To make a tutorial genuinely live, proxy to its hosted backend here instead
// (inject the buyer's x402 token server-side; see langchain-chat-ui-nvm's api routes).
export async function POST(req: NextRequest) {
  let payload: { slug?: string; action?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const raw = req.cookies.get(COOKIE)?.value;
  let state: { authorized: boolean; balance: number } | undefined;
  try {
    state = raw ? JSON.parse(raw) : undefined;
  } catch {
    state = undefined;
  }

  const result = respond(state, {
    slug: payload.slug ?? "",
    action: (payload.action ?? "ask") as "intro" | "ask" | "authorize" | "reset",
    message: payload.message,
  });

  const res = NextResponse.json(result.body, { status: result.status });
  res.cookies.set(COOKIE, JSON.stringify(result.state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
