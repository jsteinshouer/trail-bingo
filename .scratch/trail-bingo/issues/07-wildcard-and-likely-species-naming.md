# 07 — Wildcard and likely-species naming

**What to build:** Unexpected finds count. When the Card is built, text vectors are also computed for the full local species list. A Sighting confidently matching a local living thing that isn't on the Card fills the Wildcard if it's still open. When a Sighting fills a broad animal Square like "a mammal", the player is also told the likely species (for example "Looks like an Abert's Squirrel").

**Blocked by:** 05 — Build a Card from my location

**Status:** ready-for-agent

- [ ] Card building computes and stores vectors for the full local species list
- [ ] A Sighting confidently matching a local species not on the Card fills the open Wildcard (tested)
- [ ] When the Wildcard is already filled, such a Sighting results in no change and a clear message (tested)
- [ ] A Sighting filling a broad animal Square reports the likely species from the local list (tested)
