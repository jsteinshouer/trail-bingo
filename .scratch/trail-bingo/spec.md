# Spec: Trail Bingo

Status: ready-for-agent

## Problem Statement

When I go hiking I want a reason to slow down and notice what's around me — the plants, trees, fungi and animals I'd otherwise walk past — without staring at my phone the whole time. Existing ID apps are reference tools, not games, and most need a signal to identify anything, which I usually don't have on the trail. I want something fun that turns a hike into a light challenge, teaches me a little about what I find, works in the backcountry with no signal, and gets out of the way so the hike stays the main event.

## Solution

Trail Bingo is a solo bingo game for hikes, delivered as an installable web app (PWA) for Android Chrome. Before the hike, at home on Wi-Fi, I download the photo-check model once, then build a Card for my trail: I search for a place (or use my current location), pick a Card size and which groups of living things I want, and the app fills the Card with Squares drawn from species actually observed near there this time of year. Plants, trees and fungi are specific species; animals are broad groups like "a mammal" or "a reptile"; one Square is a Wildcard that anything living can fill.

On the trail, fully offline, when I spot something I take a photo — a Sighting. The app checks it on the phone against my Card. If it's confident, the Square is marked as Verified; if it isn't sure, it shows its top two or three guesses and I pick one, marking the Square as Confirmed. Either way I get a short fact card about what I found, dismiss it with one tap, and put the phone away. Completing a row, column or diagonal is a Bingo, which gets a celebration, and I can keep going toward a Blackout.

## User Stories

### First launch and setup

1. As a new player, I want the app to tell me on first launch that it needs a one-time download of about 300 MB, so that I know to connect to Wi-Fi first.
2. As a new player, I want a visible progress bar while the model downloads, so that I know the app isn't frozen.
3. As a new player, I want the download to resume or be retried cleanly if my connection drops, so that I don't lose a partial download and start over from zero unnecessarily.
4. As a new player, I want the app to ask the browser to keep the model stored persistently, so that it isn't silently deleted before my hike.
5. As a returning player, I want the app to skip the download step when the model is already stored, so that I can get straight to building a Card.
6. As a player, I want to install the app to my home screen, so that I can open it like a normal app on the trail.
7. As a player, I want the app itself to open with no signal after it's installed, so that it works in the backcountry.

### Building a Card

8. As a player, I want to search for a trail, park or town by name, so that I can build a Card for a hike I'm planning from home.
9. As a player at the trailhead, I want a "use my location" option, so that I can build a Card for exactly where I'm standing.
10. As a player, I want to choose a Card size of 3×3, 4×4 or 5×5, so that the game fits a short walk or a long day.
11. As a player, I want to choose which groups appear on my Card — plants and wildflowers, trees and shrubs, fungi and lichens, animals — so that the Card matches what I'm interested in.
12. As a player, I want Squares drawn from species actually observed near my chosen location, so that everything on my Card is realistically findable there.
13. As a player, I want Squares chosen from what's been observed around this time of year, so that I'm not hunting for wildflowers that bloomed months ago.
14. As a player, I want a mix of common and rarer species on my Card, so that I get some quick early finds and some real challenges.
15. As a player, I want animal Squares to be broad groups like "a mammal", "a bird" or "a butterfly or moth", so that a quick phone photo of any of them can count.
16. As a player, I want a Wildcard Square on my Card, so that an interesting find that isn't on the Card still counts for something.
17. As a player, I want the Wildcard in the center on 3×3 and 5×5 Cards, so that it feels like classic bingo.
18. As a player on a 4×4 Card, I want the Wildcard placed in one of the four middle Squares, so that it is still useful for completing lines.
19. As a player, I want the search area to widen automatically if there aren't enough nearby species to fill my Card, so that I still get a full Card in less-observed places.
20. As a player, I want a clear message if even the wider area can't fill a Card of my chosen size and groups, so that I can pick a smaller size or more groups.
21. As a player, I want each Square to show just its name until I find it, with a reference photo I can reveal as a clue if I'm stuck, so that spotting it on my own is part of the game.
22. As a player, I want everything the Card needs — names, reference photos, facts and match data — downloaded while I still have signal, so that the Card works fully offline.
23. As a player, I want a clear "Ready offline" confirmation when a Card has finished building, so that I know it's safe to head out.
24. As a player, I want building a new Card to replace my current one only after I confirm, so that I don't lose a Card in progress by accident.

