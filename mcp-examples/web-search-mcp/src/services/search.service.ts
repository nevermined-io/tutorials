/**
 * Mock data for the web-search demo MCP.
 *
 * Demo/sandbox only: these functions return deterministic MOCK results with no
 * external API calls and no API keys. They exist so a LangChain Fleet agent can
 * be shown buying `web_search` / `company_lookup` mid-task against a Nevermined
 * card delegation. They are NOT the production Exa / Baselayer integrations.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface CompanyRecord {
  legalName: string;
  registrationNumber: string;
  jurisdiction: string;
  status: string;
  incorporationDate: string;
  officers: string[];
}

/** Deterministic mock web-search results (Exa-style). */
export function webSearch(query: string): SearchResult[] {
  const q = query.trim();
  return [
    {
      title: `${q} — overview and recent coverage`,
      url: "https://example.com/overview",
      snippet: `A concise overview of "${q}", summarizing recent developments and primary sources.`,
    },
    {
      title: `Analysis: what "${q}" means in 2026`,
      url: "https://example.org/analysis",
      snippet: `Independent analysis of "${q}" with context, key figures, and expert commentary.`,
    },
    {
      title: `${q} — reference documentation`,
      url: "https://docs.example.net/reference",
      snippet: `Reference material and primary documentation relevant to "${q}".`,
    },
  ];
}

/** Deterministic mock verified-company data (Baselayer-style). */
export function companyLookup(name: string): CompanyRecord {
  const clean = name.trim();
  return {
    legalName: `${clean} Inc.`,
    registrationNumber: "REG-" + stableHash(clean),
    jurisdiction: "Delaware, US",
    status: "Active / Good Standing",
    incorporationDate: "2021-03-14",
    officers: ["Jane Doe (CEO)", "John Smith (CFO)", "Alex Roe (Secretary)"],
  };
}

function stableHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h).padStart(8, "0").slice(0, 8);
}
