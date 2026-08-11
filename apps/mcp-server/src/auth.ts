import type { Request, Response, NextFunction } from "express";
import { createRemoteVerifier } from "@test-servers/tokens";
import type { Store } from "@test-servers/store";
import { env } from "./env.js";

/**
 * Auth middleware for the MCP routes. Creds come from the shared store and are read live
 * on each request, so edits in the admin console take effect without a restart. A failed
 * check is a real HTTP 401 with a JSON body so the platform maps the connection to
 * `authenticationFailure` (not "unreachable").
 */

function unauthorized(res: Response, description: string): void {
  res
    .status(401)
    .json({ error: "invalid_token", error_description: description });
}

/** `Authorization: Bearer <mcpBearerToken>` or 401. */
export function createBearerAuth(store: Store) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    if (!header.toLowerCase().startsWith("bearer ")) {
      unauthorized(res, "missing bearer token");
      return;
    }
    if (header.slice(7) !== store.getSettings().mcpBearerToken) {
      unauthorized(res, "invalid bearer token");
      return;
    }
    next();
  };
}

// Verifies a Bearer JWT against the OAuth server's JWKS. Covers both the oauth2 and
// oauth2AuthorizationCode platform modes — both just present a valid access token.
const verifyJwt = createRemoteVerifier(env.MCP_OAUTH_JWKS_URL);

export function createOAuthAuth(store: Store) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { accessTokenAudience, requiredScope } = store.getSettings();
    const header = req.header("authorization") ?? "";
    if (!header.toLowerCase().startsWith("bearer ")) {
      unauthorized(res, "missing bearer token");
      return;
    }
    try {
      await verifyJwt(header.slice(7), {
        audience: accessTokenAudience || undefined,
        requiredScope: requiredScope || undefined,
      });
      next();
    } catch (error) {
      unauthorized(res, error instanceof Error ? error.message : "invalid token");
    }
  };
}
