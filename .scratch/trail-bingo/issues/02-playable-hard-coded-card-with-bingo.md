# 02 — Playable hard-coded Card with Bingo

**What to build:** The first playable slice of the game. Set up the project (Vite + TypeScript, no framework, Vitest) and the game module as the single seam with its adapters plugged in. The app shows a hard-coded demo Card as a grid; a temporary developer-only control lets you mark Squares; completing a row, column or diagonal triggers a Bingo celebration and play continues; marking every Square triggers a bigger Blackout celebration. The Card shows the current Bingo count.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Project builds and runs with Vite + TypeScript; tests run with Vitest
- [ ] Game module exposes Card state, marking a Square, Bingo count and Blackout through its public interface, with no browser or network code inside it
- [ ] Demo Card renders as a grid with Square names, including a Wildcard Square in the correct position
- [ ] Bingo is detected for rows, columns and both diagonals on 3×3, 4×4 and 5×5 Cards, and multiple Bingos are counted (tested through the game module)
- [ ] Blackout is detected when every Square is marked (tested)
- [ ] Bingo and Blackout celebrations show; getting a Bingo does not end the game
- [ ] The temporary mark control is clearly dev-only (it will be removed in ticket 03)
