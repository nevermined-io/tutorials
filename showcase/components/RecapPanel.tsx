"use client";

import { useState } from "react";
import type { RecapRun } from "@/lib/types";
import { External, Play, Spark } from "./icons";

export default function RecapPanel({ run }: { run: RecapRun }) {
  const takes = run.takes ?? [];
  const [tab, setTab] = useState(0); // 0 = the run, 1..n = takes

  const theRun = (
    <>
      {run.video ? (
        <div className="videowrap">
          <video controls preload="metadata" playsInline>
            <source src={run.video.src} type="video/mp4" />
            {run.video.subtitles ? (
              <track kind="subtitles" src={run.video.subtitles} srcLang="en" label="English" default />
            ) : null}
            Your browser can&apos;t play this video — see {run.video.caption}.
          </video>
          <div className="vidcap">
            {run.video.caption} · {run.video.duration}
          </div>
        </div>
      ) : null}

      {run.outputs ? (
        <div className="outputs">
          {run.outputs.cover ? (
            run.outputs.cover.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cover" src={run.outputs.cover.src} alt={run.outputs.cover.label} />
            ) : (
              <div className="cover ph">
                <span>{run.outputs.cover.label}</span>
              </div>
            )
          ) : null}
          {run.outputs.audio ? (
            <div className="audio">
              <div className="fname">{run.outputs.audio.label}</div>
              {run.outputs.audio.src ? (
                <audio controls preload="none" src={run.outputs.audio.src} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {run.receipt ? (
        <table className="dt" style={{ marginTop: "22px" }}>
          <thead>
            <tr>
              {run.receipt.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {run.receipt.rows.map((row, i) => (
              <tr key={i} className={run.receipt!.totalRow === i ? "total" : ""}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {run.warn ? <div className="warn">{run.warn}</div> : null}

      {run.interactive?.length ? (
        <div className="explore">
          {run.interactive.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label} <External size={14} />
            </a>
          ))}
        </div>
      ) : null}
    </>
  );

  if (takes.length === 0) return theRun;

  const active = takes[tab - 1];
  return (
    <div>
      <div className="recap-tabs" role="tablist">
        <button className={`recap-tab${tab === 0 ? " on" : ""}`} onClick={() => setTab(0)} role="tab">
          <Play size={13} /> The run
        </button>
        {takes.map((t, i) => (
          <button
            key={t.label}
            className={`recap-tab${tab === i + 1 ? " on" : ""}`}
            onClick={() => setTab(i + 1)}
            role="tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        theRun
      ) : (
        <div className="take-poster">
          <span className="flag">
            <Spark size={12} /> Alternative take
          </span>
          <h3>The same run, a different design.</h3>
          {active.byline ? <p>{active.byline}</p> : null}
          <a className="btn btn-lime" href={active.embedHref} target="_blank" rel="noreferrer">
            Open {active.label} <External size={16} />
          </a>
          <p className="take-note">
            An interactive one-page recap of this exact run, published on claude.ai.
          </p>
        </div>
      )}
    </div>
  );
}
