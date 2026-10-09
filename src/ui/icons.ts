import type { Square } from "../game";

export type Kind = "tree" | "plant" | "fungus" | "animal";

export const KIND_LABEL: Record<Kind, string> = {
  tree: "Tree or shrub",
  plant: "Plant or wildflower",
  fungus: "Fungus or lichen",
  animal: "Animal",
};

// Map-style legend symbols, drawn in contour brown.
const KIND_PATHS: Record<Kind, string> = {
  tree: '<circle cx="12" cy="9.5" r="5.5"/><path d="M12 15v6"/>',
  plant: '<path d="M5 20.5h14M12 20.5V8M12 20.5 7 12.5M12 20.5l5-8M12 20.5 9.2 10M12 20.5 14.8 10"/>',
  fungus: '<path d="M4 13.5a8 6.5 0 0 1 16 0Z"/><path d="M10 13.5v6.5h4v-6.5"/>',
  animal:
    '<ellipse cx="12" cy="16" rx="4.2" ry="3.4"/><circle cx="6.2" cy="10.6" r="1.7"/><circle cx="9.8" cy="6.8" r="1.7"/><circle cx="14.2" cy="6.8" r="1.7"/><circle cx="17.8" cy="10.6" r="1.7"/>',
};

export const kindOf = (square: Exclude<Square, { kind: "wildcard" }>): Kind =>
  square.kind === "animal" ? "animal" : square.group;

/** The legend symbol for a kind of living thing. */
export const kindGlyph = (kind: Kind) =>
  `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${KIND_PATHS[kind]}</svg>`;

/** The legend symbol for a Square: a kind glyph, or the triangulation station for the Wildcard. */
export function glyph(square: Square): string {
  return square.kind === "wildcard" ? TRIG : kindGlyph(kindOf(square));
}

const TRIG =
  '<svg class="glyph" viewBox="0 0 16 14" aria-hidden="true"><path d="M8 1 15 13H1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="9" r="1.5" fill="currentColor"/></svg>';

/** Verified: a crisp printed check. */
export const ICON_VERIFIED =
  '<svg width="60%" height="60%" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.5 10.5 2.5" fill="none" stroke="#fdfdfb" stroke-width="2.4" stroke-linecap="square"/></svg>';

/** Confirmed: a hand-pencilled tick. */
export const ICON_CONFIRMED =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M3.5 13.2c1.6.9 3.1 2.6 4.4 5.1 2.4-6.3 6.6-11.3 12.6-14.6" fill="none" stroke="#fdfdfb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="M3.5 13.2c1.6.9 3.1 2.6 4.4 5.1 2.4-6.3 6.6-11.3 12.6-14.6" fill="none" stroke="#5c2170" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICON_CLOSE =
  '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M5 5l12 12M17 5 5 17" stroke="currentColor" stroke-width="2"/></svg>';

export const ICON_IMPRINT =
  '<svg width="11" height="10" viewBox="0 0 16 14" aria-hidden="true"><path d="M8 1 15 13H1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

export const ICON_CAMERA =
  '<svg width="28" height="24" viewBox="0 0 28 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M2 7h6l2.5-4h7L20 7h6v15H2Z"/><circle cx="14" cy="14" r="4.6"/></svg>';

export const ICON_DOWNLOAD =
  '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M13 3v13M7.5 10.5 13 16l5.5-5.5M4 18v4h18v-4"/></svg>';

/** The Card menu: a map sheet's grid. */
export const ICON_GRID =
  '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="16" height="16"/><path d="M3 9h16M3 15h16M9 3v16M15 3v16" stroke-width="1"/></svg>';

export const ICON_READY =
  '<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.5 10.5 2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/** "Use my location": a map's position mark. */
export const ICON_LOCATE =
  '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><circle cx="11" cy="11" r="1.6" fill="currentColor"/><path d="M11 1v4M11 17v4M1 11h4M17 11h4"/></svg>';
