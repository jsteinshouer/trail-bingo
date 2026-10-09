export type CardSize = 3 | 4 | 5;

/** Groups whose Squares name a single species. */
export type SpeciesGroup = "tree" | "plant" | "fungus";

/** Broad groups that animal Squares name. */
export type AnimalGroup =
  | "mammal"
  | "bird"
  | "reptile"
  | "amphibian"
  | "butterfly-or-moth"
  | "insect"
  | "spider";

export type Square =
  | { kind: "species"; group: SpeciesGroup; name: string; scientificName: string }
  | { kind: "animal"; group: AnimalGroup; name: string }
  | { kind: "wildcard" };

/** Verified: the photo check was sure. Confirmed: the player chose from the top guesses. */
export type Mark = "verified" | "confirmed";

export interface Place {
  /** A place found by name has one; the player's own location doesn't. */
  name?: string;
  region?: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

/** A living thing the photo check can recognize. */
export interface Taxon {
  group: SpeciesGroup | AnimalGroup;
  /** Common name, or the scientific name when it has none. */
  name: string;
  scientificName: string;
  /** The species source's ID for it, which the fact source looks it up by. */
  taxonId?: number;
}

/** A species observed near a place, as a species source reports it. */
export interface LocalSpecies extends Taxon {
  /** Research-grade observations in the radius and season window. */
  observations: number;
}

export interface SpeciesQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  /** Months to count observations in, 1–12, across all years. */
  months: number[];
}

/** Where a Card's species come from: what's been observed near a place this time of year. */
export interface SpeciesSource {
  speciesNear(query: SpeciesQuery): Promise<LocalSpecies[]>;
}

/** Something to learn about a taxon, stored with the Card so it works offline. */
export interface Fact {
  /** Two or three sentences, plain text. */
  summary?: string;
  /** Where the summary is from, to credit it. */
  summarySource?: { name: string; url: string };
  /** A reference photo of the taxon, and its credit. */
  photo?: { image: Blob; credit: string };
}

/** Reference photos for the Card's own Squares are bigger than those for the rest of the local list. */
export type PhotoSize = "small" | "medium";

/** Where facts come from. */
export interface FactSource {
  /** Facts for each taxon it knows, by scientific name. `onProgress` gets how many taxa are done. */
  factsFor(
    taxa: Taxon[],
    options: { photoSize: PhotoSize; onProgress?: (done: number) => void },
  ): Promise<Map<string, Fact>>;
}

export interface Card {
  place: Place;
  /** Month the Card was built for, 1–12. */
  month: number;
  size: CardSize;
  /** Squares in reading order, row by row. */
  squares: Square[];
  /**
   * Other species observed nearby. The photo check compares a Sighting with
   * these as well as the Card's species Squares, so a Sighting of something
   * off the Card isn't forced onto it. Local animals also decide which broad animal
   * Square a Sighting fills.
   */
  localSpecies: Taxon[];
  /** Facts for the Squares' species and the local species, by scientific name. */
  facts?: Record<string, Fact>;
}

export type MarkedSquare = Square & {
  mark?: Mark;
  /** What the Sighting that marked it looked like: the likely species on a broad animal Square, what filled the Wildcard. */
  found?: Taxon;
};

export interface CardState {
  place: Place;
  month: number;
  size: CardSize;
  squares: MarkedSquare[];
  /** Each complete row, column and diagonal, as Square indices. */
  bingos: number[][];
  bingoCount: number;
  /** Every Square is marked. */
  blackout: boolean;
}

/** What a mark changed, so the UI knows what to celebrate. */
export interface MarkOutcome {
  /** Lines this mark completed. */
  newBingos: number[][];
  /** This mark filled the last open Square. */
  blackout: boolean;
}

/** What a Sighting turned out to be. */
export type SightingOutcome =
  /** The photo check was sure, and marked the Square as Verified: a Square on the Card, or the Wildcard for a species that isn't. */
  | { kind: "verified"; index: number; taxon: Taxon; mark: MarkOutcome }
  /** The photo check was sure, but the Square was already marked. Nothing changed. */
  | { kind: "already-marked"; index: number; taxon: Taxon }
  /**
   * The photo check wasn't sure. Its top open Squares, best first, for the
   * player to pick from, each with the species it looks like there.
   */
  | { kind: "unsure"; guesses: { index: number; taxon: Taxon }[] }
  /**
   * The photo check was sure it's a local species that isn't on the Card, and
   * the Wildcard it would have filled is already filled. Nothing changed.
   */
  | { kind: "not-on-card"; taxon: Taxon; wildcardFilledBy?: Taxon };
