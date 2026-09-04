import type { Metadata } from "next";
import "./globals.css";
import AppShell, { type NavGroup } from "@/components/AppShell";
import { groupedTutorials } from "@/content/tutorials";

export const metadata: Metadata = {
  title: "Nevermined Tutorials",
  description:
    "Working examples of AI agents that pay for services in-band as they work — Nevermined's agent payments, across protocols. Read how each one works, then run it live.",
};

const navGroups: NavGroup[] = groupedTutorials().map((g) => ({
  label: g.label,
  protocol: g.protocol,
  items: g.items.map((t) => ({
    slug: t.slug,
    title: t.title,
    language: t.language,
    tier: t.tier,
    featured: t.featured,
  })),
}));

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <AppShell groups={navGroups}>{children}</AppShell>
      </body>
    </html>
  );
}
