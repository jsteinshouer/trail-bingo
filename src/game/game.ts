import type { Card, CardSize, CardState, Mark, MarkOutcome } from "./types";

/** Every row, column and diagonal of a Card, as Square indices. */
function lines(size: CardSize): number[][] {
  const span = Array.from({ length: size }, (_, k) => k);
  return [
    ...span.map((r) => span.map((c) => r * size + c)),
    ...span.map((c) => span.map((r) => r * size + c)),
    span.map((k) => k * size + k),
    span.map((k) => k * size + (size - 1 - k)),
  ];
}

/**
 * Index of the Wildcard: the center Square on 3×3 and 5×5 Cards, and a random
 * one of the four middle Squares on 4×4.
 */
export function wildcardPosition(size: CardSize, random: () => number = Math.random): number {
  if (size !== 4) return (size * size - 1) / 2;
  const middle = [5, 6, 9, 10];
  return middle[Math.floor(random() * middle.length)];
}

/**
 * Where the game's adapters plug in. Each adapter joins this interface in the
 * ticket that builds it: encoder (03), species source (05), fact source (08),
 * store (09).
 */
export interface GameAdapters {}

export interface Game {
  /** Makes this the active Card, with no Squares marked. */
  loadCard(card: Card): void;
  /** Marks a Square. An already-marked Square keeps its first mark. */
  mark(index: number, mark: Mark): MarkOutcome;
  /** The active Card and its marks. */
  state(): CardState;
}

export function createGame(_adapters: GameAdapters = {}): Game {
  let card: Card | null = null;
  let marks: (Mark | undefined)[] = [];

  const active = (): Card => {
    if (!card) throw new Error("No Card is loaded");
    return card;
  };

  const bingos = () => lines(active().size).filter((line) => line.every((i) => marks[i]));
  const blackout = () => marks.every(Boolean);

  return {
    loadCard(next) {
      const expected = next.size * next.size;
      if (next.squares.length !== expected) {
        throw new Error(`A ${next.size}×${next.size} Card needs ${expected} Squares, got ${next.squares.length}`);
      }
      card = next;
      marks = next.squares.map(() => undefined);
    },

    mark(index, mark) {
      if (!Number.isInteger(index) || index < 0 || index >= active().squares.length) {
        throw new Error(`Square ${index} isn't on this Card`);
      }
      if (marks[index]) return { newBingos: [], blackout: false };
      marks[index] = mark;
      return { newBingos: bingos().filter((line) => line.includes(index)), blackout: blackout() };
    },

    state() {
      const { place, month, size, squares } = active();
      const complete = bingos();
      return {
        place,
        month,
        size,
        squares: squares.map((square, i) => (marks[i] ? { ...square, mark: marks[i] } : square)),
        bingos: complete,
        bingoCount: complete.length,
        blackout: blackout(),
      };
    },
  };
}
