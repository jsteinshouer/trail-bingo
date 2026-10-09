# 07 — Wildcard and likely-species naming

**What to build:** Unexpected finds count. A Sighting confidently matching a local living thing that isn't on the Card fills the Wildcard if it's still open. When a Sighting fills a broad animal Square like "a mammal", the player is also told the likely species (for example "Looks like an Eastern Fox Squirrel"); this is the species that the roll-up from ticket 05 already matched.

**Blocked by:** 05 — Build a Card from my location

**Status:** ready-for-agent

- [x] A Sighting confidently matching a local species not on the Card fills the open Wildcard (tested)
- [x] When the Wildcard is already filled, such a Sighting results in no change and a clear message (tested)
- [x] A Sighting filling a broad animal Square reports the likely species from the local list (tested)

## Comments

**Implemented on branch `07-wildcard-and-likely-species`.**

- **Game module:**
  - A sure match to a local species that isn't on the Card marks the open Wildcard as Verified (outcome `verified` with the Wildcard's index).
  - Once the Wildcard is filled, such a Sighting returns `not-on-card` with `wildcardFilledBy` and changes nothing.
  - An unsure Sighting still can't fill the Wildcard, because only a confident match counts.
  - Marked broad animal Squares and the Wildcard keep `found`: the taxon the Sighting matched. For animals this is the roll-up species from ticket 05.
  - Unsure guesses are now `{ index, taxon }`, and `game.mark(index, "confirmed", taxon)` records the likely species for a picked animal guess.
  - Tested in `sighting.test.ts`: Wildcard fill, fill by an animal with no group Square, already-filled, Bingo through the Wildcard, likely species on Verified and Confirmed animal Squares.
- **UI:**
  - An animal Square's second line reads "likely White-tailed Deer".
  - A filled Wildcard's line names what filled it.
  - The Square detail says "Looks like …" or "Filled by …".
  - Animal guesses say what they look like ("Another insect · Looks like an Asian Lady Beetle").
  - On a 5×5 Card, whose Squares hide the second line, a printed note above the Sighting band says "A mammal · Looks like a White-tailed Deer" for 4.5 s. Ticket 08's fact card will name the species after every Sighting, so this note may become redundant then.
  - "Already filled" message: "Your Wildcard is already filled with Common yarrow, so your Card stays as it is."
  - Names keep iNaturalist's capitals ("likely White-tailed Deer", not the brief's lowercase), because lowercasing breaks proper nouns.
- **Checked in headless Chromium:** real iNaturalist Card near Elkhorn, trees + animals; the camera was replaced by a canvas showing the spike's test photos.
  - Mule deer photo → "A mammal", likely White-tailed Deer.
  - Yarrow → Wildcard filled.
  - Yarrow again → already-filled message.
  - Fly agaric → unsure, animal guesses with their look-alikes.
