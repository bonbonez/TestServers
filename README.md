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

## Quick start

```bash
cp .env.example .env
corepack enable
yarn install
yarn dev            # mcp :7100, oauth :7200, login :7201, config :7300, admin https://:7301
# or one app:
yarn workspace mcp-server dev
```

`yarn dev` runs everything in **watch mode** — editing an app's source (or a shared
`@test-servers/*` package) rebuilds and restarts the affected server automatically. Stop it
with `Ctrl+C`; the servers shut down gracefully. Open the admin console at
**https://localhost:7301** (served over HTTPS with a self-signed cert via
`@vitejs/plugin-basic-ssl` — accept the browser warning once). The console proxies `/api`
to config-server, so it calls its API same-origin.

To host it on a VM with systemd + nginx, see [docs/DEPLOY.md](docs/DEPLOY.md).

### Smoke test

```bash
# MCP (no auth) — list tools over the MCP Streamable HTTP transport
curl -sk https://localhost:7100/mcp/none -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# OAuth client-credentials token, then call the protected resource
TOKEN=$(curl -sk https://localhost:7200/oauth/token \
  -d grant_type=client_credentials -d client_id=api-cred-client \
  -d client_secret=dev-api-cred-secret -d scope=read \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
curl -sk https://localhost:7200/resource/profile -H "authorization: Bearer $TOKEN"
```

## Structure

```
TestServers/
├── packages/
│   ├── tsconfig/      # @test-servers/tsconfig — shared tsconfig bases (node.json, react.json)
│   ├── eslint-config/ # @test-servers/eslint-config — one shared flat config
│   ├── tokens/        # @test-servers/tokens — RS256 JWT mint + JWKS + verify
│   ├── config/        # @test-servers/config — zod env parsing + safe-boot logging
│   ├── store/         # @test-servers/store — SQLite credential store (source of truth)
│   └── logger/        # @test-servers/logger — colorized (TTY) / JSON (piped) logging
└── apps/
    ├── mcp-server/       # Node + TS  (port 7100)
    ├── oauth-server/     # Node + TS  (port 7200)
    ├── oauth-login-web/  # TS + React + Vite + Material UI  (dev port 7201)
    ├── config-server/    # Node + TS — admin API over the credential store (port 7300)
    └── admin-web/        # TS + React + Vite + Material UI — credentials console (dev port 7301)
```

Internal packages are scoped `@test-servers/*` and referenced with Yarn's `workspace:*`
protocol. Turbo caches `build` / `lint` / `typecheck` / `test`; `dev` and `start` are
long-running.

## Credentials console

All creds (the MCP bearer token, OAuth clients, token TTLs, audience, redirect allow-list,
and the resource-API static/basic creds) live in a shared SQLite store
(`@test-servers/store`, at `.data/creds.db`). It is the **single source of truth**:
`mcp-server` and `oauth-server` read it live on every request, so edits take effect without
a restart.

- **`config-server`** (`:7300`) exposes a small REST API over the store.
- **`admin-web`** (`:7301`) is a Material UI console: a **setup wizard** (prefilled with
  generated dev defaults, all editable) on first run, then a dashboard to **view / copy /
  edit** every cred per app, manage OAuth clients, and **Copy `.env`**.

```bash
yarn workspace config-server dev   # :7300 admin API
yarn workspace admin-web dev       # console — open https://localhost:7301 (self-signed)
```

On first run the store seeds itself from `.env` (or the documented defaults). Delete
`.data/creds.db` to re-seed from scratch.

## Dummy client registry

Seeded into the store on first run; manage them in the console (or via `config-server`).

| client_id | client_secret | grants | notes |
|---|---|---|---|
| `mcp-authcode-client` | `dev-mcp-authcode-secret` | authorization_code, refresh_token | MCP popup flow |
| `mcp-cc-client` | `dev-mcp-cc-secret` | client_credentials | MCP client-credentials mode |
| `api-cred-client` | `dev-api-cred-secret` | client_credentials | an "OAuth API credential" |

