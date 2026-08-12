import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// TLS=false serves plain HTTP (matches the backends' TLS switch); default is HTTPS.
const useTls = process.env.TLS !== "false";
const OAUTH_SERVER_TARGET =
  process.env.VITE_OAUTH_SERVER_TARGET ||
  (useTls ? "https://localhost:7200" : "http://127.0.0.1:7200");

// Self-contained bundle only — no external asset/CDN requests (see README safety banner).
// The consent POST goes through a same-origin `/oauth` proxy, so there is no cross-origin
// certificate to accept.
export default defineConfig({
  // Served at the site root by default; set VITE_BASE=/login/ when deploying under nginx.
  base: process.env.VITE_BASE || "/",
  plugins: [react(), ...(useTls ? [basicSsl()] : [])],
  server: {
    port: 7201,
    strictPort: true,
    proxy: {
      "/oauth": {
        target: OAUTH_SERVER_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 7201,
    strictPort: true,
  },
});
