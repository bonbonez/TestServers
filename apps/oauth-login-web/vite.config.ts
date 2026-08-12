import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

const OAUTH_SERVER_TARGET =
  process.env.VITE_OAUTH_SERVER_TARGET || "https://localhost:7200";

// Self-contained bundle only — no external asset/CDN requests (see README safety banner).
// Served over HTTPS (self-signed, via basic-ssl); the consent POST goes through a
// same-origin `/oauth` proxy so there is no cross-origin self-signed cert to accept.
export default defineConfig({
  // Served at the site root by default; set VITE_BASE=/login/ when deploying under nginx.
  base: process.env.VITE_BASE || "/",
  plugins: [react(), basicSsl()],
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
