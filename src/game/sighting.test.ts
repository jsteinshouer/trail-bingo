import { describe, expect, it } from "vitest";
import { fakeStore } from "./testing";
import { createGame, VERIFIED_GAP, type Card, type Encoder, type SightingOutcome, type FactSource, type SpeciesSource, type Square, type Taxon } from "./index";

/*
 * The fake encoder gives every label its own axis, so a photo's cosine with a
 * species is exactly the score the test hands to `photo()`.
 */

const tree = (name: string, scientificName: string): Square => ({ kind: "species", group: "tree", name, scientificName });

const BUR_OAK = tree("Bur oak", "Quercus macrocarpa");
const HACKBERRY = tree("Common hackberry", "Celtis occidentalis");
const ELM = tree("American elm", "Ulmus americana");
const SUMAC = tree("Smooth sumac", "Rhus glabra");
const MAMMAL: Square = { kind: "animal", group: "mammal", name: "A mammal" };
const BIRD: Square = { kind: "animal", group: "bird", name: "A bird" };

const YARROW: Taxon = { group: "plant", name: "Common yarrow", scientificName: "Achillea millefolium" };
const DEER: Taxon = { group: "mammal", name: "White-tailed deer", scientificName: "Odocoileus virginianus" };
const SQUIRREL: Taxon = { group: "mammal", name: "Eastern fox squirrel", scientificName: "Sciurus niger" };
const ROBIN: Taxon = { group: "bird", name: "American robin", scientificName: "Turdus migratorius" };
const SPIDER: Taxon = { group: "spider", name: "Yellow garden spider", scientificName: "Argiope aurantia" };

/**
 *  Bur oak | Hackberry | A mammal
 *  Elm     | Wildcard  | A bird
 *  Sumac   | Yarrow?   | ...
 */
const CARD: Card = {
  place: { name: "Elkhorn", region: "Nebraska", lat: 41.28, lng: -96.24, radiusKm: 10 },
  month: 10,
  size: 3,
  squares: [
    BUR_OAK, HACKBERRY, MAMMAL,
    ELM, { kind: "wildcard" }, BIRD,
    SUMAC, tree("Eastern redcedar", "Juniperus virginiana"), tree("White mulberry", "Morus alba"),
  ],
  localSpecies: [YARROW, DEER, SQUIRREL, ROBIN, SPIDER],
};

const SPECIES = [
  ...CARD.squares.flatMap((s) => (s.kind === "species" ? [s.scientificName] : [])),
  ...CARD.localSpecies.map((t) => t.scientificName),
];

/** Each species' axis; the last axis takes up the slack so a photo vector stays unit length. */
const axis = (scientificName: string) => {
  const i = SPECIES.indexOf(scientificName);
  if (i < 0) throw new Error(`no axis for ${scientificName}`);
  return i;
};
const DIM = SPECIES.length + 1;

function fakeEncoder(): Encoder & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async encodeText(labels) {
      calls.push(labels);
      return labels.map((label) => {
        const v = new Float32Array(DIM);
        const name = SPECIES.find((s) => label.includes(s));
        if (!name) throw new Error(`fake encoder doesn't know "${label}"`);
        v[axis(name)] = 1;
        return v;
      });
    },
  };
}

/** A photo vector whose cosine with each named species is the given score; every other species scores 0. */
function photo(scores: Record<string, number>): Float32Array {
  const v = new Float32Array(DIM);
  let used = 0;
  for (const [name, score] of Object.entries(scores)) {
    v[axis(name)] = score;
    used += score * score;
  }
  v[DIM - 1] = Math.sqrt(1 - used);
  return v;
}

// These tests load a Card by hand, so the species source is never asked.
const species: SpeciesSource = { speciesNear: async () => [] };
const noFacts: FactSource = { factsFor: async () => new Map() };

function playing(card: Card = CARD) {
  const game = createGame({ encoder: fakeEncoder(), species, facts: noFacts, store: fakeStore() });
  game.loadCard(card);
  return game;
}

const SURE = VERIFIED_GAP + 0.005;
const UNSURE = VERIFIED_GAP - 0.005;

/** The Squares an unsure outcome offers, best first. */
function guessed(outcome: SightingOutcome): number[] {
  if (outcome.kind !== "unsure") throw new Error(`expected unsure, got ${outcome.kind}`);
  return outcome.guesses.map((g) => g.index);
}

const WILDCARD = 4;

