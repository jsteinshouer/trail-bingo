import { defineConfig } from "vite";

// Cross-origin isolation lets onnxruntime-web use multi-threaded WebAssembly.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  server: { headers: isolation, allowedHosts: true },
  preview: { headers: isolation, allowedHosts: true },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
});
