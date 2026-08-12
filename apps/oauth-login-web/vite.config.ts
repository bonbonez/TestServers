import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Self-contained bundle only — no external asset/CDN requests (see README safety banner).
export default defineConfig({
  // Served at the site root by default; set VITE_BASE=/login/ when deploying under nginx.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    port: 7201,
    strictPort: true,
  },
  preview: {
    port: 7201,
    strictPort: true,
  },
});
