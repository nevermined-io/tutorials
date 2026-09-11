import { NextResponse } from "next/server";

// Serves the hosted-checkout origin (NVM_EMBED_BASE_URL) to the Fiat panel at
// REQUEST time. It lives in a route handler on purpose: handlers are always
// dynamic, so this reflects the pod's env, while the /t/[slug] pages are SSG and
// would freeze the value at `next build`. "" (prod, unset) → the panel shows its
// "checkout not configured" notice; dev falls back to the local embed on :4250.
export const dynamic = "force-dynamic";

export function GET() {
  const embedBase =
    process.env.NVM_EMBED_BASE_URL ??
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:4250");
  return NextResponse.json({ embedBase });
}
