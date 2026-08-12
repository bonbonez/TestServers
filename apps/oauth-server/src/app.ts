import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { httpLogger } from "@test-servers/logger";
import type { Signer } from "@test-servers/tokens";
import type { Store, Grant } from "@test-servers/store";
import { env } from "./env.js";
import { logger } from "./logger.js";
import {
  issueAuthCode,
  consumeAuthCode,
  issueRefreshToken,
  consumeRefreshToken,
} from "./store.js";

/**
 * The dummy OAuth 2.0 authorization server + protected resource API. All creds (clients,
 * TTLs, audience, redirect allow-list, static API creds) come from the shared credential
 * store and are read live on each request, so admin-console edits apply without a restart.
 *
 * TEST-ONLY shortcuts (see README safety banner): CORS is wide open for localhost, there
 * is no consent persistence, and the login step accepts any username with no password.
 */

function sendOAuthError(
  res: Response,
  status: number,
  error: string,
  description: string,
): void {
  res.status(status).json({ error, error_description: description });
}

/** Pull client credentials from the form body or an HTTP Basic header. */
function readClientCredentials(req: Request): {
  clientId?: string;
  clientSecret?: string;
} {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator !== -1) {
      return {
        clientId: decoded.slice(0, separator),
        clientSecret: decoded.slice(separator + 1),
      };
    }
  }
  return {
    clientId: typeof req.body.client_id === "string" ? req.body.client_id : undefined,
    clientSecret:
      typeof req.body.client_secret === "string" ? req.body.client_secret : undefined,
  };
}

