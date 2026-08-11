import { loadConfig, z } from "@test-servers/config";

const schema = z.object({
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().default("development"),
  OAUTH_PORT: z.coerce.number().default(7200),
  OAUTH_ISSUER: z.string().url().default("http://127.0.0.1:7200"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(120),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(86400),
  AUTH_CODE_TTL_SECONDS: z.coerce.number().default(300),
  ACCESS_TOKEN_AUDIENCE: z.string().default("mcp-test"),
  OAUTH_LOGIN_WEB_URL: z.string().url().default("http://127.0.0.1:7201"),
  OAUTH_ALLOWED_REDIRECT_URIS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((uri) => uri.trim())
        .filter(Boolean),
    ),
  API_STATIC_BEARER: z.string().default("dev-api-static-bearer-token"),
  API_BASIC_USER: z.string().default("api-basic-user"),
  API_BASIC_PASS: z.string().default("dev-api-basic-pass"),
  TLS_CERT: z.string().optional(),
  TLS_KEY: z.string().optional(),
});

export type OAuthEnv = z.infer<typeof schema>;

export const env: OAuthEnv = loadConfig(schema);
