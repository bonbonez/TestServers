# TestServers

A **multi-app monorepo** of local **test doubles** for developing and e2e-testing MCP and
OAuth client integrations. Backends are **Node.js + TypeScript**; UIs are
**TypeScript + React (Vite)**. The repo is structured to hold **many apps**.

Apps:

1. **`mcp-server`** (`:7100`) — a dummy [Model Context Protocol](https://modelcontextprotocol.io)
   server exposing trivial tools behind every auth mode (none / bearer / OAuth 2.0 client
   credentials / OAuth 2.0 authorization code).
2. **`oauth-server`** (`:7200`) — a minimal dummy OAuth 2.0 authorization server plus a tiny
   protected resource API.
3. **`oauth-login-web`** (`:7201`) — the DEV login/consent UI the authorization server
   redirects to (built with React + Material UI).

---

## ⚠️ Safety & scope — read first (this repo is open source)

These are **throwaway test servers**. They implement *just enough* of each protocol to
exercise a client. They are **NOT secure** and **must never be deployed to the public
internet or used with real data or real credentials.**

Hard rules for everyone (humans and agents) working in this repo:

- **No real secrets, ever.** Every client id, client secret, token, and signing key is a
  throwaway dev value. Only `.env.example` is committed (obvious placeholders); real
  `.env` files are git-ignored. Never paste a production secret here.
- **Dummy data only.** Tools and endpoints return hard-coded fake data (`"Ada Lovelace"`,
  `"sunny, 21°C"`). No PII, no scraped data, no real records.
- **Bind to localhost by default.** Servers listen on `127.0.0.1`. Binding wider requires
  an explicit `HOST=0.0.0.0` opt-in and logs a warning.
- **The login/consent page is a dev stub.** It accepts any username, has no password
  check, and is clearly labelled `DEV / TEST — not a real login`. It must **not** imitate
  any real company, product, or login screen (no real logos, names, or domains) so it can
  never be mistaken for a phishing page.
- **Permissive on purpose, and it says so.** CORS is open for localhost, tokens are
  short-lived, redirect URIs are allow-listed. Every intentionally-weak choice carries a
  code comment and a README note explaining it is a test-only shortcut.
- **Not production-shaped.** No real persistence, clustering, rate limiting, or account
  system. If asked to "harden this for prod", the answer is: don't — build a real server.

---

## Prerequisites

- Node.js ≥ 20 — see `.nvmrc`.
- Yarn ≥ 4, provided by Corepack (`corepack enable`); the version is pinned via the
  root `package.json` `packageManager` field.
- Optional: Docker + Compose to run the backends together.
- Optional: [`mkcert`](https://github.com/FiloSottile/mkcert) for local HTTPS.

## Quick start

```bash
cp .env.example .env
corepack enable
yarn install
yarn dev                       # mcp-server :7100, oauth-server :7200, oauth-login-web :7201
# or one app:
yarn workspace mcp-server dev
```

### Smoke test

```bash
# MCP (no auth) — list tools over the MCP Streamable HTTP transport
curl -s http://127.0.0.1:7100/mcp/none -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# OAuth client-credentials token, then call the protected resource
TOKEN=$(curl -s http://127.0.0.1:7200/oauth/token \
  -d grant_type=client_credentials -d client_id=api-cred-client \
  -d client_secret=dev-api-cred-secret -d scope=read \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
curl -s http://127.0.0.1:7200/resource/profile -H "authorization: Bearer $TOKEN"
```

## Structure

```
TestServers/
├── packages/
│   ├── tsconfig/      # @test-servers/tsconfig — shared tsconfig bases (node.json, react.json)
│   ├── eslint-config/ # @test-servers/eslint-config — one shared flat config
│   ├── tokens/        # @test-servers/tokens — RS256 JWT mint + JWKS + verify
│   └── config/        # @test-servers/config — zod env parsing + safe-boot logging
└── apps/
    ├── mcp-server/       # Node + TS  (port 7100)
    ├── oauth-server/     # Node + TS  (port 7200)
    └── oauth-login-web/  # TS + React + Vite + Material UI  (dev port 7201)
```

Internal packages are scoped `@test-servers/*` and referenced with Yarn's `workspace:*`
protocol. Turbo caches `build` / `lint` / `typecheck` / `test`; `dev` and `start` are
long-running.

## Dummy client registry

All fake — see `apps/oauth-server/src/clients.ts`.

| client_id | client_secret | grants | notes |
|---|---|---|---|
| `mcp-authcode-client` | `dev-mcp-authcode-secret` | authorization_code, refresh_token | MCP popup flow |
| `mcp-cc-client` | `dev-mcp-cc-secret` | client_credentials | MCP client-credentials mode |
| `api-cred-client` | `dev-api-cred-secret` | client_credentials | an "OAuth API credential" |

## Example client configs

- **No auth** → URL `http://127.0.0.1:7100/mcp/none`.
- **Bearer** → URL `/mcp/bearer`, token `dev-mcp-bearer-token-abc123`.
- **OAuth client credentials** → URL `/mcp/oauth`, token URL
  `http://127.0.0.1:7200/oauth/token`, client `mcp-cc-client` / `dev-mcp-cc-secret`,
  scope `read`.
- **OAuth authorization code** → URL `/mcp/oauth`, authorization URL
  `http://127.0.0.1:7200/oauth/authorize`, token URL `http://127.0.0.1:7200/oauth/token`,
  client `mcp-authcode-client` / `dev-mcp-authcode-secret`, scope `read`, then use the
  platform **Connect** popup.

## Testing connection states

- **Auth failure**: change the MCP expected scope/token, or restart `oauth-server` (the
  JWKS keypair regenerates → old tokens fail verification).
- **Unreachable**: stop `mcp-server`.
- **Mid-session refresh**: the access-token TTL is short (120s) — idle, then message again
  to exercise refresh + refresh-token rotation.

## HTTPS (optional)

Default is plain HTTP on localhost. If a flow needs https, generate a cert with `mkcert`
(`mkcert -install`) and set `TLS_CERT` / `TLS_KEY` paths; backends start an https listener
when both are set. Never commit certs/keys (`*.pem` is git-ignored).

## License

MIT — see [LICENSE](./LICENSE).
