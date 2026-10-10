import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Cross-origin isolation lets onnxruntime-web use multi-threaded WebAssembly when WebGPU isn't available.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

/** Files from `public/` that belong to the app shell. The model in `public/models/` doesn't: the setup screen stores it. */
const PUBLIC_SHELL = ["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];

/**
 * Builds the service worker as `sw.js` and tells it the app shell: every
 * built file plus the public shell files, and a version that changes when any
 * of them do, so a new build replaces the old shell.
 */
function appShell(): Plugin {
  return {
    name: "trail-bingo-app-shell",
    apply: "build",
    generateBundle(_, bundle) {
      const sw = bundle["sw.js"];
      if (sw?.type !== "chunk") throw new Error("The service worker wasn't built as sw.js");
      const built = Object.keys(bundle).filter((file) => file !== "sw.js").sort();
      const shell = ["./", ...built, ...PUBLIC_SHELL];
      // Built files are named by content hash; public ones are hashed here.
      const version = createHash("sha256")
        .update(built.join("\n"))
        .update(Buffer.concat(PUBLIC_SHELL.map((file) => readFileSync(`public/${file}`))))
        .digest("hex")
        .slice(0, 12);
      sw.code = sw.code.replaceAll("__SHELL_FILES__", JSON.stringify(shell)).replaceAll("__SHELL_VERSION__", JSON.stringify(version));
    },
  };
}

export default defineConfig({
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  plugins: [appShell()],
  build: {
    rollupOptions: {
      input: { main: "index.html", sw: "src/offline/service-worker.ts" },
      output: { entryFileNames: (chunk) => (chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js") },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
