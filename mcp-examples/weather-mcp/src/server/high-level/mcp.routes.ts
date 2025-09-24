/**
 * MCP HTTP routes (High-Level Server)
 */
import { Request, Response } from "express";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { SessionManager } from "./session-manager.js";

// Methods from MCP protocol whose responses can leak server capabilities.
// We gate them requiring Authorization header presence before delegating.
//const GATED_METHODS = new Set(["tools/list", "resources/list", "prompts/list"]);
const GATED_METHODS = new Set([""]);

/**
 * Creates the POST handler for MCP requests
 * Authentication is handled by middleware, so this focuses on session management
 */
function createPostHandler(
  sessionManager: SessionManager,
  createServerInstance: () => any
) {
  return async (req: Request, res: Response) => {
    try {
      const sessionId = req.header("mcp-session-id") ?? undefined;
      let transport;

      // Log request body for debugging
      try {
        const sample =
          typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        console.log("[mcp POST] body snippet:", sample?.slice(0, 200));
      } catch {}

      // Handle session management
      if (sessionId && sessionManager.hasSession(sessionId)) {
        transport = sessionManager.getTransport(sessionId);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = sessionManager.createTransport();
        const server = createServerInstance();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      await transport!.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("Error handling MCP POST:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };
}

function createGetHandler(sessionManager: SessionManager) {
  return async (req: Request, res: Response) => {
    try {
      const sessionId = req.header("mcp-session-id") ?? undefined;
      if (!sessionId || !sessionManager.hasSession(sessionId)) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }
      const transport = sessionManager.getTransport(sessionId)!;
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("Error handling MCP GET:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };
}

function createDeleteHandler(sessionManager: SessionManager) {
  return async (req: Request, res: Response) => {
    try {
      const sessionId = req.header("mcp-session-id") ?? undefined;
      if (!sessionId || !sessionManager.hasSession(sessionId)) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }
      const transport = sessionManager.getTransport(sessionId)!;
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("Error handling MCP DELETE:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };
}

/**
 * Checks if a request method requires authentication
 * @param method - The MCP method name
 * @returns True if the method is in GATED_METHODS
 */
function requiresAuthentication(method: string): boolean {
  return GATED_METHODS.has(method);
}

/**
 * Handles authentication for gated MCP methods
 * @param req - Express request object
 * @param res - Express response object
 * @param method - The MCP method name
 * @param authenticateMeta - Optional authentication function
 * @returns Promise that resolves if authenticated, rejects if not
 */
async function handleAuthentication(
  req: Request,
  res: Response,
  method: string,
  authenticateMeta?: (extra: any, method: string) => Promise<any>
): Promise<void> {
  if (!authenticateMeta) {
    return;
  }

  const extra = { requestInfo: { headers: req.headers as any } };

  try {
    await authenticateMeta(extra, method);
  } catch (err: any) {
    res.status(200).json({
      jsonrpc: "2.0",
      error: {
        code: err?.code ?? -32003,
        message: err?.message || "Payment required",
      },
      id: req.body?.id ?? null,
    });
    throw err;
  }
}

/**
 * Middleware for MCP authentication
 * Only authenticates if the method is in GATED_METHODS
 */
function createAuthenticationMiddleware(
  authenticateMeta?: (extra: any, method: string) => Promise<any>
) {
  return async (req: Request, res: Response, next: any) => {
    try {
      const method = req.body?.method;

      if (typeof method === "string" && requiresAuthentication(method)) {
        await handleAuthentication(req, res, method, authenticateMeta);
      }

      next();
    } catch {
      // If authentication failed, response was already sent
      return;
    }
  };
}

export function setupHighLevelMcpRoutes(
  app: any,
  sessionManager: SessionManager,
  createServerInstance: () => any,
  authenticateMeta?: (extra: any, method: string) => Promise<any>
) {
  app.post(
    "/mcp",
    createAuthenticationMiddleware(authenticateMeta),
    createPostHandler(sessionManager, createServerInstance)
  );
  app.get("/mcp", createGetHandler(sessionManager));
  app.delete("/mcp", createDeleteHandler(sessionManager));
}
