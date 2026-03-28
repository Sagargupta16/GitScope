const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");

const distDir = path.join(__dirname, "dist");

// Clean and create dist
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

// Copy static files
const staticFiles = ["manifest.json", "css/insights.css", "html/popup.html"];
const staticDirs = ["icons"];

for (const file of staticFiles) {
  const dest = path.join(distDir, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "src", file), dest);
}

for (const dir of staticDirs) {
  const srcDir = path.join(__dirname, "src", dir);
  const destDir = path.join(distDir, dir);
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

// Bundle JS entry points
const entryPoints = {
  "js/content": "src/js/content.js",
  "js/auth-callback": "src/js/auth-callback.js",
  "js/popup": "src/js/popup.js",
};

const buildOptions = {
  entryPoints: Object.entries(entryPoints).map(([out, entry]) => ({
    in: entry,
    out: out,
  })),
  bundle: true,
  outdir: distDir,
  format: "iife",
  target: ["chrome120"],
  minify: !isWatch,
  sourcemap: isWatch,
};

async function run() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(buildOptions);
    console.log("Build complete -> dist/");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
