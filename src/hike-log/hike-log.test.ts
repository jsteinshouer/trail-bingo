import { describe, expect, it } from "vitest";
import type { CardState, CheckedSighting, SightingCheck, SightingOutcome, Taxon } from "../game";
import { entryFor, failedEntryFor, toExport } from "./index";

const DEER: Taxon = { group: "mammal", name: "White-tailed Deer", scientificName: "Odocoileus virginianus" };
const OAK: Taxon = { group: "tree", name: "Bur oak", scientificName: "Quercus macrocarpa" };
const YARROW: Taxon = { group: "plant", name: "Common yarrow", scientificName: "Achillea millefolium" };

/** The Card as it is after the Sighting: Bur oak was marked earlier, and the mammal Square by this Sighting. */
const CARD = {
  id: "card-7",
  place: { name: "Platte River State Park", region: "Nebraska", lat: 41, lng: -96.2, radiusKm: 10 },
  month: 10,
  size: 3,
  squares: [
    { kind: "species", group: "tree", name: "Bur oak", scientificName: "Quercus macrocarpa", mark: "confirmed" },
    { kind: "animal", group: "mammal", name: "A mammal", mark: "verified" },
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
  firstSinceLaunch: false,
  backend: "webgpu",
  battery: { level: 0.82, charging: false },
};

const photo = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
const checked = (outcome: SightingOutcome, check = CHECK): CheckedSighting => ({ ...outcome, check });
const VERIFIED_DEER = checked({ kind: "verified", index: 1, taxon: DEER, mark: { newBingos: [], blackout: false } });

describe("a hike log entry", () => {
  it("records a Verified Sighting with the photo check's working, timing, battery and photo", () => {
    expect(entryFor(VERIFIED_DEER, { ...CONTEXT, photo })).toEqual({
      id: "s1",
      at: "2026-10-10T15:04:05.000Z",
      card: { id: "card-7", place: "Platte River State Park", size: 3 },
      outcome: "verified",
      square: "A mammal",
      found: { name: "White-tailed Deer", scientificName: "Odocoileus virginianus" },
      matches: [
        { name: "White-tailed Deer", scientificName: "Odocoileus virginianus", square: "A mammal", marked: false, score: 0.31 },
        { name: "Bur oak", scientificName: "Quercus macrocarpa", square: "Bur oak", marked: true, score: 0.27 },
        { name: "Common yarrow", scientificName: "Achillea millefolium", square: null, marked: false, score: 0.25 },
      ],
      gap: 0.04,
      threshold: 0.03,
      timing: { encodeMs: 1312, matchMs: 4 },
      firstSinceLaunch: false,
      backend: "webgpu",
      battery: { level: 0.82, charging: false },
      photo,
    });
  });

  it("counts a match's Square as marked only if it was marked before this Sighting", () => {
    const entry = entryFor(VERIFIED_DEER, CONTEXT);

    expect(entry.matches.map((m) => m.marked)).toEqual([false, true, false]);
  });

  it("records the guesses an unsure Sighting offered", () => {
    const outcome = checked({ kind: "unsure", guesses: [{ index: 0, taxon: OAK }, { index: 1, taxon: DEER }] }, { ...CHECK, gap: 0.01 });
    const entry = entryFor(outcome, CONTEXT);

    expect(entry).toMatchObject({ outcome: "unsure", guesses: ["Bur oak", "A mammal"], gap: 0.01 });
    expect(entry.square).toBeUndefined();
  });

  it("names the Wildcard when it's the Square a Sighting filled", () => {
    const outcome = checked({ kind: "verified", index: 2, taxon: YARROW, mark: { newBingos: [], blackout: false } });

    expect(entryFor(outcome, CONTEXT)).toMatchObject({ square: "Wildcard", found: { name: "Common yarrow" } });
  });

  it("flags the first check since the app opened, whose timing includes starting up", () => {
    expect(entryFor(VERIFIED_DEER, { ...CONTEXT, firstSinceLaunch: true }).firstSinceLaunch).toBe(true);
  });

  it("records a Sighting the photo check couldn't check, with why", () => {
    const entry = failedEntryFor(new Error("The photo check stopped: out of memory"), { ...CONTEXT, photo });

    expect(entry).toMatchObject({
      outcome: "failed",
      error: "The photo check stopped: out of memory",
      matches: [],
      card: { place: "Platte River State Park" },
      photo,
    });
  });
});

describe("exporting the hike log", () => {
  it("writes every entry and the time on screen as JSON, with photos embedded so one file holds the whole hike", async () => {
    const entry = entryFor(checked({ kind: "already-marked", index: 0, taxon: OAK }), { ...CONTEXT, photo });
    const screen = [{ start: "2026-10-10T15:00:00.000Z", end: "2026-10-10T15:06:00.000Z" }];
    const exported = JSON.parse(await toExport([entry], screen, new Date("2026-10-10T20:00:00Z")));

    expect(exported).toMatchObject({ app: "Trail Bingo", kind: "hike log", exportedAt: "2026-10-10T20:00:00.000Z", screen });
    expect(exported.notes).toMatch(/best species for each Square/);
    expect(exported.entries).toHaveLength(1);
    expect(exported.entries[0]).toMatchObject({ id: "s1", outcome: "already-marked", square: "Bur oak" });
    expect(exported.entries[0].photo).toBe(`data:image/jpeg;base64,${btoa("jpeg-bytes")}`);
  });

  it("keeps an entry without a photo", async () => {
    const exported = JSON.parse(await toExport([entryFor(checked({ kind: "not-on-card", taxon: YARROW }), CONTEXT)], [], new Date()));

    expect(exported.entries[0].photo).toBeNull();
  });
});
