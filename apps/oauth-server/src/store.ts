import { randomBytes } from "node:crypto";

/**
 * In-memory state for auth codes and refresh tokens. TEST-ONLY: everything lives in
 * plain Maps and is lost on restart — exactly what we want for a throwaway server.
 */

export interface AuthCodeRecord {
  clientId: string;
  redirectUri: string;
  scope: string;
  sub: string;
  expiresAt: number;
}

export interface RefreshTokenRecord {
  clientId: string;
  scope: string;
  sub: string;
  expiresAt: number;
}

const authCodes = new Map<string, AuthCodeRecord>();
const refreshTokens = new Map<string, RefreshTokenRecord>();

function opaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function issueAuthCode(record: AuthCodeRecord): string {
  const code = opaqueToken();
  authCodes.set(code, record);
  return code;
}

/** Auth codes are single-use: consuming one removes it. */
export function consumeAuthCode(code: string): AuthCodeRecord | undefined {
  const record = authCodes.get(code);
  if (!record) {
    return undefined;
  }
  authCodes.delete(code);
  if (record.expiresAt < Date.now()) {
    return undefined;
  }
  return record;
}

export function issueRefreshToken(record: RefreshTokenRecord): string {
  const token = opaqueToken();
  refreshTokens.set(token, record);
  return token;
}

/**
 * Refresh tokens are single-use / rotating: consuming one removes it so the caller can
 * mint a replacement. This is what the platform's refresh-token-rotation persistence is
 * tested against.
 */
export function consumeRefreshToken(
  token: string,
): RefreshTokenRecord | undefined {
  const record = refreshTokens.get(token);
  if (!record) {
    return undefined;
  }
  refreshTokens.delete(token);
  if (record.expiresAt < Date.now()) {
    return undefined;
  }
  return record;
}
