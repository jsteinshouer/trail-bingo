# 09 — Progress survives restarts

**What to build:** The player's Card, marked Squares and Sighting photos are saved on the phone, so closing the app or a phone restart mid-hike loses nothing. Everything stays on the device.

**Blocked by:** 03 — Photo check on the demo Card

**Status:** ready-for-agent

- [x] Store adapter saves and loads the active Card, its marks (Verified or Confirmed) and Sighting photos in IndexedDB
- [x] Save and restore of a Card in progress is tested through the game module with an in-memory fake store
- [x] Closing and reopening the app restores the Card exactly as it was, including Bingo count
- [x] No Card data, location or photos are sent to any server

## Comments

**Implemented on branch `09-progress-survives-restarts`.**

- **Store adapter** (`src/store/`): IndexedDB database `trail-bingo` with two records.
  - **The Card:** saved when it's built, with its facts, reference photo blobs and label vectors, so a restored Card needs no re-encoding. It's written together with empty progress.
  - **Progress:** marks, likely species and Sighting photo blobs, written after every mark.
  - Nothing goes to a server.
- **Game module:**
  - `store` is the fourth adapter.
  - `buildCard` saves the new Card before it replaces the current one. If the save fails, the build fails, so a Card that would vanish on restart is never shown as "Ready offline".
  - Every mark saves progress; `game.saved()` reports a failed save.
  - `game.restore()` brings the Card back exactly as it was.
  - Progress carries its Card's `id`, so marks still being saved for an old Card never land on a new one.
  - Sighting photos now live in the game state (`MarkedSquare.photo`); `mark(index, mark, { found, photo })` and `sighting(vector, photo)` carry them.
  - Tested in `progress.test.ts` with an in-memory store that copies data the way IndexedDB does. Shared fakes moved to `src/game/testing.ts`.
- **UI:**
  - On launch the saved Card comes back; with none, the builder opens.
  - If the saved Card can't be read, the builder says so before a new build would replace it.
  - A Sighting that can't be saved shows a notice on the Card screen ("…out of space…").
- **Checked in headless Chromium** (real iNaturalist):
  - Built a 3×3 Card and took Sightings, then reloaded.
  - The Card came back identical: marks, photo, likely species, Bingo count.
  - A Sighting worked seconds after the reload, with no re-encoding and 0 requests to iNaturalist or OpenStreetMap.
- **Known limit:** marks are saved asynchronously, so a mark made in the instant before the app is force-closed could be lost.
- **Not checked yet:** the target phone.
