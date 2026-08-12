import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { logBootConfig, resolveTlsOptions } from "@test-servers/config";
import { createSigner } from "@test-servers/tokens";
import { openStore } from "@test-servers/store";
import { env } from "./env.js";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

const signer = createSigner();
const store = openStore();
const app = createApp(signer, store);

logBootConfig(logger, { ...env, signingKeyId: signer.kid });

const tls = await resolveTlsOptions(env);
const server = tls ? createHttpsServer(tls, app) : createHttpServer(app);
const scheme = tls ? "https" : "http";

server.listen(env.OAUTH_PORT, env.HOST, () => {
  logger.info("listening", { url: `${scheme}://${env.HOST}:${env.OAUTH_PORT}` });
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
