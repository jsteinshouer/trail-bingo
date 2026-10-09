import { defineConfig } from "vitest/config";

// Cross-origin isolation lets onnxruntime-web use multi-threaded WebAssembly when WebGPU isn't available.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  test: { include: ["src/**/*.test.ts"] },
});
