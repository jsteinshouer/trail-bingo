import { candidates, label, rank, VERIFIED_GAP, type Candidate, type Encoder } from "./photo-check";
import type { Card, CardSize, CardState, Mark, MarkOutcome, SightingOutcome } from "./types";

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
 * ticket that builds it: species source (05), fact source (08), store (09).
 */
export interface GameAdapters {
  encoder: Encoder;
}

export interface Game {
  /** Makes this the active Card, with no Squares marked. */
  loadCard(card: Card): void;
  /** Marks a Square. An already-marked Square keeps its first mark. */
  mark(index: number, mark: Mark): MarkOutcome;
  /**
   * Checks a Sighting, given its photo's vector, against the active Card.
   * A sure match to an open Square marks it as Verified; nothing else changes the Card.
   */
  sighting(photo: Float32Array): Promise<SightingOutcome>;
  /** The active Card and its marks. */
  state(): CardState;
}

export function createGame({ encoder }: GameAdapters): Game {
  let card: Card | null = null;
  let marks: (Mark | undefined)[] = [];
  /** The Card's species and their label vectors. Encoding starts as soon as the Card loads. */
  let candidateVectors: Promise<{ list: Candidate[]; vectors: Float32Array[] }> | null = null;

  const active = (): Card => {
    if (!card) throw new Error("No Card is loaded");
    return card;
  };

  const bingos = () => lines(active().size).filter((line) => line.every((i) => marks[i]));
  const blackout = () => marks.every(Boolean);

  function encodeCandidates(forCard: Card) {
    const list = candidates(forCard);
    const encoding = encoder.encodeText(list.map((c) => label(c.taxon))).then((vectors) => ({ list, vectors }));
    // A failure surfaces on the next Sighting, which then tries again.
    encoding.catch(() => {
      if (candidateVectors === encoding) candidateVectors = null;
    });
    return encoding;
  }

  function mark(index: number, which: Mark): MarkOutcome {
    if (!Number.isInteger(index) || index < 0 || index >= active().squares.length) {
      throw new Error(`Square ${index} isn't on this Card`);
    }
    if (marks[index]) return { newBingos: [], blackout: false };
    marks[index] = which;
    return { newBingos: bingos().filter((line) => line.includes(index)), blackout: blackout() };
  }

  return {
    loadCard(next) {
      const expected = next.size * next.size;
      if (next.squares.length !== expected) {
        throw new Error(`A ${next.size}×${next.size} Card needs ${expected} Squares, got ${next.squares.length}`);
      }
      card = next;
      marks = next.squares.map(() => undefined);
      candidateVectors = encodeCandidates(next);
    },

    mark,

    async sighting(photo) {
      const cardAtStart = active();
      const { list, vectors } = await (candidateVectors ??= encodeCandidates(cardAtStart));
      if (card !== cardAtStart) throw new Error("The Card changed during the photo check");
      const ranked = rank(photo, list, vectors);
      const [best, next] = ranked;
      // With nothing else to compare against, a lone candidate is a sure match.
      if (best.score - (next?.score ?? -1) >= VERIFIED_GAP) {
        const { square, taxon } = best;
        if (square === null) return { kind: "not-on-card", taxon };
        if (marks[square]) return { kind: "already-marked", index: square, taxon };
        return { kind: "verified", index: square, taxon, mark: mark(square, "verified") };
      }
      const open = ranked.flatMap(({ square }) => (square === null || marks[square] ? [] : [square]));
      return { kind: "unsure", guesses: open.slice(0, 3) };
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
