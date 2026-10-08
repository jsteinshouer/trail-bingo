import type { Ranked } from "./rank";

export type Precision = "fp16" | "fp32";
export type BackendChoice = "auto" | "webgpu" | "wasm";
export type Backend = "webgpu" | "wasm";
export type Optimization = "all" | "basic" | "disabled";

export type Request =
  | { type: "load"; precision: Precision; backend: BackendChoice; optimization: Optimization }
  | { type: "check"; id: number; image: Blob };

export interface FileTiming {
  file: string;
  megabytes: number;
  fromCache: boolean;
  cacheError?: string;
  ms: number;
}

export interface LoadStats {
  backend: Backend;
  fallbackReason?: string;
  gpu?: string;
  shaderF16?: boolean;
  wasmThreads: number;
  crossOriginIsolated: boolean;
  files: FileTiming[];
  sessionMs: number;
  labelEncodeMs: number;
  totalMs: number;
}

export interface CheckResult {
  id: number;
  ranked: Ranked[];
  preprocessMs: number;
  inferenceMs: number;
}

export type Response =
  | { type: "progress"; message: string }
  | { type: "loaded"; stats: LoadStats }
  | { type: "checked"; result: CheckResult }
  | { type: "error"; message: string; id?: number };
