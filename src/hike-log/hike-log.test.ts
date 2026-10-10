import { describe, expect, it } from "vitest";
import type { CardState, SightingCheck, SightingOutcome, Taxon } from "../game";
import { entryFor, toExport } from "./index";

const DEER: Taxon = { group: "mammal", name: "White-tailed Deer", scientificName: "Odocoileus virginianus" };
const OAK: Taxon = { group: "tree", name: "Bur oak", scientificName: "Quercus macrocarpa" };
const YARROW: Taxon = { group: "plant", name: "Common yarrow", scientificName: "Achillea millefolium" };

const CARD = {
  id: "card-7",
  place: { name: "Platte River State Park", region: "Nebraska", lat: 41, lng: -96.2, radiusKm: 10 },
  month: 10,
  size: 3,
  squares: [
    { kind: "species", group: "tree", name: "Bur oak", scientificName: "Quercus macrocarpa" },
    { kind: "animal", group: "mammal", name: "A mammal" },
    { kind: "wildcard" },
  ],
  bingos: [],
  bingoCount: 0,
  blackout: false,
} as unknown as CardState;

const CHECK: SightingCheck = {
  matches: [
    { taxon: DEER, square: 1, score: 0.31 },
    { taxon: OAK, square: 0, score: 0.27 },
    { taxon: YARROW, square: null, score: 0.25 },
  ],
  gap: 0.04,
  threshold: 0.03,
};

const CONTEXT = {
  id: "s1",
  at: new Date("2026-10-10T15:04:05Z"),
  card: CARD,
  timing: { encodeMs: 1312, matchMs: 4 },
  backend: "webgpu",
  battery: { level: 0.82, charging: false },
};

const photo = new Blob(["jpeg-bytes"], { type: "image/jpeg" });

describe("a hike log entry", () => {
  it("records a Verified Sighting with the photo check's working, timing, battery and photo", () => {
    const outcome = { kind: "verified", index: 1, taxon: DEER, mark: { newBingos: [], blackout: false } } as SightingOutcome;
    const entry = entryFor({ ...outcome, check: CHECK }, { ...CONTEXT, photo });

    expect(entry).toEqual({
      id: "s1",
      at: "2026-10-10T15:04:05.000Z",
      card: { id: "card-7", place: "Platte River State Park", size: 3 },
      outcome: "verified",
      square: "A mammal",
      found: { name: "White-tailed Deer", scientificName: "Odocoileus virginianus" },
      matches: [
        { name: "White-tailed Deer", scientificName: "Odocoileus virginianus", square: "A mammal", score: 0.31 },
        { name: "Bur oak", scientificName: "Quercus macrocarpa", square: "Bur oak", score: 0.27 },
        { name: "Common yarrow", scientificName: "Achillea millefolium", square: null, score: 0.25 },
      ],
      gap: 0.04,
      threshold: 0.03,
      timing: { encodeMs: 1312, matchMs: 4 },
      backend: "webgpu",
      battery: { level: 0.82, charging: false },
      photo,
    });
  });

  it("records the guesses an unsure Sighting offered", () => {
    const outcome: SightingOutcome = { kind: "unsure", guesses: [{ index: 0, taxon: OAK }, { index: 1, taxon: DEER }] };
    const entry = entryFor({ ...outcome, check: { ...CHECK, gap: 0.01 } }, CONTEXT);

    expect(entry).toMatchObject({ outcome: "unsure", guesses: ["Bur oak", "A mammal"], gap: 0.01 });
    expect(entry.square).toBeUndefined();
  });

  it("names the Wildcard when it's the Square a Sighting filled", () => {
    const outcome = { kind: "verified", index: 2, taxon: YARROW, mark: { newBingos: [], blackout: false } } as SightingOutcome;

    expect(entryFor({ ...outcome, check: CHECK }, CONTEXT)).toMatchObject({ square: "Wildcard", found: { name: "Common yarrow" } });
  });
});

describe("exporting the hike log", () => {
  it("writes every entry as JSON, with photos embedded so one file holds the whole hike", async () => {
    const outcome = { kind: "already-marked", index: 0, taxon: OAK } as SightingOutcome;
    const entry = { ...entryFor({ ...outcome, check: CHECK }, { ...CONTEXT, photo }), resolution: undefined };
    const exported = JSON.parse(await toExport([entry], new Date("2026-10-10T20:00:00Z")));

    expect(exported).toMatchObject({ app: "Trail Bingo", kind: "hike log", exportedAt: "2026-10-10T20:00:00.000Z" });
    expect(exported.entries).toHaveLength(1);
    expect(exported.entries[0]).toMatchObject({ id: "s1", outcome: "already-marked", square: "Bur oak" });
    expect(exported.entries[0].photo).toBe(`data:image/jpeg;base64,${btoa("jpeg-bytes")}`);
  });

  it("keeps an entry without a photo", async () => {
    const outcome = { kind: "not-on-card", taxon: YARROW } as SightingOutcome;
    const exported = JSON.parse(await toExport([entryFor({ ...outcome, check: CHECK }, CONTEXT)], new Date()));

    expect(exported.entries[0].photo).toBeNull();
  });
});
