import { generateCard, NotEnoughSpeciesError, SEARCH_RADII_KM, seasonMonths, type CardRequest } from "./card-builder";
import { candidates, label, rank, VERIFIED_GAP, type Candidate, type Encoder } from "./photo-check";
import type {
  Card,
  CardSize,
  CardState,
  Fact,
  FactSource,
  Mark,
  MarkOutcome,
  SightingOutcome,
  SpeciesSource,
  Square,
  Taxon,
} from "./types";

/** Labels per encoder call while building a Card, so progress can be shown between calls. */
const LABEL_BATCH = 32;

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
 * Where the game's adapters plug in. The store joins this interface in
 * ticket 09.
 */
export interface GameAdapters {
  encoder: Encoder;
  species: SpeciesSource;
  facts: FactSource;
  /** Today, for the season window. */
  now?: () => Date;
  /** For picking Squares and the 4×4 Wildcard; seeded in tests. */
  random?: () => number;
}

/** How a Card build is going. */
export type BuildProgress =
  /** Asking what's been seen within this radius, in these months of any year. */
  | { step: "species"; radiusKm: number; months: number[] }
  /** Fetching facts and reference photos for the local species, while there's signal. */
  | { step: "facts"; done: number; total: number }
  /** Encoding the local species' labels for the photo check. */
  | { step: "labels"; done: number; total: number };

export interface Game {
  /**
   * Builds a Card from species seen near the place this time of year, with
   * every local species' label vector ready, and makes it the active Card.
   * The current Card stays if the build fails. Throws NotEnoughSpeciesError
   * when even the widest search area can't fill it.
   */
  buildCard(request: CardRequest, onProgress?: (progress: BuildProgress) => void): Promise<CardState>;
  /** Whether there's an active Card, which a new one would replace. */
  hasCard(): boolean;
  /** What there is to learn about a local species on the active Card. */
  factFor(taxon: Taxon): Fact | undefined;
  /**
   * What an unmarked Square looks like, as a clue: its own species, or the
   * most observed local species for a broad animal Square. The Wildcard has none.
   */
  clue(index: number): { taxon: Taxon; fact?: Fact } | null;
  /** Makes this the active Card, with no Squares marked. */
  loadCard(card: Card): void;
  /**
   * Marks a Square, with what the Sighting looked like when there is one (a
   * guess's taxon). An already-marked Square keeps its first mark.
   */
  mark(index: number, mark: Mark, found?: Taxon): MarkOutcome;
  /**
   * Checks a Sighting, given its photo's vector, against the active Card.
   * A sure match to an open Square marks it as Verified, and a sure match to
   * a local species off the Card fills the open Wildcard; nothing else changes the Card.
   */
  sighting(photo: Float32Array): Promise<SightingOutcome>;
  /** The active Card and its marks. */
  state(): CardState;
}

/**
 * What a Square looks like: its own species, or for a broad animal Square the
 * most observed local species in its group (the local list is most observed first).
 */
function exampleOf(card: Card, square: Exclude<Square, { kind: "wildcard" }>): Taxon | undefined {
  return square.kind === "species"
    ? (card.localSpecies.find((t) => t.scientificName === square.scientificName) ?? square)
    : card.localSpecies.find((t) => t.group === square.group);
}

