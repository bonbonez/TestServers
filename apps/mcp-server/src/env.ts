import { loadConfig, z } from "@test-servers/config";

// Topology only — the creds (bearer token, audience, required scope) live in the shared
// store and are read live per request (see auth.ts).
const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  MCP_PORT: z.coerce.number().default(7100),
  MCP_OAUTH_JWKS_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:7200/.well-known/jwks.json"),
  TLS_CERT: z.string().optional(),
  TLS_KEY: z.string().optional(),
});

export type McpEnv = z.infer<typeof schema>;

export const env: McpEnv = loadConfig(schema);
