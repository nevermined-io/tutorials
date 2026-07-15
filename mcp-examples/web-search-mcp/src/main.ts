/**
 * Web Search MCP — fully-mock, buyer-side cookbook demo.
 *
 * A plain MCP server (raw @modelcontextprotocol/sdk) exposing two mock tools over
 * streamable-HTTP at POST /mcp. NO auth, NO payments, NO credentials — it boots
 * with zero env and lets a LangChain Fleet agent be shown BUYING from external
 * sellers (Exa / Baselayer) mid-task. The sellers verify + settle; this server
 * only stands in for their responses so the buying flow can be captured.
 *
 * See "Making it real (production)" in README.md for the actual buyer flow
 * (mint an x402 card-delegation token -> Exa purchase-key endpoint).
 */

import "dotenv/config";
import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { webSearch, companyLookup } from "./services/search.service.js";

const PORT = parseInt(process.env.PORT || "3010", 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

/**
 * Chat-visible footers. These represent the agent PAYING THE EXTERNAL SELLER
 * (Exa / Baselayer) via a Nevermined card delegation — the seller is the payee,
 * the delegation is the rail. Representative wording (this is a mock; nothing is
 * actually charged here).
 */
const WEB_SEARCH_FOOTER =
  "\n\n———\n✓ Exa API access purchased · $7 charged to your card via Nevermined delegation";
const COMPANY_LOOKUP_FOOTER =
  "\n\n———\n✓ Baselayer verified-data access · paid via Nevermined card delegation";

/** Build a fresh MCP server with the two mock tools (one per request; stateless). */
function buildServer(): McpServer {
  const server = new McpServer(
    { name: "web-search-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "web_search",
    {
      title: "Web search",
      description: "Search the web for recent, relevant results (Exa-style).",
      inputSchema: {
        query: z.string().min(2).max(300).describe("The web search query"),
      },
    },
    async ({ query }) => {
      const results = webSearch(query);
      const text =
        `Top results for "${query}":\n\n` +
        results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
          .join("\n\n") +
        WEB_SEARCH_FOOTER;
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.registerTool(
    "company_lookup",
    {
      title: "Verified company data",
      description:
        "Look up verified company data — registration, officers, and standing (Baselayer-style).",
      inputSchema: {
        name: z.string().min(2).max(160).describe("Company name to look up"),
      },
    },
    async ({ name }) => {
      const company = companyLookup(name);
      const text =
        `Verified data for ${company.legalName}:\n` +
        `- Registration: ${company.registrationNumber} (${company.jurisdiction})\n` +
        `- Status: ${company.status}\n` +
        `- Incorporated: ${company.incorporationDate}\n` +
        `- Officers: ${company.officers.join(", ")}` +
        COMPANY_LOOKUP_FOOTER;
      return { content: [{ type: "text" as const, text }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "web-search-mcp",
    tools: ["web_search", "company_lookup"],
  });
});

// Streamable-HTTP MCP endpoint. Stateless: a fresh server + transport per
// request, and NO auth gate — Fleet connects with no bearer token.
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless server: no SSE stream / session to GET or DELETE.
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed (stateless server)" });
});
app.delete("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed (stateless server)" });
});

app.listen(PORT, () => {
  console.log(`
🔎 Web Search MCP — fully-mock buyer-side demo (no auth, no creds)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 MCP Endpoint:  ${BASE_URL}/mcp   (POST, streamable-HTTP)
🏥 Health Check:  ${BASE_URL}/health
🛠️  Tools: web_search, company_lookup   (mock results)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