/** Build a redirect URL, appending query params without clobbering any already present. */
function buildRedirect(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function createApp(signer: Signer, store: Store): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // TEST-ONLY: permissive CORS so the localhost React login app can POST consent here.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.header("origin") ?? "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(httpLogger(logger));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/.well-known/jwks.json", async (_req, res) => {
    res.json(await signer.jwks());
  });

  // ---- Authorization endpoint: validate, then hand off to the DEV login UI. ----
  app.get("/oauth/authorize", (req, res) => {
    const { response_type, client_id, redirect_uri, state, scope } = req.query;
    const settings = store.getSettings();

    if (typeof redirect_uri !== "string" || !settings.allowedRedirectUris.includes(redirect_uri)) {
      // Never open-redirect: reject an unknown redirect_uri with a plain 400.
      sendOAuthError(res, 400, "invalid_request", "unknown redirect_uri");
      return;
    }

    if (typeof client_id !== "string") {
      sendOAuthError(res, 400, "invalid_request", "missing client_id");
      return;
    }
    const client = store.getClient(client_id);
    if (!client || !client.grants.includes("authorization_code")) {
      sendOAuthError(res, 400, "invalid_request", "unknown or ineligible client_id");
      return;
    }

    if (response_type !== "code") {
      res.redirect(
        buildRedirect(redirect_uri, {
          error: "unsupported_response_type",
          state: typeof state === "string" ? state : "",
        }),
      );
      return;
    }

    // Dev hand-off: forward the original query to the React login app.
    const forwarded = new URLSearchParams({
      client_id,
      redirect_uri,
      scope: typeof scope === "string" ? scope : "read",
      state: typeof state === "string" ? state : "",
    });
    res.redirect(`${env.OAUTH_LOGIN_WEB_URL}/?${forwarded.toString()}`);
  });

  // ---- Consent callback from the React login UI. ----
  app.post("/oauth/authorize/consent", (req, res) => {
    const { username, allow, client_id, redirect_uri, state, scope } = req.body;
    const settings = store.getSettings();

    if (typeof redirect_uri !== "string" || !settings.allowedRedirectUris.includes(redirect_uri)) {
      sendOAuthError(res, 400, "invalid_request", "unknown redirect_uri");
      return;
    }

    const client = typeof client_id === "string" ? store.getClient(client_id) : undefined;
    if (!client || !client.grants.includes("authorization_code")) {
      sendOAuthError(res, 400, "invalid_request", "unknown or ineligible client_id");
      return;
    }

    const stateValue = typeof state === "string" ? state : "";

    if (!allow || allow === "false") {
      res.json({
        redirectTo: buildRedirect(redirect_uri, {
          error: "access_denied",
          state: stateValue,
        }),
      });
      return;
    }

    const code = issueAuthCode({
      clientId: client_id,
      redirectUri: redirect_uri,
      scope: typeof scope === "string" && scope ? scope : "read",
      sub: typeof username === "string" && username ? username : "anonymous",
      expiresAt: Date.now() + settings.authCodeTtlSeconds * 1000,
    });

    res.json({
      redirectTo: buildRedirect(redirect_uri, { code, state: stateValue }),
    });
  });

  // ---- Token endpoint. ----
  app.post("/oauth/token", async (req, res) => {
    const grantType = req.body.grant_type as Grant | undefined;
    const settings = store.getSettings();
    const { clientId, clientSecret } = readClientCredentials(req);

    if (!clientId || !clientSecret) {
      sendOAuthError(res, 401, "invalid_client", "missing client credentials");
      return;
    }
    const client = store.verifyClient(clientId, clientSecret);
    if (!client) {
      sendOAuthError(res, 401, "invalid_client", "invalid client credentials");
      return;
    }
    if (grantType && !client.grants.includes(grantType)) {
      sendOAuthError(res, 400, "unauthorized_client", `client may not use ${grantType}`);
      return;
    }

    // The `grant` claim lets resource servers gate tools/behaviour by how the token was
    // obtained (e.g. user-context tools only for authorization_code). Refreshed tokens
    // keep "authorization_code" since they continue that user's session.
    const mintAccessToken = (sub: string, scope: string, grant: Grant) =>
      signer.sign(
        {
          iss: env.OAUTH_ISSUER,
          sub,
          aud: settings.accessTokenAudience,
          client_id: client.clientId,
          scope,
          grant,
        },
        { expiresInSeconds: settings.accessTokenTtlSeconds },
      );

    if (grantType === "client_credentials") {
      const scope = typeof req.body.scope === "string" ? req.body.scope : "read";
      const accessToken = await mintAccessToken(client.clientId, scope, "client_credentials");
      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: settings.accessTokenTtlSeconds,
        scope,
      });
      return;
    }

    if (grantType === "authorization_code") {
      const code = req.body.code;
      const redirectUri = req.body.redirect_uri;
      const record = typeof code === "string" ? consumeAuthCode(code) : undefined;
      if (!record || record.clientId !== client.clientId || record.redirectUri !== redirectUri) {
        sendOAuthError(res, 400, "invalid_grant", "invalid or expired authorization code");
        return;
      }
      const accessToken = await mintAccessToken(record.sub, record.scope, "authorization_code");
      const refreshToken = issueRefreshToken({
        clientId: client.clientId,
        scope: record.scope,
        sub: record.sub,
        expiresAt: Date.now() + settings.refreshTokenTtlSeconds * 1000,
      });
      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: settings.accessTokenTtlSeconds,
        scope: record.scope,
        refresh_token: refreshToken,
      });
      return;
    }

    if (grantType === "refresh_token") {
      const presented = req.body.refresh_token;
      const record = typeof presented === "string" ? consumeRefreshToken(presented) : undefined;
      if (!record || record.clientId !== client.clientId) {
        sendOAuthError(res, 400, "invalid_grant", "invalid or expired refresh token");
        return;
      }
      const accessToken = await mintAccessToken(record.sub, record.scope, "authorization_code");
      // Rotation: the old refresh token was already consumed; issue a fresh one.
      const rotated = issueRefreshToken({
        clientId: client.clientId,
        scope: record.scope,
        sub: record.sub,
        expiresAt: Date.now() + settings.refreshTokenTtlSeconds * 1000,
      });
      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: settings.accessTokenTtlSeconds,
        scope: record.scope,
        refresh_token: rotated,
      });
      return;
    }

    sendOAuthError(res, 400, "unsupported_grant_type", `unsupported grant_type: ${grantType}`);
  });

  // ---- Token introspection (RFC 7662-ish), handy for debugging. ----
  app.post("/oauth/introspect", async (req, res) => {
    const token = req.body.token;
    if (typeof token !== "string") {
      res.json({ active: false });
      return;
    }
    try {
      const claims = await signer.verify(token);
      res.json({
        active: true,
        scope: claims.scope,
        client_id: claims.client_id,
        sub: claims.sub,
        aud: claims.aud,
        exp: claims.exp,
        iss: claims.iss,
      });
    } catch {
      res.json({ active: false });
    }
  });

  // ---- OIDC-style userinfo. ----
  app.get("/userinfo", async (req, res) => {
    const header = req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
      sendOAuthError(res, 401, "invalid_token", "missing bearer token");
      return;
    }
    try {
      const claims = await signer.verify(header.slice(7));
      res.json({
        sub: claims.sub,
        name: "Ada Lovelace",
        email: `${claims.sub}@example.test`,
      });
    } catch {
      sendOAuthError(res, 401, "invalid_token", "invalid or expired token");
    }
  });

  // ---- Protected resource API (OAuth API-credential testing). ----
  // Accepts a valid RS256 JWT, a static bearer, or HTTP Basic — all dummy dev values.
  const authorizeResource = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const settings = store.getSettings();
    const header = req.header("authorization") ?? "";

    if (header.toLowerCase().startsWith("bearer ")) {
      const token = header.slice(7);
      if (token === settings.apiStaticBearer) {
        next();
        return;
      }
      try {
        await signer.verify(token);
        next();
        return;
      } catch {
        sendOAuthError(res, 401, "invalid_token", "invalid or expired token");
        return;
      }
    }

    if (header.toLowerCase().startsWith("basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      if (decoded === `${settings.apiBasicUser}:${settings.apiBasicPass}`) {
        next();
        return;
      }
    }

    sendOAuthError(res, 401, "invalid_token", "missing or invalid credentials");
  };

  app.get("/resource/profile", authorizeResource, (_req, res) => {
    res.json({
      id: "user-001",
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "analyst",
    });
  });

  app.get("/resource/items", authorizeResource, (_req, res) => {
    res.json({
      items: [
        { id: "item-1", label: "Widget", quantity: 3 },
        { id: "item-2", label: "Gadget", quantity: 7 },
        { id: "item-3", label: "Gizmo", quantity: 1 },
      ],
    });
  });

  return app;
}
