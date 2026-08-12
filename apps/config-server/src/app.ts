import express, { type Express } from "express";
import { z } from "@test-servers/config";
import { httpLogger } from "@test-servers/logger";
import type { Store } from "@test-servers/store";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * REST API over the shared credential store, backing the admin console. Reads and writes
 * the single source of truth that mcp-server / oauth-server consume live.
 */

const GRANTS = ["authorization_code", "client_credentials", "refresh_token"] as const;

const settingsSchema = z.object({
  mcpBearerToken: z.string(),
  accessTokenAudience: z.string(),
  accessTokenTtlSeconds: z.number().int().positive(),
  refreshTokenTtlSeconds: z.number().int().positive(),
  authCodeTtlSeconds: z.number().int().positive(),
  requiredScope: z.string(),
  apiStaticBearer: z.string(),
  apiBasicUser: z.string(),
  apiBasicPass: z.string(),
  allowedRedirectUris: z.array(z.string()),
  initialized: z.boolean(),
});

const clientSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  grants: z.array(z.enum(GRANTS)).min(1),
  notes: z.string().default(""),
});

function buildConnections() {
  const mcpBase = `http://${env.HOST}:${env.MCP_PORT}`;
  return {
    host: env.HOST,
    mcp: {
      none: `${mcpBase}/mcp/none`,
      bearer: `${mcpBase}/mcp/bearer`,
      oauth: `${mcpBase}/mcp/oauth`,
    },
    oauth: {
      issuer: env.OAUTH_ISSUER,
      authorize: `${env.OAUTH_ISSUER}/oauth/authorize`,
      token: `${env.OAUTH_ISSUER}/oauth/token`,
      jwks: `${env.OAUTH_ISSUER}/.well-known/jwks.json`,
      userinfo: `${env.OAUTH_ISSUER}/userinfo`,
    },
    resource: {
      profile: `${env.OAUTH_ISSUER}/resource/profile`,
      items: `${env.OAUTH_ISSUER}/resource/items`,
    },
    loginWeb: env.OAUTH_LOGIN_WEB_URL,
  };
}

function buildEnvFile(store: Store): string {
  const s = store.getSettings();
  return [
    "# Generated from the credential store by the admin console. Dummy dev values only.",
    "HOST=127.0.0.1",
    "NODE_ENV=development",
    "",
    `MCP_PORT=${env.MCP_PORT}`,
    `MCP_BEARER_TOKEN=${s.mcpBearerToken}`,
    `MCP_OAUTH_JWKS_URL=${env.OAUTH_ISSUER}/.well-known/jwks.json`,
    `MCP_OAUTH_AUDIENCE=${s.accessTokenAudience}`,
    `MCP_OAUTH_REQUIRED_SCOPE=${s.requiredScope}`,
    "",
    `OAUTH_PORT=${env.OAUTH_PORT}`,
    `OAUTH_ISSUER=${env.OAUTH_ISSUER}`,
    `ACCESS_TOKEN_TTL_SECONDS=${s.accessTokenTtlSeconds}`,
    `REFRESH_TOKEN_TTL_SECONDS=${s.refreshTokenTtlSeconds}`,
    `AUTH_CODE_TTL_SECONDS=${s.authCodeTtlSeconds}`,
    `ACCESS_TOKEN_AUDIENCE=${s.accessTokenAudience}`,
    `OAUTH_LOGIN_WEB_URL=${env.OAUTH_LOGIN_WEB_URL}`,
    `OAUTH_ALLOWED_REDIRECT_URIS=${s.allowedRedirectUris.join(",")}`,
    `API_STATIC_BEARER=${s.apiStaticBearer}`,
    `API_BASIC_USER=${s.apiBasicUser}`,
    `API_BASIC_PASS=${s.apiBasicPass}`,
    "",
  ].join("\n");
}

export function createApp(store: Store): Express {
  const app = express();
  app.use(express.json());
  app.use(httpLogger(logger));

  // TEST-ONLY: permissive CORS so the localhost admin console can call this API.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.header("origin") ?? "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      ...store.getCredentialSet(),
      connections: buildConnections(),
    });
  });

  app.get("/api/env-file", (_req, res) => {
    res.type("text/plain").send(buildEnvFile(store));
  });

  app.put("/api/settings", (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_settings", issues: parsed.error.issues });
      return;
    }
    res.json(store.updateSettings(parsed.data));
  });

  app.get("/api/clients", (_req, res) => {
    res.json(store.listClients());
  });

  app.post("/api/clients", (req, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_client", issues: parsed.error.issues });
      return;
    }
    if (store.getClient(parsed.data.clientId)) {
      res.status(409).json({ error: "client_exists" });
      return;
    }
    res.status(201).json(store.upsertClient(parsed.data));
  });

  app.put("/api/clients/:id", (req, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_client", issues: parsed.error.issues });
      return;
    }
    // Support renaming: drop the old record if the client_id changed.
    if (req.params.id !== parsed.data.clientId) {
      store.deleteClient(req.params.id);
    }
    res.json(store.upsertClient(parsed.data));
  });

  app.delete("/api/clients/:id", (req, res) => {
    store.deleteClient(req.params.id);
    res.status(204).end();
  });

  return app;
}
