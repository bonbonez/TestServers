import { createServer } from "node:http";
import { logBootConfig } from "@test-servers/config";
import { openStore } from "@test-servers/store";
import { env } from "./env.js";
import { createApp } from "./app.js";

const store = openStore();
const app = createApp(store);

logBootConfig("config-server", env);

createServer(app).listen(env.CONFIG_PORT, env.HOST, () => {
  console.log(`[config-server] listening on http://${env.HOST}:${env.CONFIG_PORT}`);
  console.log(`[config-server] admin API at /api/config`);
});
