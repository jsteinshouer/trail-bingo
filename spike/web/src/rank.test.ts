import { describe, expect, it } from "vitest";
import { rank } from "./rank";

// Three unit-length label vectors in 2-D, stored row after row.
const labels = new Float32Array([1, 0, 0, 1, Math.SQRT1_2, Math.SQRT1_2]);

describe("rank", () => {
  it("orders labels by similarity to the photo, best first", () => {
    const photo = new Float32Array([0.9, Math.sqrt(1 - 0.81)]);
    expect(rank(photo, labels, 2, 1).map((r) => r.index)).toEqual([2, 0, 1]);
  });

  it("reports cosine similarity for each label", () => {
    const [best] = rank(new Float32Array([1, 0]), labels, 2, 1);
    expect(best.index).toBe(0);
    expect(best.cosine).toBeCloseTo(1);
  });

  it("turns scaled similarities into probabilities that sum to one", () => {
    const results = rank(new Float32Array([1, 0]), labels, 2, 10);
    const total = results.reduce((sum, r) => sum + r.probability, 0);
    expect(total).toBeCloseTo(1);
    expect(results[0].probability).toBeGreaterThan(results[1].probability);
  });

  it("sharpens probabilities as the logit scale grows", () => {
    const photo = new Float32Array([1, 0]);
    const soft = rank(photo, labels, 2, 1)[0].probability;
    const sharp = rank(photo, labels, 2, 100)[0].probability;
    expect(sharp).toBeGreaterThan(soft);
  });

  it("rejects label vectors that don't match the dimension", () => {
    expect(() => rank(new Float32Array([1, 0]), new Float32Array(5), 2, 1)).toThrow();
  });
});
