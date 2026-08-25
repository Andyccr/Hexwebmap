import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

function licensePlugin(): Plugin {
  return {
    name: "hex-license",
    configureServer(server) {
      server.middlewares.use("/LICENSE", async (_req, res) => {
        const text = await readFile(resolve(root, "../../LICENSE"));
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end(text);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), licensePlugin()],
  resolve: {
    alias: {
      "@hexwebmap/shared": resolve(root, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
        },
      },
    },
  },
});
