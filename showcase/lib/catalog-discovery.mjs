// Pure discovery logic behind the "discover" tutorial's See-it-run panel.
// No HTTP, no React — just request builders + response parsers + the feed matcher,
// so it's unit-testable and app/api/catalog/route.ts stays a thin fetch shim.
// Ported from catalog/discover-the-catalog/playground (the proven standalone tool).
//
// Self-check: `node lib/catalog-discovery.mjs`.

// The catalog REST/MCP search is naive substring matching — it wants a keyword, not a
// sentence. ARD /search ranks the whole question. So the human cards + MCP pane search by
// the salient keyword; the ARD pane gets the full natural-language text. That difference is
// the lesson, not a bug.
const STOP = new Set(
  ("which what who whom whose a an the can could would will to for of in on at and " +
    "or is are be do does me my i you your with that this these those find show get list any all " +
    "agent agents tool tools service services api apis paid pay please help need want")
    .split(/\s+/),
);

/** The salient domain noun from a natural-language question (longest non-stopword). */
export function keyword(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return String(text || "").trim().replace(/[^a-z0-9\s]/gi, "").trim();
  return words.sort((a, b) => b.length - a.length)[0];
}

/** Only x402 and mpp are payable through the Router; ignore anything else a caller sends. */
export function normalizeRails(rails) {
  return [...new Set((rails || []).filter((r) => r === "x402" || r === "mpp"))];
}

// ── request builders: each returns { path|body, display } — `display` is the exact call
// shown in the panel, so what the reader sees is what the server actually sends. ──────────

export function restRequest(kw, rails) {
  const qs = new URLSearchParams({ search: kw, offset: "8" });
  if (rails.length === 1) qs.set("protocol", rails[0]);
  const path = `/api/v1/catalog/services?${qs}`;
  return { path, display: `GET ${path}` };
}

export function ardRequest(text, rails) {
  const filter = rails.length ? { "pay:protocol": rails } : undefined;
  const body = { query: { text, ...(filter ? { filter } : {}) }, pageSize: 6 };
  return { path: "/api/v1/ard/search", body, display: `POST /api/v1/ard/search\n${JSON.stringify(body)}` };
}

export function mcpRequest(kw, rails) {
  const args = { query: kw, offset: 6, ...(rails.length === 1 ? { protocol: rails[0] } : {}) };
  const body = { jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "search_services", arguments: args } };
  return { path: "/mcp", body, display: `search_services(${JSON.stringify(args)})` };
}

export function exploreRequest(text) {
  const body = {
    query: { text },
    resultType: { facets: [{ field: "pay:protocol" }, { field: "type" }, { field: "tags", limit: 6 }] },
  };
  return { path: "/api/v1/ard/explore", body };
}

/** MCP streamable-HTTP may answer as JSON or as an SSE stream — pull the JSON out of both. */
export function parseUpstream(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // SSE framing: one or more `data: {...}` lines. Take the last data payload.
    const datas = trimmed
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    for (const d of datas.reverse()) {
      try {
        return JSON.parse(d);
      } catch {
        /* try the next */
      }
    }
    return { error: "unparseable_upstream" };
  }
}

/** The MCP tool wraps its JSON payload as a string inside result.content[0].text. */
export function parseMcpResult(raw) {
  try {
    return JSON.parse(raw.result.content[0].text);
  } catch {
    return raw;
  }
}

/** Trim a feed entry to the meaningful, agent-ready terms the panel shows. */
export function trimFeedEntry(entry) {
  if (!entry) return null;
  return {
    identifier: entry.identifier,
    displayName: entry.displayName,
    type: entry.type,
    url: entry.url,
    description: entry.description,
    tags: entry.tags,
    representativeQueries: entry.representativeQueries,
    "nvm:catalog": entry["nvm:catalog"],
    trustManifest: entry.trustManifest,
  };
}

/** Match the top human/ARD result against the crawler feed (by name, then by id). */
export function matchFeedEntry(entries, restRes, ardRes) {
  const list = Array.isArray(entries) ? entries : [];
  const topName = restRes?.services?.[0]?.title || ardRes?.results?.[0]?.displayName;
  let entry = null;
  if (topName) entry = list.find((e) => (e.displayName || "").toLowerCase() === topName.toLowerCase());
  if (!entry && ardRes?.results?.[0]) {
    const id = ardRes.results[0].identifier;
    entry = list.find((e) => e.identifier === id);
  }
  return trimFeedEntry(entry);
}

// ── runnable self-check ──────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const assert = (c, m) => {
    if (!c) throw new Error("FAIL: " + m);
  };

  // keyword: picks the longest salient noun, drops stopwords ("agents","company enrich")
  assert(keyword("which agents can enrich a company?") === "company", "keyword → company");
  assert(keyword("weather") === "weather", "single word passes through");
  assert(keyword("???") === "", "no salient word → empty");

  // rails filter only attaches protocol on a single rail (REST/MCP), always on ARD
  assert(!restRequest("x", ["x402", "mpp"]).path.includes("protocol"), "two rails → no REST protocol filter");
  assert(restRequest("x", ["x402"]).path.includes("protocol=x402"), "one rail → REST protocol filter");
  assert(mcpRequest("x", ["mpp"]).body.params.arguments.protocol === "mpp", "one rail → MCP protocol");
  assert(ardRequest("q", ["x402"]).body.query.filter["pay:protocol"][0] === "x402", "ARD filter attached");
  assert(ardRequest("q", []).body.query.filter === undefined, "no rails → no ARD filter");

  // explore body shape is the one the API requires (bare {text} 500s)
  const ex = exploreRequest("enrichment").body;
  assert(ex.query.text === "enrichment" && Array.isArray(ex.resultType.facets), "explore body shape");

  // normalizeRails drops junk + dedupes
  assert(JSON.stringify(normalizeRails(["x402", "rest", "x402", "mpp"])) === '["x402","mpp"]', "normalizeRails");

  // parseUpstream handles plain JSON and SSE framing
  assert(parseUpstream('{"a":1}').a === 1, "plain json");
  assert(parseUpstream('event: message\ndata: {"a":2}\n\n').a === 2, "sse framed json");

  // parseMcpResult unwraps the stringified tool payload
  assert(parseMcpResult({ result: { content: [{ text: '{"total":3}' }] } }).total === 3, "mcp unwrap");

  // matchFeedEntry: by name, then by identifier, trimmed
  const entries = [
    { identifier: "urn:a", displayName: "Alpha", type: "application/json", extra: "dropped" },
    { identifier: "urn:b", displayName: "Beta" },
  ];
  const m = matchFeedEntry(entries, { services: [{ title: "alpha" }] }, null);
  assert(m.identifier === "urn:a" && m.extra === undefined, "match by name + trim");
  const m2 = matchFeedEntry(entries, {}, { results: [{ identifier: "urn:b", displayName: "Beta" }] });
  assert(m2.identifier === "urn:b", "match by identifier");
  assert(matchFeedEntry(entries, {}, { results: [{ identifier: "urn:zzz" }] }) === null, "no match → null");

  console.log("✓ catalog-discovery self-check passed");
}
