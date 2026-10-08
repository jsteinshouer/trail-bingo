# 05 — Build a Card from my location

**What to build:** The player builds a real Card for where they are. They tap "use my location", choose a Card size (3×3, 4×4, 5×5) and which groups to include (plants and wildflowers, trees and shrubs, fungi and lichens, animals). The app fetches species observed nearby from iNaturalist, picks the Squares, computes the text vectors for Squares and decoys, and shows a "Ready offline" confirmation. Building a new Card asks for confirmation before replacing the current one. This replaces the hard-coded demo Card.

**Blocked by:** 03 — Photo check on the demo Card

**Status:** ready-for-agent

- [ ] "Use my location" gets the device location
- [ ] Species source adapter returns research-grade species observed near a location, within a radius and season window, with observation counts and taxonomy — tested against recorded iNaturalist responses (normal, empty, error)
- [ ] Card generation (tested through the game module with a fake species source):
  - [ ] Card size and selected groups are respected
  - [ ] Season window is the current month ±1 month, across all years
  - [ ] About two-thirds of Squares are common species and one-third rarer ones
  - [ ] Plant, tree and fungus Squares name a species; animal Squares name a broad group (mammal, bird, reptile, amphibian, butterfly/moth, other insect, spider), offered only if something in that group was observed nearby
  - [ ] Radius widens from 10 km to 25 km when needed; if it still can't fill the Card, a clear message suggests a smaller size or more groups
  - [ ] Wildcard is in the center on 3×3 and 5×5, and on one of the four middle Squares on 4×4
- [ ] Text vectors are computed for every Square and about 20 local decoy species
- [ ] Card shows a "Ready offline" confirmation when everything it needs is stored
- [ ] Building a new Card asks for confirmation before replacing the current one
