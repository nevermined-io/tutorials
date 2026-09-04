"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoverRun } from "@/lib/types";
import { External } from "./icons";

// The functional "See it run" for the discovery tutorial: one question, answered at three
// altitudes (by eye / by an agent / by a crawler) live against the real, public Nevermined
// catalog through /api/catalog. No credentials, no payment — every call is read-only and free.
// Logic ported from the standalone playground (catalog/discover-the-catalog/playground).

type Rail = "x402" | "mpp";
type Tab = "mcp" | "ard" | "rest";

interface Stats {
  tier: string;
  total: number | null;
  categories: number | null;
  x402: number | null;
  mpp: number | null;
}
interface Service {
  slug?: string;
  title?: string;
  provider?: string;
  shortDescription?: string;
  protocol?: string;
  category?: string;
  priceLabel?: string;
  endpoints?: { priceLabel?: string }[];
}
interface SearchResult {
  keyword: string;
  rest: { req: string; res: { services?: Service[] } };
  ard: { req: string; res: unknown };
  mcp: { req: string; res: unknown };
  feed: { entry: unknown };
}
interface Facets {
  [field: string]: { buckets: { value: string; count: number }[] } | undefined;
}

// tiny JSON syntax highlighter — the data is the content here, so make it readable.
// Escapes & and < first, so the highlighted string is safe to inject.
function hlJson(obj: unknown): string {
  const j = JSON.stringify(obj, null, 2) ?? "null";
  return j
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"(\\.|[^"\\])*"(\s*:)?/g, (m, _g, colon) =>
      colon ? `<span class="jkey">${m}</span>` : `<span class="jstr">${m}</span>`,
    )
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="jnum">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="jbool">$1</span>')
    .replace(/\bnull\b/g, '<span class="jnull">null</span>');
}

const TABS: { id: Tab; label: string }[] = [
  { id: "mcp", label: "MCP tool" },
  { id: "ard", label: "ARD /search" },
  { id: "rest", label: "REST" },
];

// pay:protocol → rail class + display; type → strip the application/ prefix; tags → as-is
const FACET_SPEC: {
  field: string;
  label: string;
  rail?: boolean;
  fmt: (v: string) => string;
}[] = [
  { field: "pay:protocol", label: "payment rail", rail: true, fmt: (v) => (v === "x402" ? "x402" : v === "mpp" ? "MPP" : v) },
  { field: "type", label: "media type", fmt: (v) => v.replace("application/", "") },
  { field: "tags", label: "top tags", fmt: (v) => v },
];

async function callApi(op: string, body?: Record<string, unknown>) {
  const res = await fetch("/api/catalog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, ...body }),
  });
  return res.json();
}

