import { describe, expect, it } from "vitest";
import { fakeStore } from "./testing";
import { createGame, wildcardPosition, type Card, type CardSize, type Encoder, type FactSource, type SpeciesSource, type Square } from "./index";

const species = (name: string): Square => ({
  kind: "species",
  group: "plant",
  name,
  scientificName: `${name} sci`,
});

/** A Card of the given size with the Wildcard in the center (or index 5 on 4×4). */
function card(size: CardSize): Card {
  const wild = size === 4 ? 5 : (size * size - 1) / 2;
  return {
    place: { name: "Elkhorn", region: "Nebraska", lat: 41.28, lng: -96.24, radiusKm: 10 },
    month: 10,
    size,
    localSpecies: [],
    squares: Array.from({ length: size * size }, (_, i) =>
      i === wild ? { kind: "wildcard" } : species(`Species ${i}`),
    ),
  };
}

// These tests never take a Sighting or build a Card, so the adapters are never really used.
const encoder: Encoder = { encodeText: async (labels) => labels.map(() => new Float32Array(1)) };
const noSpecies: SpeciesSource = { speciesNear: async () => [] };
const noFacts: FactSource = { factsFor: async () => new Map() };

function playing(size: CardSize) {
  const game = createGame({ encoder, species: noSpecies, facts: noFacts, store: fakeStore() });
  game.loadCard(card(size));
  return game;
}

describe("marking a Square", () => {
  it("records whether the photo check or the player decided", () => {
    const game = playing(3);
    game.mark(0, "verified");
    game.mark(1, "confirmed");

    const squares = game.state().squares;
    expect(squares[0].mark).toBe("verified");
    expect(squares[1].mark).toBe("confirmed");
    expect(squares[2].mark).toBeUndefined();
  });

  it("leaves an already-marked Square as it was", () => {
    const game = playing(3);
    game.mark(0, "verified");
    game.mark(0, "confirmed");

    expect(game.state().squares[0].mark).toBe("verified");
  });

  it("rejects a Square that isn't on the Card", () => {
    const game = playing(3);

    expect(() => game.mark(9, "verified")).toThrow(/Square 9/);
    expect(() => game.mark(-1, "verified")).toThrow(/Square -1/);
  });
});

function markAll(game: ReturnType<typeof playing>, indices: number[]) {
  for (const i of indices) game.mark(i, "verified");
}

describe("Bingo", () => {
  it("is not counted until a line is complete", () => {
    const game = playing(3);
    markAll(game, [0, 1]);

    expect(game.state().bingoCount).toBe(0);
  });

  it("is counted for a complete row", () => {
    const game = playing(3);
    markAll(game, [0, 1, 2]);

    expect(game.state().bingoCount).toBe(1);
  });

  // Lines written out by hand for each size, so the test doesn't share the game's arithmetic.
  it.each<[CardSize, string, number[]]>([
    [3, "bottom row", [6, 7, 8]],
    [3, "middle column", [1, 4, 7]],
    [3, "diagonal", [0, 4, 8]],
    [3, "anti-diagonal", [2, 4, 6]],
    [4, "bottom row", [12, 13, 14, 15]],
    [4, "right column", [3, 7, 11, 15]],
    [4, "diagonal", [0, 5, 10, 15]],
    [4, "anti-diagonal", [3, 6, 9, 12]],
    [5, "second row", [5, 6, 7, 8, 9]],
    [5, "middle column", [2, 7, 12, 17, 22]],
    [5, "diagonal", [0, 6, 12, 18, 24]],
    [5, "anti-diagonal", [4, 8, 12, 16, 20]],
  ])("is counted on a size-%i Card for the %s", (size, _line, indices) => {
    const game = playing(size);
    markAll(game, indices);

    expect(game.state().bingoCount).toBe(1);
  });

  it("counts every complete line", () => {
    const game = playing(4);
    markAll(game, [0, 1, 2, 3]);
    markAll(game, [12, 13, 14, 15]);

    expect(game.state().bingoCount).toBe(2);
  });

  it("counts each line a single Square completes", () => {
    const game = playing(3);
    markAll(game, [1, 2, 3, 6]);
    markAll(game, [0]); // completes the top row and the left column

    expect(game.state().bingoCount).toBe(2);
  });

  it("counts Verified and Confirmed Squares the same", () => {
    const game = playing(3);
    game.mark(0, "verified");
    game.mark(1, "confirmed");
    game.mark(2, "confirmed");

    expect(game.state().bingoCount).toBe(1);
  });

  it("is reported by the mark that completes it", () => {
    const game = playing(3);
    markAll(game, [0, 1]);

    expect(game.mark(2, "verified").newBingos).toEqual([[0, 1, 2]]);
  });

  it("is not reported again by later marks", () => {
    const game = playing(3);
    markAll(game, [0, 1, 2]);

    expect(game.mark(4, "verified").newBingos).toEqual([]);
  });

  it("lists every complete line on the Card", () => {
    const game = playing(3);
    markAll(game, [0, 1, 2, 4, 8]);

    expect(game.state().bingos).toEqual([
      [0, 1, 2],
      [0, 4, 8],
    ]);
  });

  it("doesn't end the game", () => {
    const game = playing(3);
    markAll(game, [0, 1, 2]);
    markAll(game, [3, 4]);

    expect(game.mark(5, "confirmed").newBingos).toEqual([[3, 4, 5]]);
    expect(game.state().bingoCount).toBe(2);
  });
});

describe("Blackout", () => {
  const allBut = (size: CardSize, open: number) =>
    Array.from({ length: size * size }, (_, i) => i).filter((i) => i !== open);

  it("isn't reached while any Square is open", () => {
    const game = playing(4);
    markAll(game, allBut(4, 11));

    expect(game.state().blackout).toBe(false);
  });

  it("is reached when every Square is marked, by either mark", () => {
    const game = playing(3);
    markAll(game, allBut(3, 8));
    game.mark(8, "confirmed");

    expect(game.state().blackout).toBe(true);
    expect(game.state().bingoCount).toBe(8);
  });

  it("is reported only by the mark that completes it", () => {
    const game = playing(5);
    markAll(game, allBut(5, 12));

    expect(game.mark(12, "verified").blackout).toBe(true);
    expect(game.mark(12, "verified").blackout).toBe(false);
  });
});

describe("Wildcard position", () => {
  it("is the center Square on a 3×3 Card", () => {
    expect(wildcardPosition(3, () => 0.9)).toBe(4);
  });

  it("is the center Square on a 5×5 Card", () => {
    expect(wildcardPosition(5, () => 0.9)).toBe(12);
  });

  it("is one of the four middle Squares on a 4×4 Card", () => {
    const picks = [0, 0.3, 0.6, 0.99].map((r) => wildcardPosition(4, () => r));

    expect(picks).toEqual([5, 6, 9, 10]);
  });
});

describe("loading a Card", () => {
  it("rejects a Card whose Squares don't fill its grid", () => {
    const short = { ...card(3), squares: card(3).squares.slice(1) };

    expect(() => createGame({ encoder, species: noSpecies, facts: noFacts, store: fakeStore() }).loadCard(short)).toThrow(/9 Squares/);
  });

  it("starts with no Squares marked", () => {
    const game = playing(3);
    markAll(game, [0, 1, 2]);
    game.loadCard(card(3));

    expect(game.state().squares.some((s) => s.mark)).toBe(false);
    expect(game.state().bingoCount).toBe(0);
  });
});
