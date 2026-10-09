import * as ort from "onnxruntime-web/webgpu";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import mjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import { centerCrop, toPixelValues } from "./preprocess";
import type { Backend, EncoderInfo, Request, Response } from "./protocol";
import { loadTokenizer, tokenize } from "./tokenize";
import type { Tokenizer } from "@huggingface/tokenizers";
import { browserModelStore, type Manifest } from "../model";

// BioCLIP in a Web Worker, as proven on the target phone by the spike (ticket 01).

// The WebGPU build of onnxruntime-web 1.30 loads the "asyncify" WebAssembly variant.
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };

/** Labels per text-encoder run, so a few hundred local species don't need one huge tensor. */
const TEXT_BATCH = 32;

interface Model {
  manifest: Manifest;
  tokenizer: Tokenizer;
  imageSession: ort.InferenceSession;
  textSession: ort.InferenceSession;
}

const post = (message: Response, transfer: Transferable[] = []) => self.postMessage(message, { transfer });

/** The model was downloaded at first launch; the photo check only ever reads it from browser storage. */
const store = browserModelStore();
const readJson = async <T>(name: string): Promise<T> => JSON.parse(new TextDecoder().decode(await store.read(name)));

/** WebGPU when the browser has a usable adapter, otherwise WebAssembly. */
async function pickBackend(): Promise<{ backend: Backend; fallbackReason?: string }> {
  if (!("gpu" in navigator)) return { backend: "wasm", fallbackReason: "WebGPU isn't available" };
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (!adapter) return { backend: "wasm", fallbackReason: "no WebGPU adapter" };
  return { backend: "webgpu" };
}

async function createSessions(image: Uint8Array, text: Uint8Array, backend: Backend) {
  const options = { executionProviders: [backend], graphOptimizationLevel: "all" as const };
  const imageSession = await ort.InferenceSession.create(image, options);
  try {
    return { imageSession, textSession: await ort.InferenceSession.create(text, options) };
  } catch (error) {
    await imageSession.release();
    throw error;
  }
}

async function load(): Promise<Model> {
  const start = performance.now();
  const manifest = await readJson<Manifest>("manifest.json");
  const files = manifest.files.fp16;
  const [tokenizerJson, tokenizerConfig] = await Promise.all([
    readJson<object>("tokenizer.json"),
    readJson<object>("tokenizer_config.json"),
  ]);
  const image = await store.read(files.image);
  const text = await store.read(files.text);

  post({ type: "progress", message: "Starting the photo check…" });
  let chosen = await pickBackend();
  let sessions;
  try {
    sessions = await createSessions(image, text, chosen.backend);
  } catch (error) {
    if (chosen.backend !== "webgpu") throw error;
    chosen = { backend: "wasm", fallbackReason: `WebGPU failed: ${String(error)}` };
    sessions = await createSessions(image, text, "wasm");
  }
  const info: EncoderInfo = { ...chosen, loadMs: performance.now() - start };
  post({ type: "loaded", info });
  return { manifest, tokenizer: loadTokenizer(tokenizerJson, tokenizerConfig), ...sessions };
}

/**
 * Splits a run's output into one L2-normalized vector per row. The exported
 * encoders already normalize; doing it again keeps the promise either way.
 */
function unitVectors(data: Float32Array, dim: number): Float32Array[] {
  return Array.from({ length: data.length / dim }, (_, i) => {
    const v = data.slice(i * dim, (i + 1) * dim);
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  });
}

async function encodeText({ manifest, tokenizer, textSession }: Model, labels: string[]): Promise<Float32Array[]> {
  const { contextLength, embeddingDim } = manifest;
  const vectors: Float32Array[] = [];
  for (let i = 0; i < labels.length; i += TEXT_BATCH) {
    const batch = labels.slice(i, i + TEXT_BATCH);
    const ids = tokenize(tokenizer, batch, contextLength);
    const output = await textSession.run({ input_ids: new ort.Tensor("int64", ids, [batch.length, contextLength]) });
    vectors.push(...unitVectors(output.embeddings.data as Float32Array, embeddingDim));
  }
  return vectors;
}

async function encodeImage({ manifest, imageSession }: Model, image: Blob): Promise<Float32Array[]> {
  const { size, mean, std } = manifest.preprocess;
  const bitmap = await createImageBitmap(image);
  const crop = centerCrop(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D canvas context");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, crop.x, crop.y, crop.side, crop.side, 0, 0, size, size);
  bitmap.close();
  const pixels = toPixelValues(context.getImageData(0, 0, size, size).data, size, size, mean, std);
  const output = await imageSession.run({ pixel_values: new ort.Tensor("float32", pixels, [1, 3, size, size]) });
  return unitVectors(output.embeddings.data as Float32Array, manifest.embeddingDim);
}

const model = load();
model.catch((error) => post({ type: "load-failed", message: error instanceof Error ? error.message : String(error) }));

// One run at a time: requests wait for the model, then for each other.
let queue: Promise<unknown> = model;

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  queue = queue
    .catch(() => {})
    .then(async () => {
      const loaded = await model;
      const vectors =
        request.type === "encode-text" ? await encodeText(loaded, request.labels) : await encodeImage(loaded, request.image);
      post({ type: "vectors", id: request.id, vectors }, vectors.map((v) => v.buffer));
    })
    .catch((error) => post({ type: "error", id: request.id, message: error instanceof Error ? error.message : String(error) }));
};
