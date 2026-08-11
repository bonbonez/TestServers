import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * The dummy MCP server definition. Every tool returns static/fake data — nothing here
 * ever calls a real service. The same definition sits behind all four auth routes.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "mcp-test", version: "0.0.0" });

  server.tool("ping", "Health check that always returns pong.", {}, async () => ({
    content: [{ type: "text", text: "pong" }],
  }));

  server.tool(
    "get_server_time",
    "Return the current server time as an ISO 8601 timestamp.",
    {},
    async () => ({
      content: [{ type: "text", text: new Date().toISOString() }],
    }),
  );

  server.tool(
    "echo",
    "Echo the provided text back unchanged.",
    { text: z.string().describe("Text to echo back.") },
    async ({ text }) => ({
      content: [{ type: "text", text }],
    }),
  );

  server.tool(
    "get_weather",
    "Return fake, deterministic weather for a city.",
    { city: z.string().describe("City name.") },
    async ({ city }) => ({
      content: [{ type: "text", text: `${city}: sunny, 21°C` }],
    }),
  );

  server.tool(
    "get_user",
    "Return a fake user record for the given id.",
    { id: z.string().describe("User id.") },
    async ({ id }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id,
            name: "Ada Lovelace",
            email: "ada@example.test",
          }),
        },
      ],
    }),
  );

  return server;
}
