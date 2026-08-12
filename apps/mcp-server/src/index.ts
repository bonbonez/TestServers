import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { logBootConfig, resolveTlsOptions } from "@test-servers/config";
import { openStore } from "@test-servers/store";
import { env } from "./env.js";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

const store = openStore();
const app = createApp(store);

logBootConfig(logger, env);

// The OAuth JWKS is fetched over HTTPS; in dev that cert is self-signed, so allow it.
if (env.NODE_ENV !== "production" && env.MCP_OAUTH_JWKS_URL.startsWith("https:")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  logger.warn("outbound TLS verification disabled (dev self-signed certs)");
}

const tls = await resolveTlsOptions(env);
const server = tls ? createHttpsServer(tls, app) : createHttpServer(app);
const scheme = tls ? "https" : "http";

server.listen(env.MCP_PORT, env.HOST, () => {
  logger.info("listening", {
    url: `${scheme}://${env.HOST}:${env.MCP_PORT}`,
    routes: "POST /mcp/none, /mcp/bearer, /mcp/oauth",
  });
});

const shutdown = (signal: string) => {
  logger.info("shutting down", { signal });
  server.closeAllConnections();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
