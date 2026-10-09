/** Messages between the page and the encoder worker. */

export type Backend = "webgpu" | "wasm";

export interface EncoderInfo {
  backend: Backend;
  /** Why WebGPU wasn't used, when it wasn't. */
  fallbackReason?: string;
  loadMs: number;
}

export type Request =
  | { type: "encode-text"; id: number; labels: string[] }
  | { type: "encode-image"; id: number; image: Blob };

export type Response =
  | { type: "progress"; message: string }
  | { type: "loaded"; info: EncoderInfo }
  | { type: "load-failed"; message: string }
  | { type: "vectors"; id: number; vectors: Float32Array[] }
  | { type: "error"; id: number; message: string };
