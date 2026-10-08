# 03 — Photo check on the demo Card

**What to build:** Replace the dev-only marking with real Sightings. The player taps one button to take a photo; the image is encoded by BioCLIP in the Web Worker and compared with the demo Card's Square and decoy text vectors. A confident match marks the Square as Verified. An unsure result shows the top two or three Squares for the player to pick, marking it as Confirmed, or to dismiss. A confident decoy match or unclear photo shows a "no match" message. A Sighting of an already-marked Square changes nothing. Verified and Confirmed Squares look different but count the same.

**Blocked by:** 01 — Spike: BioCLIP in Android Chrome; 02 — Playable hard-coded Card with Bingo

**Status:** ready-for-agent

- [ ] One tap opens the camera and takes a Sighting
- [ ] Encoder adapter wraps BioCLIP in a Web Worker and returns normalized vectors for images and text
- [ ] The game module turns a Sighting's image vector into one of: Verified match, unsure (top 2–3 guesses), no match — tested with a fake encoder and hand-made vectors
- [ ] Picking a guess marks the Square as Confirmed; dismissing the guesses marks nothing (tested)
- [ ] A Sighting matching an already-marked Square leaves the Card unchanged (tested)
- [ ] Verified and Confirmed Squares have distinct visual markers and both count toward Bingo and Blackout (tested)
- [ ] Confidence thresholds are configurable in one place, for tuning in ticket 11
- [ ] The dev-only mark control from ticket 02 is removed
