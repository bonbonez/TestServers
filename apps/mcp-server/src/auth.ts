import type { Request, Response, NextFunction } from "express";
import { createRemoteVerifier } from "@test-servers/tokens";
import { env } from "./env.js";

/**
 * Auth middleware for the MCP routes. A failed check is a real HTTP 401 with a JSON body
 * so the platform maps the connection to `authenticationFailure` (not "unreachable").
 */

function unauthorized(res: Response, description: string): void {
  res
    .status(401)
    .json({ error: "invalid_token", error_description: description });
}

/** `Authorization: Bearer <MCP_BEARER_TOKEN>` or 401. */
export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    unauthorized(res, "missing bearer token");
    return;
  }
  if (header.slice(7) !== env.MCP_BEARER_TOKEN) {
    unauthorized(res, "invalid bearer token");
    return;
  }
  next();
}

// Verifies a Bearer JWT against the OAuth server's JWKS. Covers both the oauth2 and
// oauth2AuthorizationCode platform modes — both just present a valid access token.
const verifyJwt = createRemoteVerifier(env.MCP_OAUTH_JWKS_URL, {
  audience: env.MCP_OAUTH_AUDIENCE || undefined,
  requiredScope: env.MCP_OAUTH_REQUIRED_SCOPE || undefined,
});

export async function oauthAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    unauthorized(res, "missing bearer token");
    return;
  }
  try {
    await verifyJwt(header.slice(7));
    next();
  } catch (error) {
    unauthorized(res, error instanceof Error ? error.message : "invalid token");
  }
}
