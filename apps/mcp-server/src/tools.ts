import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * The dummy MCP server definition. Every tool returns static/fake data — nothing here
 * ever calls a real service.
 *
 * Most tools are available on every route; `whoami` is gated to the OAuth
 * authorization-code grant (a signed-in user session). The server `instructions` tell the
 * connecting client which tools need which authorization, tailored to this connection.
 */

const BASE_TOOLS = "ping, get_server_time, echo, get_weather, get_user";

export interface BuildMcpOptions {
  /** Expose the authorization-code-only tools (e.g. `whoami`). */
  includeAuthCodeTools?: boolean;
  /** Token subject to report from `whoami`. */
  subject?: string;
  /** Human label for the current connection's auth, used in the instructions. */
  authLabel?: string;
}

export function buildMcpServer(options: BuildMcpOptions = {}): McpServer {
  const includeAuthCodeTools = options.includeAuthCodeTools ?? false;
  const authLabel = options.authLabel ?? "unknown";

  const whoamiAvailability = includeAuthCodeTools
    ? "It is available on this connection."
    : `It is NOT available on this connection (current auth: ${authLabel}). ` +
      "Reconnect using the OAuth 2.0 authorization-code grant to use it.";

  const instructions =
    "Dummy MCP test server.\n\n" +
    `Tools available under any auth mode (none / bearer / OAuth): ${BASE_TOOLS}.\n\n` +
    "Authorization-gated tools:\n" +
    `- whoami — requires an OAuth 2.0 authorization-code access token (a signed-in user ` +
    `session). ${whoamiAvailability}`;

  const server = new McpServer(
    { name: "mcp-test", version: "0.0.0" },
    { instructions },
  );

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

  if (includeAuthCodeTools) {
    const subject = options.subject ?? "unknown";
    server.tool(
      "whoami",
      "Return the signed-in user's profile. Requires an OAuth 2.0 authorization-code " +
        "access token; not available with client-credentials, bearer, or no-auth.",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sub: subject,
              name: "Ada Lovelace",
              email: `${subject}@example.test`,
            }),
          },
        ],
      }),
    );
  }

  return server;
}
