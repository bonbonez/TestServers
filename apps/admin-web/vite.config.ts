import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served at the site root by default; override with VITE_BASE when deploying under a path.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    port: 7301,
    strictPort: true,
  },
  preview: {
    port: 7301,
    strictPort: true,
  },
});
