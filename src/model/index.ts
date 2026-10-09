/**
 * The BioCLIP model files on the phone: the first-launch download into
 * browser storage, and reading them back for the photo check with no network.
 */

/** Cache API bucket holding the model files. */
const MODEL_CACHE = "trail-bingo-models-v1";

/** No new bytes for this long and a download counts as dropped, since a lost signal can hang rather than fail. */
const STALL_MS = 30_000;

/** What the photo check needs from the export's `manifest.json`. */
export interface Manifest {
  embeddingDim: number;
  contextLength: number;
  preprocess: { size: number; mean: number[]; std: number[] };
  files: Record<string, { image: string; text: string }>;
}

export interface DownloadProgress {
  /** Bytes received so far, counting files kept from an earlier try. */
  loaded: number;
  total: number;
  /** Bytes saved as whole files: what a failed try keeps for the next one. */
  stored: number;
}

/** The part of the Cache API the store uses. */
export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

export interface ModelStoreOptions {
  /** Where the model files are downloaded from; also their keys in storage. */
  base: string;
  fetch: typeof fetch;
  openCache(): Promise<CacheLike>;
  /** Asks the browser not to evict the model; resolves to whether it agreed. */
  persist(): Promise<boolean>;
  stallMs?: number;
}

export interface ModelStore {
  /** Whether every model file is in browser storage. */
  isStored(): Promise<boolean>;
  /**
   * Downloads the model files that aren't stored yet, then asks for persistent
   * storage. A failed try keeps the files it finished, so calling it again
   * fetches only the rest.
   */
  download(onProgress: (progress: DownloadProgress) => void): Promise<{ persisted: boolean }>;
  /** A stored model file's bytes. Never touches the network. */
  read(name: string): Promise<Uint8Array>;
}

const MANIFEST = "manifest.json";

/** Every file the photo check loads, as named in the manifest. */
const filesOf = (manifest: Manifest) => [
  "tokenizer.json",
  "tokenizer_config.json",
  manifest.files.fp16.image,
  manifest.files.fp16.text,
];

export class ModelMissingError extends Error {
  constructor(name: string) {
    super(`The photo check's model isn't on this phone (${name} is missing)`);
    this.name = "ModelMissingError";
  }
}

export class DownloadStalledError extends Error {
  constructor(name: string) {
    super(`The download stalled (${name})`);
    this.name = "DownloadStalledError";
  }
}

export function createModelStore(options: ModelStoreOptions): ModelStore {
  const { base, persist, stallMs = STALL_MS } = options;
  const urlOf = (name: string) => new URL(name, base).href;

  async function storedManifest(cache: CacheLike): Promise<Manifest | null> {
    const response = await cache.match(urlOf(MANIFEST));
    return response ? response.json() : null;
  }

  /** Fails if no bytes arrive for `stallMs`; `kick` on every chunk. */
  function watchdog(name: string) {
    const abort = new AbortController();
    let stalled = false;
    let timer: ReturnType<typeof setTimeout>;
    const kick = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        abort.abort(new DownloadStalledError(name));
      }, stallMs);
    };
    kick();
    return {
      signal: abort.signal,
      kick,
      stop: () => clearTimeout(timer),
      /** The error to report: a stall shows as a stall, whatever the stream threw. */
      errorFor: (error: unknown) => (stalled ? new DownloadStalledError(name) : error),
    };
  }

  /** Requests a file. `cache: "no-store"` keeps a second ~300 MB copy out of the HTTP cache. */
  async function open(name: string) {
    const watch = watchdog(name);
    try {
      const response = await options.fetch(urlOf(name), { signal: watch.signal, cache: "no-store" });
      if (!response.ok || !response.body) throw new Error(`Couldn't download ${name}: HTTP ${response.status}`);
      return { name, response, watch, declared: Number(response.headers.get("content-length")) || 0 };
    } catch (error) {
      watch.stop();
      throw watch.errorFor(error);
    }
  }

  async function fetchManifest(cache: CacheLike): Promise<Manifest> {
    const { response, watch } = await open(MANIFEST);
    try {
      const text = await response.text();
      const manifest: Manifest = JSON.parse(text);
      await cache.put(urlOf(MANIFEST), new Response(text, { headers: { "content-type": "application/json" } }));
      return manifest;
    } catch (error) {
      throw watch.errorFor(error);
    } finally {
      watch.stop();
    }
  }

  return {
    async isStored() {
      const cache = await options.openCache();
      const manifest = await storedManifest(cache);
      if (!manifest) return false;
      const found = await Promise.all(filesOf(manifest).map((name) => cache.match(urlOf(name))));
      return found.every(Boolean);
    },

    async download(onProgress) {
      const cache = await options.openCache();
      const manifest = (await storedManifest(cache)) ?? (await fetchManifest(cache));

      let kept = 0;
      const missing: string[] = [];
      for (const name of filesOf(manifest)) {
        const stored = await cache.match(urlOf(name));
        if (stored) kept += (await stored.blob()).size;
        else missing.push(name);
      }

      // Every request's headers first, so the total is known before the bar moves.
      // Files that started still finish if another couldn't, so a retry has less to fetch.
      const opening = await Promise.allSettled(missing.map(open));
      const opened = opening.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

      const received = new Map(opened.map((file) => [file.name, 0]));
      let stored = kept;
      const report = () => {
        let loaded = kept;
        let total = kept;
        for (const { name, declared } of opened) {
          loaded += received.get(name)!;
          total += Math.max(declared, received.get(name)!);
        }
        onProgress({ loaded, total, stored });
      };
      report();

      // Each file streams straight into storage; a body that errors stores nothing.
      const saving = await Promise.allSettled(
        opened.map(async ({ name, response, watch }) => {
          const counter = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              watch.kick();
              received.set(name, received.get(name)! + chunk.byteLength);
              report();
              controller.enqueue(chunk);
            },
          });
          try {
            await cache.put(urlOf(name), new Response(response.body!.pipeThrough(counter), { headers: response.headers }));
            stored += received.get(name)!;
            report();
          } catch (error) {
            throw watch.errorFor(error);
          } finally {
            watch.stop();
          }
        }),
      );
      const failed = [...opening, ...saving].find((result) => result.status === "rejected");
      if (failed) throw failed.reason;

      return { persisted: await persist().catch(() => false) };
    },

    async read(name) {
      const cache = await options.openCache();
      const response = await cache.match(urlOf(name));
      if (!response) throw new ModelMissingError(name);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** The model store for this app: files served from the app's `models/`, kept in the Cache API. */
export function browserModelStore(): ModelStore {
  return createModelStore({
    base: new URL("models/", new URL(import.meta.env.BASE_URL, self.location.origin)).href,
    fetch: (input, init) => fetch(input, init),
    openCache: () => caches.open(MODEL_CACHE),
    persist: async () => (await navigator.storage?.persist?.()) ?? false,
  });
}
