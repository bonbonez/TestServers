# Deploying to a VM (systemd + nginx)

> ⚠️ These are **dummy test servers** with dummy credentials and **no TLS/auth by default**.
> Host them on an **internal network / VPN only** — never on the public internet. The admin
> console and `/api/` let anyone view and edit the (dummy) creds.

The backends run as systemd services bound to `127.0.0.1`; nginx serves the two React apps
as static files and reverse-proxies the APIs.

> In dev the backends serve HTTPS with a self-signed cert. **On a VM they run with
> `TLS=false`** (set in the systemd units) and nginx terminates TLS instead — so there is
> one certificate to manage, at the edge. See [TLS](#tls-recommended-even-internally).

| Public path | Serves |
|---|---|
| `/` | admin credentials console (`admin-web`) |
| `/login/` | DEV login/consent page (`oauth-login-web`) |
| `/api/…` | `config-server` (:7300) — admin API |
| `/oauth/…`, `/userinfo`, `/resource/…`, `/.well-known/…` | `oauth-server` (:7200) |
| `/mcp/…` | `mcp-server` (:7100) |

## Prerequisites (on the VM)

- Node.js ≥ 20 and Corepack (`corepack enable`) — Yarn is provided by Corepack.
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

The installer:

1. creates `.env` from `.env.example` (if missing) and sets `OAUTH_ISSUER` and
   `OAUTH_LOGIN_WEB_URL` to your `PUBLIC_URL`;
2. `yarn install` + builds the frontends (same-origin API calls; `oauth-login-web` under
   `/login/`) and the backends;
3. installs `test-servers-{oauth,mcp,config}.service` (+ a `test-servers.target`), enables
   and starts them;
4. installs and reloads the nginx site.

Edit `.env` for the rest (dummy creds seed the store on first run; add your platform's
callback to `OAUTH_ALLOWED_REDIRECT_URIS`), then re-run the installer or restart the
services.

## Manage

```bash
sudo systemctl status test-servers-oauth test-servers-mcp test-servers-config
sudo systemctl restart test-servers.target      # all three
sudo systemctl stop test-servers.target
journalctl -u test-servers-oauth -f             # logs (JSON when piped)
```

## Update

```bash
cd /opt/test-servers
git pull
corepack yarn install --immutable
corepack yarn build
VITE_BASE=/ VITE_CONFIG_SERVER_URL="" corepack yarn workspace admin-web build
VITE_BASE=/login/ VITE_OAUTH_SERVER_URL="" corepack yarn workspace oauth-login-web build
sudo systemctl restart test-servers.target
```

(Or just re-run `./deploy/install.sh`.)

## TLS (recommended even internally)

Terminate TLS at nginx, e.g. with certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d test-servers.internal
```

Then set `PUBLIC_URL=https://test-servers.internal` and re-run the installer so the OAuth
issuer/redirects use `https`.

## Notes

- The credential store lives at `.data/creds.db` under the repo dir; the service user needs
  write access there. Delete it to re-seed from `.env`.
- `mcp-server` fetches the OAuth JWKS server-side over localhost
  (`MCP_OAUTH_JWKS_URL=http://127.0.0.1:7200/.well-known/jwks.json`), so it need not go
  through nginx.
- To lock down the admin surface, restrict `/api/` and `/` in nginx (allow-list, basic
  auth) or firewall the port.
