const { buildSync } = require("esbuild");
const { createRequire } = require("node:module");
const path = require("node:path");
const vm = require("node:vm");

function loadModule(relativePath, globals = {}) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const { outputFiles } = buildSync({
    entryPoints: [filename],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    logLevel: "silent",
  });
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require: createRequire(filename),
    console,
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    crypto: globalThis.crypto,
    btoa,
    atob,
    fetch: globalThis.fetch,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    ...globals,
  };
  vm.runInNewContext(outputFiles[0].text, context, { filename });
  return module.exports;
}

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
  };
}

module.exports = { loadModule, memoryStorage };
