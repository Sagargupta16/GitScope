import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

function spa404(): Plugin {
  let outDir = "";
  return {
    name: "spa-404",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
      const sha = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
      writeFileSync(resolve(outDir, "release.json"), JSON.stringify({ sha }));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spa404()],
  base: "/GitScope/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
