# 03 — Photo check on the demo Card

**What to build:** Replace the dev-only marking with real Sightings. The player taps one button to open an in-page live camera (a square preview showing exactly what the model sees) and captures a Sighting without leaving the game. The image is encoded by BioCLIP in the Web Worker and compared with text vectors for the demo Card's Squares and a small hard-coded list of other local species. When the best match is a Square and its lead over the second-best match is at least the threshold (start at 0.03), that Square is marked Verified. When the lead is smaller, the top three Card Squares are shown for the player to pick, which marks the Square as Confirmed, or to dismiss. A confident match to a species that isn't on the Card shows "not on your Card". A Sighting of an already-marked Square changes nothing. Verified and Confirmed Squares look different but count the same.

Start from the spike (ticket 01): its export script, tokenizer, preprocessing, ranking and worker code are proven on the target phone.

**Blocked by:** 01 — Spike: BioCLIP in Android Chrome; 02 — Playable hard-coded Card with Bingo

**Status:** ready-for-agent

- [x] One tap opens an in-page live camera with a square preview; capturing takes a Sighting without opening Android's camera app
- [x] Encoder adapter wraps BioCLIP in a Web Worker (ONNX Runtime Web, WebGPU with WebAssembly fallback) and returns normalized vectors for images and text
- [x] The game module turns a Sighting's image vector into one of: Verified match, unsure (top three Card Squares), not on your Card — tested with a fake encoder and hand-made vectors
- [x] Confidence is the gap between the top two matches, not the raw score (tested)
- [x] Picking a guess marks the Square as Confirmed; dismissing the guesses marks nothing (tested)
- [x] A Sighting matching an already-marked Square leaves the Card unchanged (tested)
- [x] Verified and Confirmed Squares have distinct visual markers and both count toward Bingo and Blackout (tested)
- [x] The gap threshold is configurable in one place, starting at 0.03, for tuning in ticket 11
- [x] The dev-only mark control from ticket 02 is removed

## Comments

**Implemented on branch `03-photo-check`.**

- **Game seam:** `createGame({ encoder })` takes the encoder adapter (`encodeText` only). `loadCard` starts encoding labels ("a photo of <scientific>, <common>.") for the Card's species Squares plus `card.localSpecies`. `game.sighting(photoVector)` waits for those vectors and returns `verified` / `already-marked` / `unsure` (top three open Squares) / `not-on-card`. Picking a guess is `game.mark(index, "confirmed")`; dismissing calls nothing. If label encoding fails, the next Sighting tries it again.
- **Threshold:** `VERIFIED_GAP = 0.03` in `src/game/photo-check.ts`.
- **Decisions for ticket 11 (tuning):** the gap is measured between the top two *outcomes*, not the top two species. Species that fill the same Square (two mammals, say) count once, by their best score. For plants and fungi this is the same as the spike's measure, but animal Sightings will auto-mark more often than the spike's figures suggest, so watch for wrong Verified animal marks on the hike.
- **Animal roll-up** already works through `localSpecies`: the best-matching local animal decides which broad Square it fills. Ticket 05 must keep one Square per animal group, because roll-up fills the first Square of a group.
- **Wildcard:** ticket 02 deferred "the Wildcard naming what filled it" to 03, but filling the Wildcard is ticket 07's job, so a confident off-Card match says "not on your Card" here. The Wildcard's "filled" text in `card-screen.ts` waits for 07.
- **Encoder adapter** (`src/encoder/`): the spike's worker, tokenizer and preprocessing; WebGPU with WebAssembly fallback; one run at a time; vectors L2-normalized. Model files (fp16) are read through the Cache API (`trail-bingo-models-v1`). Ticket 04 replaces the implicit download with the first-launch step. For now, run `npm run models` to link the spike's export into the git-ignored `public/models/`.
- **UI:**
  - Take a Sighting band, showing load progress until the photo check is ready.
  - In-page camera with a square viewfinder; it saves the central square of the frame (up to 768 px), the same square the model crops.
  - Outcome panels and the top-guesses picker.
  - Sighting photos develop onto marked Squares and show in the Square detail. They are held in memory only until ticket 09.
  - Verified and Confirmed keep their distinct strips and stamps. Their counting is unit-tested; the look was checked by hand.
- **Checked in headless Chromium** with a fake camera (WebAssembly backend, 2-core dev machine):
  - Mule deer photo → "A mammal" Verified.
  - Yarrow → "Not on your Card · Common yarrow".
  - Black frame → unsure → picked guess marked Confirmed.
  - Timings: model ready in about 20 s, but the first Sighting took about 25–35 s there because it also waited for the Card's ~50 labels to encode. On the phone (WebGPU) this should be a few seconds. Ticket 05 moves label encoding to Card build time, so it goes away.
- **Not checked yet:** the target phone, and reloading with no signal after the first load.
- Dev "Start over" went with the dev control; changing `#3`/`#4`/`#5` still reloads the demo Card.
