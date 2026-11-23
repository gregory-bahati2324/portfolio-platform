
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true },
      "/sitemap.xml": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true },
      "/robots.txt": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true },
      "/_meta": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true },
      "/media": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true },
    },
  },
  test: { environment: "jsdom", globals: true },
});
