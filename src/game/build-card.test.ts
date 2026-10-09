import { describe, expect, it } from "vitest";
import {
  createGame,
  NotEnoughSpeciesError,
  VERIFIED_GAP,
  type AnimalGroup,
  type BuildProgress,
  type CardGroup,
  type CardRequest,
  type CardSize,
  type Encoder,
  type LocalSpecies,
  type SpeciesGroup,
  type SpeciesQuery,
  type SpeciesSource,
} from "./index";

/*
 * Card generation through the game module, with a fake species source. Species
 * are named after their group and rank ("tree 3" is the third most observed
 * tree), so a test can tell common from rare at a glance.
 */

const ELKHORN = { name: "Elkhorn", region: "Nebraska", lat: 41.28, lng: -96.24 };
const ALL_GROUPS: CardGroup[] = ["plant", "tree", "fungus", "animal"];
const ANIMALS: AnimalGroup[] = ["mammal", "bird", "reptile", "amphibian", "butterfly-or-moth", "insect", "spider"];

/** `n` species of a group, most observed first: "tree 1" has n observations, "tree n" has 1. */
function observed(group: SpeciesGroup | AnimalGroup, n: number): LocalSpecies[] {
  return Array.from({ length: n }, (_, i) => ({
    group,
    name: `${group} ${i + 1}`,
    scientificName: `${group} sci ${i + 1}`,
    observations: n - i,
  }));
}

/** Plenty of everything. */
const PLENTY = [
  ...observed("plant", 40),
  ...observed("tree", 40),
  ...observed("fungus", 40),
  ...ANIMALS.flatMap((g) => observed(g, 3)),
];

/** A species source with one list at 10 km and another at 25 km. */
function fakeSpecies(near: LocalSpecies[], wider: LocalSpecies[] = near): SpeciesSource & { queries: SpeciesQuery[] } {
  const queries: SpeciesQuery[] = [];
  return {
    queries,
    async speciesNear(query) {
      queries.push(query);
      return query.radiusKm <= 10 ? near : wider;
    },
  };
}

/** Gives every label its own axis, so a photo can be aimed at any species. */
function fakeEncoder(): Encoder & { labels: string[] } {
  const labels: string[] = [];
  return {
    labels,
    async encodeText(batch) {
      return batch.map((label) => {
        labels.push(label);
        const v = new Float32Array(2048);
        v[labels.length - 1] = 1;
        return v;
      });
    },
  };
}