export function createGame({ encoder, species, facts, now = () => new Date(), random = Math.random }: GameAdapters): Game {
  let card: Card | null = null;
  let marks: (Mark | undefined)[] = [];
  /** What marked each broad animal Square and the Wildcard. */
  let found: (Taxon | undefined)[] = [];
  /** The Card's species and their label vectors. Encoding starts as soon as the Card loads. */
  let candidateVectors: Promise<{ list: Candidate[]; vectors: Float32Array[] }> | null = null;

  const active = (): Card => {
    if (!card) throw new Error("No Card is loaded");
    return card;
  };

  const bingos = () => lines(active().size).filter((line) => line.every((i) => marks[i]));
  const blackout = () => marks.every(Boolean);

  async function encodeLabels(forCard: Card, onProgress?: (progress: BuildProgress) => void) {
    const list = candidates(forCard);
    const labels = list.map((c) => label(c.taxon));
    const vectors: Float32Array[] = [];
    onProgress?.({ step: "labels", done: 0, total: labels.length });
    for (let i = 0; i < labels.length; i += LABEL_BATCH) {
      vectors.push(...(await encoder.encodeText(labels.slice(i, i + LABEL_BATCH))));
      onProgress?.({ step: "labels", done: vectors.length, total: labels.length });
    }
    return { list, vectors };
  }

  function encodeCandidates(forCard: Card) {
    const encoding = encodeLabels(forCard);
    // A failure surfaces on the next Sighting, which then tries again.
    encoding.catch(() => {
      if (candidateVectors === encoding) candidateVectors = null;
    });
    return encoding;
  }

  /**
   * Facts for every local species. The Card's own species and an example for
   * each animal Square get bigger photos, since they're the clues.
   */
  async function fetchFacts(forCard: Card, onProgress?: (progress: BuildProgress) => void) {
    const examples = new Set(
      forCard.squares.flatMap((square) => {
        if (square.kind === "wildcard") return [];
        const example = exampleOf(forCard, square);
        return example ? [example.scientificName] : [];
      }),
    );
    const clues = forCard.localSpecies.filter((t) => examples.has(t.scientificName));
    const rest = forCard.localSpecies.filter((t) => !examples.has(t.scientificName));
    const total = forCard.localSpecies.length;
    onProgress?.({ step: "facts", done: 0, total });
    const clueFacts = await facts.factsFor(clues, {
      photoSize: "medium",
      onProgress: (done) => onProgress?.({ step: "facts", done, total }),
    });
    const restFacts = await facts.factsFor(rest, {
      photoSize: "small",
      onProgress: (done) => onProgress?.({ step: "facts", done: clues.length + done, total }),
    });
    onProgress?.({ step: "facts", done: total, total });
    return Object.fromEntries([...clueFacts, ...restFacts]);
  }

  function state(): CardState {
    const { place, month, size, squares } = active();
    const complete = bingos();
    return {
      place,
      month,
      size,
      squares: squares.map((square, i) =>
        marks[i] ? { ...square, mark: marks[i], ...(found[i] && { found: found[i] }) } : square,
      ),
      bingos: complete,
      bingoCount: complete.length,
      blackout: blackout(),
    };
  }

  function mark(index: number, which: Mark, what?: Taxon): MarkOutcome {
    if (!Number.isInteger(index) || index < 0 || index >= active().squares.length) {
      throw new Error(`Square ${index} isn't on this Card`);
    }
    if (marks[index]) return { newBingos: [], blackout: false };
    marks[index] = which;
    // A species Square already names what was found.
    if (what && active().squares[index].kind !== "species") found[index] = what;
    return { newBingos: bingos().filter((line) => line.includes(index)), blackout: blackout() };
  }

  return {
    async buildCard(request, onProgress) {
      if (!request.groups.length) throw new Error("Choose at least one group for the Card");
      const month = now().getMonth() + 1;
      const months = seasonMonths(month);
      let built: Card | null = null;
      for (const radiusKm of SEARCH_RADII_KM) {
        onProgress?.({ step: "species", radiusKm, months });
        const { lat, lng } = request.place;
        const local = await species.speciesNear({ lat, lng, radiusKm, months });
        built = generateCard(local, request, month, radiusKm, random);
        if (built) break;
      }
      if (!built) throw new NotEnoughSpeciesError(request.size);
      built.facts = await fetchFacts(built, onProgress);

      // Everything the photo check needs is ready before the Card replaces the current one.
      const vectors = await encodeLabels(built, onProgress);
      card = built;
      marks = built.squares.map(() => undefined);
      found = built.squares.map(() => undefined);
      candidateVectors = Promise.resolve(vectors);
      return state();
    },

    hasCard: () => card !== null,

    factFor: (taxon) => card?.facts?.[taxon.scientificName],

    clue(index) {
      const square = active().squares[index];
      if (square.kind === "wildcard") return null;
      const taxon = exampleOf(active(), square);
      return taxon ? { taxon, fact: active().facts?.[taxon.scientificName] } : null;
    },

    loadCard(next) {
      const expected = next.size * next.size;
      if (next.squares.length !== expected) {
        throw new Error(`A ${next.size}×${next.size} Card needs ${expected} Squares, got ${next.squares.length}`);
      }
      card = next;
      marks = next.squares.map(() => undefined);
      found = next.squares.map(() => undefined);
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
        if (square === null) {
          // Anything living the photo check is sure of counts for the Wildcard.
          const wild = cardAtStart.squares.findIndex((s) => s.kind === "wildcard");
          if (wild < 0) return { kind: "not-on-card", taxon };
          if (!marks[wild]) return { kind: "verified", index: wild, taxon, mark: mark(wild, "verified", taxon) };
          return { kind: "not-on-card", taxon, wildcardFilledBy: found[wild] };
        }
        if (marks[square]) return { kind: "already-marked", index: square, taxon };
        return { kind: "verified", index: square, taxon, mark: mark(square, "verified", taxon) };
      }
      const open = ranked.flatMap(({ square, taxon }) => (square === null || marks[square] ? [] : [{ index: square, taxon }]));
      return { kind: "unsure", guesses: open.slice(0, 3) };
    },

    state,
  };
}
