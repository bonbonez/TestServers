# Deploying to a VM (systemd + nginx)

> ⚠️ These are **dummy test servers** with dummy credentials and **no auth in front of the
> admin console or `/api/`**. Host them on an **internal network / VPN only** — never on the
> public internet. Anyone who can reach the vhost can view and edit the (dummy) creds.

The backends run as systemd services bound to `127.0.0.1`; nginx serves the two React apps
as static files and reverse-proxies the APIs.

> In dev the backends serve HTTPS with a self-signed cert. **Under systemd they run with
> `TLS=false`** and nginx terminates TLS instead — so there is one certificate to manage, at
> the edge. See [TLS](#tls).

| Public path | Serves |
|---|---|
| `/` | admin credentials console (`admin-web`) |
| `/login/` | DEV login/consent page (`oauth-login-web`) |
| `/api/…` | `config-server` (:7300) — admin API |
| `/oauth/…`, `/userinfo`, `/resource/…`, `/.well-known/…` | `oauth-server` (:7200) |
| `/mcp/…` | `mcp-server` (:7100) |
| `/healthz/{oauth,mcp,config}` | per-service health checks |

## Prerequisites (on the VM)

- Node.js ≥ 20. Yarn comes from Corepack; if `corepack` is not installed the installer falls
  back to `npx corepack`, so it never touches a globally installed `yarn` that other
  projects on the machine may depend on.
- `nginx`, `systemd`, and build tools for `better-sqlite3` (`build-essential` / `python3`).
- Debian/Ubuntu layout assumed (`/etc/nginx/sites-available`); on RHEL the installer falls
  back to `/etc/nginx/conf.d`.

## Deploy

```bash
# clone where the services will run from (this becomes APP_DIR)
sudo git clone <repo-url> /opt/test-servers
sudo chown -R "$USER" /opt/test-servers
cd /opt/test-servers

# build everything, install units + nginx, enable + start
PUBLIC_URL=http://test-servers.internal SERVICE_USER="$USER" ./deploy/install.sh
```

### Installer options

| Env | Default | Purpose |
|---|---|---|
| `PUBLIC_URL` | derived from `SERVER_NAME` + scheme/port | Public origin clients use. Written to `.env` as `OAUTH_ISSUER` and `OAUTH_LOGIN_WEB_URL=<PUBLIC_URL>/login`. |
| `SERVICE_USER` | invoking user | User the services run as. |
| `APP_DIR` | the repo's path | Where the services run from. |
| `SERVER_NAME` | `_` (catch-all) | nginx `server_name`. |
| `HTTP_PORT` | `80` | Plain-HTTP listener; redirects to HTTPS when `TLS_CERT` is set. |
| `HTTPS_PORT` | `443` | TLS listener (only with `TLS_CERT`). |
| `TLS_CERT` / `TLS_KEY` | unset | Certificate/key for nginx. `TLS_KEY` defaults to `TLS_CERT` for combined PEM files. Unset ⇒ plain HTTP only. |

The installer:

1. creates `.env` from `.env.example` (if missing) and sets `OAUTH_ISSUER` and
   `OAUTH_LOGIN_WEB_URL` to your `PUBLIC_URL`;
2. generates `.env.systemd` — see [Why `.env.systemd`](#why-envsystemd);
3. `yarn install` + builds the frontends (same-origin API calls; `oauth-login-web` under
   `/login/`) and the backends;
4. installs `test-servers-{oauth,mcp,config}.service` (+ a `test-servers.target`), enables
   and starts them;
5. installs and reloads the nginx site.

Edit `.env` for the rest (dummy creds seed the store on first run; add your platform's
callback to `OAUTH_ALLOWED_REDIRECT_URIS`), then **re-run the installer** so `.env.systemd`
is regenerated.

### Sharing an nginx with another site

`server_name _` on port 80 will not win against an existing `default_server`, so give this
vhost its own ports and a real hostname instead:

```bash
SERVER_NAME=box.example.com HTTP_PORT=7090 HTTPS_PORT=7443 \
TLS_CERT=/etc/pki/tls/certs/box.pem \
PUBLIC_URL=https://box.example.com:7443 \
./deploy/install.sh
```

The location blocks live in a separate `test-servers-locations.inc` that both vhost
variants `include`, so the HTTP-only and TLS layouts stay in sync.

## Firewall

The installer configures nginx and systemd but deliberately does **not** touch the firewall —
opening a port is a network-exposure decision. On a non-standard `HTTPS_PORT` you must open it
yourself, or browsers get "This site can't be reached" while `curl` **on the box still works**
(loopback bypasses the firewall zone entirely, so local smoke tests prove nothing here).

```bash
# RHEL / firewalld — check first, then open
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=7443/tcp --add-port=7090/tcp
sudo firewall-cmd --reload

# Debian / ufw
sudo ufw allow 7443/tcp && sudo ufw allow 7090/tcp
```

Prefer scoping it to the network that needs access rather than the whole zone — there is no
auth in front of the admin console:

```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" \
  source address="10.0.0.0/8" port port="7443" protocol="tcp" accept'
```

## Manage

```bash
sudo systemctl status test-servers-oauth test-servers-mcp test-servers-config
sudo systemctl restart test-servers.target      # all three
sudo systemctl stop test-servers.target
journalctl -u test-servers-oauth -f             # logs (JSON when piped)
curl -fsS https://box.example.com:7443/healthz/oauth
```

## Update

```bash
cd /opt/test-servers
git pull
./deploy/install.sh      # rebuilds, regenerates .env.systemd, restarts, reloads nginx
```

Pass the same `SERVER_NAME`/`HTTP_PORT`/`HTTPS_PORT`/`TLS_CERT` values you deployed with.

## State

The credential store is SQLite at **`/var/lib/test-servers/creds.db`**, created by the units'
`StateDirectory=test-servers`. It lives outside the repo on purpose: the units set
`ProtectSystem=full`, which makes `/usr` read-only, and a repo checked out under `/usr`
could not be written to.

`.env` only **seeds** the store on first run; after that the store (edited via the admin
console) is the source of truth. To re-seed from `.env`:

```bash
sudo systemctl stop test-servers.target
sudo rm -f /var/lib/test-servers/creds.db*
sudo systemctl start test-servers.target
```

## Why `.env.systemd`

The units read a generated `.env.systemd`, never `.env` directly, because systemd's
`EnvironmentFile` parser differs from a shell's in two ways that silently break this app:

- **Trailing comments are part of the value.** `HOST=127.0.0.1  # bind address` makes the
  server bind to the whole string, and the same pollution lands in `MCP_BEARER_TOKEN`,
  `MCP_OAUTH_AUDIENCE` and the TTLs — which then get seeded into the credential store.
- **`EnvironmentFile` overrides `Environment=`** regardless of the order of the directives,
  so `TLS=true` in `.env` defeats the unit's `Environment=TLS=false`.

So the installer strips inline comments from `.env` and appends the deploy overrides last
(`NODE_ENV=production`, `HOST=127.0.0.1`, `TLS=false`, `CREDS_DB_PATH`,
`MCP_OAUTH_JWKS_URL`). Consequence: **a value that legitimately contains ` #` will be
truncated** — don't use one. `.env.systemd` is generated and gitignored; edit `.env` and
re-run the installer.

## TLS

Terminate TLS at nginx. With an existing certificate:

```bash
TLS_CERT=/etc/pki/tls/certs/box.pem PUBLIC_URL=https://box.example.com ./deploy/install.sh
```

Or issue one with certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d test-servers.internal
```

Either way set `PUBLIC_URL` to the `https://…` origin so the OAuth issuer and the
`/authorize` redirect use `https`.

## Notes

- `mcp-server` fetches the OAuth JWKS server-side over localhost
  (`MCP_OAUTH_JWKS_URL=http://127.0.0.1:7200/.well-known/jwks.json`), so it does not go
  through nginx and is unaffected by edge TLS.
- To lock down the admin surface, restrict `/api/` and `/` in nginx (allow-list, basic
  auth) or firewall the port.
- nginx serves the built SPAs straight off disk, so its worker user needs traverse+read on
  `APP_DIR`. The installer checks this and warns if it fails.
