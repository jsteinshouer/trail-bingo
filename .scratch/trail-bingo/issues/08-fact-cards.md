# 08 — Fact cards

**What to build:** The player learns something with every find. When a Card is built, a short summary and reference photo for each Square (and the local species list, for Wildcard and likely-species finds) are fetched and stored. After a matched Sighting, a quick fact card shows the name, reference photo and a two-to-three sentence summary with source attribution, and is dismissed with one tap. Tapping a marked Square reopens its fact card. Fungus fact cards always show a warning never to eat anything based on this identification.

**Blocked by:** 05 — Build a Card from my location

**Status:** ready-for-agent

- [x] Fact source adapter returns a summary, reference photo and attribution for a taxon from iNaturalist or Wikipedia — tested against recorded responses (normal, missing summary, error)
- [x] Facts and reference photos are fetched and stored at Card build time so they work offline
- [x] Tapping an unmarked Square offers its reference photo as a clue; the Card itself shows no reference photos (see `docs/design/card-grid/brief.md`)
- [x] A fact card appears after each matched Sighting and is dismissed with one tap
- [x] Tapping a marked Square reopens its fact card
- [x] Every fact card credits its source
- [x] Every fungus fact card shows the "never eat based on this identification" warning

## Comments

**Implemented on branch `08-fact-cards`.**

- **Fact source** (`src/facts/`): `createInatFactSource({ fetch }).factsFor(taxa, { photoSize })` asks iNaturalist's taxa endpoint, 30 at a time, by the `taxonId` the species source now passes through.
  - **Summary:** the `wikipedia_summary`, as plain text, at most three whole sentences. It doesn't split at "U.S.", "Q. alba", "e.g." or decimals, and drops iNaturalist's "..." fragment. It's always credited to Wikipedia, linked when there's a URL.
  - **Photo:** the default photo, downloaded as a blob with its attribution. A photo that fails to download is left out; the fact still counts.
  - Tested against recorded responses (`fixtures/record.sh`): normal, missing summary/photo, missing taxon, 422 and unreachable, plus one hand-made summary for sentence splitting.
- **Game module:**
  - `buildCard` fetches facts for every local species before the long label encoding, while there's still signal. The Card's species and one example per animal Square get "medium" photos (the clues); the rest of the list gets "small" ones. That's about 25–40 MB for a ~500-species Card, which took under a minute on the dev machine.
  - A failed facts fetch fails the build, and the current Card stays.
  - `game.factFor(taxon)` and `game.clue(index)`: an animal Square's clue is its most observed local species; the Wildcard has none.
  - Facts are held in memory with the Card; keeping them across restarts is ticket 09.
- **UI:**
  - **Fact card** (`src/ui/fact-card.ts`): your Sighting photo beside the reference photo, then Verified or Confirmed, then the fungus warning, then the summary. Every photo and summary is credited ("Photo © …, via iNaturalist.", "From Wikipedia.").
  - **After a Verified or Confirmed mark,** the Square's fact card opens once the photo has developed and closes with one tap. The Bingo/Blackout celebration waits until it's dismissed, so learning comes first. This departs from the brief's back-to-back sequence.
  - **Tapping a marked Square** reopens its fact card.
  - **Repeat and off-Card Sightings** show the fact in the camera result.
  - **Unmarked Squares** have "Show a clue" (map-tint panel, as in the mockup), which reveals the reference photo with its credit, or "For example, a Monarch" for an animal.
  - The builder shows a "Saving facts and photos" progress step.
  - The 5×5 found note from ticket 07 is gone: the fact card names what was found.
- **Checked in headless Chromium** (real iNaturalist Cards near Elkhorn; camera replaced by the spike's test photos):
  - The species clue and animal clue showed their credits.
  - Deer → the Wildcard's fact card opened, then dismissed with one tap on the dimmed Card.
  - Repeat yarrow → "Not on your Card" with the fact, and the answer stayed in view.
  - The fungus fact card and its warning were checked on a page rendering `factCard` directly, since the test photos never matched a Card's fungus.
