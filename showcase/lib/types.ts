// Normalized content model shared by every tutorial page.
// One shape for all tutorials → uniform pages out of wildly different READMEs.

export type Protocol = "x402" | "mpp" | "mcp" | "langchain" | "catalog";
export type Language = "ts" | "py" | "autonomous" | "agnostic";
export type Tier = "live" | "recap" | "discover";

export interface CodeSample {
  caption?: string;
  lang: string;
  code: string;
}

export interface FileRow {
  path: string;
  desc: string;
}

export interface FlowStep {
  label: string;
  sub?: string;
  emphasis?: boolean;
}

export interface DataTable {
  head: string[];
  rows: string[][];
  /** index of the row to render as a bold total, if any */
  totalRow?: number;
}

/** Section 1 — what the tutorial teaches. */
export interface LearnSection {
  lead: string;
  bullets: string[];
}

/** Section 2 — how it works. */
export interface HowSection {
  paragraphs: string[];
  flow?: FlowStep[];
  table?: DataTable;
}

/** A titled group of code samples — rendered as a numbered sub-section (3.1, 3.2, …). */
export interface CodeGroup {
  title: string;
  /** optional lead sentence under the sub-section heading */
  lead?: string;
  samples: CodeSample[];
}

/** Section 3 — technical details. */
export interface TechSection {
  stack: string[];
  /** flat samples — rendered when `groups` is absent (most tutorials) */
  samples: CodeSample[];
  /** when present, samples are split into numbered sub-sections (e.g. 3.1 Client, 3.2 Agent) */
  groups?: CodeGroup[];
  files?: FileRow[];
}

/** Section 4 (live) — a runnable panel. The panel (components/LiveRunPanel) is
 * API-driven: it talks to /api/agent, whose per-tutorial behavior lives in
 * lib/demo-agent.mjs (real x402 round-trips against a local sandbox — no real money).
 * Only `note` is read from here now (the pill shown in the panel comes from the intro
 * response, not `paymentPill`); the other fields are legacy editorial kept for reference. */
export interface LiveRun {
  kind: "live";
  present: "chat" | "transcript";
  paymentPill?: string;
  /** for present==="chat" */
  chat?: { role: "user" | "agent"; text: string; free?: boolean; paid?: boolean }[];
  paidPrompt?: { title: string; body: string; cta: string };
  settle?: string;
  paidAnswer?: string;
  /** for present==="transcript" */
  transcript?: { t: string; kind?: "req" | "r402" | "r200" | "dim" | "settle" }[];
  /** env var holding a real backend URL; when set the panel offers a live send */
  endpointEnv?: string;
  note: string;
}

/** Section 4 (recap) — watch it run; no live backend (real money / autonomy). */
export interface RecapRun {
  kind: "recap";
  video?: {
    src: string;
    caption: string;
    duration: string;
    /** WebVTT tracks (HTML5 <track> only accepts .vtt, not .srt) */
    subtitles?: { src: string; srcLang: string; label: string; default?: boolean }[];
  };
  outputs?: {
    cover?: { src?: string; label: string };
    audio?: { src?: string; label: string };
  };
  receipt?: DataTable;
  prompt?: string;
  warn?: string;
  interactive?: { label: string; href: string }[];
  /** additional embedded "takes" shown as tabs beside the main recap */
  takes?: { label: string; byline?: string; embedHref: string }[];
}

/** A captioned video block (WebVTT tracks — HTML5 <track> only accepts .vtt). */
export interface VideoBlock {
  src: string;
  caption: string;
  duration: string;
  subtitles?: { src: string; srcLang: string; label: string; default?: boolean }[];
}

/** Section 4 (discover) — a functional, read-only discovery panel. Unlike `live` (which
 * runs the x402 payment handshake against a sandbox), this queries the real, public catalog
 * live through /api/catalog (a same-origin proxy) — no credentials, no payment, ever. The
 * panel (components/DiscoverPanel) fetches everything else; only these editorial bits live here. */
export interface DiscoverRun {
  kind: "discover";
  /** guided-tour video shown above the live panel */
  video?: VideoBlock;
  /** the hero question, auto-run on load so the panel is populated on first paint */
  question: string;
  /** preset chips offered under the query box */
  presets: string[];
  note: string;
}

export interface Tutorial {
  slug: string;
  title: string;
  tagline: string;
  protocol: Protocol;
  language: Language;
  tier: Tier;
  repoPath: string;
  featured?: boolean;
  learn: LearnSection;
  how: HowSection;
  tech: TechSection;
  run: LiveRun | RecapRun | DiscoverRun;
}

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  x402: "x402 HTTP",
  mpp: "MPP",
  mcp: "MCP",
  langchain: "LangChain",
  catalog: "Catalog",
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  ts: "ts",
  py: "py",
  autonomous: "autonomous",
  // Required (Record is total) but unreachable for chips: languageTags() returns
  // LANGUAGE_TAGS["agnostic"] instead. The rendered text lives there, not here.
  agnostic: "agnostic",
};

// A tutorial's language, as the chip(s) to show. Most languages are one chip; a
// language-agnostic tutorial is labelled by the interfaces it teaches instead — its own
// chip each (e.g. "mcp", "api"). Single source of truth for every render site.
const LANGUAGE_TAGS: Partial<Record<Language, string[]>> = {
  agnostic: ["mcp", "api"],
};
export function languageTags(language: Language): string[] {
  return LANGUAGE_TAGS[language] ?? [LANGUAGE_LABEL[language]];
}
