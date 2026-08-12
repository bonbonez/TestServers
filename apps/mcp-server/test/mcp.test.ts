import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openStore } from "@test-servers/store";
import { createApp } from "../src/app.js";
import { buildMcpServer } from "../src/tools.js";

async function connectInMemory(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(createApp(openStore(":memory:")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

test("tools/list exposes all five tools on /mcp/none", async () => {
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp/none`)),
  );
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "echo",
    "get_server_time",
    "get_user",
    "get_weather",
    "ping",
  ]);
  await client.close();
});

test("ping returns canned data", async () => {
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp/none`)),
  );
  const result = await client.callTool({ name: "ping", arguments: {} });
  assert.deepEqual(result.content, [{ type: "text", text: "pong" }]);
  await client.close();
});

test("whoami is hidden without the authorization-code grant", async () => {
  const client = await connectInMemory(
    buildMcpServer({ authLabel: "OAuth client-credentials" }),
  );
  const { tools } = await client.listTools();
  assert.equal(tools.some((tool) => tool.name === "whoami"), false);
  await client.close();
});

test("whoami is exposed for the authorization-code grant", async () => {
  const client = await connectInMemory(
    buildMcpServer({ includeAuthCodeTools: true, subject: "ada" }),
  );
  const { tools } = await client.listTools();
  assert.equal(tools.some((tool) => tool.name === "whoami"), true);
  const result = await client.callTool({ name: "whoami", arguments: {} });
  assert.match(JSON.stringify(result.content), /ada@example\.test/);
  await client.close();
});

test("instructions advertise the whoami authorization requirement", async () => {
  const client = await connectInMemory(buildMcpServer({ authLabel: "no auth" }));
  const instructions = client.getInstructions() ?? "";
  assert.match(instructions, /whoami/);
  assert.match(instructions, /authorization-code/);
  await client.close();
});

test("/mcp/bearer rejects a wrong token with 401", async () => {
  const res = await fetch(`${baseUrl}/mcp/bearer`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: "Bearer nope",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "invalid_token");
});
