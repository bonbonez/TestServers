# TestServers

A **multi-app monorepo** of local **test doubles** for developing and e2e-testing the AI
platform integrations. Backends are **Node.js + TypeScript**; UIs are
**TypeScript + React (Vite)**. The repo is structured to hold **many apps** — start with
the three below and add more freely.

Initial apps:

1. **`mcp-server`** (Node/TS) — a dummy [Model Context Protocol](https://modelcontextprotocol.io)
   server exposing trivial tools behind **every auth mode the platform supports**
   (none / bearer / OAuth 2.0 client-credentials / OAuth 2.0 authorization-code).
2. **`oauth-server`** (Node/TS) — a minimal dummy **OAuth 2.0 authorization server** plus a
   tiny protected **resource API**. Backs the interactive OAuth flows for the MCP server
   and stands in for a third-party API behind an **OAuth API credential**.
3. **`oauth-login-web`** (TS/React) — the DEV login/consent UI the authorization server
   redirects to.

Every server returns simple canned data after a successful handshake, so tests assert on
real output, not just a 200.

> This document is the build spec. A coding agent should be able to implement the repo
> from it end-to-end. Treat the **Acceptance criteria** at the end as the definition of
> done.

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

Keep this banner at the top of the shipped README.

---

## Goals — what these apps let us test

The the platform platform side is already built; these apps are its counterparts.

| the platform feature under test | Exercised by |
|---|---|
| MCP server, `authType: noAuth` | `mcp-server` → `/mcp/none` |
| MCP server, `authType: bearer` | `mcp-server` → `/mcp/bearer` (static token) |
| MCP server, `authType: oauth2` (client credentials) | `mcp-server` `/mcp/oauth` + `oauth-server` `client_credentials` |
| MCP server, `authType: oauth2AuthorizationCode` (popup) | `mcp-server` `/mcp/oauth` + `oauth-server` `authorization_code` + `oauth-login-web` |
| Mid-session token refresh + **refresh-token rotation** | `oauth-server` short access-token TTL + single-use rotating refresh tokens |
| Tool discovery / sync / per-tool enablement | `mcp-server` exposing a stable tool set |
| Connection states (connected / unreachable / auth failure) | `mcp-server` returns real `401`; stop the process for "unreachable" |
| **API credential**, OAuth 2.0 (client credentials) + Test Connection | `oauth-server` `client_credentials` + protected `GET /resource/*` |
| API credential, Bearer / Basic (nice-to-have) | `oauth-server` resource also accepts a static bearer / basic |

---

## Monorepo structure

**pnpm workspaces + [Turborepo](https://turbo.build/repo)** — the idiomatic setup for a
repo that grows to many apps. `apps/*` are deployables (backends or frontends);
`packages/*` are shared internal libraries.

```
TestServers/
├── package.json               # private root; workspaces + turbo task wiring
├── pnpm-workspace.yaml        # packages: ["apps/*", "packages/*"]
├── turbo.json                 # dev / build / lint / typecheck / start pipelines
├── tsconfig.base.json
├── .nvmrc                     # node 20
├── .env.example               # placeholders only — committed
├── .gitignore                 # .env, node_modules, dist, *.pem, .keys/
├── LICENSE                    # MIT
├── docker-compose.yml         # optional: run the backends together
├── packages/
│   ├── tsconfig/              # @test-servers/tsconfig — shared bases (node.json, react.json)
│   ├── eslint-config/         # @test-servers/eslint-config — one shared flat config
│   ├── tokens/                # @test-servers/tokens — RS256 JWT mint + JWKS + verify
│   └── config/                # @test-servers/config — zod env parsing + safe-boot logging
└── apps/
    ├── mcp-server/            # Node + TS  (port 7100)
    ├── oauth-server/          # Node + TS  (port 7200)
    └── oauth-login-web/       # TS + React + Vite  (dev port 7201)
```

Conventions:

- Package manager: **pnpm** (`packageManager` pinned in root `package.json`).
- Internal packages are scoped **`@test-servers/*`** and referenced with pnpm's
  `workspace:*` protocol.
- Backends: TS compiled with `tsc`; dev via `tsx watch`; ESM (`"type": "module"`).
- Frontends: **Vite + React + TS**.
- Shared TS config lives in `@test-servers/tsconfig` (a `node.json` base and a `react.json`
  base); every app/package `extends` one of them.
- One shared ESLint flat config in `@test-servers/eslint-config`.
- Turbo caches `build`/`lint`/`typecheck`; `dev` is long-running (`"cache": false,
  "persistent": true`).

### Root scripts (via Turbo)

```jsonc
// package.json (root)
{
  "scripts": {
    "dev": "turbo run dev",           // all apps in parallel
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "start": "turbo run start"
  }
}
```

---

## Prerequisites

- Node.js ≥ 20 (uses `node:crypto` `generateKeyPairSync`, global `fetch`) — see `.nvmrc`.
- pnpm ≥ 9 (`corepack enable` then `corepack prepare pnpm@latest --activate`).
- Optional: Docker + Compose to run the backends together.
- Optional: [`mkcert`](https://github.com/FiloSottile/mkcert) for local HTTPS.

---

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev                       # mcp-server :7100, oauth-server :7200, oauth-login-web :7201
# or one app:
pnpm --filter mcp-server dev
```

Smoke test:

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

---

## Configuration (`.env.example`)

All values are **dummy dev placeholders**, safe to commit. Copy to `.env` and adjust
locally. Never replace with real secrets. Prefix by app to keep one root `.env` readable
(each app reads its own prefix via `@test-servers/config`).

```dotenv
# ---- shared ----
HOST=127.0.0.1                       # set 0.0.0.0 only intentionally; logs a warning
NODE_ENV=development

# ---- mcp-server ----
MCP_PORT=7100
MCP_BEARER_TOKEN=dev-mcp-bearer-token-abc123          # accepted by /mcp/bearer (dev-only)
MCP_OAUTH_JWKS_URL=http://127.0.0.1:7200/.well-known/jwks.json
MCP_OAUTH_AUDIENCE=mcp-test                        # optional aud check
MCP_OAUTH_REQUIRED_SCOPE=read                          # optional scope check

# ---- oauth-server ----
OAUTH_PORT=7200
OAUTH_ISSUER=http://127.0.0.1:7200
ACCESS_TOKEN_TTL_SECONDS=120                            # short so refresh path runs
REFRESH_TOKEN_TTL_SECONDS=86400
AUTH_CODE_TTL_SECONDS=300
# In dev, /authorize redirects here (the React login app). In prod, oauth-server serves
# oauth-login-web/dist instead.
OAUTH_LOGIN_WEB_URL=http://127.0.0.1:7201
# Allow-list of redirect URIs the authorization-code flow will honour (comma-separated).
# Add the exact origin you run the platform on.
OAUTH_ALLOWED_REDIRECT_URIS=http://localhost:5173/integration-accounts/mcp/oauth/callback,https://localhost:8443/integration-accounts/mcp/oauth/callback

# ---- oauth-login-web ----
VITE_OAUTH_SERVER_URL=http://127.0.0.1:7200            # where the React app POSTs consent
```

Dummy client registry (`apps/oauth-server/src/clients.ts`, committed — all fake):

| client_id | client_secret | grants | notes |
|---|---|---|---|
| `mcp-authcode-client` | `dev-mcp-authcode-secret` | authorization_code, refresh_token | MCP popup flow |
| `mcp-cc-client` | `dev-mcp-cc-secret` | client_credentials | MCP client-credentials mode |
| `api-cred-client` | `dev-api-cred-secret` | client_credentials | the platform "OAuth API credential" |

---

## App — `mcp-server` (Node/TS)

### Transport
MCP **Streamable HTTP** using the official SDK (`@modelcontextprotocol/sdk`,
`StreamableHTTPServerTransport`). the platform connects via `@langchain/mcp-adapters` with
`transport: 'http'` and an `Authorization` header, so a standards-compliant Streamable
HTTP endpoint is what it expects. Keep it stateless (new transport per request is fine).

### Auth modes → routes
One MCP server definition (same tools) behind four route prefixes, each with its own auth
middleware (`src/auth.ts`):

| Route | Auth check |
|---|---|
| `POST /mcp/none` | none |
| `POST /mcp/bearer` | `Authorization: Bearer <MCP_BEARER_TOKEN>` else `401` |
| `POST /mcp/oauth` | Verify a Bearer **JWT** via JWKS (`MCP_OAUTH_JWKS_URL`, using `@test-servers/tokens`); check `exp` and optional `aud`/`scope`, else `401`. Covers **both** `oauth2` and `oauth2AuthorizationCode` platform modes — both just present a valid access token. |

A `401` is a real HTTP 401 with a JSON body so the platform maps it to
`authenticationFailure`. "Unreachable" is produced by stopping the process / wrong port.

### Tools (canned data — the "more than an auth wall" part)
Define with proper JSON-schema input so discovery/sync shows something:

- `ping` → `"pong"`.
- `get_server_time` → current ISO timestamp.
- `echo` `{ text: string }` → same text.
- `get_weather` `{ city: string }` → fake deterministic `"{city}: sunny, 21°C"`.
- `get_user` `{ id: string }` → fake `{ id, name: "Ada Lovelace", email: "ada@example.test" }`.

All results static/fake; never call a real service.

### Example the platform configs (for the tester)
- No auth → URL `http://127.0.0.1:7100/mcp/none`.
- Bearer → URL `/mcp/bearer`, token `dev-mcp-bearer-token-abc123`.
- OAuth client credentials → URL `/mcp/oauth`, token URL `http://127.0.0.1:7200/oauth/token`,
  client `mcp-cc-client` / `dev-mcp-cc-secret`, scope `read`.
- OAuth authorization code → URL `/mcp/oauth`, authorization URL
  `http://127.0.0.1:7200/oauth/authorize`, token URL `http://127.0.0.1:7200/oauth/token`,
  client `mcp-authcode-client` / `dev-mcp-authcode-secret`, scope `read`, then use the
  platform **Connect** popup.

---

## App — `oauth-server` (Node/TS)

A minimal Express app: authorization server for the MCP OAuth modes **and** protected API
for the OAuth-API-credential feature.

### Token format & keys (`@test-servers/tokens`)
- **Access token**: RS256 **JWT**. Claims `iss, sub, aud, client_id, scope, iat, exp`.
  Short TTL (default **120s**).
- **Signing key**: RSA keypair generated **at startup** (`generateKeyPairSync('rsa',
  { modulusLength: 2048 })`). Never committed. Optionally cache to git-ignored `.keys/`.
- **JWKS**: public key at `GET /.well-known/jwks.json` so verifiers need no shared secret.
- **Refresh token**: opaque random (`randomBytes(32).hex`), in-memory, **single-use /
  rotating** — every refresh returns a new one and invalidates the old (exactly what the
  platform's rotation-persistence must be tested against).

### Endpoints

| Method & path | Purpose |
|---|---|
| `GET /oauth/authorize` | Validate `response_type=code`, `client_id`, `redirect_uri` (allow-list), `state`; hand off to the React login UI (see below). |
| `POST /oauth/authorize/consent` | Called by `oauth-login-web`: `{ username, allow, client_id, redirect_uri, state, scope }` → issues one-time `code`, returns `{ redirectTo }` (or `{ error }`). |
| `POST /oauth/token` | Grants `authorization_code`, `client_credentials`, `refresh_token` (form-encoded). Validates client creds. Returns `{ access_token, token_type:"Bearer", expires_in, scope, refresh_token? }`. Auth-code + refresh rotate a `refresh_token`; client-credentials returns none. |
| `POST /oauth/introspect` | RFC 7662 `{ active, scope, client_id, exp, … }` (optional; handy for debugging). |
| `GET /userinfo` | Bearer JWT → fake `{ sub, name, email }`. |
| `GET /resource/profile` | Protected fake profile JSON (API-credential testing). |
| `GET /resource/items` | Protected fake list, so a test asserts on a body. |
| `GET /.well-known/jwks.json` | Public verification key(s). |
| `GET /healthz` | `200 { ok: true }`. |

Protected `/resource/*` accept a valid RS256 JWT for a known client; **also** accept a
static bearer + HTTP Basic (documented dummy values) so the platform's Bearer/Basic API-credential
types can be exercised too — nice-to-have.

### Login/consent hand-off (dev vs prod)
- **Dev**: `GET /oauth/authorize` validates params then **302-redirects** to
  `${OAUTH_LOGIN_WEB_URL}/?<original query>` (the Vite dev server).
- **Prod-ish**: serve `oauth-login-web/dist` statically from `/oauth/authorize` instead.

The React app reads the query params, shows consent, and `POST`s to
`/oauth/authorize/consent`; the server replies with `{ redirectTo }` and the app does
`window.location = redirectTo`.

### Errors
Spec-shaped `{ error, error_description }` with correct codes (`400`
invalid_request/invalid_grant, `401` invalid_client). Reject unknown `redirect_uri` with a
`400` and **no redirect** (never open-redirect).

### Example flows (curl)

```bash
# client_credentials
curl -s http://127.0.0.1:7200/oauth/token \
  -d grant_type=client_credentials -d client_id=mcp-cc-client \
  -d client_secret=dev-mcp-cc-secret -d scope=read

# refresh_token rotation
curl -s http://127.0.0.1:7200/oauth/token \
  -d grant_type=refresh_token -d refresh_token=<old> \
  -d client_id=mcp-authcode-client -d client_secret=dev-mcp-authcode-secret
```

---

## App — `oauth-login-web` (TS + React + Vite)

The DEV login/consent UI. Not a real login.

- Vite + React + TS. Dev server on `:7201`.
- Reads `client_id`, `redirect_uri`, `state`, `scope` from the URL query.
- Renders a card **prominently titled "Test OAuth — DEV login (not a real login;
  accepts any username)"**, a single username field (becomes token `sub`), the requested
  scopes, and **Allow** / **Deny** buttons. No password.
- **Allow** → `POST ${VITE_OAUTH_SERVER_URL}/oauth/authorize/consent` → `window.location =
  redirectTo`. **Deny** → redirect to `redirect_uri?error=access_denied&state=…`.
- Must not resemble or name any real provider (keeps it un-phishable).
- No external asset/CDN requests; self-contained bundle.

---

## Local e2e with the platform

- **Redirect URI**: the platform posts its own https callback
  (`…/integration-accounts/mcp/oauth/callback`) as the `redirect_uri`. Add the exact
  origin you run the platform on to `OAUTH_ALLOWED_REDIRECT_URIS`. http is fine for `localhost`.
- **Short access-token TTL** (120s) → idling then messaging exercises the platform's
  mid-session refresh + rotation-persistence.
- **Auth-failure state**: change the MCP expected scope/token, or restart oauth-server
  (JWKS keypair regenerates → old tokens fail verification).
- **Unreachable state**: stop `mcp-server`.

---

## Adding another app (this repo is meant to grow)

New **backend** (Node/TS):

1. `mkdir -p apps/<name>/src` with a `package.json` (`"type":"module"`,
   `dev: tsx watch src/index.ts`, `build: tsc`, `start: node dist/index.js`,
   `lint`, `typecheck: tsc --noEmit`).
2. `tsconfig.json` `extends "@test-servers/tsconfig/node.json"`.
3. Depend on `@test-servers/config` for env parsing (add `@test-servers/tokens` if it does OAuth).
4. Pick an unused port; add its `*_PORT` to `.env.example`.

New **frontend** (TS/React):

1. Scaffold a Vite React-TS app under `apps/<name>/`.
2. `tsconfig` `extends "@test-servers/tsconfig/react.json"`; use `@test-servers/eslint-config`.
3. Config via `VITE_*` env vars (documented in `.env.example`).

Turbo picks new apps up automatically (they match `apps/*` and expose the standard task
names). No root wiring needed beyond the `.env.example` entries. Ideas for later:
`apps/api-resource` (a second protected API), `apps/test-console-web` (a React panel to
issue/inspect tokens), `apps/webhook-sink` (capture outbound calls).

---

## HTTPS (optional)

Default is plain HTTP on localhost. If a flow needs https, generate a cert with `mkcert`
and set `TLS_CERT`/`TLS_KEY` paths; backends start an https listener when both are set.
Document `mkcert -install`. Never commit certs/keys (`*.pem` git-ignored).

---

## Implementation guidance

- **Language**: TypeScript, ESM, Node ≥ 20.
- **Shared packages**: `@test-servers/tokens` (jose: RS256 sign + JWKS + verify),
  `@test-servers/config` (zod env parse + redacted boot log), `@test-servers/tsconfig`,
  `@test-servers/eslint-config`.
- **mcp-server** deps: `@modelcontextprotocol/sdk`, `zod`, `@test-servers/tokens`. HTTP via a
  thin Express or `node:http`.
- **oauth-server** deps: `express`, `zod`, `@test-servers/tokens`.
- **oauth-login-web** deps: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`.
- **State** is in-memory `Map`s (`apps/oauth-server/src/store.ts`): auth codes, refresh
  tokens. Fine to lose on restart.
- **Config** parsed/validated with `zod`; fail fast on bad env; log effective config at
  boot with secrets redacted.
- **Logging**: one structured line per request (method, path, mode, status); redact
  tokens/secrets.
- **Tests** (encouraged): `node:test` suites hitting each grant and each MCP mode with
  `fetch`, asserting status + canned body. A frontend test for the consent app is
  optional (Vitest + Testing Library) if you add a React test runner.

---

## Security hardening checklist (keep it a test server)

- [ ] `.gitignore` covers `.env`, `node_modules`, `dist`, `*.pem`, `.keys/`.
- [ ] Only `.env.example` committed; all values obvious dev placeholders.
- [ ] Default `HOST=127.0.0.1`; wider binding logs a prominent warning.
- [ ] `redirect_uri` strictly allow-listed; unknown values `400`, no redirect.
- [ ] Login page clearly labelled DEV, imitates no real brand, needs no password.
- [ ] Access-token TTL short; refresh tokens single-use/rotating; codes single-use.
- [ ] No signing keys or tokens committed; keypair generated at runtime.
- [ ] Tokens/secrets redacted in all logs.
- [ ] README safety banner present and unedited.
- [ ] Dependencies pinned; `pnpm audit` clean at setup time.

---

## Acceptance criteria (definition of done)

1. `pnpm install && pnpm dev` starts `mcp-server` (:7100), `oauth-server` (:7200), and
   `oauth-login-web` (:7201).
2. MCP `tools/list` works on `/mcp/none`; `/mcp/bearer` rejects a wrong token with `401`
   and accepts the configured one; `/mcp/oauth` accepts a valid oauth-server JWT and
   rejects expired/invalid with `401`.
3. All five tools are discoverable and return their canned data on every mode.
4. `client_credentials`, `authorization_code`, and `refresh_token` grants work; refresh
   returns a **new** refresh token and the old one stops working.
5. `GET /resource/profile` and `/resource/items` return fake data only with a valid token.
6. The React consent app completes the authorization-code flow end-to-end via the browser.
7. The the platform platform can, against these apps: add an MCP server in each auth mode,
   discover/sync tools, complete the OAuth **Connect** popup, keep working after the
   access token expires (refresh), and add an OAuth-2.0 API credential whose Test
   Connection succeeds.
8. Adding a new `apps/*` app requires no root config beyond `.env.example` — `turbo run
   dev/build` picks it up.
9. No real secret, key, or piece of personal data exists anywhere in the repo.

---

## License

MIT — include a standard MIT `LICENSE`. Appropriate for a throwaway test-utility repo;
swap only if your org mandates otherwise.
