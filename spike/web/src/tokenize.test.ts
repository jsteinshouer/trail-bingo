import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadTokenizer, tokenize } from "./tokenize";

const models = new URL("../public/models/", import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, models), "utf8"));

describe("tokenize", () => {
  const tokenizer = loadTokenizer(read("tokenizer.json"), read("tokenizer_config.json"));
  const labels: { prompt: string; tokenIds: number[] }[] = read("labels.json");

  it.each(labels.map((l) => [l.prompt, l.tokenIds] as const))(
    "matches open_clip's token ids for %s",
    (prompt, expected) => {
      const ids = tokenize(tokenizer, [prompt], 77);
      expect(Array.from(ids.slice(0, expected.length), Number)).toEqual(expected);
    },
  );

  it("pads each prompt with zeros to the context length", () => {
    const ids = tokenize(tokenizer, ["a photo of a fern.", "a mammal"], 77);
    expect(ids).toBeInstanceOf(BigInt64Array);
    expect(ids.length).toBe(2 * 77);
    expect(ids[76]).toBe(0n);
    expect(ids[77]).toBe(49406n);
    expect(ids[153]).toBe(0n);
  });

  it("truncates long prompts and still ends with the end-of-text token", () => {
    const ids = tokenize(tokenizer, ["fern ".repeat(200)], 77);
    expect(ids.length).toBe(77);
    expect(ids[76]).toBe(49407n);
  });
});
