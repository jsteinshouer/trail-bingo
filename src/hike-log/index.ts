import { squareName, type CardState, type CheckedSighting, type SightingOutcome } from "../game";
import { opener, settled } from "../idb";

/**
 * An optional record of a hike, for tuning the photo check from real photos
 * afterwards: every Sighting with the photo check's working and the player's
 * photo, and the time the app spent on screen. Off until the player turns it
 * on; kept on the phone in its own database, apart from the game's; it leaves
 * only when the player exports and shares it.
 */

type Named = { name: string; scientificName: string };

/** What the player did with an unsure Sighting's guesses. */
export type GuessResolution = { picked: string } | { dismissed: true };

/** How long a photo check took: the image encoding, then the matching. */
export interface CheckTiming {
  encodeMs: number;
  matchMs: number;
}

export interface HikeEntry {
  id: string;
  /** When the Sighting was taken, as an ISO date. */
  at: string;
  card: { id?: string; place: string; size: number };
  outcome: SightingOutcome["kind"] | "failed";
  /** Why a failed check failed. */
  error?: string;
  /** The Square the Sighting marked or matched. */
  square?: string;
  /** What the photo check matched, for a sure Sighting. */
  found?: Named;
  /** The Squares an unsure Sighting offered. */
  guesses?: string[];
  resolution?: GuessResolution;
  /** The best match for each Square (or each off-Card species), best first; `marked` if the Square was already marked. */
  matches: (Named & { square: string | null; marked: boolean; score: number })[];
  gap: number;
  threshold: number;
  timing: CheckTiming;
  /** The first check since the app opened, whose timing includes starting up. */
  firstSinceLaunch: boolean;
  /** WebGPU or WebAssembly. */
  backend?: string;
  battery?: { level: number; charging: boolean };
  photo?: Blob;
}

/** A stretch of time the app was on screen. */
export interface ScreenSpell {
  start: string;
  end: string;
}

export interface EntryContext {
  id: string;
  at: Date;
  /** The Card after the Sighting. */
  card: CardState;
  timing: CheckTiming;
  firstSinceLaunch: boolean;
  backend?: string;
  battery?: HikeEntry["battery"];
  photo?: Blob;
}

const taxonNames = ({ name, scientificName }: Named): Named => ({ name, scientificName });

/** What every entry records, whatever the outcome. */
function baseEntry(context: EntryContext): Omit<HikeEntry, "outcome" | "matches" | "gap" | "threshold"> {
  const { card } = context;
  return {
    id: context.id,
    at: context.at.toISOString(),
    card: { ...(card.id && { id: card.id }), place: card.place.name ?? "Your location", size: card.size },
    timing: context.timing,
    firstSinceLaunch: context.firstSinceLaunch,
    ...(context.backend && { backend: context.backend }),
    ...(context.battery && { battery: context.battery }),
    ...(context.photo && { photo: context.photo }),
  };
}

/** A log entry for a checked Sighting. */
export function entryFor(outcome: CheckedSighting, context: EntryContext): HikeEntry {
  const { squares } = context.card;
  const markedNow = outcome.kind === "verified" ? outcome.index : null;
  const entry: HikeEntry = {
    ...baseEntry(context),
    outcome: outcome.kind,
    matches: outcome.check.matches.map(({ taxon, square, score }) => ({
      ...taxonNames(taxon),
      square: square === null ? null : squareName(squares[square]),
      // The Card is as it is after the Sighting, so the Square it just marked wasn't marked before.
      marked: square !== null && square !== markedNow && Boolean(squares[square].mark),
      score,
    })),
    gap: outcome.check.gap,
    threshold: outcome.check.threshold,
  };
  if (outcome.kind === "verified" || outcome.kind === "already-marked") entry.square = squareName(squares[outcome.index]);
  if (outcome.kind === "unsure") entry.guesses = outcome.guesses.map((g) => squareName(squares[g.index]));
  else entry.found = taxonNames(outcome.taxon);
  return entry;
}

