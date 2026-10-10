/** Small IndexedDB helpers shared by the game's store and the hike log. */

/** An IndexedDB request as a promise. */
export const settled = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** A transaction's end: writes count once it completes, not when each request succeeds. */
export const committed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving on the phone was cancelled"));
  });

/** Opens a database once, when first needed; a failed open is tried again next time. */
export function opener(name: string, version: number, upgrade: (database: IDBDatabase) => void): () => Promise<IDBDatabase> {
  let database: Promise<IDBDatabase> | null = null;
  return () => {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => upgrade(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.catch(() => (database = null));
    return database;
  };
}
