# Shared location blocks for the Test Servers vhost — included from the server block(s) in
# test-servers.conf (plain HTTP) or test-servers-tls.conf (HTTPS + redirect).
#
# @APP_DIR@ is replaced by deploy/install.sh with the absolute repo path on the VM.

# --- admin credentials console (SPA at the site root) ---
root @APP_DIR@/apps/admin-web/dist;
index index.html;

# --- DEV login / consent SPA (built with VITE_BASE=/login/) ---
# Without this, a bare /login falls through to the admin console's SPA fallback below and
# renders a blank page. $is_args$args keeps the ?client_id=…&state=… query intact.
location = /login {
    return 301 /login/$is_args$args;
}

location /login/ {
    alias @APP_DIR@/apps/oauth-login-web/dist/;
    index index.html;
    try_files $uri $uri/ /login/index.html;
}

# --- config-server: admin API over the credential store ---
location /api/ {
    proxy_pass http://127.0.0.1:7300;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# --- oauth-server: authorization server + protected resource API ---
location /oauth/       { proxy_pass http://127.0.0.1:7200; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
location = /userinfo   { proxy_pass http://127.0.0.1:7200; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
location /resource/    { proxy_pass http://127.0.0.1:7200; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
location /.well-known/ { proxy_pass http://127.0.0.1:7200; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }

# --- mcp-server: MCP Streamable HTTP (supports SSE, so disable buffering) ---
location /mcp/ {
    proxy_pass http://127.0.0.1:7100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}

# --- per-service health checks (handy for smoke tests / monitoring) ---
location = /healthz/oauth  { proxy_pass http://127.0.0.1:7200/healthz; }
location = /healthz/mcp    { proxy_pass http://127.0.0.1:7100/healthz; }
location = /healthz/config { proxy_pass http://127.0.0.1:7300/healthz; }

# --- admin console SPA fallback ---
location / {
    try_files $uri $uri/ /index.html;
}
