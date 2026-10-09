import type { AnimalGroup, LocalSpecies, SpeciesGroup, SpeciesQuery, SpeciesSource } from "../game";
import { WOODY_TAXA } from "./woody";

const API = "https://api.inaturalist.org/v1/observations/species_counts";

/**
 * Species per request, most observed first. The photo check encodes every one
 * at Card build time, so this bounds how long a build takes on the phone.
 */
const PER_REQUEST = 300;

/** iNaturalist taxon IDs that decide a species' group. */
const FUNGI = 47170;
const PLANTAE = 47126;
/** Most specific first: a butterfly is an insect too, but fills "a butterfly or moth". */
const ANIMAL_GROUPS: [number, AnimalGroup][] = [
  [47157, "butterfly-or-moth"], // Lepidoptera
  [47158, "insect"], // Insecta
  [47118, "spider"], // Araneae
  [40151, "mammal"], // Mammalia
  [3, "bird"], // Aves
  [26036, "reptile"], // Reptilia
  [20978, "amphibian"], // Amphibia
];

/** One request for the plants and fungi, one for the animals, so neither crowds out the other. */
const ICONIC_TAXA = ["Plantae,Fungi", "Mammalia,Aves,Reptilia,Amphibia,Insecta,Arachnida"];

interface SpeciesCount {
  count: number;
  taxon: { name: string; preferred_common_name?: string; ancestor_ids: number[] };
}

function groupOf(ancestors: number[]): SpeciesGroup | AnimalGroup | null {
  if (ancestors.includes(FUNGI)) return "fungus";
  if (ancestors.includes(PLANTAE)) return ancestors.some((id) => WOODY_TAXA.has(id)) ? "tree" : "plant";
  return ANIMAL_GROUPS.find(([id]) => ancestors.includes(id))?.[1] ?? null;
}

const capitalize = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** Species observed near a place, from iNaturalist's research-grade observations. */
export function createInatSpeciesSource({ fetch }: { fetch: typeof globalThis.fetch }): SpeciesSource {
  async function speciesCounts(query: SpeciesQuery, iconicTaxa: string): Promise<SpeciesCount[]> {
    const url = new URL(API);
    url.search = new URLSearchParams({
      lat: String(query.lat),
      lng: String(query.lng),
      radius: String(query.radiusKm),
      month: query.months.join(","),
      quality_grade: "research",
      rank: "species",
      iconic_taxa: iconicTaxa,
      locale: "en",
      per_page: String(PER_REQUEST),
    }).toString();
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error("Couldn't reach iNaturalist. Check your connection, then try again.");
    }
    if (!response.ok) throw new Error(`iNaturalist couldn't answer (HTTP ${response.status}). Try again in a minute.`);
    return (await response.json()).results;
  }

  return {
    async speciesNear(query) {
      const counts = (await Promise.all(ICONIC_TAXA.map((iconic) => speciesCounts(query, iconic)))).flat();
      return counts.flatMap(({ count, taxon }) => {
        const group = groupOf(taxon.ancestor_ids);
        // Arachnids other than spiders don't fill any Square.
        if (!group) return [];
        const name = taxon.preferred_common_name ? capitalize(taxon.preferred_common_name) : taxon.name;
        return [{ group, name, scientificName: taxon.name, observations: count }];
      });
    },
  };
}
