import { loadConfig, z } from "@test-servers/config";

const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  MCP_PORT: z.coerce.number().default(7100),
  MCP_BEARER_TOKEN: z.string().default("dev-mcp-bearer-token-abc123"),
  MCP_OAUTH_JWKS_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:7200/.well-known/jwks.json"),
  // Empty string disables the optional aud/scope checks.
  MCP_OAUTH_AUDIENCE: z.string().default("mcp-test"),
  MCP_OAUTH_REQUIRED_SCOPE: z.string().default("read"),
  TLS_CERT: z.string().optional(),
  TLS_KEY: z.string().optional(),
});

export type McpEnv = z.infer<typeof schema>;

export const env: McpEnv = loadConfig(schema);
