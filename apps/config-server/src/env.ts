import { loadConfig, z } from "@test-servers/config";

// URL defaults follow the TLS switch, so `TLS=false` yields http:// defaults everywhere.
const scheme = process.env.TLS === "false" ? "http" : "https";

// The admin console needs to render ready-to-copy connection URLs, so config-server knows
// the other apps' ports/issuer (topology only — no creds live here).
const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  CONFIG_PORT: z.coerce.number().default(7300),
  MCP_PORT: z.coerce.number().default(7100),
  OAUTH_PORT: z.coerce.number().default(7200),
  OAUTH_ISSUER: z.string().url().default(`${scheme}://localhost:7200`),
  OAUTH_LOGIN_WEB_URL: z.string().url().default(`${scheme}://localhost:7201`),
  // Serve HTTPS (self-signed dev cert unless TLS_CERT/TLS_KEY are set). Set TLS=false for
  // plain HTTP (e.g. behind a TLS-terminating proxy).
  TLS: z.string().default("true").transform((value) => value !== "false"),
  TLS_CERT: z.string().optional(),
  TLS_KEY: z.string().optional(),
});

export type ConfigEnv = z.infer<typeof schema>;

export const env: ConfigEnv = loadConfig(schema);
