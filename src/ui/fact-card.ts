import type { Fact, Taxon } from "../game";
import { esc } from "./text";

/** One object URL per stored photo, made when it's first shown. */
const urls = new WeakMap<Blob, string>();

export function photoUrl(image: Blob): string {
  let url = urls.get(image);
  if (!url) urls.set(image, (url = URL.createObjectURL(image)));
  return url;
}

/** "Photo © Tobin Brown, some rights reserved (CC BY-NC), via iNaturalist." */
export const photoCredit = (credit: string) => `Photo ${esc(credit.replace(/^\(c\)/, "©"))}, via iNaturalist.`;

/**
 * The fact card: a reference photo with its credit, a short summary with its
 * source, and for any fungus the warning never to eat it on this identification.
 * Given the player's own Sighting photo, the two sit side by side to compare.
 */
export function factCard(taxon: Taxon, fact: Fact | undefined, sightingPhoto?: string): string {
  const ref = fact?.photo;
  const tile = (src: string, alt: string, label: string) =>
    `<div class="tile"><div class="tile-photo"><img src="${src}" alt="${alt}"></div><span>${label}</span></div>`;
  const tiles = [
    sightingPhoto ? tile(sightingPhoto, `Your Sighting of ${esc(taxon.name)}`, "Your Sighting") : "",
    ref ? tile(photoUrl(ref.image), `Reference photo: ${esc(taxon.name)}`, "Reference") : "",
  ].join("");
  const photo = tiles
    ? `<figure class="tiles${sightingPhoto && ref ? " pair" : ""}">${tiles}
        ${ref ? `<figcaption class="credit">${sightingPhoto ? "Reference photo" : "Photo"} ${photoCredit(ref.credit).replace(/^Photo /, "")}</figcaption>` : ""}</figure>`
    : "";
  const summary = fact?.summary
    ? `<p class="summary">${esc(fact.summary)}</p>` +
      (fact.summarySource
        ? `<p class="credit">From <a href="${esc(fact.summarySource.url)}" target="_blank" rel="noopener">${esc(fact.summarySource.name)}</a>.</p>`
        : "")
    : `<p class="hint">There's no short summary for this one yet.</p>`;
  const warning =
    taxon.group === "fungus"
      ? `<p class="warning" role="note"><b>Never eat it.</b> Never eat a mushroom or anything else because of this identification: some deadly ones look just like safe ones.</p>`
      : "";
  return `<section class="fact" aria-label="About ${esc(taxon.name)}">${warning}${photo}${summary}</section>`;
}
