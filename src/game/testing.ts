import {
  VERIFIED_GAP,
  type AnimalGroup,
  type CardGroup,
  type Encoder,
  type Fact,
  type FactSource,
  type LocalSpecies,
  type PhotoSize,
  type SavedGame,
  type SpeciesGroup,
  type SpeciesQuery,
  type SpeciesSource,
  type Store,
} from "./index";

/*
 * Fake adapters for testing the game module. Species are named after their
 * group and rank ("tree 3" is the third most observed tree), so a test can
 * tell common from rare at a glance.
 */

export const ELKHORN = { name: "Elkhorn", region: "Nebraska", lat: 41.28, lng: -96.24 };
export const ALL_GROUPS: CardGroup[] = ["plant", "tree", "fungus", "animal"];
export const ANIMALS: AnimalGroup[] = ["mammal", "bird", "reptile", "amphibian", "butterfly-or-moth", "insect", "spider"];

/** `n` species of a group, most observed first: "tree 1" has n observations, "tree n" has 1. */
export function observed(group: SpeciesGroup | AnimalGroup, n: number): LocalSpecies[] {
  return Array.from({ length: n }, (_, i) => ({
    group,
    name: `${group} ${i + 1}`,
    scientificName: `${group} sci ${i + 1}`,
    observations: n - i,
  }));
}

/** Plenty of everything. */
export const PLENTY = [
  ...observed("plant", 40),
  ...observed("tree", 40),
  ...observed("fungus", 40),
  ...ANIMALS.flatMap((g) => observed(g, 3)),
];

/** A species source with one list at 10 km and another at 25 km. */
export function fakeSpecies(near: LocalSpecies[], wider: LocalSpecies[] = near): SpeciesSource & { queries: SpeciesQuery[] } {
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
export function fakeEncoder(): Encoder & { labels: string[] } {
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

/** A fact for every taxon it's asked about, recording which taxa were asked for at which photo size. */
export function fakeFacts(): FactSource & { asked: Map<PhotoSize, string[]>; fail?: Error } {
  const asked = new Map<PhotoSize, string[]>();
  const source: FactSource & { asked: Map<PhotoSize, string[]>; fail?: Error } = {
    asked,
    async factsFor(taxa, { photoSize, onProgress }) {
      if (source.fail) throw source.fail;
      asked.set(photoSize, [...(asked.get(photoSize) ?? []), ...taxa.map((t) => t.scientificName)]);
      taxa.forEach((_, i) => onProgress?.(i + 1));
      return new Map(taxa.map((t): [string, Fact] => [t.scientificName, { summary: `All about ${t.name}.` }]));
    },
  };
  return source;
}

/** A small seeded random number generator (mulberry32), so builds are repeatable. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A photo that's a sure match for one species and nothing else. */
export function photoOf(encoder: ReturnType<typeof fakeEncoder>, scientificName: string) {
  const v = new Float32Array(2048);
  v[encoder.labels.findIndex((label) => label.includes(`${scientificName},`))] = 0.3 + VERIFIED_GAP;
  return v;
}

/** An in-memory store: what a restarted app would find saved on the phone. */
export function fakeStore(): Store & { saved: SavedGame | null; failSaves?: Error } {
  const store: Store & { saved: SavedGame | null; failSaves?: Error } = {
    saved: null,
    async load() {
      return store.saved;
    },
    async saveCard(card, vectors) {
      if (store.failSaves) throw store.failSaves;
      store.saved = { card, vectors: [...vectors], progress: { marks: [], found: [], photos: [] } };
    },
    async saveProgress(progress) {
      if (store.failSaves) throw store.failSaves;
      if (!store.saved) throw new Error("No Card to save progress for");
      store.saved = { ...store.saved, progress: structuredClone(progress) };
    },
  };
  return store;
}
