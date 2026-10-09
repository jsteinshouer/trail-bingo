import type { Card, Taxon } from "./types";

/**
 * How far the best match must lead the runner-up for the photo check to be
 * sure. Raw scores of right and wrong answers overlap; the gap separates them.
 * In the spike's accuracy test, 0.03 auto-marked 63% of photos with 4.8% of
 * those wrong. Tuned on the test hike (ticket 11).
 */
export const VERIFIED_GAP = 0.03;

/** Turns text labels into L2-normalized vectors. */
export interface Encoder {
  encodeText(labels: string[]): Promise<Float32Array[]>;
}

/** BioCLIP's label form: scientific name and common name. */
export const label = (taxon: Taxon) => `a photo of ${taxon.scientificName}, ${taxon.name}.`;

/** A species the photo check can match, and the Square it fills (null when it isn't on the Card). */
export interface Candidate {
  taxon: Taxon;
  square: number | null;
}

/** Every species the photo check compares a Sighting with. */
export function candidates(card: Card): Candidate[] {
  const list = new Map<string, Candidate>();
  card.squares.forEach((square, i) => {
    if (square.kind === "species") list.set(square.scientificName, { taxon: square, square: i });
  });
  for (const taxon of card.localSpecies) {
    if (list.has(taxon.scientificName)) continue;
    // Animal Squares are broad groups: the best-matching local animal decides the group.
    const square = card.squares.findIndex((s) => s.kind === "animal" && s.group === taxon.group);
    list.set(taxon.scientificName, { taxon, square: square < 0 ? null : square });
  }
  return [...list.values()];
}

/**
 * The photo's best matches on this Card, best first. Species that fill the same
 * Square count once, by their best score, so two mammals don't make the photo
 * check unsure whether it's "a mammal".
 */
export function rank(photo: Float32Array, list: Candidate[], vectors: Float32Array[]): (Candidate & { score: number })[] {
  const best = new Map<string | number, Candidate & { score: number }>();
  list.forEach(({ taxon, square }, i) => {
    const score = dot(photo, vectors[i]);
    const key = square ?? taxon.scientificName;
    if ((best.get(key)?.score ?? -Infinity) < score) best.set(key, { taxon, square, score });
  });
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`Vectors don't match: ${a.length} and ${b.length} dimensions`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