export default function DiscoverPanel({ run }: { run: DiscoverRun }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState(run.question);
  const [rails, setRails] = useState<Rail[]>([]);
  const [tab, setTab] = useState<Tab>("mcp");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(
    async (text: string, useRails: Rail[]) => {
      const q = text.trim() || run.question;
      setBusy(true);
      setError(null);
      try {
        const [s, e] = await Promise.all([
          callApi("search", { text: q, rails: useRails }),
          callApi("explore", { text: q }),
        ]);
        if (s?.error) setError(s.message || "The catalog didn't answer — try again.");
        else setResult(s as SearchResult);
        setFacets((e?.facets ?? {}) as Facets);
      } catch {
        setError("Network error reaching the catalog. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [run.question],
  );

  // boot: live stats, then auto-run the hero question so the panel is populated on first paint
  useEffect(() => {
    let live = true;
    callApi("boot").then((b) => {
      if (live && b?.stats) setStats({ tier: b.tier, ...b.stats });
    });
    discover(run.question, []);
    return () => {
      live = false;
    };
  }, [discover, run.question]);

  function toggleRail(r: Rail) {
    const next = rails.includes(r) ? rails.filter((x) => x !== r) : [...rails, r];
    setRails(next);
    discover(query, next);
  }

  const services = result?.rest?.res?.services ?? [];
  const active = result ? result[tab] : null;

  return (
    <div className="dsc">
      {/* readout */}
      <div className="dsc-readout">
        <Stat value={stats?.total} label="agents" />
        <Stat value={stats?.categories} label="categories" />
        <div className="dsc-stat rails">
          <b>
            <span className="rx">{stats?.x402 ?? "—"}</span>
            <span className="sep">/</span>
            <span className="rm">{stats?.mpp ?? "—"}</span>
          </b>
          <span>x402 / MPP rails</span>
        </div>
        <div className="dsc-tier">
          <span className="dot" aria-hidden="true" /> {stats?.tier ?? "live"} catalog · read-only
        </div>
      </div>

      {/* command bar */}
      <form
        className="dsc-command"
        onSubmit={(e) => {
          e.preventDefault();
          discover(query, rails);
        }}
      >
        <div className="dsc-qbox">
          <span className="glyph" aria-hidden="true">
            &gt;_
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="Ask the catalog a question"
            placeholder="which agents can enrich a company?"
          />
        </div>
        <button className="dsc-run" type="submit" disabled={busy}>
          {busy ? "Discovering…" : "Discover"}
        </button>
      </form>

      {/* rail filters + presets */}
      <div className="dsc-chips">
        <span className="lbl">rails</span>
        {(["x402", "mpp"] as Rail[]).map((r) => (
          <button
            key={r}
            className={`dsc-chip ${r}`}
            data-on={rails.includes(r) ? "1" : "0"}
            aria-pressed={rails.includes(r)}
            onClick={() => toggleRail(r)}
            disabled={busy}
          >
            <span className="swatch" aria-hidden="true" />
            {r === "x402" ? "x402" : "MPP"}
            <span className="cnt">{r === "x402" ? stats?.x402 ?? "" : stats?.mpp ?? ""}</span>
          </button>
        ))}
        <span className="lbl gap">try</span>
        {run.presets.map((p) => (
          <button
            key={p}
            className="dsc-chip preset"
            onClick={() => {
              setQuery(p);
              discover(p, rails);
            }}
            disabled={busy}
          >
            {p}
          </button>
        ))}
      </div>

      {error ? <div className="dsc-err">{error}</div> : null}

      {/* three altitudes */}
      <div className="dsc-altitudes">
        {/* By eye */}
        <section className="dsc-pane eye">
          <header>
            <span className="k">By eye</span>
            <span className="sub">what a person browses</span>
          </header>
          <div className="body scroll">
            {services.length === 0 ? (
              <div className="dsc-empty">
                {busy ? "Searching the catalog…" : "No matching agents — try another query or clear the rail filter."}
              </div>
            ) : (
              services.slice(0, 8).map((s, i) => (
                <div className="dsc-svc" key={s.slug ?? i}>
                  <div className="top">
                    <h4>{s.title || s.slug}</h4>
                    {s.provider ? <span className="prov">{s.provider}</span> : null}
                  </div>
                  {s.shortDescription ? <div className="desc">{s.shortDescription}</div> : null}
                  <div className="meta">
                    {s.protocol === "x402" || s.protocol === "mpp" ? (
                      <span className={`rail ${s.protocol}`}>{s.protocol === "x402" ? "x402" : "MPP"}</span>
                    ) : null}
                    {s.category ? <span className="tagpill">{s.category}</span> : null}
                    {(() => {
                      const price = s.priceLabel || s.endpoints?.[0]?.priceLabel;
                      return price ? <span className="price">{price}</span> : null;
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* By an agent */}
        <section className="dsc-pane agent">
          <header>
            <span className="k">By an agent</span>
            <span className="sub">the live API call it makes</span>
          </header>
          <div className="body">
            <div className="dsc-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className="dsc-tab"
                  data-on={tab === t.id ? "1" : "0"}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="dsc-req">{active ? active.req : "The request appears here."}</div>
            <pre
              className="dsc-json grow"
              dangerouslySetInnerHTML={{ __html: active ? hlJson(active.res) : "// response" }}
            />
          </div>
        </section>

        {/* By a crawler */}
        <section className="dsc-pane crawler">
          <header>
            <span className="k">By a crawler</span>
            <span className="sub">.well-known/ard.json</span>
          </header>
          <div className="body">
            {result?.feed?.entry ? (
              <pre className="dsc-json grow" dangerouslySetInnerHTML={{ __html: hlJson(result.feed.entry) }} />
            ) : (
              <div className="dsc-empty">
                The open-web feed entry for the top match. Every listed agent appears at{" "}
                <code>/.well-known/ard.json</code>.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* facet strip — the STRUCTURE behind the answer, via ARD /explore */}
      <div className="dsc-facets">
        <h3>What&apos;s in this answer</h3>
        <p className="lead">
          The same query, run through ARD <code>/explore</code> — a live histogram of the payment rails, media
          types and tags behind your results. This is how you discover the catalog&apos;s <em>structure</em>, not
          just its listings.
        </p>
        <div className="dsc-facet-grid">
          {facets && FACET_SPEC.some((f) => facets[f.field]) ? (
            FACET_SPEC.map((spec) => {
              const f = facets[spec.field];
              if (!f) return null;
              const max = Math.max(1, ...f.buckets.map((b) => b.count));
              return (
                <div className="dsc-facet" key={spec.field}>
                  <h5>{spec.label}</h5>
                  {f.buckets.map((b) => (
                    <div className="dsc-bar" key={b.value}>
                      <div className="name" title={spec.fmt(b.value)}>
                        {spec.fmt(b.value)}
                      </div>
                      <div className="track">
                        <div
                          className={`fill${spec.rail ? " " + (b.value === "x402" ? "x402" : b.value === "mpp" ? "mpp" : "") : ""}`}
                          style={{ width: `${(b.count / max) * 100}%` }}
                        />
                      </div>
                      <div className="val">{b.count}</div>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <div className="dsc-empty">{busy ? "Computing facets…" : "Run a query to see its facets."}</div>
          )}
        </div>
      </div>

      <p className="runnote">
        Live against the public Nevermined Agent Services Catalog — every call here is read-only, unauthenticated
        and free (no API key, no wallet, no payment). A same-origin proxy (<code>/api/catalog</code>) forwards the
        calls server-side because the catalog&apos;s CORS only allows <code>*.nevermined.app</code> origins.{" "}
        <a href="https://nevermined.app/catalog/" target="_blank" rel="noreferrer">
          Browse the catalog <External size={12} />
        </a>{" "}
        {run.note}
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div className="dsc-stat">
      <b>{value ?? "—"}</b>
      <span>{label}</span>
    </div>
  );
}
