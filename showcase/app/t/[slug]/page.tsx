import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tutorials, getTutorial } from "@/content/tutorials";
import { PROTOCOL_LABEL, languageTags } from "@/lib/types";
import { repoUrl, repoFileUrl } from "@/lib/repo";
import LiveRunPanel from "@/components/LiveRunPanel";
import RecapPanel from "@/components/RecapPanel";
import DiscoverPanel from "@/components/DiscoverPanel";
import CodeBlock from "@/components/CodeBlock";
import { ArrowRight, ArrowLeft, GitHub, External } from "@/components/icons";

export function generateStaticParams() {
  return tutorials.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTutorial(slug);
  if (!t) return { title: "Not found · Nevermined Tutorials" };
  return { title: `${t.title} · Nevermined Tutorials`, description: t.tagline };
}

export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTutorial(slug);
  if (!t) notFound();

  const isRecap = t.tier === "recap";
  // discover tutorials keep the demo (§4) and the video in a separate §5
  const discoverVideo = t.run.kind === "discover" ? t.run.video : undefined;

  return (
    <div className="container">
      <div className="tut-head">
        <div className="tut-top">
          <Link href="/" className="backlink">
            <ArrowLeft size={14} /> all tutorials
          </Link>
          <a className="btn btn-ghost" href={repoUrl(t.repoPath)} target="_blank" rel="noreferrer">
            <GitHub size={17} /> View on GitHub
          </a>
        </div>

        <div className="tut-taglist">
          <span className="t-proto">{PROTOCOL_LABEL[t.protocol]}</span>
          {languageTags(t.language).map((tag) => (
            <span key={tag} className="t-lang">
              {tag}
            </span>
          ))}
          <span className={`tier ${t.tier}`}>
            {t.tier === "recap"
              ? "recap · watch it run"
              : t.tier === "discover"
                ? "discover · free & live"
                : "live · you pay per call"}
          </span>
        </div>
        <h1>{t.title}</h1>
        <p className="sub">{t.tagline}</p>
        <span className="repo">{t.repoPath}</span>
      </div>

      <div className="content">
        {/* 1 — Learn */}
        <section className="block" id="learn">
          <div className="h2">
            <span className="num">1</span> {isRecap ? "What it shows" : "What you'll learn"}
          </div>
          <p className="lead">{t.learn.lead}</p>
          <ul className="learn">
            {t.learn.bullets.map((b, i) => (
              <li key={i}>
                <span className="b" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* 2 — How */}
        <section className="block" id="how">
          <div className="h2">
            <span className="num">2</span> How it works
          </div>
          {t.how.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {t.how.flow ? (
            <div className="flow">
              {t.how.flow.map((s, i) => (
                <FlowStepEl key={i} step={s} last={i === t.how.flow!.length - 1} />
              ))}
            </div>
          ) : null}
          {t.how.table ? (
            <table className="dt">
              <thead>
                <tr>
                  {t.how.table.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.how.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        {/* 3 — Tech */}
        <section className="block" id="tech">
          <div className="h2">
            <span className="num">3</span> Under the hood
          </div>
          <div className="chips" style={{ marginBottom: "18px" }}>
            {t.tech.stack.map((s) => (
              <span key={s} className="schip">
                {s}
              </span>
            ))}
          </div>
          {t.tech.groups?.length ? (
            t.tech.groups.map((g, gi) => (
              <div key={gi} className="subblock">
                <div className="h3">
                  <span className="num">3.{gi + 1}</span> {g.title}
                </div>
                {g.lead ? <p className="sublead">{g.lead}</p> : null}
                {g.samples.map((s, i) => (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <CodeBlock code={s.code} caption={s.caption} lang={s.lang} />
                  </div>
                ))}
              </div>
            ))
          ) : (
            t.tech.samples.map((s, i) => (
              <div key={i} style={{ marginBottom: "16px" }}>
                <CodeBlock code={s.code} caption={s.caption} lang={s.lang} />
              </div>
            ))
          )}
          {t.tech.files?.length ? (
            <table className="files">
              <tbody>
                {t.tech.files.map((f) => (
                  <tr key={f.path}>
                    <td>
                      <a
                        className="filelink"
                        href={repoFileUrl(t.repoPath, f.path)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {f.path}
                        <External size={12} />
                      </a>
                    </td>
                    <td>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        {/* 4 — Run */}
        <section className="block wide" id="run">
          <div className="h2">
            <span className="num">4</span> See it run
          </div>
          {t.run.kind === "live" ? (
            <LiveRunPanel slug={t.slug} run={t.run} title={t.title} />
          ) : t.run.kind === "discover" ? (
            <DiscoverPanel run={t.run} />
          ) : (
            <RecapPanel run={t.run} />
          )}
        </section>

        {/* 5 — Catalog video (discover tutorials only) */}
        {discoverVideo ? (
          <section className="block wide" id="video">
            <div className="h2">
              <span className="num">5</span> Catalog video
            </div>
            <div className="videowrap">
              <video controls preload="metadata" playsInline>
                <source src={discoverVideo.src} type="video/mp4" />
                {(discoverVideo.subtitles ?? []).map((s) => (
                  <track
                    key={s.srcLang}
                    kind="subtitles"
                    src={s.src}
                    srcLang={s.srcLang}
                    label={s.label}
                    default={s.default}
                  />
                ))}
                Your browser can&apos;t play this video — see {discoverVideo.caption}.
              </video>
              <div className="vidcap">
                {discoverVideo.caption} · {discoverVideo.duration}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function FlowStepEl({
  step,
  last,
}: {
  step: { label: string; sub?: string; emphasis?: boolean };
  last: boolean;
}) {
  return (
    <>
      <div className={`step${step.emphasis ? " pay" : ""}`}>
        <b>{step.label}</b>
        {step.sub ? <span>{step.sub}</span> : null}
      </div>
      {!last ? <ArrowRight className="arrow" size={16} /> : null}
    </>
  );
}
