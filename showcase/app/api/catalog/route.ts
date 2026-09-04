import { NextRequest, NextResponse } from "next/server";
import {
  keyword,
  normalizeRails,
  restRequest,
  ardRequest,
  mcpRequest,
  exploreRequest,
  parseUpstream,
  parseMcpResult,
  matchFeedEntry,
} from "@/lib/catalog-discovery.mjs";

// Same-origin proxy for the "discover" tutorial's See-it-run panel.
//
// Why it exists: every catalog/ARD/MCP discovery endpoint is PUBLIC, unauthenticated and free,
// but the API's CORS allowlist only reflects `*.nevermined.app` origins — so a browser calling it
// from the showcase's origin is blocked. This route sits same-origin with the page and forwards the
// discovery calls server-side, where CORS does not apply (exactly what the standalone playground's
// server.mjs does). No credentials are involved: discovery never needs an API key or a wallet.
//
// SSRF-safe: the client picks an `op` from a fixed set; the upstream URL + path are built entirely
// server-side by our own request builders. There is no client-controlled destination host or path,
// so this can't be turned into an open relay.

const TIER = process.env.NVM_CATALOG_TIER === "sandbox" ? "sandbox" : "live";
const API_BASE = `https://api.${TIER}.nevermined.app`;
const MCP_BASE = `https://mcp.${TIER}.nevermined.app`;
const TIMEOUT_MS = 15_000;

function upstreamUrl(path: string): string {
  if (path === "/mcp") return `${MCP_BASE}/mcp`;
  return `${API_BASE}${path}`; // /api/... and /.well-known/... only (paths are ours, never the client's)
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(upstreamUrl(path), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  return parseUpstream(await res.text());
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(upstreamUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  return parseUpstream(await res.text());
}

// The crawler feed is ~160 entries and changes slowly — cache it in-process (soft 10-min TTL)
// so a search doesn't refetch the whole document on every keystroke.
// ponytail: module-level cache, per-instance; fine for a read-only marketing demo.
type FeedCache = { at: number; entries: unknown[] };
let feedCache: FeedCache | null = null;
async function feedEntries(): Promise<unknown[]> {
  if (feedCache && Date.now() - feedCache.at < 10 * 60_000) return feedCache.entries;
  try {
    const feed = (await getJson("/.well-known/ard.json")) as { entries?: unknown[] };
    feedCache = { at: Date.now(), entries: Array.isArray(feed.entries) ? feed.entries : [] };
  } catch {
    feedCache = { at: Date.now(), entries: [] };
  }
  return feedCache.entries;
}

type Payload = { op?: string; text?: string; rails?: string[] };

export async function POST(req: NextRequest) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const rails = normalizeRails(payload.rails);
  const text = (payload.text || "").trim();

  try {
    if (payload.op === "boot") {
      const [cats, x402, mpp] = await Promise.all([
        getJson("/api/v1/catalog/categories"),
        getJson("/api/v1/catalog/services?protocol=x402&offset=1"),
        getJson("/api/v1/catalog/services?protocol=mpp&offset=1"),
      ]);
      const catList = Array.isArray(cats) ? (cats as { count?: number }[]) : [];
      return NextResponse.json({
        tier: TIER,
        stats: {
          categories: catList.length,
          total: catList.reduce((s, c) => s + (c.count || 0), 0),
          x402: (x402 as { total?: number })?.total ?? null,
          mpp: (mpp as { total?: number })?.total ?? null,
        },
      });
    }

    if (payload.op === "search") {
      if (!text) return NextResponse.json({ error: "empty query" }, { status: 400 });
      const kw = keyword(text);
      const rest = restRequest(kw, rails);
      const ard = ardRequest(text, rails);
      const mcp = mcpRequest(kw, rails);

      const [restRes, ardRes, mcpRaw, entries] = await Promise.all([
        getJson(rest.path),
        postJson(ard.path, ard.body),
        postJson(mcp.path, mcp.body),
        feedEntries(),
      ]);
      const mcpRes = parseMcpResult(mcpRaw);

      return NextResponse.json({
        keyword: kw,
        rest: { req: rest.display, res: restRes },
        ard: { req: ard.display, res: ardRes },
        mcp: { req: mcp.display, res: mcpRes },
        feed: { entry: matchFeedEntry(entries, restRes, ardRes) },
      });
    }

    if (payload.op === "explore") {
      if (!text) return NextResponse.json({ error: "empty query" }, { status: 400 });
      const ex = exploreRequest(text);
      const data = (await postJson(ex.path, ex.body)) as { facets?: unknown };
      return NextResponse.json({ facets: data?.facets ?? {} });
    }

    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: "proxy_error", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
