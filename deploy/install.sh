#!/usr/bin/env bash
#
# One-shot installer for hosting the Test Servers on a VM with systemd + nginx.
#
# ⚠️ DUMMY test servers with dummy creds — no auth in front of the admin console or /api/.
# Keep this on an internal network / VPN only.
#
# Usage (from anywhere):
#   PUBLIC_URL=http://test-servers.internal SERVICE_USER=deploy ./deploy/install.sh
#
# Sharing an nginx that already serves another site? Give this vhost its own ports and
# hostname so it cannot shadow the existing one:
#   SERVER_NAME=box.example.com HTTP_PORT=7090 HTTPS_PORT=7443 \
#   TLS_CERT=/etc/pki/tls/certs/box.pem TLS_KEY=/etc/pki/tls/certs/box.pem \
#   ./deploy/install.sh
#
# Env:
#   PUBLIC_URL    Public origin clients use. Default: derived from SERVER_NAME + the
#                 scheme/port below. Written into .env as OAUTH_ISSUER and
#                 OAUTH_LOGIN_WEB_URL=<PUBLIC_URL>/login.
#   SERVICE_USER  User the systemd services run as (default: the invoking user).
#   APP_DIR       Repo location on the VM (default: this repo's path).
#   SERVER_NAME   nginx server_name (default: _, i.e. catch-all on its ports). Set a real
#                 hostname when another vhost already claims the same port.
#   HTTP_PORT     Plain-HTTP listener (default: 80). Redirects to HTTPS when TLS_CERT is set.
#   HTTPS_PORT    TLS listener (default: 443). Only used when TLS_CERT is set.
#   TLS_CERT      Certificate for nginx to terminate TLS with. Unset = plain HTTP only.
#   TLS_KEY       Private key (default: TLS_CERT, for combined cert+key PEM files).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-$USER}}"
SERVER_NAME="${SERVER_NAME:-_}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
TLS_CERT="${TLS_CERT:-}"
TLS_KEY="${TLS_KEY:-${TLS_CERT}}"
SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

# Public origin: https when nginx terminates TLS, and only spell out non-default ports.
if [ -n "$TLS_CERT" ]; then
  default_host="${SERVER_NAME/#_/localhost}"
  [ "$HTTPS_PORT" = "443" ] || default_host="${default_host}:${HTTPS_PORT}"
  PUBLIC_URL="${PUBLIC_URL:-https://${default_host}}"
else
  default_host="${SERVER_NAME/#_/localhost}"
  [ "$HTTP_PORT" = "80" ] || default_host="${default_host}:${HTTP_PORT}"
  PUBLIC_URL="${PUBLIC_URL:-http://${default_host}}"
fi

cd "$APP_DIR"
echo "==> repo:        $APP_DIR"
echo "==> public URL:  $PUBLIC_URL"
echo "==> run as user: $SERVICE_USER"
if [ -n "$TLS_CERT" ]; then
  echo "==> nginx:       ${SERVER_NAME} :${HTTPS_PORT} (TLS) + :${HTTP_PORT} (redirect)"
else
  echo "==> nginx:       ${SERVER_NAME} :${HTTP_PORT} (plain HTTP)"
fi

# Yarn comes from Corepack. Fall back to `npx corepack` on boxes without it, so we never
# touch a globally installed yarn that other projects on the machine may depend on.
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  YARN=(corepack yarn)
else
  echo "==> corepack not found; using 'npx corepack' for Yarn"
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  YARN=(npx --yes corepack@latest yarn)
fi

