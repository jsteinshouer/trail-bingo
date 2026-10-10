import { NO_PROGRESS, type Card, type SavedGame, type SavedProgress, type Store } from "../game";
import { committed, opener, settled } from "../idb";

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

export function createIndexedDbStore(): Store {
  const open = opener(DATABASE, VERSION, (database) => database.createObjectStore(RECORDS));

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