/** A small seeded random number generator (mulberry32), so builds are repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setup(options: { near?: LocalSpecies[]; wider?: LocalSpecies[]; today?: Date; seed?: number } = {}) {
  const species = fakeSpecies(options.near ?? PLENTY, options.wider);
  const encoder = fakeEncoder();
  const game = createGame({
    encoder,
    species,
    now: () => options.today ?? new Date(2026, 9, 8),
    random: seeded(options.seed ?? 1),
  });
  return { game, species, encoder };
}

const request = (size: CardSize, groups: CardGroup[] = ALL_GROUPS): CardRequest => ({ place: ELKHORN, size, groups });

const groupOf = (square: ReturnType<ReturnType<typeof createGame>["state"]>["squares"][number]) =>
  square.kind === "wildcard" ? "wildcard" : square.kind === "animal" ? "animal" : square.group;

describe("building a Card", () => {
  it.each([3, 4, 5] as CardSize[])("fills a %i×%i Card with one Wildcard", async (size) => {
    const { game } = setup();
    const card = await game.buildCard(request(size));

    expect(card.size).toBe(size);
    expect(card.squares).toHaveLength(size * size);
    expect(card.squares.filter((s) => s.kind === "wildcard")).toHaveLength(1);
    expect(card.squares.every((s) => !s.mark)).toBe(true);
  });

  it("names the place and the month it was built for", async () => {
    const { game } = setup({ today: new Date(2026, 9, 8) });
    const card = await game.buildCard(request(3));

    expect(card.place).toEqual({ ...ELKHORN, radiusKm: 10 });
    expect(card.month).toBe(10);
  });

  it("never repeats a Square", async () => {
    const { game } = setup();
    const card = await game.buildCard(request(5));

    const names = card.squares.flatMap((s) => (s.kind === "wildcard" ? [] : [s.name]));
    expect(new Set(names).size).toBe(names.length);
  });

  it("varies from one build to the next", async () => {
    const first = await setup({ seed: 1 }).game.buildCard(request(4));
    const second = await setup({ seed: 2 }).game.buildCard(request(4));

    expect(second.squares).not.toEqual(first.squares);
  });
});

describe("Wildcard position", () => {
  it.each([3, 5] as CardSize[])("is the center Square on a %i×%i Card", async (size) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const card = await setup({ seed }).game.buildCard(request(size));
      expect(card.squares[(size * size - 1) / 2].kind).toBe("wildcard");
    }
  });

  it("is one of the four middle Squares on a 4×4 Card", async () => {
    const positions = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const card = await setup({ seed }).game.buildCard(request(4));
      positions.add(card.squares.findIndex((s) => s.kind === "wildcard"));
    }
    expect([...positions].every((i) => [5, 6, 9, 10].includes(i))).toBe(true);
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe("groups on a Card", () => {
  it("includes only the groups the player chose", async () => {
    const { game } = setup();
    const card = await game.buildCard(request(5, ["tree", "animal"]));

    const groups = new Set(card.squares.map(groupOf));
    expect(groups).toEqual(new Set(["tree", "animal", "wildcard"]));
  });

  it("shares the Squares evenly between the chosen groups", async () => {
    const { game } = setup();
    const card = await game.buildCard(request(5));

    for (const group of ALL_GROUPS) {
      expect(card.squares.filter((s) => groupOf(s) === group)).toHaveLength(6);
    }
  });

  it("gives plants, trees and fungi a single species each", async () => {
    const { game } = setup();
    const card = await game.buildCard(request(4, ["plant", "tree", "fungus"]));

    for (const square of card.squares) {
      if (square.kind === "wildcard") continue;
      expect(square).toMatchObject({ kind: "species", name: expect.any(String), scientificName: expect.any(String) });
    }
  });

  it("gives animals broad groups, each at most once", async () => {
    const { game } = setup();
    const card = await game.buildCard(request(4, ["animal", "tree"]));

    const animals = card.squares.flatMap((s) => (s.kind === "animal" ? [s] : []));
    expect(animals.length).toBeGreaterThan(0);
    expect(new Set(animals.map((a) => a.group)).size).toBe(animals.length);
    expect(animals.find((a) => a.group === "mammal")?.name ?? "A mammal").toBe("A mammal");
  });

  it("offers an animal group only if something in it was observed nearby", async () => {
    const near = [...observed("tree", 40), ...observed("mammal", 2), ...observed("bird", 5)];
    const { game } = setup({ near });
    const card = await game.buildCard(request(5, ["tree", "animal"]));

    const animals = card.squares.flatMap((s) => (s.kind === "animal" ? [s.group] : []));
    expect(animals.sort()).toEqual(["bird", "mammal"]);
    // The trees take up the rest.
    expect(card.squares.filter((s) => groupOf(s) === "tree")).toHaveLength(22);
  });
});

describe("common and rarer species", () => {
  it("fills about two-thirds of the species Squares from the most observed, one-third from the rest", async () => {
    for (const seed of [1, 2, 3]) {
      const { game } = setup({ seed });
      const card = await game.buildCard(request(5, ["tree"]));

      const ranks = card.squares.flatMap((s) => (s.kind === "species" ? [Number(s.name.split(" ")[1])] : []));
      expect(ranks).toHaveLength(24);
      expect(ranks.filter((rank) => rank <= 20)).toHaveLength(16);
      expect(ranks.filter((rank) => rank > 20)).toHaveLength(8);
    }
  });
});

describe("the season window", () => {
  it.each([
    [new Date(2026, 9, 8), [9, 10, 11]],
    [new Date(2027, 0, 15), [12, 1, 2]],
    [new Date(2026, 11, 31), [11, 12, 1]],
  ])("on %s is the month either side of this one", async (today, months) => {
    const { game, species } = setup({ today });
    await game.buildCard(request(3));

    expect(species.queries[0].months).toEqual(months);
  });

  it("asks about the chosen place", async () => {
    const { game, species } = setup();
    await game.buildCard(request(3));

    expect(species.queries[0]).toMatchObject({ lat: ELKHORN.lat, lng: ELKHORN.lng, radiusKm: 10 });
  });
});

describe("the search area", () => {
  it("stays at 10 km when that fills the Card", async () => {
    const { game, species } = setup();
    const card = await game.buildCard(request(5));

    expect(species.queries.map((q) => q.radiusKm)).toEqual([10]);
    expect(card.place.radiusKm).toBe(10);
  });

  it("widens to 25 km when 10 km can't fill the Card", async () => {
    const near = observed("tree", 5);
    const wider = observed("tree", 30);
    const { game, species } = setup({ near, wider });
    const card = await game.buildCard(request(4, ["tree"]));

    expect(species.queries.map((q) => q.radiusKm)).toEqual([10, 25]);
    expect(card.place.radiusKm).toBe(25);
    expect(card.squares.filter((s) => s.kind === "species")).toHaveLength(15);
  });

  it("says to pick a smaller Card or more groups when even 25 km can't fill it", async () => {
    const { game } = setup({ near: observed("fungus", 3), wider: observed("fungus", 10) });

    const build = game.buildCard(request(4, ["fungus"]));
    await expect(build).rejects.toThrow(NotEnoughSpeciesError);
    await expect(build).rejects.toThrow(/smaller Card or more groups/);
  });

  it("counts only the chosen groups toward filling the Card", async () => {
    const near = [...observed("plant", 40), ...observed("tree", 3)];
    const { game } = setup({ near, wider: near });

    await expect(game.buildCard(request(3, ["tree"]))).rejects.toThrow(NotEnoughSpeciesError);
  });
});

describe("the photo check on a built Card", () => {
  it("has a label vector for every local species, chosen groups or not, before the Card is ready", async () => {
    const near = [...observed("plant", 30), ...observed("tree", 30), ...observed("mammal", 4)];
    const { game, encoder } = setup({ near });
    await game.buildCard(request(3, ["tree"]));

    expect(encoder.labels).toHaveLength(64);
    expect(encoder.labels).toContain("a photo of plant sci 7, plant 7.");
    expect(encoder.labels).toContain("a photo of mammal sci 2, mammal 2.");
  });

  it("doesn't encode labels again for a Sighting", async () => {
    const { game, encoder } = setup();
    await game.buildCard(request(3));
    const before = encoder.labels.length;
    await game.sighting(new Float32Array(2048));

    expect(encoder.labels).toHaveLength(before);
  });

  it("treats local species that aren't on the Card as decoys", async () => {
    const near = [...observed("tree", 30), ...observed("plant", 5)];
    const { game, encoder } = setup({ near });
    await game.buildCard(request(3, ["tree"]));

    const outcome = await game.sighting(photoOf(encoder, "plant sci 3"));
    expect(outcome).toMatchObject({ kind: "not-on-card", taxon: { scientificName: "plant sci 3" } });
  });

  it("fills a broad animal Square with the best-matching local animal's group", async () => {
    const near = [...observed("tree", 30), ...observed("mammal", 3)];
    const { game, encoder } = setup({ near });
    const card = await game.buildCard(request(3, ["tree", "animal"]));
    const mammal = card.squares.findIndex((s) => s.kind === "animal" && s.group === "mammal");

    const outcome = await game.sighting(photoOf(encoder, "mammal sci 2"));
    expect(outcome).toMatchObject({ kind: "verified", index: mammal, taxon: { name: "mammal 2" } });
  });
});

/** A photo that's a sure match for one species and nothing else. */
function photoOf(encoder: ReturnType<typeof fakeEncoder>, scientificName: string) {
  const v = new Float32Array(2048);
  v[encoder.labels.findIndex((label) => label.includes(`${scientificName},`))] = 0.3 + VERIFIED_GAP;
  return v;
}