### Playing on the trail

25. As a player, I want to see my Card as a grid with marked and unmarked Squares, so that I can see my progress at a glance.
26. As a player, I want to take a photo of something I've spotted with one tap, without leaving the game, so that recording a Sighting is quick and never loses my progress.
27. As a player, I want the photo check to run on my phone with no signal, so that the game works anywhere on the trail.
28. As a player, I want a confident match to mark the matching Square as Verified automatically, so that I can get back to hiking quickly.
29. As a player, I want the app to show its top two or three guesses from my Card when it isn't sure, so that I can pick the right one myself.
30. As a player, I want a Square I picked from the guesses to be marked as Confirmed, so that it still counts.
31. As a player, I want to dismiss the guesses if none of them are right, so that a wrong guess doesn't mark a Square.
32. As a player, I want the app to tell me when my photo doesn't look like anything on my Card, so that I'm not confused when nothing happens.
33. As a player, I want a living thing that isn't on my Card to be able to fill my Wildcard, so that unexpected finds count.
34. As a player, I want an animal Sighting that fills a broad Square like "a mammal" to also tell me its likely species, so that I learn what I actually saw.
35. As a player, I want Verified and Confirmed Squares to look different on the Card, so that I can see which finds the photo check backed up.
36. As a player, I want Verified and Confirmed Squares to count the same toward Bingo, so that a tricky photo doesn't cost me the game.
37. As a player, I want a reasonable photo check time even on my phone's CPU when the GPU path isn't available, so that the game still works on my device.
38. As a player, I want a Sighting that matches an already-marked Square to show me the fact card without changing anything, so that I can still learn from repeat finds.

### Learning something

39. As a player, I want a short fact card after each matched Sighting, with the name, a reference photo and a two-to-three sentence summary, so that I learn something about what I found.
40. As a player, I want to dismiss the fact card with one tap, so that the screen time stays short.
41. As a player, I want fact cards to credit iNaturalist or Wikipedia, so that the sources are properly attributed.
42. As a player who finds a mushroom, I want a clear warning never to eat anything based on this identification, so that I don't put myself in danger.
43. As a player, I want to revisit the fact card for any marked Square by tapping it, so that I can read it again later on the hike.

### Winning

44. As a player, I want a celebration when I complete a row, column or diagonal, so that a Bingo feels rewarding.
45. As a player, I want to keep playing after a Bingo, so that I can go for more lines or a Blackout.
46. As a player, I want a bigger celebration when every Square is marked, so that a Blackout feels like an achievement.
47. As a player, I want to see how many Bingos I have on my current Card, so that I can track my progress.

### Persistence

48. As a player, I want my Card and marked Squares saved on my phone, so that closing the app or my phone restarting doesn't lose my progress.
49. As a player, I want my Sighting photos kept with the Squares they marked, so that I can look back at what I found.
50. As a player, I want everything to stay on my phone, so that my location and photos aren't sent to a server I don't control.

## Implementation Decisions

