import { wildcardPosition, type Card, type CardSize, type Square } from "./game";

// A hand-assembled Card that's plausible for Elkhorn, NE in October. The Card
// generator (ticket 05) replaces it.
const SQUARES: Square[] = [
  { kind: "species", group: "tree", name: "Eastern cottonwood", scientificName: "Populus deltoides" },
  { kind: "species", group: "tree", name: "Bur oak", scientificName: "Quercus macrocarpa" },
  { kind: "species", group: "tree", name: "Smooth sumac", scientificName: "Rhus glabra" },
  { kind: "species", group: "plant", name: "Common milkweed", scientificName: "Asclepias syriaca" },
  { kind: "species", group: "plant", name: "Big bluestem", scientificName: "Andropogon gerardi" },
  { kind: "species", group: "plant", name: "Canada goldenrod", scientificName: "Solidago canadensis" },
  { kind: "species", group: "fungus", name: "Turkey tail", scientificName: "Trametes versicolor" },
  { kind: "species", group: "tree", name: "Eastern redcedar", scientificName: "Juniperus virginiana" },
  { kind: "species", group: "tree", name: "Common hackberry", scientificName: "Celtis occidentalis" },
  { kind: "species", group: "plant", name: "Eastern poison ivy", scientificName: "Toxicodendron radicans" },
  { kind: "species", group: "plant", name: "New England aster", scientificName: "Symphyotrichum novae-angliae" },
  { kind: "species", group: "plant", name: "Maximilian sunflower", scientificName: "Helianthus maximiliani" },
  { kind: "species", group: "plant", name: "Virginia creeper", scientificName: "Parthenocissus quinquefolia" },
  { kind: "species", group: "tree", name: "White mulberry", scientificName: "Morus alba" },
  { kind: "species", group: "plant", name: "Wild bergamot", scientificName: "Monarda fistulosa" },
  { kind: "species", group: "fungus", name: "Splitgill mushroom", scientificName: "Schizophyllum commune" },
  { kind: "species", group: "tree", name: "Roughleaf dogwood", scientificName: "Cornus drummondii" },
  { kind: "species", group: "tree", name: "American elm", scientificName: "Ulmus americana" },
  { kind: "animal", group: "bird", name: "A bird" },
  { kind: "animal", group: "mammal", name: "A mammal" },
  { kind: "animal", group: "butterfly-or-moth", name: "A butterfly or moth" },
  { kind: "animal", group: "insect", name: "Another insect" },
  { kind: "animal", group: "reptile", name: "A reptile" },
  { kind: "animal", group: "amphibian", name: "An amphibian" },
];

// Order Squares are dealt in, so a 3×3 still gets a mix of trees, plants, fungi and animals.
const DEAL = [1, 19, 5, 6, 18, 3, 20, 9, 0, 21, 2, 4, 15, 7, 22, 10, 8, 11, 23, 12, 13, 14, 16, 17];

export function demoCard(size: CardSize): Card {
  const wild = wildcardPosition(size);
  let dealt = 0;
  return {
    place: { name: "Elkhorn", region: "Nebraska", lat: 41.28, lng: -96.24, radiusKm: 10 },
    month: 10,
    size,
    squares: Array.from({ length: size * size }, (_, i) =>
      i === wild ? { kind: "wildcard" } : SQUARES[DEAL[dealt++]],
    ),
  };
}
