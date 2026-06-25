import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev we proxy /api → the local BFF so the browser talks to one origin.
// In prod the static site is configured with VITE_BFF_URL pointing at the BFF.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.BFF_PROXY_TARGET || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
