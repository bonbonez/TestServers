import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { logBootConfig } from "@test-servers/config";
import { createSigner } from "@test-servers/tokens";
import { openStore } from "@test-servers/store";
import { env } from "./env.js";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

const signer = createSigner();
const store = openStore();
const app = createApp(signer, store);

logBootConfig(logger, { ...env, signingKeyId: signer.kid });

const server =
  env.TLS_CERT && env.TLS_KEY
    ? createHttpsServer(
        { cert: readFileSync(env.TLS_CERT), key: readFileSync(env.TLS_KEY) },
        app,
      )
    : createHttpServer(app);

server.listen(env.OAUTH_PORT, env.HOST, () => {
  const scheme = env.TLS_CERT && env.TLS_KEY ? "https" : "http";
  logger.info("listening", { url: `${scheme}://${env.HOST}:${env.OAUTH_PORT}` });
});
