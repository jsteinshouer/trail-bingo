# 05 — Build a Card from my location

**What to build:** The player builds a real Card for where they are. They tap "use my location", choose a Card size (3×3, 4×4, 5×5) and which groups to include (plants and wildflowers, trees and shrubs, fungi and lichens, animals). The app fetches plants, fungi and animals observed nearby from iNaturalist, picks the Squares, computes text vectors for the whole local species list, and shows a "Ready offline" confirmation. Animal Squares are checked by roll-up: the best-matching local animal species decides the broad group. Building a new Card asks for confirmation before replacing the current one. This replaces the hard-coded demo Card.

**Blocked by:** 03 — Photo check on the demo Card

**Status:** ready-for-agent

- [x] "Use my location" gets the device location
- [x] Species source adapter returns research-grade species observed near a location, within a radius and season window, with observation counts and taxonomy — tested against recorded iNaturalist responses (normal, empty, error)
- [x] Card generation (tested through the game module with a fake species source):
  - [x] Card size and selected groups are respected
  - [x] Season window is the current month ±1 month, across all years
  - [x] About two-thirds of Squares are common species and one-third rarer ones
  - [x] Plant, tree and fungus Squares name a species; animal Squares name a broad group (mammal, bird, reptile, amphibian, butterfly/moth, other insect, spider), offered only if something in that group was observed nearby
  - [x] Radius widens from 10 km to 25 km when needed; if it still can't fill the Card, a clear message suggests a smaller size or more groups
  - [x] Wildcard is in the center on 3×3 and 5×5, and on one of the four middle Squares on 4×4
- [x] Text vectors are computed for the full local species list (plants, fungi and animals), using "a photo of <scientific name>, <common name>." labels; species not on the Card serve as decoys
- [x] A Sighting of an animal fills a broad animal Square when its best-matching local animal species belongs to that group, using the same gap rule as ticket 03 (tested)
- [x] Card shows a "Ready offline" confirmation when everything it needs is stored
- [x] Building a new Card asks for confirmation before replacing the current one

## Comments

**Implemented on branch `05-card-from-location`.**

- **Game module:** `game.buildCard({ place, size, groups }, onProgress)` takes the injected adapters `species`, plus `now` and `random` (seeded in tests).
  - It searches 10 km first, then 25 km.
  - The season is this month and the one either side (`seasonMonths`).
  - It encodes every local species' label before the new Card replaces the current one. If the build fails, the current Card and its marks stay.
  - `NotEnoughSpeciesError` says to try a smaller Card or more groups.
  - Generation is in `src/game/card-builder.ts`:
    - Squares are dealt one group at a time, so the chosen groups share evenly while they have Squares left.
    - About a third of all species Squares come from the less observed half of their group, counted across the whole Card.
    - Each animal group is one Square, offered only when something in it was seen.
    - Every local species, chosen groups or not, goes into `localSpecies` as a decoy.
  - Tested through `createGame` with a fake species source (`build-card.test.ts`).
- **Species source** (`src/species/`): iNaturalist `observations/species_counts`, research grade, rank species. One request covers plants and fungi and one covers animals, up to 300 species each, most observed first. Tested against recorded responses (`fixtures/record.sh`): normal, empty, HTTP 500, unreachable.
  - **Trees vs plants:** iNaturalist has no growth-form field. A plant counts as a tree or shrub when one of its ancestors is on a curated list of woody families and genera (`woody.ts`, 81 taxa). Anything not on the list is a plant. Grow the list if the hike turns up shrubs filed as plants.
  - Species with no common name stay in the local list (labelled "a photo of *X*.") but never name a Square. Arachnids other than spiders are dropped.
  - Common names are capitalized as iNaturalist gives them ("Common Sunflower", "Giant blue sage").
- **Place:**
  - "Use my location" rounds the position to about 1 km before it leaves the phone.
  - The Card's name comes from OpenStreetMap Nominatim reverse geocoding at zoom 14, which gives "Elkhorn" rather than the city of Omaha around it. In the backcountry it falls back to the county, and on failure to "Your location". Tested against recorded responses (`src/places/fixtures/`).
  - Nominatim is a second service that sees the rough location. Ticket 06's place search will use a geocoder anyway.
- **UI:**
  - The builder overlay (`src/ui/builder.ts`) has Where, Card size and "What to look for", plus a progress bar for label encoding.
  - Building over a Card asks "Replace your Elkhorn Card?" first.
  - The Card screen's collar has the grid button (New Card for now; ticket 08 can make it the Card menu with photo credits) and "Ready offline".
  - The demo Card is gone, so the app opens on the builder.
- **Checked in headless Chromium** (fake geolocation at Elkhorn, real iNaturalist and Nominatim):
  - Elkhorn, Nebraska → 3×3 Card: 2 plants, 2 trees, 2 fungi, 2 animal groups, Wildcard in the center → "Ready offline".
  - New Card → "Replace your Elkhorn Card?" → Keep kept it.
- **For later tickets:**
  - **Build time:** 504 local species took about 5 minutes to encode on the dev machine's WebAssembly fallback (about 0.5 s per label, plus about 55 s to load the model). On the phone with WebGPU this should be much faster, but it hasn't been measured. If it's slow, lower `PER_REQUEST` in `src/species/index.ts`.
  - **"Ready offline"** is true for the current session: playing needs no signal. But the Card lives in memory until ticket 09 stores it, and reference photos and facts arrive with ticket 08.
  - **Real nature, unfiltered:** the Elkhorn Card included Maize and Cannabis (feral hemp), both research-grade wild observations. Consider a skip-list if that's not wanted on a family Card.