- **Architecture (see ADR 0001):** fully static PWA with no backend of our own. BioCLIP (`imageomics/bioclip`, ViT-B/16, MIT licence) runs in the browser through ONNX Runtime Web (its WebGPU build), using WebGPU where available and falling back to WebAssembly. Labels are tokenized in the browser with Hugging Face's tokenizers.js, which matches open_clip's tokens exactly. No LLM is used, so the project does not enter the "Best Use of Gemma" category.
- **Stack:** Vite + TypeScript, no UI framework. Model inference runs in a Web Worker so the UI stays responsive.
- **Target device:** Android Chrome. iOS is not a target for this build.
- **Model packaging:** both BioCLIP encoders (image and text) are exported to ONNX by us; no browser-ready package with both encoders exists. Weights are stored as fp16 and cast to fp32 when the model loads, with all math in fp32: about 173 MB (image) + 128 MB (text), identical output to PyTorch. Full fp16 math is avoided because it crashes ONNX Runtime's CPU backend, which is the WebAssembly fallback; plain dynamic int8 is avoided because it measurably degrades this ViT. The spike's export script (ticket 01) is the starting point.
- **Model download:** an explicit first-launch setup step with progress, not part of the service worker install. The model is cached in browser storage and persistent storage is requested.
- **Offline:** a service worker caches the app shell so the installed app opens with no signal. Building a Card requires signal; playing does not.
- **Modules:**
  - **Game module** — the single seam all game behaviour goes through. Its interface covers: building a Card from a request (location, size, groups); handling a Sighting, given an image vector, into an outcome; marking a Square as Verified or Confirmed; and reporting Bingo count and Blackout. It depends on four injected adapters and contains no browser or network code.
  - **Species source adapter** — given a location, radius and season window, returns species observed nearby with observation counts and taxonomy, from the iNaturalist API (research-grade observations).
  - **Fact source adapter** — given a taxon, returns a short summary, a reference photo and attribution, from iNaturalist or Wikipedia summaries.
  - **Encoder adapter** — turns text labels and images into L2-normalized vectors using BioCLIP, running in the Web Worker.
  - **Store adapter** — saves and loads the active Card, its marks and Sighting photos in IndexedDB.
  - **Place search** — turns a place name into coordinates (a geocoding lookup) or uses device geolocation.
  - **Hike log** (added in ticket 11) — an opt-in record of each Sighting (the photo check's top matches, gap, outcome, timing, battery, photo) and screen time, kept on the phone in its own IndexedDB database and exported as one JSON file from the Card menu, for tuning the confidence threshold from real photos.
  - **UI** — setup/download screen, Card builder, Card grid, in-page camera/Sighting flow, top-guesses picker, fact card, celebrations.
- **Camera:** Sightings are taken with an in-page live camera (a square preview showing exactly the area the model sees, and a capture button), not Android's camera app. Opening the camera app puts Chrome in the background, and in the spike Chrome discarded and reloaded the page, losing the loaded model.
- **Card generation rules:**
  - Start with a 10 km radius around the location; widen to 25 km if there aren't enough species to fill the Card.
  - Season window: observations from the current month ±1 month, across all years.
  - Rank candidate species by observation count; fill roughly two-thirds of non-Wildcard Squares from the most common and one-third from rarer species.
  - Plants, trees and fungi Squares are single species. Animal Squares are broad groups: mammal, bird, reptile, amphibian, butterfly/moth, other insect, spider. A broad group is only offered if at least one species in that group has been observed nearby.
  - Wildcard placement: center on 3×3 and 5×5; a random one of the four middle Squares on 4×4.
- **Photo check:**
  - At Card build time, text vectors are computed for the full local species list: plants and fungi, and animals (a few hundred taxa each). Labels use the form "a photo of <scientific name>, <common name>." (BioCLIP's full-taxonomy format measured no better).
  - A Sighting's image vector is compared with every local species. Plant, tree and fungus Squares match on species. **Animal Squares match by roll-up:** the best-matching local animal species decides the broad group, and also gives the likely species to show the player. In the Elkhorn, NE accuracy test, roll-up got the group right 93% of the time, against 56–60% for matching the group names directly.
  - Local species that aren't on the Card act as the decoys: a confident match to one of them fills the Wildcard if it's still open, otherwise it's "not on your Card".
  - **Confidence is the gap between the top two matches, not the raw score.** Raw cosine scores of right and wrong answers overlap (medians about 0.33 vs 0.29); the gap separates them. Starting rule: gap ≥ 0.03 marks the Square as Verified; smaller gaps show the top three guesses for the player to pick (Confirmed) or dismiss. In the accuracy test this auto-marked 63% of photos with 4.8% of those wrong, and the right answer was in the top three 92–94% of the time. Tuned on the test hike (ticket 11).
- **State:** one active Card at a time. Verified and Confirmed both count toward Bingo and Blackout. Getting a Bingo does not end the game.
- **Fungus safety:** every fact card for a fungus shows a "never eat based on this identification" warning.
- **Attribution:** fact cards and reference photos credit their source (iNaturalist or Wikipedia) as their licences require.
- **Plan B: not needed.** The spike ran BioCLIP on WebGPU in Chrome on the target Android phone: about 6 s to load from cache, about 1.3 s per photo check, and the tab stayed stable with the in-page camera. See ticket 01.

## Testing Decisions

- **What makes a good test:** tests exercise external behavior through public interfaces only. They assert on outcomes such as "this Sighting marks Quaking Aspen as Verified" or "this Card has a Bingo", not on internal data structures or helper functions, so the internals can be refactored freely.
- **Test runner:** Vitest.
- **Game module (main seam):** tested with fake adapters. The fake species source returns canned observation lists; the fake fact source returns canned summaries; the fake encoder returns hand-made vectors so "this photo is near this Square" is set directly; the fake store is in-memory. Covers:
  - Card generation: size, groups, common/rarer mix, broad animal groups, radius widening, not-enough-species error
  - Wildcard placement on each size
  - each Sighting outcome: Verified, unsure → top guesses → Confirmed, no match, Wildcard fill, repeat Sighting on an already-marked Square, likely-species naming for broad Squares
  - Bingo detection on rows, columns and both diagonals for each size, multiple Bingos, Blackout
  - save and restore of a Card in progress
- **Species source and fact source adapters:** tested against recorded HTTP responses (fixtures captured from real iNaturalist and Wikipedia calls), covering normal results, empty results and error responses. Tests check that responses are mapped into the game module's types correctly.
- **Not unit-tested:** the real BioCLIP encoder, the camera, geolocation, the service worker and offline caching. (The service worker's routing decisions, which requests it answers from the app shell, are a pure function with unit tests; the worker itself is still checked by hand.) These are checked by hand on the Android phone: the Day 1 spike for model load time, photo check time and tab stability; then the real hike.
- **Prior art:** none. This is a new repository, and these tests set the pattern.

## Out of Scope

- Multiplayer of any kind: shared Cards, live sync, leaderboards
- A backend or user accounts
- iOS / Safari as a supported target
- Any LLM, including Gemma
- Plant Squares named by broad group (e.g. "any fern")
- More than one active Card, and a history or journal of past Cards
- A map or pin-drop for choosing the location
- One-time wildcard tokens or other power-ups
- Sound identification (e.g. bird calls)
- Edibility or toxicity information beyond the fungus warning

## Further Notes

- **Deadline:** submission for the Hacktoberfest Open-Source AI Challenge Week 1 ("Touch Grass") is due 11 October 2026 at 11:59 PM PDT. Writing quality is weighted most heavily, so time for the DEV post is reserved on the last day.
- **Rough schedule:** Day 1 spike (export the encoders, load them on the phone, time a photo check, decide plan B); Day 2 Card building; Day 3 play, fact cards, offline; Day 4 hike, fixes, write-up.
- **"Why open" story for the post:** an open model built for the job, running where there is no signal, with location and photos staying on the phone, and no cost to run. Explaining why a general-purpose LLM was not used is part of that story.
- **Bonus points:** take it on a real hike and write about how it went. Optionally save the agent session with DevRelay and embed it in the post.
- **Vocabulary:** see `CONTEXT.md` for Card, Square, Wildcard, Sighting, Verified, Confirmed, Bingo and Blackout.
