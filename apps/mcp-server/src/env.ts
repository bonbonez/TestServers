import { loadConfig, z } from "@test-servers/config";

// URL defaults follow the TLS switch, so `TLS=false` yields http:// defaults everywhere.
const scheme = process.env.TLS === "false" ? "http" : "https";

// Topology only — the creds (bearer token, audience, required scope) live in the shared
// store and are read live per request (see auth.ts).
const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  MCP_PORT: z.coerce.number().default(7100),
  MCP_OAUTH_JWKS_URL: z
    .string()
    .url()
    .default(`${scheme}://localhost:7200/.well-known/jwks.json`),
  // Serve HTTPS (self-signed dev cert unless TLS_CERT/TLS_KEY are set). Set TLS=false for
  // plain HTTP (e.g. behind a TLS-terminating proxy).
  TLS: z.string().default("true").transform((value) => value !== "false"),
  TLS_CERT: z.string().optional(),
  TLS_KEY: z.string().optional(),
});

export type McpEnv = z.infer<typeof schema>;

export const env: McpEnv = loadConfig(schema);
