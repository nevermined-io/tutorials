"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveRun } from "@/lib/types";
import { ArrowRight } from "./icons";

type Item =
  | { type: "msg"; role: "user" | "agent"; text: string; tag?: "free" | "paid" }
  | { type: "pay"; credits: number; pending: string; resolved?: boolean }
  | { type: "settle"; text: string; error?: boolean }
  | { type: "notice"; text: string };

interface Intro {
  greeting: string;
  suggestions: string[];
  authorized: boolean;
  balance: number;
}

export default function LiveRunPanel({
  slug,
  title,
  run,
}: {
  slug: string;
  title: string;
  run: LiveRun;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [flash, setFlash] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  async function call(action: string, message?: string) {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, action, message }),
    });
    return { status: res.status, body: await res.json() };
  }

  function tickBalance(next: number) {
    setBalance(next);
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }

  useEffect(() => {
    let live = true;
    call("intro").then(({ body }) => {
      if (!live) return;
      const intro = body as Intro;
      setItems([{ type: "msg", role: "agent", text: intro.greeting }]);
      setSuggestions(intro.suggestions ?? []);
      setAuthorized(intro.authorized);
      setBalance(intro.balance);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [items]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setItems((x) => [...x, { type: "msg", role: "user", text: message }]);
    try {
      const { status, body } = await call("ask", message);
      if (status === 402 && body.kind === "payment_required") {
        setItems((x) => [...x, { type: "pay", credits: body.credits, pending: message }]);
      } else if (status === 402 && body.kind === "insufficient") {
        setBalance(body.balance);
        setItems((x) => [
          ...x,
          { type: "notice", text: "Out of credits this session — reset the delegation to top up." },
        ]);
      } else if (body.kind === "free") {
        setItems((x) => [...x, { type: "msg", role: "agent", text: body.answer, tag: "free" }]);
      } else if (body.kind === "paid") {
        tickBalance(body.balance);
        setItems((x) => [
          ...x,
          { type: "settle", text: `200 OK · settled ${body.credits} credit(s) · balance ${body.balance}` },
          { type: "msg", role: "agent", text: body.answer, tag: "paid" },
        ]);
      } else {
        setItems((x) => [...x, { type: "settle", text: "the agent returned an error", error: true }]);
      }
    } catch {
      setItems((x) => [
        ...x,
        { type: "settle", text: "network error — is the sandbox running?", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function authorize(pending: string, idx: number) {
    if (busy) return;
    setBusy(true);
    try {
      const { body } = await call("authorize");
      setAuthorized(true);
      if (typeof body.balance === "number") setBalance(body.balance);
      setItems((x) => x.map((it, i) => (i === idx ? ({ ...it, resolved: true } as Item) : it)));
    } finally {
      setBusy(false);
    }
    await ask(pending);
  }

  async function reset() {
    await call("reset");
    setAuthorized(false);
    setBalance(100);
    setItems((x) => [...x, { type: "notice", text: "Card delegation reset · balance back to 100." }]);
  }

  return (
    <>
      <div className="runpanel">
        <div className="rp-bar">
          <span className="live-dot" aria-hidden="true" />
          <span className="title">{title}</span>
          {balance !== null ? (
            <span className={`bal${flash ? " flash" : ""}`}>
              balance <b>{balance}</b>
            </span>
          ) : null}
        </div>

        <div className="chatlog" ref={logRef}>
          {items.map((it, i) => {
            if (it.type === "msg") {
              return (
                <div
                  key={i}
                  className={`msg ${it.role === "user" ? "u" : "a"}`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {it.text}
                  {it.tag ? (
                    <span className={`tagfree ${it.tag}`}>
                      {it.tag === "free" ? "free · no token attached" : "paid · settled in one round-trip"}
                    </span>
                  ) : null}
                </div>
              );
            }
            if (it.type === "pay") {
              return (
                <div className="paycard" key={i}>
                  <div className="big402">
                    402 <span>Payment Required</span>
                  </div>
                  <p>
                    This capability costs {it.credits} credit(s). Authorize a card delegation once and
                    the agent pays per call — you&apos;re not asked again this session.
                  </p>
                  <button
                    className="cta"
                    onClick={() => authorize(it.pending, i)}
                    disabled={busy || it.resolved}
                  >
                    {it.resolved ? "Authorized" : "Authorize with card"}
                    {!it.resolved ? <ArrowRight size={16} /> : null}
                  </button>
                </div>
              );
            }
            if (it.type === "settle") {
              return (
                <div className={`settle${it.error ? " err" : ""}`} key={i}>
                  <span className="stamp">{it.error ? "ERROR" : "PAID"}</span>
                  <span className="txt">{it.text}</span>
                </div>
              );
            }
            return (
              <div className="notice" key={i}>
                {it.text}
              </div>
            );
          })}
        </div>

        {suggestions.length > 0 && items.length <= 1 ? (
          <div className="rp-suggest">
            {suggestions.map((s) => (
              <button key={s} className="schip" onClick={() => ask(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="rp-input"
          onSubmit={(e) => {
            e.preventDefault();
            const t = input;
            setInput("");
            ask(t);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "…" : "Send a request to the agent"}
            disabled={busy}
            aria-label="Message the agent"
          />
          <button type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </div>
      <p className="runnote">
        {authorized ? (
          <>
            Sandbox agent — real payment round-trips and a real per-session credit balance, no real money.{" "}
            <button className="linkbtn" onClick={reset}>
              Reset delegation
            </button>
            .{" "}
          </>
        ) : (
          "Sandbox agent — real payment round-trips (402 → authorize → settle) with a per-session credit balance, no external service and no real money. "
        )}
        {run.note}
      </p>
    </>
  );
}
