import { copyFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const pages = process.env.GITHUB_PAGES === "true";

function staticAssetsPlugin(): Plugin {
  const licenseSrc = resolve(root, "../../LICENSE");
  const licenseDest = resolve(root, "public/LICENSE");
  return {
    name: "hex-static-assets",
    buildStart() {
      copyFileSync(licenseSrc, licenseDest);
    },
    closeBundle() {
      const dist = resolve(root, "dist/index.html");
      const notFound = resolve(root, "dist/404.html");
      try {
        copyFileSync(dist, notFound);
      } catch {
        /* dist may not exist during typecheck */
      }
    },
    configureServer(server) {
      server.middlewares.use("/LICENSE", (_req, res, next) => {
        try {
          copyFileSync(licenseSrc, licenseDest);
        } catch {
          next();
          return;
        }
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end(readFileSync(licenseSrc));
      });
    },
  };
}

export default defineConfig({
  base: pages ? "/Hexwebmap/" : "/",
  plugins: [react(), staticAssetsPlugin()],
  resolve: {
    alias: {
      "@hexwebmap/shared": resolve(root, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
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
