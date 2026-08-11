import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
