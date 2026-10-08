# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA targeting Android Chrome. iOS / Safari is not a target for this build.

## Stack

Vite + TypeScript, no UI framework, Vitest (decided in `.scratch/trail-bingo/spec.md`). Model inference runs in a Web Worker. The throwaway spike lives in `spike/`; the real app is not scaffolded yet (ticket 02).

## Users

Casual hikers, including parents playing with kids. They build a Card at home on Wi-Fi before a hike, or at the trailhead, then play solo or as a family on the trail with no signal. Their job: turn a hike into a light challenge that gets them noticing the plants, trees, fungi and animals they'd otherwise walk past, and learn a little about what they find.

Secondary audience: Hacktoberfest "Touch Grass" judges and DEV readers, who meet the app through the submission post and demo.

## Product Purpose

Trail Bingo is a bingo game played on a hike. A Card is built for one place and season from species actually observed nearby. Players spot living things from the Card and prove each Sighting with a photo, which an open model checks on the phone. Success is a hike where the phone comes out briefly for a Sighting, a fact and maybe a Bingo, then goes back in the pocket. The screen should be the shortest part of the experience.

## Positioning

Existing ID apps are reference tools, and most need signal. Trail Bingo is a game, and its photo check runs entirely on the phone: BioCLIP (an open model trained to match photos to taxon names) runs in the browser, so play works in the backcountry with no signal, location and photos never leave the device, and it costs nothing to run. Cards come from real iNaturalist observations near the chosen place at this time of year, so everything on them can realistically be found.

## Operating Context

- **Before the hike (signal, usually Wi-Fi):** one-time ~300 MB model download with progress; search for a place or use current location; pick Card size (3×3, 4×4, 5×5) and groups (plants and wildflowers, trees and shrubs, fungi and lichens, animals); wait for "Ready offline".
- **On the trail (no signal):** glance at the Card, open the in-page live camera, take a Sighting, read a short fact card, dismiss it with one tap, put the phone away. Conditions: outdoors, often bright sunlight, often one hand, sometimes gloves, short sessions, phone shared with kids.
- **Photo check outcomes:** Verified (confident match, auto-marked), unsure (top three guesses; picking one marks it Confirmed, or dismiss), not on your Card, Wildcard fill, repeat Sighting (fact card only). Animal Squares also name the likely species.
- **Winning:** Bingo (row, column or diagonal) gets a celebration and play continues; Blackout gets a bigger one; the Bingo count is visible.

## Capabilities and Constraints

- Vocabulary is fixed in `CONTEXT.md`: Card, Square, Wildcard, Sighting, Verified, Confirmed, Bingo, Blackout. Use these terms in UI copy and avoid the listed alternatives (board, tile, free space, capture, win, coverall…).
- Fully static PWA, no backend, no accounts, no LLM (ADR 0001). Building a Card needs signal; playing does not.
- Everything used during play is stored on the phone. The app shell, fonts and icons are cached by the service worker. The model, Card data, reference photos and facts are stored before the hike, and Sighting photos are stored when taken. Nothing loads from a third-party CDN at run time (no Google Fonts, no hotlinked images).
- Sightings use an in-page square camera preview showing exactly what the model sees. Android's camera app is avoided because Chrome discarded the page in the spike.
- Measured on the target phone: ~6 s cached model load, ~1.3 s per photo check on WebGPU; the WebAssembly fallback is slower (~1.75–2.5 s on the dev machine).
- Verified and Confirmed must look different on the Card and count the same toward Bingo.
- Unmarked Squares show the name only, no photo: recognizing the thing on your own is part of the game. The reference photo is an optional clue the player can reveal. A marked Square shows the player's own Sighting photo. Plants, trees and fungi are single species; animals are broad groups (a mammal, a bird, a reptile, an amphibian, a butterfly or moth, another insect, a spider).
- One active Card at a time; replacing it needs confirmation. Card and Sighting photos persist on the phone.
- Out of scope: multiplayer, history of past Cards, map or pin-drop, power-ups, sound ID, edibility info beyond the fungus warning.
- Deadline: DEV submission due 11 October 2026, 11:59 PM PDT.

## Brand Commitments

- Name: **Trail Bingo**.
- Voice: warm field guide. Curious, plain-spoken, a little naturalist. Facts are the reward; the game stays light. Copy should read well to kids and adults alike.
- No logo or identity assets exist yet.

## Evidence on Hand

- Spike results on the target Android phone and accuracy test (Elkhorn, NE): plants/fungi top-1 80–81%, top-3 92–94% against 500 local species; animal groups 93% by roll-up; the gap rule auto-marked 63% of photos with 4.8% wrong. See `spike/README.md`, `spike/eval-results.json`, ticket 01.
- Four test photos with licence credits in `spike/web/public/fixtures/` (`CREDITS.json`).
- Reference photos and fact text come from iNaturalist and Wikipedia at runtime and must carry their attribution.
- Not yet available, and not to be fabricated: real hike report (ticket 11), user testimonials, usage numbers, deployed URL, screenshots of the real app.

## Product Principles

1. **The hike is the main event.** Every on-trail interaction is designed to get the phone back in the pocket fast.
2. **Works with no signal.** Anything needed on the trail is downloaded and confirmed ready beforehand; nothing on the trail waits on the network.
3. **Honest about certainty.** The app shows when it's sure (Verified) and when the player decided (Confirmed), and never pretends a guess is a match.
4. **Learning is the reward.** Every matched Sighting teaches something short and true, with its source credited.
5. **Safe and private by default.** Fungus fact cards always warn against eating based on the identification; location and photos stay on the phone.

## Accessibility & Inclusion

No formal standard was set. Product constraints from the operating context: readable in bright outdoor light, usable one-handed and with quick glances, large enough touch targets for gloves and kids, and copy that a child can follow.
