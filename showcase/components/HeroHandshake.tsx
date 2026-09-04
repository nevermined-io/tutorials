"use client";

import { useEffect, useState } from "react";

// The product thesis, demonstrated: an agent hits a paywall and settles it in-band.
// Plays on load and loops (a projector-friendly demo), collapses to a static frame
// under prefers-reduced-motion.
const LINES = [
  { tag: "POST", cls: "req", head: "POST /research", tail: '  "EV market in Europe"' },
  { tag: "402", cls: "r402", head: "Payment Required", tail: "  · plan: card-delegation" },
  { tag: "PAY", cls: "pay", head: "payment token", tail: "  · visa *4242" },
  { tag: "200", cls: "r200", head: "OK", tail: "  · payment-response: settled" },
];

export default function HeroHandshake() {
  // Rests as the COMPLETE handshake (good first frame / thumbnail), then loops.
  const [step, setStep] = useState(LINES.length);
  const [settled, setSettled] = useState(true);
  const [balance, setBalance] = useState(95);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // stay on the full resting frame

    const timers: ReturnType<typeof setTimeout>[] = [];
    function cycle() {
      setStep(0);
      setSettled(false);
      setBalance(100);
      LINES.forEach((_, i) => {
        timers.push(setTimeout(() => setStep(i + 1), 650 * (i + 1)));
      });
      const afterLines = 650 * (LINES.length + 1);
      timers.push(
        setTimeout(() => {
          setSettled(true);
          setBalance(95);
          setFlash(true);
          timers.push(setTimeout(() => setFlash(false), 600));
        }, afterLines),
      );
      timers.push(setTimeout(cycle, afterLines + 3200)); // loop
    }
    timers.push(setTimeout(cycle, 2600)); // hold the full frame first, then animate
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="handshake" aria-label="An agent paying for a service in-band">
      <div className="hs-bar">
        <span className="who">
          <b>agent</b> → research service
        </span>
        <span className={`bal${flash ? " flash" : ""}`}>
          balance <b>{balance}</b>
        </span>
      </div>
      <div className="hs-body">
        {LINES.map((l, i) => (
          <div key={i} className={`hs-line${i < step ? " in" : ""}`}>
            <span className={`tag ${l.cls}`}>{l.tag}</span>
            <span className="txt">
              {l.head}
              <span className="dim">{l.tail}</span>
            </span>
          </div>
        ))}
        <div className={`hs-stamp${settled ? " in" : ""}`}>settled · 5 credits · one round-trip · zero clicks</div>
      </div>
    </div>
  );
}
