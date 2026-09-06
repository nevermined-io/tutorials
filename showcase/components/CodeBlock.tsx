"use client";

import { useMemo, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-typescript";
// jsx/tsx must load after typescript (tsx extends both jsx and typescript) so
// the chat.tsx sample — JSX + TS — highlights fully instead of rendering plain.
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import { Copy, Check } from "./icons";

const LANG_MAP: Record<string, string> = {
  python: "python",
  py: "python",
  typescript: "typescript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  json: "json",
  bash: "bash",
  sh: "bash",
};

export default function CodeBlock({
  code,
  caption,
  lang,
}: {
  code: string;
  caption?: string;
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    const l = LANG_MAP[lang ?? ""] ?? "";
    const grammar = l ? Prism.languages[l] : undefined;
    if (!grammar) return null;
    try {
      return Prism.highlight(code, grammar, l);
    } catch {
      return null;
    }
  }, [code, lang]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div>
      {caption ? <div className="codecap"># {caption}</div> : null}
      <div className="codewrap">
        <button className={`copybtn${copied ? " ok" : ""}`} onClick={copy} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
        {/* suppressHydrationWarning: Prism (and some browser extensions) mutate the
            highlighted <pre>/<code> after SSR — adding a language class / tabindex — which
            is a benign attribute-only diff React would otherwise warn about. */}
        <pre className="code" suppressHydrationWarning>
          {html ? (
            // Safe: `code` is our own static content (content/tutorials.ts), and
            // Prism.highlight HTML-escapes its input before emitting token spans —
            // there is no untrusted-input path here.
            <code
              className={`language-${lang}`}
              dangerouslySetInnerHTML={{ __html: html }}
              suppressHydrationWarning
            />
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
    </div>
  );
}
