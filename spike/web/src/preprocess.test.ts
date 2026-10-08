import { describe, expect, it } from "vitest";
import { centerSquare, toPixelValues } from "./preprocess";

describe("centerSquare", () => {
  it("takes the middle of a landscape photo", () => {
    expect(centerSquare(4000, 3000)).toEqual({ x: 500, y: 0, side: 3000 });
  });

  it("takes the middle of a portrait photo", () => {
    expect(centerSquare(3000, 4000)).toEqual({ x: 0, y: 500, side: 3000 });
  });

  it("keeps a square photo whole", () => {
    expect(centerSquare(224, 224)).toEqual({ x: 0, y: 0, side: 224 });
  });

  it("rounds odd margins down", () => {
    expect(centerSquare(225, 224)).toEqual({ x: 0, y: 0, side: 224 });
  });
});

describe("toPixelValues", () => {
  const mean = [0.5, 0.25, 0];
  const std = [0.5, 0.25, 1];

  it("normalizes each channel and lays pixels out channel-first", () => {
    // 2×1 image: a white pixel then a black pixel, alpha ignored.
    const rgba = new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255]);
    const values = toPixelValues(rgba, 2, 1, mean, std);
    expect(Array.from(values)).toEqual([
      1, -1, // R: (1-0.5)/0.5, (0-0.5)/0.5
      3, -1, // G: (1-0.25)/0.25, (0-0.25)/0.25
      1, 0, //  B: (1-0)/1, (0-0)/1
    ]);
  });

  it("rejects a buffer that doesn't match the size", () => {
    expect(() => toPixelValues(new Uint8ClampedArray(4), 2, 2, mean, std)).toThrow();
  });
});
