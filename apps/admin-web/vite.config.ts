import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// TLS=false serves plain HTTP (matches the backends' TLS switch); default is HTTPS.
const useTls = process.env.TLS !== "false";
const CONFIG_SERVER_TARGET =
  process.env.VITE_CONFIG_SERVER_TARGET ||
  (useTls ? "https://localhost:7300" : "http://127.0.0.1:7300");

// The console talks to config-server through a same-origin `/api` proxy, so there is no
// mixed content or CORS to worry about whichever scheme is in use.
export default defineConfig({
  // Served at the site root by default; override with VITE_BASE when deploying under a path.
  base: process.env.VITE_BASE || "/",
  plugins: [react(), ...(useTls ? [basicSsl()] : [])],
  server: {
    port: 7301,
    strictPort: true,
    proxy: {
      "/api": {
        target: CONFIG_SERVER_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 7301,
    strictPort: true,
  },
});
