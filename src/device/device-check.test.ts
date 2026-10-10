import { describe, expect, it } from "vitest";
import { checkDevice, type DeviceFeatures } from "./index";

/** A phone that has everything: Chrome on Android with WebGPU and plenty of room. */
const GOOD: DeviceFeatures = {
  secureContext: true,
  freeStorageBytes: 5e9,
  cacheApi: true,
  moduleWorkers: true,
  wasmSimd: true,
  camera: true,
  webgpu: true,
  deviceMemoryGb: 8,
  androidChrome: true,
  crossOriginIsolated: true,
};

const codes = (problems: { code: string }[]) => problems.map((p) => p.code);

describe("the first-launch device check", () => {
  it("passes a phone that has everything", () => {
    expect(checkDevice(GOOD)).toEqual({ blockers: [], warnings: [] });
  });

  it.each([
    ["secureContext", false, "insecure"],
    ["cacheApi", false, "no-cache-api"],
    ["moduleWorkers", false, "no-workers"],
    ["wasmSimd", false, "no-wasm-simd"],
    ["camera", false, "no-camera"],
  ] as const)("blocks the download without %s", (feature, value, code) => {
    const { blockers, warnings } = checkDevice({ ...GOOD, [feature]: value });

    expect(codes(blockers)).toEqual([code]);
    expect(warnings).toEqual([]);
  });

  it("blocks the download when there isn't room for the model and a Card", () => {
    expect(codes(checkDevice({ ...GOOD, freeStorageBytes: 300e6 }).blockers)).toEqual(["no-room"]);
    expect(checkDevice({ ...GOOD, freeStorageBytes: 460e6 }).blockers).toEqual([]);
  });

  it("doesn't block when the browser won't say how much room there is", () => {
    expect(checkDevice({ ...GOOD, freeStorageBytes: null }).blockers).toEqual([]);
  });

  it.each([
    ["webgpu", false, "slow-photo-check"],
    ["androidChrome", false, "untested-browser"],
    ["crossOriginIsolated", false, "single-thread"],
  ] as const)("warns, but lets the player go on, without %s", (feature, value, code) => {
    const { blockers, warnings } = checkDevice({ ...GOOD, [feature]: value });

    expect(blockers).toEqual([]);
    expect(codes(warnings)).toEqual([code]);
  });

  it("warns about a phone with little memory, but not when the browser won't say", () => {
    expect(codes(checkDevice({ ...GOOD, deviceMemoryGb: 2 }).warnings)).toEqual(["low-memory"]);
    expect(checkDevice({ ...GOOD, deviceMemoryGb: 4 }).warnings).toEqual([]);
    expect(checkDevice({ ...GOOD, deviceMemoryGb: null }).warnings).toEqual([]);
  });

  it("explains every problem in words a hiker can act on", () => {
    const worst: DeviceFeatures = {
      secureContext: false,
      freeStorageBytes: 1e6,
      cacheApi: false,
      moduleWorkers: false,
      wasmSimd: false,
      camera: false,
      webgpu: false,
      deviceMemoryGb: 1,
      androidChrome: false,
      crossOriginIsolated: false,
    };
    const { blockers, warnings } = checkDevice(worst);

    expect(blockers).toHaveLength(6);
    expect(warnings).toHaveLength(4);
    for (const problem of [...blockers, ...warnings]) expect(problem.message).toMatch(/^[A-Z].+\.$/);
  });
});
