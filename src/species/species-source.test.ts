import { describe, expect, it } from "vitest";
import type { LocalSpecies } from "../game";
import { createInatSpeciesSource } from "./index";
import plantsFungi from "./fixtures/plants-fungi.json";
import animals from "./fixtures/animals.json";
import empty from "./fixtures/empty.json";
import error500 from "./fixtures/error-500.json";

/*
 * Recorded iNaturalist responses for Elkhorn, NE, 10 km, September–November
 * (see fixtures/record.sh). The fake fetch serves them by `iconic_taxa`.
 */

const QUERY = { lat: 41.2864, lng: -96.237, radiusKm: 10, months: [9, 10, 11] };

type Body = { status: number; json: unknown };

function fakeInat(byIconic: { plants: Body; animals: Body }) {
  const urls: URL[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url);
    const body = url.searchParams.get("iconic_taxa")!.includes("Plantae") ? byIconic.plants : byIconic.animals;
    return new Response(JSON.stringify(body.json), { status: body.status, headers: { "content-type": "application/json" } });
  };
  return { fetch, urls };
}

const ok = (json: unknown): Body => ({ status: 200, json });

async function speciesFrom(plants: Body, animalsBody: Body = ok(empty)) {
  const inat = fakeInat({ plants, animals: animalsBody });
  const species = await createInatSpeciesSource({ fetch: inat.fetch }).speciesNear(QUERY);
  return { species, urls: inat.urls };
}

const find = (species: LocalSpecies[], scientificName: string) => species.find((s) => s.scientificName === scientificName);

describe("iNaturalist species source", () => {
  it("asks for research-grade species near the place, within the radius and season window", async () => {
    const { urls } = await speciesFrom(ok(plantsFungi), ok(animals));

    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.origin + url.pathname).toBe("https://api.inaturalist.org/v1/observations/species_counts");
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        lat: "41.2864",
        lng: "-96.237",
        radius: "10",
        month: "9,10,11",
        quality_grade: "research",
        rank: "species",
      });
    }
    expect(urls.map((u) => u.searchParams.get("iconic_taxa")).sort()).toEqual([
      "Mammalia,Aves,Reptilia,Amphibia,Insecta,Arachnida",
      "Plantae,Fungi",
    ]);
  });

  it("returns plants and fungi with their observation counts", async () => {
    const { species } = await speciesFrom(ok(plantsFungi));

    expect(species).toHaveLength(25);
    expect(find(species, "Sorghastrum nutans")).toEqual({
      group: "plant",
      name: "Indiangrass",
      scientificName: "Sorghastrum nutans",
      observations: 13,
    });
    expect(find(species, "Cerioporus squamosus")).toMatchObject({ group: "fungus", name: "Dryad's Saddle", observations: 7 });
  });

  it("sorts trees and shrubs from other plants by their taxonomy", async () => {
    const { species } = await speciesFrom(ok(plantsFungi));

    for (const tree of ["Lonicera maackii", "Juniperus virginiana", "Morus alba", "Rhus glabra"]) {
      expect(find(species, tree)?.group).toBe("tree");
    }
    for (const plant of ["Salvia azurea", "Helianthus annuus", "Asclepias syriaca", "Andropogon gerardi"]) {
      expect(find(species, plant)?.group).toBe("plant");
    }
  });

  it("capitalizes common names without changing the rest", async () => {
    const { species } = await speciesFrom(ok(plantsFungi));

    expect(find(species, "Salvia azurea")?.name).toBe("Giant blue sage");
    expect(find(species, "Helianthus annuus")?.name).toBe("Common Sunflower");
  });

  it("puts animals in the Card's broad groups", async () => {
    const { species } = await speciesFrom(ok(empty), ok(animals));

    expect(find(species, "Sciurus niger")).toEqual({
      group: "mammal",
      name: "Eastern Fox Squirrel",
      scientificName: "Sciurus niger",
      observations: 37,
    });
    expect(find(species, "Passer domesticus")?.group).toBe("bird");
    // Butterflies and moths are their own group, ahead of other insects.
    expect(find(species, "Danaus plexippus")?.group).toBe("butterfly-or-moth");
    expect(find(species, "Pyrrharctia isabella")?.group).toBe("butterfly-or-moth");
    expect(find(species, "Bombus impatiens")?.group).toBe("insect");
    expect(find(species, "Platycryptus undatus")?.group).toBe("spider");
  });

  it("leaves out species with no common name, and animals outside the Card's groups", async () => {
    const plants = structuredClone(plantsFungi);
    delete (plants.results[0].taxon as { preferred_common_name?: string }).preferred_common_name;
    const critters = structuredClone(animals);
    // A harvestman: an arachnid, but not a spider.
    critters.results[0].taxon.ancestor_ids = [48460, 1, 47120, 245097, 47119, 47367];
    critters.results[0].taxon.iconic_taxon_name = "Arachnida";
    const { species } = await speciesFrom(ok(plants), ok(critters));

    expect(find(species, plantsFungi.results[0].taxon.name)).toBeUndefined();
    expect(find(species, animals.results[0].taxon.name)).toBeUndefined();
    expect(species).toHaveLength(48);
  });

  it("returns nothing when nothing has been observed nearby", async () => {
    const { species } = await speciesFrom(ok(empty), ok(empty));

    expect(species).toEqual([]);
  });

  it("fails clearly when iNaturalist answers with an error", async () => {
    await expect(speciesFrom({ status: 500, json: error500 })).rejects.toThrow(/iNaturalist.*500/);
  });

  it("fails clearly when iNaturalist can't be reached", async () => {
    const source = createInatSpeciesSource({
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await expect(source.speciesNear(QUERY)).rejects.toThrow(/iNaturalist/);
  });
});
