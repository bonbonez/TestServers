export type Grant =
  | "authorization_code"
  | "client_credentials"
  | "refresh_token";

export interface Settings {
  mcpBearerToken: string;
  accessTokenAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  authCodeTtlSeconds: number;
  requiredScope: string;
  apiStaticBearer: string;
  apiBasicUser: string;
  apiBasicPass: string;
  allowedRedirectUris: Array<string>;
  initialized: boolean;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  grants: Array<Grant>;
  notes: string;
}

export interface Connections {
  host: string;
  mcp: { none: string; bearer: string; oauth: string };
  oauth: {
    issuer: string;
    authorize: string;
    token: string;
    jwks: string;
    userinfo: string;
  };
  resource: { profile: string; items: string };
  loginWeb: string;
}

export interface ConfigResponse {
  settings: Settings;
  clients: Array<OAuthClient>;
  connections: Connections;
}
