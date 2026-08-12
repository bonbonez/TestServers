import { loadConfig, z } from "@test-servers/config";

// Topology only — TTLs, audience, redirect allow-list, client registry and the API
// static/basic creds all live in the shared store and are read live per request.
const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  OAUTH_PORT: z.coerce.number().default(7200),
  OAUTH_ISSUER: z.string().url().default("https://localhost:7200"),
  OAUTH_LOGIN_WEB_URL: z.string().url().default("https://localhost:7201"),
  // Serve HTTPS (self-signed dev cert unless TLS_CERT/TLS_KEY are set). Set TLS=false for
  // plain HTTP (e.g. behind a TLS-terminating proxy).
  TLS: z.string().default("true").transform((value) => value !== "false"),
  TLS_CERT: z.string().optional(),
  TLS_KEY: z.string().optional(),
});

export type OAuthEnv = z.infer<typeof schema>;

export const env: OAuthEnv = loadConfig(schema);
