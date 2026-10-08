# 05 — Build a Card from my location

**What to build:** The player builds a real Card for where they are. They tap "use my location", choose a Card size (3×3, 4×4, 5×5) and which groups to include (plants and wildflowers, trees and shrubs, fungi and lichens, animals). The app fetches plants, fungi and animals observed nearby from iNaturalist, picks the Squares, computes text vectors for the whole local species list, and shows a "Ready offline" confirmation. Animal Squares are checked by roll-up: the best-matching local animal species decides the broad group. Building a new Card asks for confirmation before replacing the current one. This replaces the hard-coded demo Card.

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
- [ ] Text vectors are computed for the full local species list (plants, fungi and animals), using "a photo of <scientific name>, <common name>." labels; species not on the Card serve as decoys
- [ ] A Sighting of an animal fills a broad animal Square when its best-matching local animal species belongs to that group, using the same gap rule as ticket 03 (tested)
- [ ] Card shows a "Ready offline" confirmation when everything it needs is stored
- [ ] Building a new Card asks for confirmation before replacing the current one
