// Normalized content model shared by every tutorial page.
// One shape for all tutorials → uniform pages out of wildly different READMEs.

export type Protocol = "x402" | "mcp" | "langchain" | "catalog";
export type Language = "ts" | "py" | "autonomous";
export type Tier = "live" | "recap";

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

/** Section 3 — technical details. */
export interface TechSection {
  stack: string[];
  samples: CodeSample[];
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
  run: LiveRun | RecapRun;
}

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  x402: "x402 HTTP",
  mcp: "MCP",
  langchain: "LangChain",
  catalog: "Catalog",
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  ts: "ts",
  py: "py",
  autonomous: "autonomous",
};
