import type { AnimalGroup, Card, CardSize, LocalSpecies, Place, SpeciesGroup, Square } from "./types";

/** What the player can choose to put on a Card: three species groups, and animals as broad groups. */
export type CardGroup = SpeciesGroup | "animal";

export interface CardRequest {
  place: Omit<Place, "radiusKm">;
  size: CardSize;
  groups: CardGroup[];
}

/** The search area: 10 km first, wider when that can't fill the Card. */
export const SEARCH_RADII_KM = [10, 25];

const ANIMAL_NAMES: Record<AnimalGroup, string> = {
  mammal: "A mammal",
  bird: "A bird",
  reptile: "A reptile",
  amphibian: "An amphibian",
  "butterfly-or-moth": "A butterfly or moth",
  insect: "Another insect",
  spider: "A spider",
};

/** Even when the player asked for "animal" first, the Card's groups are dealt in this order. */
const DEAL_ORDER: CardGroup[] = ["plant", "tree", "fungus", "animal"];

export class NotEnoughSpeciesError extends Error {
  constructor(size: CardSize) {
    super(
      `Not enough different living things have been seen near here at this time of year to fill a ${size} × ${size} Card. ` +
        "Try a smaller Card or more groups.",
    );
    this.name = "NotEnoughSpeciesError";
  }
}

/** This month and the one either side, as 1–12. */
export const seasonMonths = (month: number) => [month - 1, month, month + 1].map((m) => ((m + 11) % 12) + 1);

/**
 * Index of the Wildcard: the center Square on 3×3 and 5×5 Cards, and a random
 * one of the four middle Squares on 4×4.
 */
export function wildcardPosition(size: CardSize, random: () => number = Math.random): number {
  if (size !== 4) return (size * size - 1) / 2;
  const middle = [5, 6, 9, 10];
  return middle[Math.floor(random() * middle.length)];
}

/** `n` items picked at random, in random order. */
function sample<T>(items: T[], n: number, random: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/** The Squares each chosen group could fill. Species groups are most observed first. */
function pools(local: LocalSpecies[], groups: CardGroup[]): Map<CardGroup, Square[]> {
  const byCount = [...local].sort((a, b) => b.observations - a.observations || a.name.localeCompare(b.name));
  const chosen = DEAL_ORDER.filter((group) => groups.includes(group));
  return new Map(
    chosen.map((group): [CardGroup, Square[]] => {
      if (group === "animal") {
        const seen = new Set(local.map((s) => s.group));
        const animals = (Object.keys(ANIMAL_NAMES) as AnimalGroup[]).filter((g) => seen.has(g));
        return [group, animals.map((g) => ({ kind: "animal", group: g, name: ANIMAL_NAMES[g] }))];
      }
      const species = byCount.filter((s) => s.group === group);
      return [group, species.map(({ name, scientificName }) => ({ kind: "species", group, name, scientificName }))];
    }),
  );
}

/** Deals the Squares out one group at a time, so every chosen group gets its share while it has Squares left. */
function shares(pools: Map<CardGroup, Square[]>, needed: number): Map<CardGroup, number> | null {
  const share = new Map([...pools.keys()].map((group) => [group, 0]));
  let dealt = 0;
  while (dealt < needed) {
    const before = dealt;
    for (const [group, pool] of pools) {
      if (dealt === needed) break;
      if (share.get(group)! < pool.length) {
        share.set(group, share.get(group)! + 1);
        dealt++;
      }
    }
    if (dealt === before) return null;
  }
  return share;
}

/**
 * About two-thirds from the more observed half of the group, one-third from
 * the rest: some quick early finds and some real challenges.
 */
function pickSpecies(pool: Square[], n: number, random: () => number): Square[] {
  const common = pool.slice(0, Math.ceil(pool.length / 2));
  const rarer = pool.slice(common.length);
  const fromRarer = Math.max(Math.min(Math.floor(n / 3), rarer.length), n - common.length);
  return [...sample(common, n - fromRarer, random), ...sample(rarer, fromRarer, random)];
}

/** A Card from the species seen near the place, or null if they can't fill it. */
export function generateCard(
  local: LocalSpecies[],
  request: CardRequest,
  month: number,
  radiusKm: number,
  random: () => number,
): Card | null {
  const { size } = request;
  const available = pools(local, request.groups);
  const share = shares(available, size * size - 1);
  if (!share) return null;

  const picked = [...available].flatMap(([group, pool]) =>
    group === "animal" ? sample(pool, share.get(group)!, random) : pickSpecies(pool, share.get(group)!, random),
  );
  const squares = sample(picked, picked.length, random);
  squares.splice(wildcardPosition(size, random), 0, { kind: "wildcard" });

  return {
    place: { ...request.place, radiusKm },
    month,
    size,
    squares,
    // Every local species, chosen groups or not: the photo check compares Sightings with all of them.
    localSpecies: local.map(({ group, name, scientificName }) => ({ group, name, scientificName })),
  };
}