## Example client configs

- **No auth** → URL `https://localhost:7100/mcp/none`.
- **Bearer** → URL `/mcp/bearer`, token `dev-mcp-bearer-token-abc123`.
- **OAuth client credentials** → URL `/mcp/oauth`, token URL
  `https://localhost:7200/oauth/token`, client `mcp-cc-client` / `dev-mcp-cc-secret`,
  scope `read`.
- **OAuth authorization code** → URL `/mcp/oauth`, authorization URL
  `https://localhost:7200/oauth/authorize`, token URL `https://localhost:7200/oauth/token`,
  client `mcp-authcode-client` / `dev-mcp-authcode-secret`, scope `read`, then use the
  platform **Connect** popup.

## MCP tools & authorization

| Tool | Available under |
|---|---|
| `ping`, `get_server_time`, `echo`, `get_weather`, `get_user` | any auth mode (none / bearer / OAuth) |
| `whoami` | **only** the OAuth 2.0 **authorization-code** grant (a signed-in user session) |

`whoami` returns the token subject's profile, so it is exposed only when the access token
carries `grant: "authorization_code"` — client-credentials, bearer, and no-auth
connections don't see it. Clients are told which tools need which authorization two ways:
each tool's `description`, and the server `instructions` returned at initialize, which name
the current connection's auth mode and whether `whoami` is available on it.

## Testing connection states

- **Auth failure**: change the MCP expected scope/token, or restart `oauth-server` (the
  JWKS keypair regenerates → old tokens fail verification).
- **Unreachable**: stop `mcp-server`.
- **Mid-session refresh**: the access-token TTL is short (120s) — idle, then message again
  to exercise refresh + refresh-token rotation.

## Logging

The backends log through `@test-servers/logger`: one line per request (method, path,
color-coded status, duration) plus boot/listen lines with secrets redacted.

- **Colorized** when stdout/stderr is a TTY; **one JSON object per line** when piped or
  redirected (machine-readable).
- `LOG_LEVEL` sets the threshold (`debug` | `info` | `warn` | `error`, default `info`).
- `NO_COLOR` disables colors even on a TTY.

## HTTPS

Everything runs over **HTTPS on `localhost` by default**, so the dev setup matches what a
real client expects (secure-context browser APIs, `https` redirect URIs, no mixed content).

- **Backends** (`oauth`, `mcp`, `config`) generate a **self-signed dev certificate** for
  `localhost` / `127.0.0.1` on first boot and cache it in the git-ignored `.keys/`. Use
  `curl -k` (or import the cert) when calling them by hand.
- **Frontends** are served over HTTPS by `@vitejs/plugin-basic-ssl`, and proxy their API
  calls same-origin (`/api` → config-server, `/oauth` → oauth-server), so there is no
  mixed content and no second certificate to accept.
- In dev the backends skip verification for outbound calls between each other (the certs
  are self-signed) and log a warning saying so. This is disabled when
  `NODE_ENV=production`.
- Bring your own cert with `TLS_CERT` / `TLS_KEY`, or serve **plain HTTP** with:

  ```bash
  TLS=false yarn dev
  ```

  That switches *everything* — both backends and both Vite dev servers — to `http://`, and
  the issuer / JWKS / login URL defaults follow the scheme automatically. It's also what
  the systemd units use, since nginx terminates TLS in that setup (see
  [docs/DEPLOY.md](docs/DEPLOY.md)).

  Note: `OAUTH_ISSUER`, `MCP_OAUTH_JWKS_URL` and `OAUTH_LOGIN_WEB_URL` are commented out in
  `.env.example` on purpose, so their scheme tracks `TLS`. Uncommenting one pins it, and a
  pinned `https://` URL with `TLS=false` will not work.

Never commit certs/keys — `*.pem` and `.keys/` are git-ignored.

## License

MIT — see [LICENSE](./LICENSE).