/** A log entry for a Sighting the photo check couldn't check. */
export function failedEntryFor(error: unknown, context: EntryContext): HikeEntry {
  return {
    ...baseEntry(context),
    outcome: "failed",
    error: error instanceof Error ? error.message : String(error),
    matches: [],
    gap: 0,
    threshold: 0,
  };
}

/** A photo as a data URL, so the export is one self-contained file. */
async function dataUrl(photo: Blob): Promise<string> {
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${photo.type || "image/jpeg"};base64,${btoa(binary)}`;
}

const NOTES =
  "matches holds the best species for each Square (and each off-Card species), best first; gap is the lead of the best over the next. " +
  "Timings flagged firstSinceLaunch include starting the photo check.";

/** The whole log as JSON, photos included. */
export async function toExport(entries: HikeEntry[], screen: ScreenSpell[], now: Date): Promise<string> {
  const exported = await Promise.all(
    entries.map(async ({ photo, ...entry }) => ({ ...entry, photo: photo ? await dataUrl(photo) : null })),
  );
  return JSON.stringify({ app: "Trail Bingo", kind: "hike log", exportedAt: now.toISOString(), notes: NOTES, screen, entries: exported }, null, 1);
}

/** The battery's charge, where the browser tells (Chrome does). */
export async function batteryNow(): Promise<HikeEntry["battery"]> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
  const battery = await nav.getBattery?.().catch(() => null);
  return battery ? { level: battery.level, charging: battery.charging } : undefined;
}

const SIGHTINGS = "sightings";
const SCREEN = "screen";

export interface HikeLog {
  add(entry: HikeEntry): Promise<void>;
  resolve(id: string, resolution: GuessResolution): Promise<void>;
  addScreenTime(spell: ScreenSpell): Promise<void>;
  all(): Promise<{ entries: HikeEntry[]; screen: ScreenSpell[] }>;
  count(): Promise<number>;
  /** Empties the log, photos and all. */
  clear(): Promise<void>;
}

export function createHikeLog(): HikeLog {
  const open = opener("trail-bingo-hike-log", 1, (database) => {
    database.createObjectStore(SIGHTINGS, { keyPath: "id" });
    database.createObjectStore(SCREEN, { autoIncrement: true });
  });
  const records = async (name: string, mode: IDBTransactionMode) => (await open()).transaction(name, mode).objectStore(name);

  return {
    async add(entry) {
      await settled((await records(SIGHTINGS, "readwrite")).put(entry));
    },
    async resolve(id, resolution) {
      const sightings = await records(SIGHTINGS, "readwrite");
      const entry = await settled(sightings.get(id) as IDBRequest<HikeEntry | undefined>);
      if (entry) await settled(sightings.put({ ...entry, resolution }));
    },
    async addScreenTime(spell) {
      await settled((await records(SCREEN, "readwrite")).add(spell));
    },
    async all() {
      const [entries, screen] = await Promise.all([
        settled((await records(SIGHTINGS, "readonly")).getAll() as IDBRequest<HikeEntry[]>),
        settled((await records(SCREEN, "readonly")).getAll() as IDBRequest<ScreenSpell[]>),
      ]);
      return { entries: entries.sort((a, b) => a.at.localeCompare(b.at)), screen };
    },
    async count() {
      return settled((await records(SIGHTINGS, "readonly")).count());
    },
    async clear() {
      await Promise.all([settled((await records(SIGHTINGS, "readwrite")).clear()), settled((await records(SCREEN, "readwrite")).clear())]);
    },
  };
}

const ENABLED_KEY = "trail-bingo-hike-log";

/** Whether the player has turned the hike log on. Remembered in this browser only. */
export function hikeLogOn(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "on";
  } catch {
    return false;
  }
}

export function setHikeLogOn(on: boolean) {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, "on");
    else localStorage.removeItem(ENABLED_KEY);
  } catch {
    // Without storage the log just stays off.
  }
}
