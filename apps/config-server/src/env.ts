import { loadConfig, z } from "@test-servers/config";

// The admin console needs to render ready-to-copy connection URLs, so config-server knows
// the other apps' ports/issuer (topology only — no creds live here).
const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  CONFIG_PORT: z.coerce.number().default(7300),
  MCP_PORT: z.coerce.number().default(7100),
  OAUTH_PORT: z.coerce.number().default(7200),
  OAUTH_ISSUER: z.string().url().default("http://127.0.0.1:7200"),
  OAUTH_LOGIN_WEB_URL: z.string().url().default("http://127.0.0.1:7201"),
});

export type ConfigEnv = z.infer<typeof schema>;

export const env: ConfigEnv = loadConfig(schema);
