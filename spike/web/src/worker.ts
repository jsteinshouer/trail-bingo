/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/webgpu";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import mjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import { centerSquare, toPixelValues } from "./preprocess";
import type { Backend, FileTiming, LoadStats, Optimization, Request, Response } from "./protocol";
import { rank } from "./rank";
import { loadTokenizer, tokenize } from "./tokenize";

// The WebGPU build of onnxruntime-web 1.30 loads the "asyncify" WebAssembly variant.
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };

interface Manifest {
  embeddingDim: number;
  logitScale: number;
  contextLength: number;
  preprocess: { size: number; mean: number[]; std: number[] };
  files: Record<string, { image: string; text: string }>;
}

const MODELS = new URL("models/", new URL(import.meta.env.BASE_URL, self.location.origin));
const CACHE = "bioclip-spike-v1";

let state: {
  manifest: Manifest;
  image: ort.InferenceSession;
  labelVectors: Float32Array;
} | undefined;

const post = (message: Response) => self.postMessage(message);

/** Fetch through the Cache API so a second load measures reading from the phone, not the network. */
async function fetchCached(name: string): Promise<{ bytes: ArrayBuffer; timing: FileTiming }> {
  const start = performance.now();
  const url = new URL(name, MODELS).href;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(url);
  let bytes: ArrayBuffer;
  let cacheError: string | undefined;
  if (cached) {
    bytes = await cached.arrayBuffer();
  } else {
    post({ type: "progress", message: `Downloading ${name}…` });
    const fresh = await fetch(url);
    if (!fresh.ok) throw new Error(`${name}: HTTP ${fresh.status}`);
    bytes = await fresh.arrayBuffer();
    // A full cache only costs us the next load's speed; the model still runs from memory.
    try {
      await cache.put(url, new Response(bytes));
    } catch (error) {
      cacheError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    bytes,
    timing: {
      file: name,
      megabytes: bytes.byteLength / 1e6,
      fromCache: Boolean(cached),
      cacheError,
      ms: performance.now() - start,
    },
  };
}

async function fetchJson<T>(name: string): Promise<T> {
  const response = await fetch(new URL(name, MODELS));
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

async function pickBackend(choice: Request & { type: "load" }): Promise<{
  backend: Backend;
  fallbackReason?: string;
  gpu?: string;
  shaderF16?: boolean;
}> {
  if (choice.backend === "wasm") return { backend: "wasm" };
  if (!("gpu" in navigator)) return { backend: "wasm", fallbackReason: "navigator.gpu not available" };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { backend: "wasm", fallbackReason: "no WebGPU adapter" };
  const info = adapter.info;
  return {
    backend: "webgpu",
    gpu: [info.vendor, info.architecture, info.description].filter(Boolean).join(" ") || "unknown",
    shaderF16: adapter.features.has("shader-f16"),
  };
}

async function createSession(bytes: ArrayBuffer, backend: Backend, optimization: Optimization) {
  return ort.InferenceSession.create(new Uint8Array(bytes), {
    executionProviders: [backend],
    graphOptimizationLevel: optimization,
  });
}

async function load(request: Request & { type: "load" }) {
  const totalStart = performance.now();
  const manifest = await fetchJson<Manifest>("manifest.json");
  const files = manifest.files[request.precision];
  const [tokenizerJson, tokenizerConfig, labels] = await Promise.all([
    fetchJson<object>("tokenizer.json"),
    fetchJson<object>("tokenizer_config.json"),
    fetchJson<{ prompt: string }[]>("labels.json"),
  ]);

  const image = await fetchCached(files.image);
  const text = await fetchCached(files.text);

  let chosen = await pickBackend(request);
  post({ type: "progress", message: `Creating sessions on ${chosen.backend}…` });
  const sessionStart = performance.now();
  let imageSession: ort.InferenceSession;
  let textSession: ort.InferenceSession;
  try {
    imageSession = await createSession(image.bytes, chosen.backend, request.optimization);
    textSession = await createSession(text.bytes, chosen.backend, request.optimization);
  } catch (error) {
    if (chosen.backend !== "webgpu" || request.backend === "webgpu") throw error;
    chosen = { backend: "wasm", fallbackReason: `WebGPU session failed: ${String(error)}` };
    imageSession = await createSession(image.bytes, "wasm", request.optimization);
    textSession = await createSession(text.bytes, "wasm", request.optimization);
  }
  const sessionMs = performance.now() - sessionStart;

  post({ type: "progress", message: "Encoding labels…" });
  const labelStart = performance.now();
  const tokenizer = loadTokenizer(tokenizerJson, tokenizerConfig);
  const ids = tokenize(tokenizer, labels.map((l) => l.prompt), manifest.contextLength);
  const input = new ort.Tensor("int64", ids, [labels.length, manifest.contextLength]);
  const output = await textSession.run({ input_ids: input });
  const labelVectors = new Float32Array(output.embeddings.data as Float32Array);
  const labelEncodeMs = performance.now() - labelStart;
  // The text encoder is only needed while building a Card; free it like the real app would.
  await textSession.release();

  state = { manifest, image: imageSession, labelVectors };
  const stats: LoadStats = {
    ...chosen,
    wasmThreads: ort.env.wasm.numThreads ?? 1,
    crossOriginIsolated: self.crossOriginIsolated,
    files: [image.timing, text.timing],
    sessionMs,
    labelEncodeMs,
    totalMs: performance.now() - totalStart,
  };
  post({ type: "loaded", stats });
}

async function check(request: Request & { type: "check" }) {
  if (!state) throw new Error("model not loaded");
  const { manifest, image, labelVectors } = state;
  const { size, mean, std } = manifest.preprocess;

  const preprocessStart = performance.now();
  const bitmap = await createImageBitmap(request.image);
  const square = centerSquare(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("no 2D canvas context");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, square.x, square.y, square.side, square.side, 0, 0, size, size);
  bitmap.close();
  const pixels = toPixelValues(context.getImageData(0, 0, size, size).data, size, size, mean, std);
  const preprocessMs = performance.now() - preprocessStart;

  const inferenceStart = performance.now();
  const output = await image.run({
    pixel_values: new ort.Tensor("float32", pixels, [1, 3, size, size]),
  });
  const photo = new Float32Array(output.embeddings.data as Float32Array);
  const inferenceMs = performance.now() - inferenceStart;

  post({
    type: "checked",
    result: {
      id: request.id,
      ranked: rank(photo, labelVectors, manifest.embeddingDim, manifest.logitScale),
      preprocessMs,
      inferenceMs,
    },
  });
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === "load") await load(request);
    else await check(request);
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      id: request.type === "check" ? request.id : undefined,
    });
  }
};
