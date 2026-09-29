import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Carimba o `sw.js` com a versão do build. Sem isto o service worker nunca mudaria de bytes, o
 * navegador nunca instalaria o novo, e o app instalado ficaria servindo o cache do primeiro deploy.
 */
function stampServiceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "gr-stamp-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, "sw.js");
      try {
        const source = readFileSync(file, "utf8");
        writeFileSync(file, source.replaceAll("__BUILD_VERSION__", Date.now().toString(36)));
      } catch {
        // Sem `public/sw.js` não há o que carimbar.
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [stampServiceWorker()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
