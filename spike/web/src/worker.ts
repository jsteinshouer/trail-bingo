/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/webgpu";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import mjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import { centerCrop, toPixelValues } from "./preprocess";
import { MODEL_CACHE } from "./protocol";
import type { Backend, BackendChoice, BackendInfo, FileTiming, LoadStats, Optimization, Request, Response } from "./protocol";
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

let state: {
  manifest: Manifest;
  imageSession: ort.InferenceSession;
  labelVectors: Float32Array;
} | undefined;

const post = (message: Response) => self.postMessage(message);

/** Fetch through the Cache API so a second load measures reading from the phone, not the network. */
async function fetchCached(name: string): Promise<{ bytes: ArrayBuffer; timing: FileTiming }> {
  const start = performance.now();
  const url = new URL(name, MODELS).href;
  const cache = await caches.open(MODEL_CACHE);
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

/** Choose a backend. "WebGPU only" fails loudly instead of falling back, so a test of WebGPU means WebGPU. */
async function pickBackend(choice: BackendChoice): Promise<BackendInfo> {
  if (choice === "wasm") return { backend: "wasm" };
  const unavailable = (reason: string): BackendInfo => {
    if (choice === "webgpu") throw new Error(`WebGPU unavailable: ${reason}`);
    return { backend: "wasm", fallbackReason: reason };
  };
  if (!("gpu" in navigator)) return unavailable("navigator.gpu not available");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return unavailable("no WebGPU adapter");
  const info = adapter.info;
  return {
    backend: "webgpu",
    gpu: [info.vendor, info.architecture, info.description].filter(Boolean).join(" ") || "unknown",
    shaderF16: adapter.features.has("shader-f16"),
  };
}

/** Create both sessions on one backend; if the second fails, release the first so nothing leaks. */
async function createSessions(
  imageBytes: ArrayBuffer,
  textBytes: ArrayBuffer,
  backend: Backend,
  optimization: Optimization,
) {
  const options = { executionProviders: [backend], graphOptimizationLevel: optimization };
  const imageSession = await ort.InferenceSession.create(new Uint8Array(imageBytes), options);
  try {
    const textSession = await ort.InferenceSession.create(new Uint8Array(textBytes), options);
    return { imageSession, textSession };
  } catch (error) {
    await imageSession.release();
    throw error;
  }
}

async function load(request: Request & { type: "load" }) {
  // Loading again in the same tab (e.g. to time a cached load) must not keep the old model in memory.
  if (state) {
    await state.imageSession.release();
    state = undefined;
  }
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

  let chosen = await pickBackend(request.backend);
  post({ type: "progress", message: `Creating sessions on ${chosen.backend}…` });
  const sessionStart = performance.now();
  let sessions;
  try {
    sessions = await createSessions(image.bytes, text.bytes, chosen.backend, request.optimization);
  } catch (error) {
    if (chosen.backend !== "webgpu" || request.backend === "webgpu") throw error;
    chosen = { backend: "wasm", fallbackReason: `WebGPU session failed: ${String(error)}` };
    sessions = await createSessions(image.bytes, text.bytes, "wasm", request.optimization);
  }
  const { imageSession, textSession } = sessions;
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

  state = { manifest, imageSession, labelVectors };
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
  const { manifest, imageSession, labelVectors } = state;
  const { size, mean, std } = manifest.preprocess;

  const preprocessStart = performance.now();
  const bitmap = await createImageBitmap(request.image);
  const crop = centerCrop(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("no 2D canvas context");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, crop.x, crop.y, crop.side, crop.side, 0, 0, size, size);
  bitmap.close();
  const pixels = toPixelValues(context.getImageData(0, 0, size, size).data, size, size, mean, std);
  const preprocessMs = performance.now() - preprocessStart;

  const inferenceStart = performance.now();
  const output = await imageSession.run({
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
