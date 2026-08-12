import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { logBootConfig } from "@test-servers/config";
import { openStore } from "@test-servers/store";
import { env } from "./env.js";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

const store = openStore();
const app = createApp(store);

logBootConfig(logger, env);

const server =
  env.TLS_CERT && env.TLS_KEY
    ? createHttpsServer(
        { cert: readFileSync(env.TLS_CERT), key: readFileSync(env.TLS_KEY) },
        app,
      )
    : createHttpServer(app);

server.listen(env.MCP_PORT, env.HOST, () => {
  const scheme = env.TLS_CERT && env.TLS_KEY ? "https" : "http";
  logger.info("listening", {
    url: `${scheme}://${env.HOST}:${env.MCP_PORT}`,
    routes: "POST /mcp/none, /mcp/bearer, /mcp/oauth",
  });
});
