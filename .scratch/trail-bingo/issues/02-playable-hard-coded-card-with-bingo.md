# 02 — Playable hard-coded Card with Bingo

**What to build:** The first playable slice of the game. Set up the project (Vite + TypeScript, no framework, Vitest) and the game module as the single seam with its adapters plugged in. The app shows a hard-coded demo Card as a grid; a temporary developer-only control lets you mark Squares; completing a row, column or diagonal triggers a Bingo celebration and play continues; marking every Square triggers a bigger Blackout celebration. The Card shows the current Bingo count.

**Design:** see `docs/design/card-grid/brief.md` and its mockup.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] Project builds and runs with Vite + TypeScript; tests run with Vitest
- [x] Game module exposes Card state, marking a Square, Bingo count and Blackout through its public interface, with no browser or network code inside it
- [x] Demo Card renders as a grid with Square names, including a Wildcard Square in the correct position
- [x] Bingo is detected for rows, columns and both diagonals on 3×3, 4×4 and 5×5 Cards, and multiple Bingos are counted (tested through the game module)
- [x] Blackout is detected when every Square is marked (tested)
- [x] Bingo and Blackout celebrations show; getting a Bingo does not end the game
- [x] The temporary mark control is clearly dev-only (it will be removed in ticket 03)

## Comments

**Implemented on branch `02-playable-card`.**
- `createGame(adapters)` is the seam, but `GameAdapters` is empty for now. Each adapter is added in the ticket that builds it (encoder 03, species source 05, fact source 08, store 09), so its interface isn't guessed at before it exists.
- The dev mark control lives in the Square detail panel (Mark Verified, Mark Confirmed, Start over) in `src/ui/dev-mark-control.ts`. Ticket 03 deletes that file and its one call site in `card-screen.ts`.
- Until the Card builder arrives in ticket 05, `#3`, `#4` or `#5` in the URL picks the demo Card size. Changing the hash reloads the Card.
- Deferred to later tickets:
  - the Take a Sighting band, Sighting photos on marked Squares, and the Wildcard naming what filled it (03)
  - "Ready offline" (05/10; the collar says "Demo Card" for now)
  - the Card menu, and clues (05/08)
- The Bingo stamp says "First Bingo on the Elkhorn Card" rather than the brief's "First line…", because CONTEXT.md lists "line" as a word to avoid. The brief has been updated to match.