describe("a Sighting the photo check is sure of", () => {
  it("marks the matching Square as Verified", async () => {
    const game = playing();
    const outcome = await game.sighting(photo({ "Quercus macrocarpa": 0.33, "Celtis occidentalis": 0.33 - SURE }));
    expect(outcome).toMatchObject({ kind: "verified", index: 0 });
    expect(game.state().squares[0].mark).toBe("verified");
  });
});

describe("confidence", () => {
  it("comes from the lead over the runner-up, not the raw score", async () => {
    const game = playing();
    // A low score far ahead of everything else is sure...
    const low = await game.sighting(photo({ "Ulmus americana": 0.2, "Rhus glabra": 0.2 - SURE }));
    expect(low.kind).toBe("verified");
    // ...and a high score only just ahead isn't.
    const high = await game.sighting(photo({ "Quercus macrocarpa": 0.6, "Celtis occidentalis": 0.6 - UNSURE }));
    expect(high.kind).toBe("unsure");
  });
});

describe("a Sighting the photo check isn't sure of", () => {
  it("offers the three best Card Squares, best first, and marks nothing", async () => {
    const game = playing();
    const outcome = await game.sighting(
      photo({ "Celtis occidentalis": 0.33, "Ulmus americana": 0.32, "Rhus glabra": 0.31, "Quercus macrocarpa": 0.3 }),
    );
    expect(guessed(outcome)).toEqual([1, 3, 6]);
    expect(game.state().squares.some((s) => s.mark)).toBe(false);
  });

  it("marks the guess the player picks as Confirmed", async () => {
    const game = playing();
    const outcome = await game.sighting(photo({ "Celtis occidentalis": 0.33, "Ulmus americana": 0.32 }));
    if (outcome.kind !== "unsure") throw new Error(`expected unsure, got ${outcome.kind}`);
    const { index, taxon } = outcome.guesses[1];
    game.mark(index, "confirmed", { found: taxon });
    expect(game.state().squares[3].mark).toBe("confirmed");
    expect(game.state().squares.filter((s) => s.mark)).toHaveLength(1);
  });

  it("offers only open Squares, since picking a marked one would change nothing", async () => {
    const game = playing();
    game.mark(3, "verified");
    const outcome = await game.sighting(
      photo({ "Celtis occidentalis": 0.33, "Ulmus americana": 0.325, "Rhus glabra": 0.32, "Quercus macrocarpa": 0.31 }),
    );
    expect(guessed(outcome)).toEqual([1, 6, 0]);
  });

  it("offers only Card Squares, even when a species off the Card leads", async () => {
    const game = playing();
    const outcome = await game.sighting(
      photo({ "Achillea millefolium": 0.34, "Rhus glabra": 0.33, "Quercus macrocarpa": 0.32, "Ulmus americana": 0.31 }),
    );
    expect(guessed(outcome)).toEqual([6, 0, 3]);
  });

  it("offers each guess with the species it looks like, so a broad animal Square gets its likely species", async () => {
    const game = playing();
    const outcome = await game.sighting(photo({ "Sciurus niger": 0.33, "Turdus migratorius": 0.33 - UNSURE }));
    if (outcome.kind !== "unsure") throw new Error(`expected unsure, got ${outcome.kind}`);

    expect(outcome.guesses.slice(0, 2)).toEqual([
      { index: 2, taxon: SQUIRREL },
      { index: 5, taxon: ROBIN },
    ]);
    game.mark(2, "confirmed", { found: outcome.guesses[0].taxon });
    expect(game.state().squares[2]).toMatchObject({ mark: "confirmed", found: SQUIRREL });
  });
});

