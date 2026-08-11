import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

const REDIRECT_URI =
  "http://localhost:5173/integration-accounts/mcp/oauth/callback";
// The store seeds itself from the environment on first open, so set the allow-list and an
// isolated in-memory database before importing anything that opens the store.
process.env.OAUTH_ALLOWED_REDIRECT_URIS = REDIRECT_URI;
process.env.CREDS_DB_PATH = ":memory:";

let server: Server;
let baseUrl: string;

before(async () => {
  const { createSigner } = await import("@test-servers/tokens");
  const { openStore } = await import("@test-servers/store");
  const { createApp } = await import("../src/app.js");
  const app = createApp(createSigner(), openStore(":memory:"));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

async function tokenRequest(body: Record<string, string>): Promise<Response> {
  return fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

test("client_credentials grant returns an access token and no refresh token", async () => {
  const res = await tokenRequest({
    grant_type: "client_credentials",
    client_id: "api-cred-client",
    client_secret: "dev-api-cred-secret",
    scope: "read",
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.token_type, "Bearer");
  assert.ok(body.access_token);
  assert.equal(body.refresh_token, undefined);
});

test("invalid client secret is rejected with 401 invalid_client", async () => {
  const res = await tokenRequest({
    grant_type: "client_credentials",
    client_id: "api-cred-client",
    client_secret: "wrong",
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "invalid_client");
});

test("protected resource requires a token", async () => {
  const unauthorized = await fetch(`${baseUrl}/resource/profile`);
  assert.equal(unauthorized.status, 401);

  const tokenRes = await tokenRequest({
    grant_type: "client_credentials",
    client_id: "api-cred-client",
    client_secret: "dev-api-cred-secret",
    scope: "read",
  });
  const { access_token } = await tokenRes.json();
  const authorized = await fetch(`${baseUrl}/resource/profile`, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  assert.equal(authorized.status, 200);
  const profile = await authorized.json();
  assert.equal(profile.name, "Ada Lovelace");
});

test("refresh token rotates and the old one stops working", async () => {
  const consentRes = await fetch(`${baseUrl}/oauth/authorize/consent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      allow: true,
      client_id: "mcp-authcode-client",
      redirect_uri: "http://localhost:5173/integration-accounts/mcp/oauth/callback",
      state: "xyz",
      scope: "read",
    }),
  });
  const { redirectTo } = await consentRes.json();
  const code = new URL(redirectTo).searchParams.get("code");
  assert.ok(code);

  const first = await tokenRequest({
    grant_type: "authorization_code",
    code: code!,
    redirect_uri: "http://localhost:5173/integration-accounts/mcp/oauth/callback",
    client_id: "mcp-authcode-client",
    client_secret: "dev-mcp-authcode-secret",
  });
  const firstBody = await first.json();
  assert.ok(firstBody.refresh_token);

  const refreshed = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: firstBody.refresh_token,
    client_id: "mcp-authcode-client",
    client_secret: "dev-mcp-authcode-secret",
  });
  const refreshedBody = await refreshed.json();
  assert.equal(refreshed.status, 200);
  assert.ok(refreshedBody.refresh_token);
  assert.notEqual(refreshedBody.refresh_token, firstBody.refresh_token);

  const reuse = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: firstBody.refresh_token,
    client_id: "mcp-authcode-client",
    client_secret: "dev-mcp-authcode-secret",
  });
  assert.equal(reuse.status, 400);
});

test("unknown redirect_uri is rejected without redirecting", async () => {
  const res = await fetch(`${baseUrl}/oauth/authorize/consent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      allow: true,
      client_id: "mcp-authcode-client",
      redirect_uri: "http://evil.example/callback",
      state: "xyz",
      scope: "read",
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_request");
});
