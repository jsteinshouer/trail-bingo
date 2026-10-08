# 03 — Photo check on the demo Card

**What to build:** Replace the dev-only marking with real Sightings. The player taps one button to open an in-page live camera (a square preview showing exactly what the model sees) and captures a Sighting without leaving the game. The image is encoded by BioCLIP in the Web Worker and compared with text vectors for the demo Card's Squares and a small hard-coded list of other local species. When the best match is a Square and its lead over the second-best match is at least the threshold (start at 0.03), that Square is marked Verified. When the lead is smaller, the top three Card Squares are shown for the player to pick, which marks the Square as Confirmed, or to dismiss. A confident match to a species that isn't on the Card shows "not on your Card". A Sighting of an already-marked Square changes nothing. Verified and Confirmed Squares look different but count the same.

Start from the spike (ticket 01): its export script, tokenizer, preprocessing, ranking and worker code are proven on the target phone.

**Blocked by:** 01 — Spike: BioCLIP in Android Chrome; 02 — Playable hard-coded Card with Bingo

**Status:** ready-for-agent

- [ ] One tap opens an in-page live camera with a square preview; capturing takes a Sighting without opening Android's camera app
- [ ] Encoder adapter wraps BioCLIP in a Web Worker (ONNX Runtime Web, WebGPU with WebAssembly fallback) and returns normalized vectors for images and text
- [ ] The game module turns a Sighting's image vector into one of: Verified match, unsure (top three Card Squares), not on your Card — tested with a fake encoder and hand-made vectors
- [ ] Confidence is the gap between the top two matches, not the raw score (tested)
- [ ] Picking a guess marks the Square as Confirmed; dismissing the guesses marks nothing (tested)
- [ ] A Sighting matching an already-marked Square leaves the Card unchanged (tested)
- [ ] Verified and Confirmed Squares have distinct visual markers and both count toward Bingo and Blackout (tested)
- [ ] The gap threshold is configurable in one place, starting at 0.03, for tuning in ticket 11
- [ ] The dev-only mark control from ticket 02 is removed
