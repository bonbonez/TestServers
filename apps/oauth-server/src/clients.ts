/**
 * Dummy client registry — every value here is a throwaway dev placeholder (see README
 * safety banner). These are NOT real credentials and must never be replaced with any.
 */

export type Grant =
  | "authorization_code"
  | "client_credentials"
  | "refresh_token";

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  grants: Array<Grant>;
  notes: string;
}

export const CLIENTS: Array<OAuthClient> = [
  {
    clientId: "mcp-authcode-client",
    clientSecret: "dev-mcp-authcode-secret",
    grants: ["authorization_code", "refresh_token"],
    notes: "MCP popup (authorization-code) flow.",
  },
  {
    clientId: "mcp-cc-client",
    clientSecret: "dev-mcp-cc-secret",
    grants: ["client_credentials"],
    notes: "MCP client-credentials mode.",
  },
  {
    clientId: "api-cred-client",
    clientSecret: "dev-api-cred-secret",
    grants: ["client_credentials"],
    notes: "OAuth API credential (client-credentials).",
  },
];

export function findClient(clientId: string): OAuthClient | undefined {
  return CLIENTS.find((client) => client.clientId === clientId);
}

/** Return the client only when the id/secret pair matches exactly. */
export function verifyClientSecret(
  clientId: string,
  clientSecret: string,
): OAuthClient | undefined {
  const client = findClient(clientId);
  if (!client || client.clientSecret !== clientSecret) {
    return undefined;
  }
  return client;
}
