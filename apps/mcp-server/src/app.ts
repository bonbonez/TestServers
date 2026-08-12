import express, { type Express, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { httpLogger } from "@test-servers/logger";
import type { Store } from "@test-servers/store";
import { buildMcpServer } from "./tools.js";
import { createBearerAuth, createOAuthAuth } from "./auth.js";
import { logger } from "./logger.js";

/**
 * One MCP server definition behind four auth routes. The transport is stateless — a fresh
 * server + transport is created per request (fine for a test double).
 */
export function createApp(store: Store): Express {
  const app = express();
  app.use(express.json());
  app.use(httpLogger(logger));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  const handleMcp = async (req: Request, res: Response) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };

  app.post("/mcp/none", handleMcp);
  app.post("/mcp/bearer", createBearerAuth(store), handleMcp);
  app.post("/mcp/oauth", createOAuthAuth(store), handleMcp);

  return app;
}
