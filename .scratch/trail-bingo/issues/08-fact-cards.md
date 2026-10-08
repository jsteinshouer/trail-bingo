# 08 — Fact cards

**What to build:** The player learns something with every find. When a Card is built, a short summary and reference photo for each Square (and the local species list, for Wildcard and likely-species finds) are fetched and stored. After a matched Sighting, a quick fact card shows the name, reference photo and a two-to-three sentence summary with source attribution, and is dismissed with one tap. Tapping a marked Square reopens its fact card. Fungus fact cards always show a warning never to eat anything based on this identification.

**Blocked by:** 05 — Build a Card from my location

**Status:** ready-for-agent

- [ ] Fact source adapter returns a summary, reference photo and attribution for a taxon from iNaturalist or Wikipedia — tested against recorded responses (normal, missing summary, error)
- [ ] Facts and reference photos are fetched and stored at Card build time so they work offline
- [ ] Tapping an unmarked Square offers its reference photo as a clue; the Card itself shows no reference photos (see `docs/design/card-grid/brief.md`)
- [ ] A fact card appears after each matched Sighting and is dismissed with one tap
- [ ] Tapping a marked Square reopens its fact card
- [ ] Every fact card credits its source
- [ ] Every fungus fact card shows the "never eat based on this identification" warning
