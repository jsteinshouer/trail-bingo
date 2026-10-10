# 11 — Hike test and threshold tuning

**What to build:** Take Trail Bingo on a real hike, play a full Card offline, and tune the photo check's confidence thresholds based on real Sightings. Fix whatever breaks. This is the "take it outside" bonus and the material for the post.

**Blocked by:** 07 — Wildcard and likely-species naming; 10 — Installable and offline

**Status:** ready-for-human

- [ ] A Card built at home for the hike location
- [ ] A full hike played offline on the Android phone
- [ ] Notes kept on what worked and what didn't: matches, misses, Confirmed vs Verified, speed, battery, screen time
- [ ] Confidence thresholds adjusted from real Sightings
- [ ] Bugs found are fixed or filed as new tickets

## Comments

**Hike log added on branch `11-hike-test-and-threshold-tuning`** (tooling for this ticket; the hike itself is for the human).

- **Turn it on before the hike:** Card menu (grid button) → **Keep a hike log**. Starting it clears earlier entries, so it holds just the hike.
- **What it records, for every Sighting:**
  - the outcome (Verified, already marked, not on the Card, unsure, or a failed check)
  - the Square, and for unsure Sightings the guesses offered and what you picked or dismissed
  - the photo check's five best matches with scores, whether each Square was already marked, the gap and the threshold (0.03)
  - encode and match times, with the first check after launch flagged
  - WebGPU or WebAssembly, battery level, and your photo

  It also records the stretches the app was on screen.
- **After the hike:** Card menu → **Export hike log** saves one JSON file with the photos embedded (via the share sheet where Chrome allows, otherwise a download). Share it back for the threshold analysis. **Stop and delete hike log** removes it from the phone.
- **Privacy:** the log is off by default, stays on the phone, and leaves only when exported. PRODUCT.md principle 5 and the spec's Modules list record this.
- **Code:**
  - `game.sighting()` returns `check` with each outcome.
  - `src/hike-log/` has `entryFor`, `failedEntryFor` and `toExport`, unit-tested, plus the IndexedDB log.
  - The camera reports checks and guess resolutions.
  - The Card menu (grid button) now holds New Card and the hike log items.
- **Checked in headless Chromium:**
  - A Sighting before turning the log on isn't recorded.
  - With the log on, three Sightings were logged with all fields, including `{"picked": "Ash-tree bolete"}` for an unsure one, plus a screen-time stretch.
  - Stop and delete left 0 entries.
- **Known limit:** a pick can be lost if the app is killed in the instant after a check, before its entry is saved.
