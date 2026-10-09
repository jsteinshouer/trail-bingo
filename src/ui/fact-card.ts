import type { Fact, Taxon } from "../game";
import { esc } from "./text";

/** One object URL per stored photo, made when it's first shown and released when the Card is replaced. */
const urls = new Map<Blob, string>();

export function photoUrl(image: Blob): string {
  let url = urls.get(image);
  if (!url) urls.set(image, (url = URL.createObjectURL(image)));
  return url;
}

/** Frees the photos shown for the Card being replaced. */
export function releasePhotos() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

/** "Photo © Tobin Brown, some rights reserved (CC BY-NC), via iNaturalist." */
export const photoCredit = (credit: string, lead = "Photo") =>
  `${lead} ${esc(credit.replace(/^\(c\)/, "©"))}, via iNaturalist.`;

export const referencePhoto = (taxon: Taxon, image: Blob) =>
  `<img src="${photoUrl(image)}" alt="Reference photo: ${esc(taxon.name)}">`;

/**
 * The fact card: the player's Sighting photo beside the reference photo, then
 * how the Square was marked, then for any fungus the warning never to eat it
 * on this identification, then a short summary. Every photo and summary is credited.
 */
export function factCard(taxon: Taxon, fact: Fact | undefined, { sightingPhoto = "", status = "" } = {}): string {
  const ref = fact?.photo;
  const tile = (img: string, label: string) => `<div class="tile"><div class="tile-photo">${img}</div><span>${label}</span></div>`;
  const tiles =
    (sightingPhoto ? tile(`<img src="${sightingPhoto}" alt="Your Sighting of ${esc(taxon.name)}">`, "Your Sighting") : "") +
    (ref ? tile(referencePhoto(taxon, ref.image), "Reference") : "");
  const photos = tiles
    ? `<figure class="tiles${sightingPhoto && ref ? " pair" : ""}">${tiles}
        ${ref ? `<figcaption class="credit">${photoCredit(ref.credit, sightingPhoto ? "Reference photo" : "Photo")}</figcaption>` : ""}</figure>`
    : "";
  const source = fact?.summarySource;
  const summary = fact?.summary
    ? `<p class="summary">${esc(fact.summary)}</p>` +
      (source
        ? `<p class="credit">From ${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.name)}</a>` : esc(source.name)}.</p>`
        : "")
    : `<p class="hint">There's no short summary for this one yet.</p>`;
  const warning =
    taxon.group === "fungus"
      ? `<p class="warning" role="note"><b>Never eat it.</b> Never eat a mushroom or anything else because of this identification: some deadly ones look just like safe ones.</p>`
      : "";
  return `<section class="fact" aria-label="About ${esc(taxon.name)}">${photos}${status}${warning}${summary}</section>`;
}
