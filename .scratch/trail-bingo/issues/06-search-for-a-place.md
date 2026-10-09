# 06 — Search for a place

**What to build:** From home, the player types the name of a trail, park or town, picks a result, and builds a Card for that place instead of their current location.

**Blocked by:** 05 — Build a Card from my location

**Status:** ready-for-agent

- [x] A search box returns matching places for a typed name
- [x] Choosing a result builds a Card for that place using the same flow as "use my location"
- [x] No results and lookup errors show a clear message
- [x] "Use my location" is still available next to search

## Comments

**Implemented on branch `06-search-for-a-place`.**

- **Geocoder: OpenStreetMap Nominatim**, chosen over iNaturalist's place search, which finds parks and trails but misses towns like Moab. Nominatim sees only the typed name; the device location still goes only to iNaturalist, rounded.
- **Place search** (`src/places/`): `createPlaceSearch({ fetch }).search(name)` returns up to 8 places, each with a `detail` line ("Nature reserve · Cass County, Nebraska, United States") to tell same-named places apart. Tested against recorded responses (`fixtures/record.sh`): park, town, same-named towns, trail, state, nothing found, HTTP error, unreachable.
  - **Trails:** Nominatim ranks streets named "Bright Angel Trail" above the real one. Roads are dropped and only paths, footways, tracks and bridleways are kept, labelled "Trail". It asks for 15 results to leave room.
  - **Region:** a state's region is its country, so "Utah" reads "Utah, United States".
  - **Usage policy:** searches run on submit only (no search-as-you-type), and answers are remembered for the session.
- **Builder:** the Where section has a search box, then results, then "or", then Use my location.
  - Picking a result fills the place line ("Platte River State Park, Nebraska") and enables Build, the same as Use my location.
  - Results carry the "Places © OpenStreetMap contributors" credit.
  - If "Use my location" fails, a place already picked from search still stands.
  - No results: "No place called … was found. Try a nearby town or park, or check the spelling." Errors say so and point to Use my location.
  - A Card built for a found place carries its name: the collar title, "Replace your Platte River State Park Card?", the Bingo stamp.
- **Checked in headless Chromium** (real Nominatim and iNaturalist):
  - Nonsense query → no-results message. Nominatim blocked → error message.
  - Platte River State Park → 3×3 Card with that title and "Nebraska · October · Ready offline".
  - Bright Angel Trail → only the two Grand Canyon trail segments.
- **Not checked yet:** the target phone.
