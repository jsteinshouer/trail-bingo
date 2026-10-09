import type { AnimalGroup, Place, Square } from "../game";

export const monthName = (month: number) => new Date(2000, month - 1).toLocaleString("en", { month: "long" });

/** The Card's title: its place, or "Your location" when it was built where the player stood. */
export const placeTitle = (place: Place) => place.name ?? "Your location";

/** "the Elkhorn Card", or "this Card" when it has no place name. Not escaped. */
export const theCard = (place: Place) => (place.name ? `the ${place.name} Card` : "this Card");

/** An error's message, for showing the player. */
export const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ANIMAL_ANY: Record<AnimalGroup, string> = {
  mammal: "any mammal",
  bird: "any bird",
  reptile: "any reptile",
  amphibian: "any amphibian",
  "butterfly-or-moth": "any butterfly or moth",
  insect: "any insect",
  spider: "any spider",
};

/** A Square's second line: the scientific name, or what counts for a broad animal Square. */
export const secondLine = (square: Exclude<Square, { kind: "wildcard" }>) =>
  square.kind === "animal" ? ANIMAL_ANY[square.group] : square.scientificName;
