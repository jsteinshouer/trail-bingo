import type { AnimalGroup, MarkedSquare, Place, Taxon } from "../game";

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

/**
 * A Square's second line: the scientific name, or for a broad animal Square
 * what counts until it's found, then the likely species.
 */
export function secondLine(square: Exclude<MarkedSquare, { kind: "wildcard" }>): string {
  if (square.kind !== "animal") return square.scientificName;
  return square.found ? `likely ${square.found.name}` : ANIMAL_ANY[square.group];
}

const hasCommonName = ({ name, scientificName }: Taxon) => name !== scientificName;

/** A taxon's common name with its scientific name, or the scientific name alone when it has no common name. HTML. */
export const namedTaxon = (taxon: Taxon) =>
  hasCommonName(taxon) ? `${esc(taxon.name)} (<i>${esc(taxon.scientificName)}</i>)` : `<i>${esc(taxon.name)}</i>`;

/** "Looks like an Eastern Fox Squirrel": what a Sighting matched. HTML. */
export const looksLike = (taxon: Taxon) =>
  hasCommonName(taxon)
    ? `Looks like ${/^[aeiou]/i.test(taxon.name) ? "an" : "a"} ${esc(taxon.name)}`
    : `Looks like <i>${esc(taxon.name)}</i>`;
