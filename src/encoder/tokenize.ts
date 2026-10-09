import { Tokenizer } from "@huggingface/tokenizers";

const END_OF_TEXT = 49407;

export function loadTokenizer(tokenizerJson: object, tokenizerConfig: object): Tokenizer {
  return new Tokenizer(tokenizerJson, tokenizerConfig);
}

/**
 * Token ids for the text encoder, one row of `contextLength` per prompt.
 * Matches open_clip: start/end tokens added, zero-padded, truncated with the end token kept last
 * (the text encoder pools at the end token).
 */
export function tokenize(tokenizer: Tokenizer, prompts: string[], contextLength: number): BigInt64Array {
  const out = new BigInt64Array(prompts.length * contextLength);
  prompts.forEach((prompt, row) => {
    let ids = tokenizer.encode(prompt).ids;
    if (ids.length > contextLength) {
      ids = [...ids.slice(0, contextLength - 1), END_OF_TEXT];
    }
    ids.forEach((id, col) => {
      out[row * contextLength + col] = BigInt(id);
    });
  });
  return out;
}