set_env_kv() {
  local key="$1" val="$2" file=".env"
  if grep -qE "^${key}=" "$file"; then
    sed -i.bak -E "s#^${key}=.*#${key}=${val}#" "$file" && rm -f "$file.bak"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

echo "==> preparing .env"
[ -f .env ] || cp .env.example .env
set_env_kv OAUTH_ISSUER "$PUBLIC_URL"
set_env_kv OAUTH_LOGIN_WEB_URL "${PUBLIC_URL}/login"

# systemd's EnvironmentFile parser keeps a trailing "# comment" as part of the value (so
# `HOST=127.0.0.1  # bind address` binds to a bogus host) and it overrides Environment= in
# the unit. So hand systemd a generated file instead of the human-edited .env: inline
# comments stripped, deploy overrides appended last (last assignment wins).
# Caveat: a value that legitimately contains " #" would be truncated — don't use one.
echo "==> generating .env.systemd"
{
  sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//' .env | grep -vE '^[[:space:]]*(#|$)'
  echo "NODE_ENV=production"
  echo "HOST=127.0.0.1"
  echo "TLS=false"
  echo "CREDS_DB_PATH=/var/lib/test-servers/creds.db"
  echo "MCP_OAUTH_JWKS_URL=http://127.0.0.1:7200/.well-known/jwks.json"
} >.env.systemd

echo "==> installing dependencies"
"${YARN[@]}" install --immutable

echo "==> building frontends (served behind nginx, same-origin API calls)"
VITE_BASE=/ VITE_CONFIG_SERVER_URL="" "${YARN[@]}" workspace admin-web build
VITE_BASE=/login/ VITE_OAUTH_SERVER_URL="" "${YARN[@]}" workspace oauth-login-web build

echo "==> building backends + packages"
"${YARN[@]}" build

echo "==> installing systemd units"
for unit in test-servers-oauth.service test-servers-mcp.service test-servers-config.service test-servers.target; do
  sed -e "s#@APP_DIR@#${APP_DIR}#g" -e "s#@USER@#${SERVICE_USER}#g" \
    "deploy/systemd/${unit}" | $SUDO tee "/etc/systemd/system/${unit}" >/dev/null
done
$SUDO systemctl daemon-reload
$SUDO systemctl enable test-servers.target
$SUDO systemctl enable --now test-servers-oauth test-servers-mcp test-servers-config
$SUDO systemctl restart test-servers-oauth test-servers-mcp test-servers-config

echo "==> installing nginx site"
if [ -d /etc/nginx/sites-available ]; then
  NGINX_DIR=/etc/nginx/sites-available
else
  NGINX_DIR=/etc/nginx/conf.d
fi
LOCATIONS="${NGINX_DIR}/test-servers-locations.inc"
sed "s#@APP_DIR@#${APP_DIR}#g" deploy/nginx/test-servers-locations.inc | $SUDO tee "$LOCATIONS" >/dev/null

if [ -n "$TLS_CERT" ]; then
  REDIRECT_HOST='$host'
  [ "$HTTPS_PORT" = "443" ] || REDIRECT_HOST="\$host:${HTTPS_PORT}"
  sed -e "s#@HTTP_PORT@#${HTTP_PORT}#g" -e "s#@HTTPS_PORT@#${HTTPS_PORT}#g" \
    -e "s#@SERVER_NAME@#${SERVER_NAME}#g" -e "s#@TLS_CERT@#${TLS_CERT}#g" \
    -e "s#@TLS_KEY@#${TLS_KEY}#g" -e "s#@REDIRECT_HOST@#${REDIRECT_HOST}#g" \
    -e "s#@LOCATIONS@#${LOCATIONS}#g" \
    deploy/nginx/test-servers-tls.conf | $SUDO tee "${NGINX_DIR}/test-servers.conf" >/dev/null
else
  sed -e "s#@HTTP_PORT@#${HTTP_PORT}#g" -e "s#@SERVER_NAME@#${SERVER_NAME}#g" \
    -e "s#@LOCATIONS@#${LOCATIONS}#g" \
    deploy/nginx/test-servers.conf | $SUDO tee "${NGINX_DIR}/test-servers.conf" >/dev/null
fi

if [ "$NGINX_DIR" = /etc/nginx/sites-available ]; then
  $SUDO ln -sf /etc/nginx/sites-available/test-servers.conf /etc/nginx/sites-enabled/test-servers.conf
fi

# nginx serves the built SPAs straight off disk, so its worker user needs to read them.
NGINX_USER="$(awk '$1=="user"{print $2}' /etc/nginx/nginx.conf | tr -d ';' | head -1)"
if [ -n "${NGINX_USER:-}" ] && ! $SUDO -u "$NGINX_USER" test -r "$APP_DIR/apps/admin-web/dist/index.html"; then
  echo "!!! nginx user '$NGINX_USER' cannot read $APP_DIR/apps/admin-web/dist/index.html"
  echo "!!! grant traverse+read on the repo path (e.g. chmod o+rx on each parent dir)"
fi

$SUDO nginx -t
$SUDO systemctl reload nginx

echo
echo "==> done. services:"
$SUDO systemctl --no-pager --lines=0 status test-servers-oauth test-servers-mcp test-servers-config | grep -E "●|Active:" || true
echo
echo "Console:      ${PUBLIC_URL}/"
echo "OAuth token:  ${PUBLIC_URL}/oauth/token"
echo "MCP (oauth):  ${PUBLIC_URL}/mcp/oauth"
echo "Health:       ${PUBLIC_URL}/healthz/oauth  /healthz/mcp  /healthz/config"
echo "Logs:         journalctl -u test-servers-oauth -f"