describe("a sure Sighting of a local species that isn't on the Card", () => {
  it("fills the open Wildcard as Verified, remembering what filled it", async () => {
    const game = playing();
    const outcome = await game.sighting(photo({ "Achillea millefolium": 0.34, "Rhus glabra": 0.34 - SURE }));

    expect(outcome).toMatchObject({ kind: "verified", index: WILDCARD, taxon: YARROW });
    expect(game.state().squares[WILDCARD]).toEqual({ kind: "wildcard", mark: "verified", found: YARROW });
    expect(game.state().squares.filter((s) => s.mark)).toHaveLength(1);
  });

  it("fills the Wildcard with an animal whose group has no Square", async () => {
    const game = playing();
    const outcome = await game.sighting(photo({ "Argiope aurantia": 0.3, "Sciurus niger": 0.3 - SURE }));

    expect(outcome).toMatchObject({ kind: "verified", index: WILDCARD, taxon: SPIDER });
  });

  it("changes nothing once the Wildcard is filled, and says so", async () => {
    const game = playing();
    await game.sighting(photo({ "Achillea millefolium": 0.34, "Rhus glabra": 0.34 - SURE }));
    const before = game.state();
    const outcome = await game.sighting(photo({ "Argiope aurantia": 0.3, "Sciurus niger": 0.3 - SURE }));

    expect(outcome).toEqual({ kind: "not-on-card", taxon: SPIDER, wildcardFilledBy: YARROW });
    expect(game.state()).toEqual(before);
  });

  it("can complete a Bingo through the Wildcard", async () => {
    const game = playing();
    game.mark(3, "verified");
    game.mark(5, "verified");
    const outcome = await game.sighting(photo({ "Achillea millefolium": 0.34, "Rhus glabra": 0.34 - SURE }));

    expect(outcome).toMatchObject({ kind: "verified", index: WILDCARD, mark: { newBingos: [[3, 4, 5]] } });
  });
});

describe("a Sighting of an already-marked Square", () => {
  it("leaves the Card unchanged", async () => {
    const game = playing();
    game.mark(0, "confirmed");
    const before = game.state();
    const outcome = await game.sighting(photo({ "Quercus macrocarpa": 0.33, "Celtis occidentalis": 0.33 - SURE }));
    expect(outcome).toEqual({ kind: "already-marked", index: 0, taxon: BUR_OAK });
    expect(game.state()).toEqual(before);
  });
});

describe("a Sighting of an animal", () => {
  it("fills the broad Square for the group of the best-matching local animal", async () => {
    const game = playing();
    const outcome = await game.sighting(photo({ "Turdus migratorius": 0.31, "Celtis occidentalis": 0.31 - SURE }));
    expect(outcome).toMatchObject({ kind: "verified", index: 5, taxon: ROBIN });
    expect(game.state().squares[5].mark).toBe("verified");
  });

  it("names the likely species on the Square it fills", async () => {
    const game = playing();
    await game.sighting(photo({ "Sciurus niger": 0.31, "Celtis occidentalis": 0.31 - SURE }));

    expect(game.state().squares[2]).toEqual({ kind: "animal", group: "mammal", name: "A mammal", mark: "verified", found: SQUIRREL });
  });

  it("is sure of the group when the close runner-up is in the same group", async () => {
    const game = playing();
    const outcome = await game.sighting(
      photo({ "Odocoileus virginianus": 0.32, "Sciurus niger": 0.315, "Turdus migratorius": 0.32 - SURE }),
    );
    expect(outcome).toMatchObject({ kind: "verified", index: 2, taxon: DEER });
  });
});

describe("label encoding", () => {
  it("is tried again by the next Sighting when it fails", async () => {
    const encoder = fakeEncoder();
    let failures = 1;
    const flaky: Encoder = {
      encodeText: (labels) => (failures-- > 0 ? Promise.reject(new Error("out of memory")) : encoder.encodeText(labels)),
    };
    const game = createGame({ encoder: flaky, species, facts: noFacts, store: fakeStore() });
    game.loadCard(CARD);
    const sure = photo({ "Quercus macrocarpa": 0.33, "Celtis occidentalis": 0.33 - SURE });
    await expect(game.sighting(sure)).rejects.toThrow("out of memory");
    expect(await game.sighting(sure)).toMatchObject({ kind: "verified", index: 0 });
  });
});

describe("Verified and Confirmed Squares from Sightings", () => {
  it("count the same toward Bingo and Blackout", async () => {
    const game = playing();
    const sure = (sci: string, other: string) => game.sighting(photo({ [sci]: 0.33, [other]: 0.33 - SURE }));
    await sure("Quercus macrocarpa", "Ulmus americana"); // 0, Verified
    await sure("Celtis occidentalis", "Ulmus americana"); // 1, Verified
    game.mark(2, "confirmed"); // A mammal, picked from guesses
    expect(game.state().bingoCount).toBe(1);

    for (const i of [3, 4, 5, 6, 7]) game.mark(i, "confirmed");
    const last = await sure("Morus alba", "Ulmus americana"); // 8, Verified
    expect(last).toMatchObject({ kind: "verified", index: 8, mark: { blackout: true } });
    expect(game.state().blackout).toBe(true);
  });
});
