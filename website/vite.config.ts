import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

function spa404(): Plugin {
  return {
    name: "spa-404",
    closeBundle() {
      const outDir = resolve(__dirname, "../docs");
      copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
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
