import Link from "next/link";
import { groupedTutorials, tutorials } from "@/content/tutorials";
import { languageTags } from "@/lib/types";
import { repoUrl } from "@/lib/repo";
import HeroHandshake from "@/components/HeroHandshake";
import { ArrowRight, GitHub, Spark } from "@/components/icons";

export default function HomePage() {
  const groups = groupedTutorials();
  const flagship = tutorials.find((t) => t.featured);

  return (
    <div className="container">
      <section className="hero">
        <h1>
          Agents that <span className="hl">pay</span> their own way.
        </h1>
        <p className="intro">
          Working examples of AI agents that hit a paywall, <strong>settle it in-band</strong>, and
          keep going — no human in the loop. Nevermined is{" "}
          <strong>payment-protocol-independent</strong> — these demos span x402, MCP and MPP. Every
          tutorial is one page: what you&apos;ll learn, how it works, the code, and a panel where you{" "}
          <strong>run the real payment handshake</strong> yourself.
        </p>
        <HeroHandshake />
        <div className="cta-row">
          {flagship ? (
            <Link href={`/t/${flagship.slug}`} className="btn btn-lime">
              Start with the research agent <ArrowRight size={17} />
            </Link>
          ) : null}
          <a
            className="btn btn-ghost"
            href="https://github.com/nevermined-io/tutorials"
            target="_blank"
            rel="noreferrer"
          >
            <GitHub size={17} /> Browse the source
          </a>
        </div>
      </section>

      {flagship ? (
        <div className="feature">
          <span className="flag">
            <Spark size={12} /> Featured live demo
          </span>
          <h3>{flagship.title}</h3>
          <p>{flagship.tagline}</p>
          <div style={{ display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/t/${flagship.slug}`} className="go">
              Open tutorial <ArrowRight size={17} />
            </Link>
            <a
              className="go"
              style={{ color: "var(--muted)" }}
              href={repoUrl(flagship.repoPath)}
              target="_blank"
              rel="noreferrer"
            >
              <GitHub size={16} /> View on GitHub
            </a>
          </div>
        </div>
      ) : null}

      <div className="idx">
        {groups.map((g) => {
          const rows = g.items.filter((t) => !t.featured);
          if (rows.length === 0) return null;
          return (
            <section key={g.label}>
              <div className="idx-cat">
                <h2>{g.label}</h2>
                <span className="rule" />
                <span className="n">{rows.length}</span>
              </div>
              {rows.map((t) => (
                <div className="idx-row" key={t.slug}>
                  <div className="idx-main">
                    <Link href={`/t/${t.slug}`} className="idx-title">
                      {t.title}
                      <ArrowRight className="go" size={16} />
                    </Link>
                    <div className="idx-desc">{t.tagline}</div>
                  </div>
                  <div className="idx-meta">
                    {languageTags(t.language).map((tag) => (
                      <span key={tag} className="t-lang">
                        {tag}
                      </span>
                    ))}
                    <span className={`tier ${t.tier}`}>{t.tier}</span>
                    <a
                      className="idx-gh"
                      href={repoUrl(t.repoPath)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${t.title} on GitHub`}
                    >
                      <GitHub size={17} />
                    </a>
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
