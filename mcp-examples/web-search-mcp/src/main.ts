/**
 * Web Search MCP Server with Nevermined Payments Integration (demo/sandbox).
 *
 * Two PAID tools gated by Nevermined x402:
 *   - web_search(query)     -> Exa-style web search        (mock results)
 *   - company_lookup(name)  -> Baselayer-style company data (mock results)
 *
 * Results are mock (no external API, no keys); the payment/gating is real
 * Nevermined x402. Exists to demo a LangChain Fleet agent buying tools mid-task
 * against a card delegation. See FLEET-SMOKE-TEST.md.
 */

import "dotenv/config";
import { z } from "zod";
import { webSearch, companyLookup } from "./services/search.service.js";
import { Payments } from "@nevermined-io/payments";

// The environment is derived from the NVM API key prefix (e.g. "sandbox:").
const payments = Payments.getInstance({
  nvmApiKey: process.env.NVM_API_KEY!,
});

const PORT = parseInt(process.env.PORT || "3010", 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

/*****************************************************************************
 * REGISTER PAID TOOLS
 *****************************************************************************/

const webSearchSchema = z.object({
  query: z.string().min(2).max(300).describe("The web search query"),
}) as any;

payments.mcp.registerTool(
  "web_search",
  {
    title: "Web search",
    description:
      "Search the web for recent, relevant results (Exa-style). Paid per call.",
    inputSchema: webSearchSchema,
  },
  handleWebSearch,
  { credits: 1n }
);

const companyLookupSchema = z.object({
  name: z.string().min(2).max(160).describe("Company name to look up"),
}) as any;

payments.mcp.registerTool(
  "company_lookup",
  {
    title: "Verified company data",
    description:
      "Look up verified company data — registration, officers, and standing (Baselayer-style). Paid per call.",
    inputSchema: companyLookupSchema,
  },
  handleCompanyLookup,
  { credits: 2n }
);

/*****************************************************************************
 * TOOL HANDLERS
 *****************************************************************************/

async function handleWebSearch(args: any, _extra?: any) {
  const { query } = args as { query: string };
  if (!query) throw { code: -32003, message: "query is required" };

  const results = webSearch(query);
  const text =
    `Top results for "${query}":\n\n` +
    results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
      .join("\n\n");

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { query, results },
  };
}

async function handleCompanyLookup(args: any, _extra?: any) {
  const { name } = args as { name: string };
  if (!name) throw { code: -32003, message: "name is required" };

  const company = companyLookup(name);
  const text =
    `Verified data for ${company.legalName}:\n` +
    `- Registration: ${company.registrationNumber} (${company.jurisdiction})\n` +
    `- Status: ${company.status}\n` +
    `- Incorporated: ${company.incorporationDate}\n` +
    `- Officers: ${company.officers.join(", ")}`;

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: company,
  };
}

/*****************************************************************************
 * START SERVER
 *****************************************************************************/

async function main() {
  const { info, stop } = await payments.mcp.start({
    port: PORT,
    planId: process.env.NVM_PLAN_ID!,
    baseUrl: BASE_URL,
    serverName: "web-search-mcp",
    version: "0.1.0",
    description:
      "Web search + company lookup MCP server with Nevermined Payments integration (demo)",
  });

  console.log(`
🚀 Web Search MCP Server (Nevermined Payments) started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 MCP Endpoint:  ${info.baseUrl}/mcp
🏥 Health Check:  ${info.baseUrl}/health
ℹ️  Server Info:   ${info.baseUrl}/
🛠️  Tools: web_search, company_lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    await stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
