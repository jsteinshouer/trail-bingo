/**
 * BioCLIP preprocessing: resize the shortest side to 224 then center-crop, which is the same as
 * taking the central square of the photo and scaling it to 224×224 (the canvas does the scaling).
 */

export interface CropRegion {
  x: number;
  y: number;
  side: number;
}

export function centerCrop(width: number, height: number): CropRegion {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    side,
  };
}

/** RGBA bytes (as from a canvas) to channel-first, normalized floats for the image encoder. */
export function toPixelValues(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  mean: number[],
  std: number[],
): Float32Array {
  const pixels = width * height;
  if (rgba.length !== pixels * 4) {
    throw new Error(`expected ${pixels * 4} RGBA bytes, got ${rgba.length}`);
  }
  const out = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * pixels + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c];
    }
  }
  return out;
}
