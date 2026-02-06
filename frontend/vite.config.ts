import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BACKEND = "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/auth": { target: BACKEND, changeOrigin: true },

      "/graph": { target: BACKEND, changeOrigin: true },
      "/nodes": { target: BACKEND, changeOrigin: true },
      "/edges": { target: BACKEND, changeOrigin: true },
      "/schema": { target: BACKEND, changeOrigin: true },
      "/query": { target: BACKEND, changeOrigin: true },
      "/search": { target: BACKEND, changeOrigin: true },

      "/imports": { target: BACKEND, changeOrigin: true },
      "/claims": { target: BACKEND, changeOrigin: true },
      "/node-claims": { target: BACKEND, changeOrigin: true },

      "/audit": { target: BACKEND, changeOrigin: true },

      "/export": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("connection", "close");
          });

          proxy.on("error", (err, _req, _res) => {
            console.error("[vite proxy] /export error", err?.message || err);
          });
        },
      },
    },
  },
});
