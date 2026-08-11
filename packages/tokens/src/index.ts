import { generateKeyPairSync, randomUUID } from "node:crypto";
import {
  SignJWT,
  exportJWK,
  jwtVerify,
  createRemoteJWKSet,
  type JWK,
  type JWTPayload,
} from "jose";

/**
 * RS256 token helpers for the dummy OAuth server and the MCP server.
 *
 * TEST-ONLY: the signing keypair is generated fresh at process startup and never
 * persisted, so restarting the OAuth server invalidates every previously issued token.
 * That is intentional — it lets tests exercise the client's auth-failure handling.
 */

export interface SignOptions {
  /** Seconds until the token expires. */
  expiresInSeconds: number;
}

export interface Signer {
  /** Key id advertised in the JWKS and the token header. */
  readonly kid: string;
  /** Mint an RS256 JWT with the given claims. `iat`/`exp` are set automatically. */
  sign(claims: JWTPayload, options: SignOptions): Promise<string>;
  /** Verify a token minted by this signer (uses the in-memory public key). */
  verify(token: string): Promise<JWTPayload>;
  /** The public JWKS document to serve at `/.well-known/jwks.json`. */
  jwks(): Promise<{ keys: JWK[] }>;
}

export function createSigner(): Signer {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const kid = randomUUID();

  return {
    kid,
    async sign(claims, { expiresInSeconds }) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid })
        .setIssuedAt()
        .setExpirationTime(`${expiresInSeconds}s`)
        .sign(privateKey);
    },
    async verify(token) {
      const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ["RS256"],
      });
      return payload;
    },
    async jwks() {
      const jwk = await exportJWK(publicKey);
      return { keys: [{ ...jwk, kid, use: "sig", alg: "RS256" }] };
    },
  };
}

export interface VerifyOptions {
  /** Expected `aud` claim, if any. */
  audience?: string;
  /** A scope that must be present in the space-delimited `scope` claim, if any. */
  requiredScope?: string;
}

export interface Verifier {
  (token: string): Promise<JWTPayload>;
}

/**
 * Build a verifier that fetches the signer's public key from a remote JWKS URL — this is
 * how the MCP server validates tokens without sharing a secret with the OAuth server.
 */
export function createRemoteVerifier(
  jwksUrl: string,
  options: VerifyOptions = {},
): Verifier {
  const jwks = createRemoteJWKSet(new URL(jwksUrl));

  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["RS256"],
      audience: options.audience,
    });

    if (options.requiredScope) {
      const scopes = String(payload.scope ?? "").split(" ").filter(Boolean);
      if (!scopes.includes(options.requiredScope)) {
        throw new Error(`token missing required scope "${options.requiredScope}"`);
      }
    }

    return payload;
  };
}

export type { JWK, JWTPayload };
