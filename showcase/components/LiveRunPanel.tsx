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
  live?: boolean;
}

// The Nevermined App host for the "Connect" (CLI-auth) flow. Sandbox vs live is chosen inside the
// App; this is just the frontend host. Override per-deployment via NEXT_PUBLIC_NVM_APP_URL.
const APP_URL = process.env.NEXT_PUBLIC_NVM_APP_URL || "https://nevermined.app";
const KEY_STORAGE = "nvm_api_key";

function readStoredKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

// Current page URL with any nvm_api_key param stripped — used as the callback target.
function cleanCallbackUrl(): string {
  const u = new URL(window.location.href);
  u.searchParams.delete(KEY_STORAGE);
  return u.toString();
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
  const [live, setLive] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // On mount: capture an nvm_api_key returned by the Nevermined App callback (query string),
  // persist it, and clean the URL — otherwise fall back to a previously stored key.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const returned = params.get(KEY_STORAGE);
      if (returned) {
        localStorage.setItem(KEY_STORAGE, returned);
        window.history.replaceState({}, "", cleanCallbackUrl());
      }
    } catch {
      /* private mode / no storage — connect flow just won't persist */
    }
    setApiKey(readStoredKey());
  }, []);

  async function call(action: string, message?: string) {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, action, message, apiKey: readStoredKey() ?? undefined }),
    });
    return { status: res.status, body: await res.json() };
  }

  function tickBalance(next: number) {
    setBalance(next);
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }

  useEffect(() => {
    let alive = true;
    call("intro").then(({ body }) => {
      if (!alive) return;
      const intro = body as Intro;
      setItems([{ type: "msg", role: "agent", text: intro.greeting }]);
      setSuggestions(intro.suggestions ?? []);
      setAuthorized(intro.authorized);
      setBalance(intro.balance);
      setLive(!!intro.live);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [items]);

  function connect() {
    setConnecting(true);
    const url = `${APP_URL}/auth/cli?callback_url=${encodeURIComponent(
      cleanCallbackUrl(),
    )}&key_name=${encodeURIComponent("Nevermined Tutorials")}`;
    window.location.href = url;
  }

  function disconnect() {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
    setApiKey(null);
    setAuthorized(false);
    setItems((x) => [...x, { type: "notice", text: "Disconnected — your Nevermined key was removed from this browser." }]);
  }

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setItems((x) => [...x, { type: "msg", role: "user", text: message }]);
    try {
      const { status, body } = await call("ask", message);
      if (status === 401 && body.kind === "not_connected") {
        setItems((x) => [...x, { type: "notice", text: "Connect with Nevermined first to make paid requests." }]);
      } else if (status === 402 && body.kind === "payment_required") {
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
        setItems((x) => [
          ...x,
          { type: "settle", text: body.error || "the agent returned an error", error: true },
        ]);
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
    setBalance(live ? balance : 100);
    setItems((x) => [...x, { type: "notice", text: "Delegation reset." }]);
  }

  // Live tutorial, not yet connected → show the Connect gate instead of the input.
  const needsConnect = live && !apiKey;

  return (
    <>
      <div className="runpanel">
        <div className="rp-bar">
          <span className="live-dot" aria-hidden="true" />
          <span className="title">{title}</span>
          {live && apiKey ? (
            <span className="bal" title="Connected to Nevermined">
              connected{" "}
              <button className="linkbtn" onClick={disconnect}>
                disconnect
              </button>
            </span>
          ) : null}
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
                <div className="payline" key={i}>
                  <span className="stamp">402</span>
                  <span className="txt">Payment required · {it.credits} credit(s)</span>
                  <button
                    className="cta sm"
                    onClick={() => authorize(it.pending, i)}
                    disabled={busy || it.resolved}
                  >
                    {it.resolved ? "Authorized" : "Authorize"}
                    {!it.resolved ? (busy ? <span className="spinner" /> : <ArrowRight size={14} />) : null}
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
          {busy ? (
            <div className="working">
              <span className="spinner" /> contacting the agent…
            </div>
          ) : null}
        </div>

        {needsConnect ? (
          <div className="paycard" style={{ margin: "0 12px 12px" }}>
            <p style={{ marginTop: 0 }}>
              This tutorial makes <b>real</b> x402 / MPP requests to a live sandbox agent. Connect your
              Nevermined account to get a sandbox API key — you&apos;ll be sent to the Nevermined App to log
              in and returned here automatically.
            </p>
            <button className="cta" onClick={connect} disabled={busy || connecting}>
              {connecting ? "Redirecting to Nevermined…" : "Connect with Nevermined"}
              {connecting ? <span className="spinner" /> : <ArrowRight size={16} />}
            </button>
          </div>
        ) : (
          <>
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
                {busy ? <span className="spinner" /> : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
      <p className="runnote">
        {live ? (
          apiKey ? (
            <>Live agent — real x402/MPP payments on Nevermined sandbox, paid with your connected key. </>
          ) : (
            <>Live agent — connect once to pay real x402/MPP requests on Nevermined sandbox. </>
          )
        ) : authorized ? (
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