describe("progress while building", () => {
  it("reports the search, then encoding every label, ending with all of them", async () => {
    const near = observed("tree", 5);
    const wider = [...observed("tree", 40), ...observed("plant", 60)];
    const { game } = setup({ near, wider });
    const log: BuildProgress[] = [];
    await game.buildCard(request(3, ["tree"]), (p) => log.push(p));

    expect(log[0]).toEqual({ step: "species", radiusKm: 10 });
    expect(log[1]).toEqual({ step: "species", radiusKm: 25 });
    const labels = log.filter((p) => p.step === "labels");
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.at(-1)).toEqual({ step: "labels", done: 100, total: 100 });
  });
});

describe("replacing a Card", () => {
  it("starts the new Card with nothing marked", async () => {
    const { game } = setup();
    await game.buildCard(request(3));
    game.mark(0, "verified");
    const next = await game.buildCard(request(4));

    expect(next.size).toBe(4);
    expect(game.state().squares.every((s) => !s.mark)).toBe(true);
  });

  it("keeps the current Card and its marks when a new one can't be built", async () => {
    const species = fakeSpecies(PLENTY);
    const game = createGame({ encoder: fakeEncoder(), species, random: seeded(1) });
    const first = await game.buildCard(request(3));
    game.mark(0, "verified");

    species.speciesNear = async () => {
      throw new Error("Couldn't reach iNaturalist");
    };
    await expect(game.buildCard(request(5))).rejects.toThrow(/iNaturalist/);
    expect(game.state().squares).toEqual(first.squares.map((s, i) => (i === 0 ? { ...s, mark: "verified" } : s)));
  });

  it("reports whether there's a Card to replace", async () => {
    const { game } = setup();
    expect(game.hasCard()).toBe(false);
    await game.buildCard(request(3));
    expect(game.hasCard()).toBe(true);
  });
});
