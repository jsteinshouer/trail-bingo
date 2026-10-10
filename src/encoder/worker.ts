import * as ort from "onnxruntime-web/webgpu";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import mjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import { centerCrop, toPixelValues } from "./preprocess";
import type { Backend, EncoderInfo, Request, Response } from "./protocol";
import { loadTokenizer, tokenize } from "./tokenize";
import type { Tokenizer } from "@huggingface/tokenizers";
import { lightPhotoCheck } from "../device";
import { browserModelStore, type Manifest } from "../model";

// BioCLIP in a Web Worker, as proven on the target phone by the spike (ticket 01).

// The WebGPU build of onnxruntime-web 1.30 loads the "asyncify" WebAssembly variant.
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };

/** Labels per text-encoder run, so a few hundred local species don't need one huge tensor. */
const TEXT_BATCH = 32;

/** The two halves of BioCLIP. Only one is in memory at a time: together they don't fit older phones. */
type Half = "image" | "text";

interface Model {
  manifest: Manifest;
  tokenizer: Tokenizer;
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

/**
 * Full optimization folds the fp16 weights into fp32 copies: faster checks, twice
 * the memory. Phones with little memory keep fp16 and convert as they go.
 */
const OPTIMIZATION = lightPhotoCheck((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
  ? "disabled"
  : "all";

let chosen: { backend: Backend; fallbackReason?: string } = { backend: "wasm" };
/** The half in memory now, if any. */
let loadedHalf: { half: Half; session: ort.InferenceSession } | null = null;

/**
 * The session for one half, swapping out the other first. Sightings use the
 * image half; only building a Card uses the text half, since a Card's labels
 * are encoded once and saved. If WebGPU can't run it, WebAssembly takes over.
 */
async function sessionFor({ manifest }: Model, half: Half): Promise<ort.InferenceSession> {
  if (loadedHalf?.half === half) return loadedHalf.session;
  if (loadedHalf) {
    const { session } = loadedHalf;
    loadedHalf = null;
    await session.release();
  }
  const files = manifest.files.fp16;
  const bytes = await store.read(half === "image" ? files.image : files.text);
  const create = (backend: Backend) =>
    ort.InferenceSession.create(bytes, { executionProviders: [backend], graphOptimizationLevel: OPTIMIZATION });
  let session: ort.InferenceSession;
  try {
    session = await create(chosen.backend);
  } catch (error) {
    if (chosen.backend !== "webgpu") throw error;
    chosen = { backend: "wasm", fallbackReason: `WebGPU failed: ${String(error)}` };
    session = await create("wasm");
  }
  loadedHalf = { half, session };
  return session;
}

/** Ready for Sightings: the tokenizer, and the image half in memory. */
async function load(): Promise<Model> {
  const start = performance.now();
  const manifest = await readJson<Manifest>("manifest.json");
  const [tokenizerJson, tokenizerConfig] = await Promise.all([
    readJson<object>("tokenizer.json"),
    readJson<object>("tokenizer_config.json"),
  ]);
  const model: Model = { manifest, tokenizer: loadTokenizer(tokenizerJson, tokenizerConfig) };

  post({ type: "progress", message: "Starting the photo check…" });
  chosen = await pickBackend();
  await sessionFor(model, "image");
  const info: EncoderInfo = { ...chosen, loadMs: performance.now() - start };
  post({ type: "loaded", info });
  return model;
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

async function encodeText(model: Model, labels: string[]): Promise<Float32Array[]> {
  const { manifest, tokenizer } = model;
  const { contextLength, embeddingDim } = manifest;
  const textSession = await sessionFor(model, "text");
  const vectors: Float32Array[] = [];
  for (let i = 0; i < labels.length; i += TEXT_BATCH) {
    const batch = labels.slice(i, i + TEXT_BATCH);
    const ids = tokenize(tokenizer, batch, contextLength);
    const output = await textSession.run({ input_ids: new ort.Tensor("int64", ids, [batch.length, contextLength]) });
    vectors.push(...unitVectors(output.embeddings.data as Float32Array, embeddingDim));
  }
  return vectors;
}

async function encodeImage(model: Model, image: Blob): Promise<Float32Array[]> {
  const { manifest } = model;
  const { size, mean, std } = manifest.preprocess;
  const imageSession = await sessionFor(model, "image");
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
