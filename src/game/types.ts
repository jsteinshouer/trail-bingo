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
  name: string;
  region: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface Card {
  place: Place;
  /** Month the Card was built for, 1–12. */
  month: number;
  size: CardSize;
  /** Squares in reading order, row by row. */
  squares: Square[];
}

export type MarkedSquare = Square & { mark?: Mark };

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
