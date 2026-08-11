import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.CREDS_DB_PATH = ":memory:";

let server: Server;
let baseUrl: string;

before(async () => {
  const { openStore } = await import("@test-servers/store");
  const { createApp } = await import("../src/app.js");
  server = createServer(createApp(openStore(":memory:")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

test("GET /api/config returns settings, clients and connections", async () => {
  const res = await fetch(`${baseUrl}/api/config`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.settings.accessTokenAudience, "mcp-test");
  assert.ok(body.clients.some((c: { clientId: string }) => c.clientId === "mcp-cc-client"));
  assert.match(body.connections.mcp.oauth, /\/mcp\/oauth$/);
});

test("PUT /api/settings persists an edit", async () => {
  const current = await (await fetch(`${baseUrl}/api/config`)).json();
  const next = { ...current.settings, mcpBearerToken: "edited-token", initialized: true };
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
  assert.equal(res.status, 200);
  const saved = await res.json();
  assert.equal(saved.mcpBearerToken, "edited-token");
  assert.equal(saved.initialized, true);
});

test("client CRUD lifecycle", async () => {
  const create = await fetch(`${baseUrl}/api/clients`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: "extra-client",
      clientSecret: "extra-secret",
      grants: ["client_credentials"],
      notes: "added in test",
    }),
  });
  assert.equal(create.status, 201);

  const duplicate = await fetch(`${baseUrl}/api/clients`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: "extra-client",
      clientSecret: "x",
      grants: ["client_credentials"],
      notes: "",
    }),
  });
  assert.equal(duplicate.status, 409);

  const del = await fetch(`${baseUrl}/api/clients/extra-client`, { method: "DELETE" });
  assert.equal(del.status, 204);

  const list = await (await fetch(`${baseUrl}/api/clients`)).json();
  assert.equal(list.some((c: { clientId: string }) => c.clientId === "extra-client"), false);
});

test("invalid settings are rejected", async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessTokenTtlSeconds: -1 }),
  });
  assert.equal(res.status, 400);
});
