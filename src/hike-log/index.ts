import type { CardState, MarkedSquare, SightingCheck, SightingOutcome } from "../game";

/**
 * A record of every Sighting on a hike, for tuning the photo check from real
 * photos afterwards. Kept on the phone in its own database, apart from the
 * game's; it leaves only when the player exports and shares it.
 */

type Named = { name: string; scientificName: string };

export interface HikeEntry {
  id: string;
  /** When the Sighting was taken, as an ISO date. */
  at: string;
  card: { id?: string; place: string; size: number };
  outcome: SightingOutcome["kind"];
  /** The Square the Sighting marked or matched. */
  square?: string;
  /** What the photo check matched, for a sure Sighting. */
  found?: Named;
  /** The Squares an unsure Sighting offered. */
  guesses?: string[];
  /** What the player did with an unsure Sighting's guesses. */
  resolution?: { picked: string } | { dismissed: true };
  matches: (Named & { square: string | null; score: number })[];
  gap: number;
  threshold: number;
  timing: { encodeMs: number; matchMs: number };
  /** WebGPU or WebAssembly. */
  backend?: string;
  battery?: { level: number; charging: boolean };
  photo?: Blob;
}

export interface EntryContext {
  id: string;
  at: Date;
  card: CardState;
  timing: HikeEntry["timing"];
  backend?: string;
  battery?: HikeEntry["battery"];
  photo?: Blob;
}

const nameOf = (square: MarkedSquare) => (square.kind === "wildcard" ? "Wildcard" : square.name);
const named = ({ name, scientificName }: Named): Named => ({ name, scientificName });

/** A log entry for a Sighting and its photo check. */
export function entryFor(outcome: SightingOutcome & { check: SightingCheck }, context: EntryContext): HikeEntry {
  const { card } = context;
  const squareName = (index: number | null) => (index === null ? null : nameOf(card.squares[index]));
  const entry: HikeEntry = {
    id: context.id,
    at: context.at.toISOString(),
    card: { ...(card.id && { id: card.id }), place: card.place.name ?? "Your location", size: card.size },
    outcome: outcome.kind,
    matches: outcome.check.matches.map(({ taxon, square, score }) => ({ ...named(taxon), square: squareName(square), score })),
    gap: outcome.check.gap,
    threshold: outcome.check.threshold,
    timing: context.timing,
  };
  if (outcome.kind === "verified" || outcome.kind === "already-marked") entry.square = nameOf(card.squares[outcome.index]);
  if (outcome.kind !== "unsure") entry.found = named(outcome.taxon);
  else entry.guesses = outcome.guesses.map((g) => nameOf(card.squares[g.index]));
  if (context.backend) entry.backend = context.backend;
  if (context.battery) entry.battery = context.battery;
  if (context.photo) entry.photo = context.photo;
  return entry;
}

/** A photo as a data URL, so the export is one self-contained file. */
async function dataUrl(photo: Blob): Promise<string> {
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${photo.type || "image/jpeg"};base64,${btoa(binary)}`;
}

/** The whole log as JSON, photos included. */
export async function toExport(entries: HikeEntry[], now: Date): Promise<string> {
  const exported = await Promise.all(
    entries.map(async ({ photo, ...entry }) => ({ ...entry, photo: photo ? await dataUrl(photo) : null })),
  );
  return JSON.stringify({ app: "Trail Bingo", kind: "hike log", exportedAt: now.toISOString(), entries: exported }, null, 1);
}

/** The battery's charge, where the browser tells (Chrome does). */
export async function batteryNow(): Promise<HikeEntry["battery"]> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
  const battery = await nav.getBattery?.().catch(() => null);
  return battery ? { level: battery.level, charging: battery.charging } : undefined;
}

const DATABASE = "trail-bingo-hike-log";
const SIGHTINGS = "sightings";

const settled = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export interface HikeLog {
  add(entry: HikeEntry): Promise<void>;
  /** Records what the player did with an unsure Sighting's guesses. */
  resolve(id: string, resolution: NonNullable<HikeEntry["resolution"]>): Promise<void>;
  all(): Promise<HikeEntry[]>;
  count(): Promise<number>;
}

export function createHikeLog(): HikeLog {
  let database: Promise<IDBDatabase> | null = null;
  const open = () =>
    (database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(SIGHTINGS, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  const sightings = async (mode: IDBTransactionMode) => (await open()).transaction(SIGHTINGS, mode).objectStore(SIGHTINGS);

  return {
    async add(entry) {
      await settled((await sightings("readwrite")).put(entry));
    },
    async resolve(id, resolution) {
      const store = await sightings("readwrite");
      const entry = await settled(store.get(id) as IDBRequest<HikeEntry | undefined>);
      if (entry) await settled(store.put({ ...entry, resolution }));
    },
    async all() {
      const entries = await settled((await sightings("readonly")).getAll() as IDBRequest<HikeEntry[]>);
      return entries.sort((a, b) => a.at.localeCompare(b.at));
    },
    async count() {
      return settled((await sightings("readonly")).count());
    },
  };
}
