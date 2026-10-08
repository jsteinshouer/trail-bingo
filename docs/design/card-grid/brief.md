# Card screen: design brief

Status: confirmed direction, not yet built. Interactive mockup: [mockup.html](mockup.html) (open it in a browser; `#3`, `#4` or `#5` picks the Card size, and `#5/detail` or `#5/clue` opens a Square's detail). Reference captures at 390 × 844: [3×3](card-3x3.png), [4×4](card-4x4.png), [5×5](card-5x5.png), [Square detail](square-detail.png), [clue shown](square-clue.png).

## Job and audience

The on-trail home screen: an Operate surface. A hiker, often a parent with kids, pulls the phone out in bright daylight, usually one-handed. They check what's left to find, take a Sighting, and put the phone away. Success is seeing your progress at a glance and reaching the camera in one tap.

## Direction: Topo Quadrangle

The Card is a USGS 7.5-minute map sheet for this trail and season. Sightings are printed onto it in **photorevision purple**, the ink USGS used for features it added from aerial photographs. It refuses the category default: rounded photo tiles on soft green, checkmark badges and confetti.

**The photo is the reward.** A new Card is a bare map: names and legend symbols, no photos. Recognizing the thing on your own is part of the game. Each Sighting prints the player's own photo onto its Square, so the map fills with your hike as you go, and a Blackout Card is a sheet made entirely of your photos.

- **World:** white map stock, woodland-green tint, faint brown contours with every fifth one heavier, a neatline with corner coordinates and a graticule tick at every Square boundary. No radius, no card chrome, no shadows on Squares. Squares are fields of map tint separated by 2 px paper section lines.
- **State vocabulary:** every state is a printed mark, never a glow or badge. The grid never changes shape; marking restyles a Square in place.
- **Type:** Barlow Condensed for map lettering (names, collar, controls) and Barlow for scientific names and running text. Barlow is drawn from California highway signage, and the condensed width suits names in narrow Squares.
- **Light only.** The scene is a daylight trail.

Tokens are listed in the mockup's notes column. DESIGN.md will be written from the built screen, not before it.

## Screen anatomy (top to bottom)

1. **Top collar:** the place name in large condensed caps (the quad title), with state · month and "Ready offline" beside it. A grid icon opens the Card menu (new Card, photo credits).
2. **The sheet:** the whole Card, always fully on screen at every size. No scrolling or panning; the grid fills the space between the collars.
3. **Bottom collar:** the bottom margin carries corner coordinates and the "Trail Bingo · iNaturalist · 10 km" imprint, where a quad prints its publisher. A **scale bar** is the progress meter: one segment per Square, filled purple as Squares are marked. The Bingo count sits at the right ("1 Bingo" / "2 Bingos").
4. **Take a Sighting:** a full-width purple band, about 68 px tall, at the thumb. It's the only filled control.

## Squares and states

| State | Looks like | Meaning |
|---|---|---|
| Unmarked | Map tint with contours, a brown legend symbol for the kind of thing, and the name. **No photo.** | Not found yet |
| Verified | **The player's Sighting photo** develops onto the Square, with a solid purple name strip and a crisp printed check | The photo check was sure |
| Confirmed | The Sighting photo with a hatched purple name strip and a hand-pencilled tick | The player chose from the top guesses |
| Wildcard | A triangulation-station mark on open paper, labelled "anything living"; once filled, the Sighting photo and the name of what filled it | Any living thing the photo check recognizes |
| Bingo | The map's trail symbol (black dash, white casing) through the completed line | Stays drawn, so every Bingo is visible at a glance |

- **Legend symbols** are authored map-style glyphs in contour brown: tree or shrub (canopy on a stem), plant or wildflower (grass tuft), fungus or lichen (cap), animal (paw print). They tell a child what kind of thing to look for without giving the answer away.
- **Same ink, different mark:** Verified and Confirmed use the same ink because both count the same. Only the mark differs, which shows who decided: the machine or the player.
- **Names** are bottom-aligned in every state, so rows read evenly.
- **Animal Squares'** second line reads "any mammal" until found, then "likely white-tailed deer" (the likely species from the photo check).

**Size ranges** (390 px phone):
- **5×5:** Squares about 70 × 100 px, with up to three lines of 13 px condensed semibold. No second line.
- **4×4:** two lines of 15 px, with the scientific name below in brown italic.
- **3×3:** two lines of 18 px, with the scientific name below.

## Square detail and clues

Tapping any Square opens a detail panel that slides up from the bottom over the Card. It closes with the ✕, a tap on the dimmed Card, Escape or the back gesture.

- **Unmarked species Square:** the name, the scientific name and the kind, then a map-tint panel with a **Show a clue** button: "Stuck? A clue shows a photo of what to look for." The clue reveals the reference photo with its credit line directly beneath it. Animal clues show a representative local species ("For example, a white-tailed deer").
- **Unmarked Wildcard:** explains that anything living that isn't already marked fills it. There is no clue.
- **Marked Square:** the Sighting photo, a Verified or Confirmed line, then the fact card content (ticket 08): summary, reference photo with credit, and the fungus warning where it applies.

Clue photos are downloaded at Card build time like everything else, so clues work offline.

In the mockup, the orange "Mockup only" box in the detail (Mark Verified / Mark Confirmed / Unmark) stands in for ticket 02's dev-only mark control.

## Celebrations

- **Bingo:** the Sighting photo develops (about 0.7 s), the trail line draws across the completed line (about 0.9 s), the sheet gives a small shake, the phone vibrates (`[40, 60, 40]`), and a purple revision stamp reads "BINGO" with "First line on the Elkhorn Card" for about 2.6 s, then clears on its own. No sound. Play continues.
- **Blackout:** a larger stamp ("BLACKOUT · Photorevised · October 2026") over a Card that is now all photos. It stays until tapped, so the family can look at it together.
- **Reduced motion:** no developing, line drawing or scaling. The stamp appears and disappears without animating.

## Constraints

- Android Chrome PWA; Vite + TypeScript, no framework (PRODUCT.md, spec).
- **Everything is local.** Nothing on this screen may load from the network at play time. Fonts and icons ship in the app shell, which the service worker caches. Reference photos, facts and Square data are stored when the Card is built, and Sighting photos are stored when taken. No Google Fonts, CDNs or hotlinked images. The font files are ready in [fonts/](fonts/) (Barlow and Barlow Condensed, latin subset, SIL OFL).
- Use the CONTEXT.md vocabulary in all copy: Card, Square, Wildcard, Sighting, Verified, Confirmed, Bingo, Blackout.
- Sighting photos are stored on the phone with their Squares (spec story 49) and shown at Square size on the Card, so store or derive a small thumbnail.
- Reference photos carry their iNaturalist or Wikipedia credit wherever they appear: under the clue, and on the fact card.
- Touch targets: Squares are at least 70 px; the Sighting band is full width.
- The 4×4 Wildcard goes in a random one of the four middle Squares (the mockup fixes it at index 9).

## Open decisions

- **Clue cost:** whether using a clue costs anything or is recorded on the Square (for example, a small mark). The mockup treats clues as free and leaves no trace on the Card.
- **Other screens:** the fact card, top-guesses picker, camera and Card builder aren't shaped yet. They inherit this world.

## Demonstration content

The mockup's Card was assembled by hand to be plausible for Elkhorn, NE in October; the Card generator did not build it. The "Sighting photos" on marked Squares are iNaturalist photos standing in for the player's own. There's no spider Square because no openly licensed photo was found. The mockup is self-contained and works offline: fonts are in `fonts/` and photos in `photos/`, with every photo credit listed in the mockup.
