import { wildcardPosition, type Card, type CardSize, type Square, type Taxon } from "./game";

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

// Other living things commonly observed around Elkhorn in autumn. The photo check
// compares Sightings with these too, so a Sighting of something off the Card isn't
// forced onto it, and the animals decide which broad animal Square a Sighting fills.
const LOCAL: Taxon[] = [
  { group: "tree", name: "Green ash", scientificName: "Fraxinus pennsylvanica" },
  { group: "tree", name: "Silver maple", scientificName: "Acer saccharinum" },
  { group: "tree", name: "Black walnut", scientificName: "Juglans nigra" },
  { group: "tree", name: "Honey locust", scientificName: "Gleditsia triacanthos" },
  { group: "plant", name: "Common yarrow", scientificName: "Achillea millefolium" },
  { group: "plant", name: "Common dandelion", scientificName: "Taraxacum officinale" },
  { group: "plant", name: "Giant ragweed", scientificName: "Ambrosia trifida" },
  { group: "plant", name: "Common mullein", scientificName: "Verbascum thapsus" },
  { group: "plant", name: "Smooth brome", scientificName: "Bromus inermis" },
  { group: "fungus", name: "Chicken of the woods", scientificName: "Laetiporus sulphureus" },
  { group: "fungus", name: "Oyster mushroom", scientificName: "Pleurotus ostreatus" },
  { group: "fungus", name: "Common greenshield lichen", scientificName: "Flavoparmelia caperata" },
  { group: "mammal", name: "White-tailed deer", scientificName: "Odocoileus virginianus" },
  { group: "mammal", name: "Eastern fox squirrel", scientificName: "Sciurus niger" },
  { group: "mammal", name: "Eastern cottontail", scientificName: "Sylvilagus floridanus" },
  { group: "mammal", name: "Raccoon", scientificName: "Procyon lotor" },
  { group: "bird", name: "American robin", scientificName: "Turdus migratorius" },
  { group: "bird", name: "Northern cardinal", scientificName: "Cardinalis cardinalis" },
  { group: "bird", name: "Blue jay", scientificName: "Cyanocitta cristata" },
  { group: "bird", name: "Black-capped chickadee", scientificName: "Poecile atricapillus" },
  { group: "butterfly-or-moth", name: "Monarch", scientificName: "Danaus plexippus" },
  { group: "butterfly-or-moth", name: "Painted lady", scientificName: "Vanessa cardui" },
  { group: "insect", name: "Differential grasshopper", scientificName: "Melanoplus differentialis" },
  { group: "insect", name: "Western honey bee", scientificName: "Apis mellifera" },
  { group: "insect", name: "Common eastern bumble bee", scientificName: "Bombus impatiens" },
  { group: "reptile", name: "Common garter snake", scientificName: "Thamnophis sirtalis" },
  { group: "amphibian", name: "American toad", scientificName: "Anaxyrus americanus" },
  { group: "spider", name: "Yellow garden spider", scientificName: "Argiope aurantia" },
];

// Order Squares are dealt in, so a 3×3 still gets a mix of trees, plants, fungi and animals.
const DEAL = [1, 19, 5, 6, 18, 3, 20, 9, 0, 21, 2, 4, 15, 7, 22, 10, 8, 11, 23, 12, 13, 14, 16, 17];

export function demoCard(size: CardSize): Card {
  const wild = wildcardPosition(size);
  let dealt = 0;
  const squares: Square[] = Array.from({ length: size * size }, (_, i) =>
    i === wild ? { kind: "wildcard" } : SQUARES[DEAL[dealt++]],
  );
  // Species left off a smaller Card are still local, so they're still compared with.
  const undealt = SQUARES.filter((s) => !squares.includes(s)).flatMap((s) => (s.kind === "species" ? [s] : []));
  return {
    place: { name: "Elkhorn", region: "Nebraska", lat: 41.28, lng: -96.24, radiusKm: 10 },
    month: 10,
    size,
    squares,
    localSpecies: [...undealt, ...LOCAL],
  };
}
