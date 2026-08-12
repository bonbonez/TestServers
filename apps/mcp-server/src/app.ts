import express, { type Express, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { httpLogger } from "@test-servers/logger";
import type { Store } from "@test-servers/store";
import { buildMcpServer, type BuildMcpOptions } from "./tools.js";
import { createBearerAuth, createOAuthAuth } from "./auth.js";
import { logger } from "./logger.js";

/**
 * One MCP server definition behind four auth routes. The transport is stateless — a fresh
 * server + transport is created per request (fine for a test double). Each route decides,
 * from its auth mode, which tools to expose and what usage instructions to advertise.
 */
export function createApp(store: Store): Express {
  const app = express();
  app.use(express.json());
  app.use(httpLogger(logger));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  const handleMcp = async (req: Request, res: Response, options: BuildMcpOptions) => {
    const server = buildMcpServer(options);
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

  app.post("/mcp/none", (req, res) =>
    handleMcp(req, res, { authLabel: "no auth" }),
  );
  app.post("/mcp/bearer", createBearerAuth(store), (req, res) =>
    handleMcp(req, res, { authLabel: "bearer token" }),
  );
  app.post("/mcp/oauth", createOAuthAuth(store), (req, res) => {
    const isAuthCode = res.locals.grant === "authorization_code";
    handleMcp(req, res, {
      includeAuthCodeTools: isAuthCode,
      subject: res.locals.subject,
      authLabel: isAuthCode
        ? "OAuth authorization-code"
        : "OAuth client-credentials",
    });
  });

  return app;
}
