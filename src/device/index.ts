/**
 * Can this phone run Trail Bingo? Checked on the setup screen before the
 * ~300 MB model download, so nobody spends the data to find out it can't.
 */

/** What the browser offers, as `readDeviceFeatures` finds it. */
export interface DeviceFeatures {
  /** HTTPS: the camera, Cache API and WebGPU need it. */
  secureContext: boolean;
  /** Browser storage still free for this site, or null when the browser won't say. */
  freeStorageBytes: number | null;
  cacheApi: boolean;
  moduleWorkers: boolean;
  /** ONNX Runtime's WebAssembly build needs SIMD. */
  wasmSimd: boolean;
  camera: boolean;
  webgpu: boolean;
  /** Rough device memory, or null when the browser won't say (only Chrome tells). */
  deviceMemoryGb: number | null;
  androidChrome: boolean;
  /** Lets WebAssembly use more than one thread. */
  crossOriginIsolated: boolean;
}

export type DeviceProblemCode =
  | "insecure"
  | "no-room"
  | "no-cache-api"
  | "no-workers"
  | "no-wasm-simd"
  | "no-camera"
  | "slow-photo-check"
  | "low-memory"
  | "untested-browser"
  | "single-thread";

export interface DeviceProblem {
  code: DeviceProblemCode;
  message: string;
}

/** What it means for the player when the photo check runs without WebGPU. Said wherever it matters. */
export const SLOW_PHOTO_CHECK = "each check takes a few seconds, and building a Card can take several minutes.";

/** Whether the photo check runs on the phone's graphics chip (WebGPU) rather than its main processor. */
export const isFast = (backend: string) => backend === "webgpu";

export interface DeviceCheck {
  /** Reasons the game can't run here: the download stays off. */
  blockers: DeviceProblem[];
  /** Reasons it may run poorly: the player can go on. */
  warnings: DeviceProblem[];
}

/** The model (~300 MB), a Card's facts and photos (25–40 MB), and headroom. */
const STORAGE_NEEDED = 450e6;
/** Below this, the photo check's model (about 600 MB once loaded) may not fit alongside the browser. */
const MEMORY_RECOMMENDED_GB = 4;

const mb = (bytes: number) => Math.round(bytes / 1e6);

export function checkDevice(device: DeviceFeatures): DeviceCheck {
  const blockers: DeviceProblem[] = [];
  const warnings: DeviceProblem[] = [];
  const block = (code: DeviceProblemCode, message: string) => blockers.push({ code, message });
  const warn = (code: DeviceProblemCode, message: string) => warnings.push({ code, message });

  if (!device.secureContext) {
    block("insecure", "Trail Bingo has to be opened from a secure link, one starting with https, to use the camera and keep its files.");
  }
  if (device.freeStorageBytes !== null && device.freeStorageBytes < STORAGE_NEEDED) {
    block(
      "no-room",
      `There's only room for about ${mb(device.freeStorageBytes)} MB, and Trail Bingo needs about ${mb(STORAGE_NEEDED)} MB. ` +
        "Free up space on your phone, or close any private (incognito) tab, then try again.",
    );
  }
  if (!device.cacheApi) block("no-cache-api", "This browser can't store the photo check's files. Try a recent Chrome.");
  if (!device.moduleWorkers) block("no-workers", "This browser can't run the photo check in the background. Try a recent Chrome.");
  if (!device.wasmSimd) block("no-wasm-simd", "This browser can't run the photo check's model. Try a recent Chrome.");
  if (!device.camera) block("no-camera", "This browser can't use a camera, and every Sighting is a photo.");

  if (!device.webgpu) {
    warn("slow-photo-check", `The photo check will run more slowly on this phone: ${SLOW_PHOTO_CHECK}`);
  }
  if (device.deviceMemoryGb !== null && device.deviceMemoryGb < MEMORY_RECOMMENDED_GB) {
    warn("low-memory", "This phone has little memory, so the photo check may close the app. Close other apps before a hike.");
  }
  if (!device.androidChrome) warn("untested-browser", "Trail Bingo is made for Chrome on Android, so some things may not work here.");
  if (!device.crossOriginIsolated) {
    warn("single-thread", "This browser won't let the photo check use all of the phone's power, so it may be slower.");
  }

  return { blockers, warnings };
}

/** The smallest WebAssembly module using a SIMD instruction (as in wasm-feature-detect). */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

/** Module workers read the `type` option; older browsers never ask for it. */
function supportsModuleWorkers(): boolean {
  let asked = false;
  try {
    const options = {
      get type() {
        asked = true;
        return "module" as const;
      },
    };
    new Worker("data:,", options).terminate();
  } catch {
    // Some browsers refuse a data: worker after reading the options; asking was enough.
  }
  return asked;
}

/** What this browser offers. */
export async function readDeviceFeatures(): Promise<DeviceFeatures> {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
  const agent = navigator.userAgent;
  return {
    secureContext: isSecureContext,
    freeStorageBytes: estimate?.quota !== undefined ? estimate.quota - (estimate.usage ?? 0) : null,
    cacheApi: "caches" in self,
    moduleWorkers: typeof Worker !== "undefined" && supportsModuleWorkers(),
    wasmSimd: typeof WebAssembly !== "undefined" && WebAssembly.validate(SIMD_PROBE),
    camera: Boolean(navigator.mediaDevices?.getUserMedia),
    webgpu: Boolean(adapter),
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    androidChrome: /Android/.test(agent) && /Chrome\//.test(agent),
    crossOriginIsolated,
  };
}
