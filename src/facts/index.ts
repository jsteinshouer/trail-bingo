import type { Fact, FactSource, PhotoSize, Taxon } from "../game";

const API = "https://api.inaturalist.org/v1/taxa";

/** iNaturalist answers up to 30 taxa per request. */
const BATCH = 30;
/** Photos downloading at once. */
const PARALLEL_PHOTOS = 6;
/** A fact card is short: the phone goes back in the pocket. */
const SENTENCES = 3;

interface InatTaxon {
  id: number;
  wikipedia_summary?: string | null;
  wikipedia_url?: string | null;
  default_photo?: { url: string; attribution: string } | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Wikipedia's HTML summary as plain text. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (entity, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity;
      return String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** The first few whole sentences. iNaturalist cuts long summaries off with "...", and a cut-off sentence is dropped. */
function shortSummary(text: string): string {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map((s) => s.trim()) ?? [];
  if (/(\.\.\.|…)$/.test(text)) sentences.pop();
  return sentences.slice(0, SENTENCES).join(" ");
}

/** Runs `task` over `items`, a few at a time. */
async function inParallel<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Summaries from Wikipedia and reference photos, both through iNaturalist's taxa. */
export function createInatFactSource({ fetch }: { fetch: typeof globalThis.fetch }): FactSource {
  async function taxaById(ids: number[]): Promise<InatTaxon[]> {
    let response: Response;
    try {
      response = await fetch(`${API}/${ids.join(",")}?locale=en&per_page=${BATCH}`);
    } catch {
      throw new Error("Couldn't reach iNaturalist for facts. Check your connection, then try again.");
    }
    if (!response.ok) throw new Error(`iNaturalist couldn't answer for facts (HTTP ${response.status}). Try again in a minute.`);
    return (await response.json()).results;
  }

  /** The photo, or nothing: a fact is still worth having without one. */
  async function download(url: string): Promise<Blob | undefined> {
    try {
      const response = await fetch(url);
      return response.ok ? await response.blob() : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    async factsFor(taxa, { photoSize, onProgress }) {
      const known = taxa.filter((t): t is Taxon & { taxonId: number } => t.taxonId !== undefined);
      const found: { taxon: Taxon; inat: InatTaxon }[] = [];
      for (let i = 0; i < known.length; i += BATCH) {
        const batch = known.slice(i, i + BATCH);
        const byId = new Map((await taxaById(batch.map((t) => t.taxonId))).map((t) => [t.id, t]));
        for (const taxon of batch) {
          const inat = byId.get(taxon.taxonId);
          if (inat) found.push({ taxon, inat });
        }
      }

      const facts = new Map<string, Fact>();
      let done = 0;
      await inParallel(found, PARALLEL_PHOTOS, async ({ taxon, inat }) => {
        const fact: Fact = {};
        if (inat.wikipedia_summary) {
          fact.summary = shortSummary(plainText(inat.wikipedia_summary));
          if (inat.wikipedia_url) fact.summarySource = { name: "Wikipedia", url: inat.wikipedia_url.replace(/ /g, "_") };
        }
        if (inat.default_photo) {
          const image = await download(inat.default_photo.url.replace(/\/square\./, `/${photoSize satisfies PhotoSize}.`));
          if (image) fact.photo = { image, credit: inat.default_photo.attribution };
        }
        facts.set(taxon.scientificName, fact);
        onProgress?.(++done);
      });
      return facts;
    },
  };
}
