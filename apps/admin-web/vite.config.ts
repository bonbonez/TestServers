import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

const CONFIG_SERVER_TARGET =
  process.env.VITE_CONFIG_SERVER_TARGET || "https://localhost:7300";

// The console is served over HTTPS (self-signed, via basic-ssl) and talks to config-server
// through a same-origin `/api` proxy, so there is no mixed-content or CORS to worry about.
export default defineConfig({
  // Served at the site root by default; override with VITE_BASE when deploying under a path.
  base: process.env.VITE_BASE || "/",
  plugins: [react(), basicSsl()],
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
