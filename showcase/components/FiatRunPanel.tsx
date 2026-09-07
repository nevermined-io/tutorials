"use client";

import { useEffect, useRef, useState } from "react";
import type { FiatRun, FiatPackage } from "@/lib/types";

// The REAL Orders flow, embedded in the gallery: pick a trip → POST /api/orders
// (our server route holds the org key and calls the Nevermined Orders API) →
// mount the hosted Stripe checkout in an iframe → the iframe postMessages
// nvm:success and we show "booked". No account, no wallet — a card in the iframe.
//
// This needs a running Orders backend + NVM_ORDER_API_KEY (local stack now; the
// sandbox once Orders ships). If it's not reachable, the panel says so.

const fmtUsd = (amountMinor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountMinor / 100);

const ORDER_TIMEOUT_MS = 15_000;

type Item =
  | { type: "msg"; role: "user" | "agent"; text: string }
  | { type: "checkout"; orderId: string; pkg: FiatPackage }
  | { type: "confirm"; pkg: FiatPackage; paymentIntent: string }
  | { type: "notice"; text: string };

export default function FiatRunPanel({ run, embedBase }: { run: FiatRun; embedBase: string }) {
  const [items, setItems] = useState<Item[]>([{ type: "msg", role: "agent", text: run.greeting }]);
  const [picking, setPicking] = useState(true);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const confirmed = useRef<Set<string>>(new Set());
  const orderPkg = useRef<Map<string, FiatPackage>>(new Map());

  // Normalize once: e.origin is a browser-normalized origin (no trailing slash),
  // while embedBase is whatever an operator typed into NVM_EMBED_BASE_URL. Compare
  // and build the iframe src off the SAME derived origin so a trailing slash (or a
  // full URL with a path) can't silently break the origin check or the iframe URL.
  // Empty string (unconfigured in production) → "" → the panel refuses to proceed.
  const embedOrigin = (() => {
    try {
      return embedBase ? new URL(embedBase).origin : "";
    } catch {
      return "";
    }
  })();

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [items]);

  // Trust nvm:success only from the embed origin, only our event, only version 1.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!embedOrigin || e.origin !== embedOrigin) return;
      if (e.data?.type !== "nvm:success") return;
      if (e.data?.version !== "1") return;
      const { orderId, paymentIntent } = e.data.payload ?? {};
      if (!orderId || confirmed.current.has(orderId)) return;
      const pkg = orderPkg.current.get(orderId);
      if (!pkg) return;
      confirmed.current.add(orderId);
      // swap the (completed) checkout iframe for the confirmation
      setItems((x) => [
        ...x.filter((it) => !(it.type === "checkout" && it.orderId === orderId)),
        { type: "confirm", pkg, paymentIntent: paymentIntent ?? "" },
      ]);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedOrigin]);

  async function pick(pkg: FiatPackage) {
    if (busy) return;
    if (!embedOrigin) {
      setItems((x) => [
        ...x,
        { type: "notice", text: "Checkout isn't configured here (NVM_EMBED_BASE_URL is unset). Run it from the fiat-checkout-chat/ app — see the tutorial's README." },
      ]);
      return;
    }
    setBusy(true);
    setPicking(false);
    setItems((x) => [
      ...x,
      { type: "msg", role: "user", text: `I'd like to book the ${pkg.name}.` },
      { type: "msg", role: "agent", text: "Setting up your secure checkout…" },
    ]);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
        signal: AbortSignal.timeout(ORDER_TIMEOUT_MS),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.orderId !== "string") {
        throw new Error(data.error ?? `order failed (${res.status})`);
      }
      orderPkg.current.set(data.orderId, pkg);
      setItems((x) => [
        ...x.filter((it) => !(it.type === "msg" && it.text === "Setting up your secure checkout…")),
        {
          type: "msg",
          role: "agent",
          text: `Here's your secure checkout for the ${pkg.name} (${fmtUsd(pkg.amountMinor)}). Pay with the Stripe test card 4242 4242 4242 4242 — any future expiry / CVC / ZIP.`,
        },
        { type: "checkout", orderId: data.orderId, pkg },
      ]);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setItems((x) => [
        ...x.filter((it) => !(it.type === "msg" && it.text === "Setting up your secure checkout…")),
        {
          type: "notice",
          text: timedOut
            ? "The Orders backend didn't respond in time. Make sure the local Nevermined Orders stack is running — see the tutorial's README."
            : `Couldn't reach the Orders backend (${err instanceof Error ? err.message : "error"}). Start the local Nevermined Orders stack and set NVM_ORDER_API_KEY — see the tutorial's README.`,
        },
      ]);
      setPicking(true);
    } finally {
      setBusy(false);
    }
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
            if (it.type === "checkout") {
              const src =
                `${embedOrigin}/checkout/order/${it.orderId}` +
                `?parentOrigin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`;
              return (
                <div key={i} className="fiat-checkout">
                  <div className="fiat-cap">
                    🔒 Secure Stripe checkout · {it.pkg.name} · {fmtUsd(it.pkg.amountMinor)}
                  </div>
                  <iframe src={src} title="Nevermined hosted checkout" allow="payment" />
                </div>
              );
            }
            if (it.type === "confirm") {
              return (
                <div key={i} className="msg a" style={{ borderLeft: "3px solid var(--paid)" }}>
                  ✅ Payment confirmed — your <b>{it.pkg.name}</b> is booked! You&apos;ll get an itinerary by
                  email shortly.
                  {it.paymentIntent ? (
                    <span style={{ display: "block", marginTop: 4, fontFamily: "var(--mono)", fontSize: 11, opacity: 0.7 }}>
                      {it.paymentIntent}
                    </span>
                  ) : null}
                </div>
              );
            }
            return (
              <div key={i} className="notice">
                {it.text}
              </div>
            );
          })}
          {busy ? (
            <div className="working">
              <span className="spinner" /> creating your order…
            </div>
          ) : null}
        </div>

        {picking ? (
          <div className="rp-suggest" style={{ flexWrap: "wrap" }}>
            {run.packages.map((p) => (
              <button key={p.id} className="schip" onClick={() => pick(p)} disabled={busy}>
                {p.emoji} {p.name} · {fmtUsd(p.amountMinor)}
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
        Live Orders flow — selecting a trip sends a real <code>POST /api/v1/orders</code> to the backend (the
        org key stays server-side), then the hosted Stripe checkout runs in the iframe above. Pay with test
        card <code>4242 4242 4242 4242</code>; no real money moves. {run.note}
      </p>
    </>
  );
}
