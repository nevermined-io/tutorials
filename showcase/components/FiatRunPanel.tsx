"use client";

import { useEffect, useRef, useState } from "react";
import type { FiatRun, FiatPackage } from "@/lib/types";
import { ArrowRight } from "./icons";

// Self-contained, scripted card-checkout chat — the deployed gallery can't reach a
// running Orders API, so nothing here charges a card. The real hosted Stripe iframe
// lives in the tutorial's own app (see run.note / repoPath). This mirrors the shape
// of the live tutorials' panel (components/LiveRunPanel) using the same CSS.

type Item =
  | { type: "msg"; role: "user" | "agent"; text: string }
  | { type: "pay"; pkg: FiatPackage; resolved?: boolean }
  | { type: "settle"; text: string }
  | { type: "confirm"; pkg: FiatPackage };

export default function FiatRunPanel({ run }: { run: FiatRun }) {
  const [items, setItems] = useState<Item[]>([{ type: "msg", role: "agent", text: run.greeting }]);
  const [picking, setPicking] = useState(true);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [items]);

  function pick(pkg: FiatPackage) {
    if (busy) return;
    setPicking(false);
    setItems((x) => [
      ...x,
      { type: "msg", role: "user", text: `I'd like to book the ${pkg.name}.` },
      {
        type: "msg",
        role: "agent",
        text: `Great choice! Here's your secure checkout for the ${pkg.name} (${pkg.amount}). Pay by card — no account needed.`,
      },
      { type: "pay", pkg },
    ]);
  }

  function pay(pkg: FiatPackage, idx: number) {
    if (busy) return;
    setBusy(true);
    setItems((x) => x.map((it, i) => (i === idx ? ({ ...it, resolved: true } as Item) : it)));
    // brief pause so the "processing" state reads as a real card round-trip
    setTimeout(() => {
      setItems((x) => [
        ...x,
        { type: "settle", text: `paid · card ····4242 · ${pkg.amount}` },
        { type: "confirm", pkg },
      ]);
      setBusy(false);
    }, 900);
  }

  function reset() {
    setItems([{ type: "msg", role: "agent", text: run.greeting }]);
    setPicking(true);
  }

  return (
    <>
      <div className="runpanel">
        <div className="rp-bar">
          <span className="live-dot" aria-hidden="true" />
          <span className="title">{run.merchant} · card checkout</span>
          <span className="bal">no account needed</span>
        </div>

        <div className="chatlog" ref={logRef}>
          {items.map((it, i) => {
            if (it.type === "msg") {
              return (
                <div key={i} className={`msg ${it.role === "user" ? "u" : "a"}`} style={{ whiteSpace: "pre-wrap" }}>
                  {it.text}
                </div>
              );
            }
            if (it.type === "pay") {
              return (
                <div className="payline" key={i}>
                  <span className="stamp">CARD</span>
                  <span className="txt">
                    {it.pkg.amount} · {it.pkg.name}
                  </span>
                  <button className="cta sm" onClick={() => pay(it.pkg, i)} disabled={busy || it.resolved}>
                    {it.resolved ? "Paid" : "Pay by card"}
                    {!it.resolved ? busy ? <span className="spinner" /> : <ArrowRight size={14} /> : null}
                  </button>
                </div>
              );
            }
            if (it.type === "settle") {
              return (
                <div className="settle" key={i}>
                  <span className="stamp">PAID</span>
                  <span className="txt">{it.text}</span>
                </div>
              );
            }
            return (
              <div className="msg a" key={i} style={{ borderLeft: "3px solid var(--paid)" }}>
                ✅ Payment confirmed — your <b>{it.pkg.name}</b> is booked! You&apos;ll get an itinerary by
                email shortly.
              </div>
            );
          })}
          {busy ? (
            <div className="working">
              <span className="spinner" /> charging the card…
            </div>
          ) : null}
        </div>

        {picking ? (
          <div className="rp-suggest" style={{ flexWrap: "wrap" }}>
            {run.packages.map((p) => (
              <button key={p.id} className="schip" onClick={() => pick(p)} disabled={busy}>
                {p.emoji} {p.name} · {p.amount}
              </button>
            ))}
          </div>
        ) : (
          <div className="rp-suggest">
            <button className="schip" onClick={reset} disabled={busy}>
              ↺ Book another trip
            </button>
          </div>
        )}
      </div>
      <p className="runnote">
        Scripted checkout — no real card is charged here. The real hosted Stripe iframe (test card{" "}
        <code>4242 4242 4242 4242</code>) runs in the tutorial&apos;s own app. {run.note}
      </p>
    </>
  );
}
