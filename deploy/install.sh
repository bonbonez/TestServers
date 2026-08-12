#!/usr/bin/env bash
#
# One-shot installer for hosting the Test Servers on a VM with systemd + nginx.
#
# ⚠️ DUMMY test servers — no TLS/auth by default. Keep this on an internal network only.
#
# Usage (from anywhere):
#   PUBLIC_URL=http://test-servers.internal SERVICE_USER=deploy ./deploy/install.sh
#
# Env:
#   PUBLIC_URL    Public origin clients use (default: http://localhost). Written into .env
#                 as OAUTH_ISSUER and OAUTH_LOGIN_WEB_URL=<PUBLIC_URL>/login.
#   SERVICE_USER  User the systemd services run as (default: the invoking user).
#   APP_DIR       Repo location on the VM (default: this repo's path).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
PUBLIC_URL="${PUBLIC_URL:-http://localhost}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-$USER}}"
SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

cd "$APP_DIR"
echo "==> repo:        $APP_DIR"
echo "==> public URL:  $PUBLIC_URL"
echo "==> run as user: $SERVICE_USER"

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

echo "==> installing dependencies"
corepack enable
corepack yarn install --immutable

echo "==> building frontends (served behind nginx, same-origin API calls)"
VITE_BASE=/ VITE_CONFIG_SERVER_URL="" corepack yarn workspace admin-web build
VITE_BASE=/login/ VITE_OAUTH_SERVER_URL="" corepack yarn workspace oauth-login-web build

echo "==> building backends + packages"
corepack yarn build

echo "==> installing systemd units"
for unit in test-servers-oauth.service test-servers-mcp.service test-servers-config.service test-servers.target; do
  sed -e "s#@APP_DIR@#${APP_DIR}#g" -e "s#@USER@#${SERVICE_USER}#g" \
    "deploy/systemd/${unit}" | $SUDO tee "/etc/systemd/system/${unit}" >/dev/null
done
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now test-servers-oauth test-servers-mcp test-servers-config

echo "==> installing nginx site"
if [ -d /etc/nginx/sites-available ]; then
  sed "s#@APP_DIR@#${APP_DIR}#g" deploy/nginx/test-servers.conf | $SUDO tee /etc/nginx/sites-available/test-servers.conf >/dev/null
  $SUDO ln -sf /etc/nginx/sites-available/test-servers.conf /etc/nginx/sites-enabled/test-servers.conf
else
  sed "s#@APP_DIR@#${APP_DIR}#g" deploy/nginx/test-servers.conf | $SUDO tee /etc/nginx/conf.d/test-servers.conf >/dev/null
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
echo "Logs:         journalctl -u test-servers-oauth -f"
