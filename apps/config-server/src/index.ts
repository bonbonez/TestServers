import { createServer } from "node:http";
import { logBootConfig } from "@test-servers/config";
import { openStore } from "@test-servers/store";
import { env } from "./env.js";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

const store = openStore();
const app = createApp(store);

logBootConfig(logger, env);

const server = createServer(app);

server.listen(env.CONFIG_PORT, env.HOST, () => {
  logger.info("listening", {
    url: `http://${env.HOST}:${env.CONFIG_PORT}`,
    api: "/api/config",
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
