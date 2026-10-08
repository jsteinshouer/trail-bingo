export interface Ranked {
  index: number;
  cosine: number;
  probability: number;
}

/**
 * Compare one photo vector with every label vector (all L2-normalized), best match first.
 * Probabilities are a softmax over cosine × logitScale, as CLIP does for zero-shot classification.
 */
export function rank(photo: Float32Array, labels: Float32Array, dim: number, logitScale: number): Ranked[] {
  if (photo.length !== dim || labels.length % dim !== 0) {
    throw new Error(`vectors don't match dimension ${dim}`);
  }
  const count = labels.length / dim;
  const cosines = Array.from({ length: count }, (_, row) => {
    let dot = 0;
    for (let i = 0; i < dim; i++) dot += photo[i] * labels[row * dim + i];
    return dot;
  });
  const max = Math.max(...cosines);
  const exps = cosines.map((c) => Math.exp((c - max) * logitScale));
  const total = exps.reduce((sum, e) => sum + e, 0);
  return cosines
    .map((cosine, index) => ({ index, cosine, probability: exps[index] / total }))
    .sort((a, b) => b.cosine - a.cosine);
}
