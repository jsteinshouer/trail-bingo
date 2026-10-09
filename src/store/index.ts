import type { Card, SavedGame, SavedProgress, Store } from "../game";

/**
 * The active Card, kept on the phone in IndexedDB. Two records: the Card with
 * its facts, photos and label vectors, written once when it's built; and the
 * play on it, written after every mark. Nothing here leaves the phone.
 */

const DATABASE = "trail-bingo";
const VERSION = 1;
const RECORDS = "game";
const CARD = "card";
const PROGRESS = "progress";

const NO_PROGRESS: SavedProgress = { marks: [], found: [], photos: [] };

/** An IndexedDB request as a promise. */
const settled = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** A transaction's end: writes count once it completes, not when each request succeeds. */
const committed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving on the phone was cancelled"));
  });

export function createIndexedDbStore(indexedDB: IDBFactory = globalThis.indexedDB): Store {
  let database: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(RECORDS);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // A failed open is tried again next time.
    database.catch(() => (database = null));
    return database;
  }

  async function write(records: [string, unknown][]) {
    const transaction = (await open()).transaction(RECORDS, "readwrite");
    const store = transaction.objectStore(RECORDS);
    for (const [key, value] of records) store.put(value, key);
    await committed(transaction);
  }

  return {
    async load() {
      const records = (await open()).transaction(RECORDS, "readonly").objectStore(RECORDS);
      const [saved, progress] = await Promise.all([
        settled(records.get(CARD) as IDBRequest<{ card: Card; vectors: Float32Array[] } | undefined>),
        settled(records.get(PROGRESS) as IDBRequest<SavedProgress | undefined>),
      ]);
      if (!saved) return null;
      return { ...saved, progress: progress ?? NO_PROGRESS } satisfies SavedGame;
    },

    // A new Card and its empty progress land together, so the old Card's marks never apply to it.
    saveCard: (card, vectors) =>
      write([
        [CARD, { card, vectors }],
        [PROGRESS, NO_PROGRESS],
      ]),

    saveProgress: (progress) => write([[PROGRESS, progress]]),
  };
}
