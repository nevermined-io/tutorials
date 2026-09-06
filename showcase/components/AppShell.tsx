"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Language, Tier, Protocol } from "@/lib/types";
import { languageTags } from "@/lib/types";
import {
  Menu,
  Chevron,
  GitHub,
  External,
  Spark,
  Bolt,
  Signal,
  Plug,
  Layers,
  Card,
  Book,
  Globe,
  Discord,
  Link as LinkIcon,
} from "./icons";
import Logo from "./Logo";

const LINKS = [
  { label: "Docs", href: "https://nevermined.ai/docs", icon: <Book size={16} /> },
  { label: "Nevermined App", href: "https://nevermined.app", icon: <Globe size={16} /> },
  { label: "Discord", href: "https://discord.com/invite/GZju2qScKq", icon: <Discord size={16} /> },
  { label: "GitHub", href: "https://github.com/nevermined-io/tutorials", icon: <GitHub size={16} /> },
];

export interface NavItem {
  slug: string;
  title: string;
  language: Language;
  tier: Tier;
  featured?: boolean;
}
export interface NavGroup {
  label: string;
  protocol: Protocol;
  items: NavItem[];
}

const GLYPH: Record<Protocol, React.ReactNode> = {
  catalog: <Layers size={13} />,
  x402: <Bolt size={13} />,
  mpp: <Signal size={13} />,
  mcp: <Plug size={13} />,
  langchain: <LinkIcon size={13} />,
  orders: <Card size={13} />,
};

export default function AppShell({
  groups,
  children,
}: {
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => setOpen(false), [pathname]);

  const toggle = (label: string) =>
    setCollapsed((c) => ({ ...c, [label]: !c[label] }));

  return (
    <div className="app">
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Tutorials">
        <Link href="/" className="sb-brand" aria-label="Nevermined — home">
          <Logo height={21} />
        </Link>

        <nav className="sb-nav">
          <Link href="/" className={`sb-banner${pathname === "/" ? " active" : ""}`}>
            <span className="bi" aria-hidden="true">
              <Book size={18} />
            </span>
            <span className="bt">
              <b>Tutorials</b>
              <span>agents payment protocol</span>
            </span>
          </Link>

          {groups.map((g) => {
            const isCollapsed = !!collapsed[g.label];
            return (
              <div className="sb-group" key={g.label}>
                <button
                  className="sb-cat"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggle(g.label)}
                >
                  <span className={`glyph ${g.protocol}`}>{GLYPH[g.protocol]}</span>
                  {g.label}
                  <span className="cat-count">{g.items.length}</span>
                  <Chevron className="chev" size={16} />
                </button>
                <div className="sb-items" hidden={isCollapsed}>
                  {g.items.map((it) => {
                    const active = pathname === `/t/${it.slug}`;
                    return (
                      <Link
                        key={it.slug}
                        href={`/t/${it.slug}`}
                        className={`sb-item${active ? " active" : ""}`}
                      >
                        <span className={`tdot ${it.tier}`} aria-hidden="true" />
                        <span className="label">{it.title}</span>
                        {it.featured ? <Spark className="spark" size={12} /> : null}
                        <span className="lang">{languageTags(it.language).join(" · ")}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sb-links">
          <div className="sb-label">Links</div>
          {LINKS.map((l) => (
            <a key={l.label} className="sb-link" href={l.href} target="_blank" rel="noreferrer">
              <span className="li">{l.icon}</span>
              <span className="label">{l.label}</span>
              <External className="ext" size={13} />
            </a>
          ))}
        </div>
      </aside>

      {open ? <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <div className="main">
        <div className="mobilebar">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Open tutorials menu">
            <Menu size={20} />
          </button>
          <Logo height={19} />
        </div>
        {children}
      </div>
    </div>
  );
}
