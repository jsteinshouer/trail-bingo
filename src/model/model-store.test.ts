import { describe, expect, it } from "vitest";
import { createModelStore, type CacheLike, type DownloadProgress } from "./index";

const SOURCE = "https://models.example/bioclip/";
const KEYS = "https://app.example/models/";

const MANIFEST = JSON.stringify({ files: { fp16: { image: "image.onnx", text: "text.onnx" } } });

/** What the server holds: name → bytes. The two encoders are the big ones. */
const SERVER: Record<string, Uint8Array> = {
  "manifest.json": new TextEncoder().encode(MANIFEST),
  "tokenizer.json": bytes(30),
  "tokenizer_config.json": bytes(10),
  "image.onnx": bytes(600),
  "text.onnx": bytes(400),
};
const DOWNLOAD_BYTES = 30 + 10 + 600 + 400;

function bytes(n: number, fill = 7) {
  return new Uint8Array(n).fill(fill);
}

/** Streams `body` in 100-byte chunks; `failAfter` errors the stream after that many bytes. */
function streamOf(body: Uint8Array, failAfter?: number) {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (failAfter !== undefined && sent >= failAfter) return controller.error(new TypeError("network error"));
      if (sent >= body.length) return controller.close();
      const chunk = body.slice(sent, sent + 100);
      sent += chunk.length;
      controller.enqueue(chunk);
    },
  });
}

type Fault = "offline" | "http-500" | { failAfter: number } | "stall";

function fakeServer() {
  const faults = new Map<string, Fault>();
  const requests: string[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const name = url.slice(SOURCE.length);
    requests.push(name);
    const fault = faults.get(name);
    if (fault === "offline") throw new TypeError("Failed to fetch");
    if (fault === "http-500") return new Response("oops", { status: 500 });
    const body = SERVER[name];
    if (!body) return new Response("missing", { status: 404 });
    const headers = { "content-length": String(body.length) };
    if (fault === "stall") {
      // Headers arrive, then the body never sends another byte until the request is aborted.
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(init.signal!.reason));
        },
      });
      return new Response(stream, { headers });
    }
    const failAfter = typeof fault === "object" ? fault.failAfter : undefined;
    return new Response(streamOf(body, failAfter), { headers });
  };
  return { fetch, faults, requests };
}

/** In-memory Cache API: `put` reads the whole body first, so a body that errors stores nothing. */
function fakeCache(): CacheLike & { entries: Map<string, Uint8Array> } {
  const entries = new Map<string, Uint8Array>();
  return {
    entries,
    async match(key) {
      const body = entries.get(String(key));
      return body ? new Response(body.slice()) : undefined;
    },
    async put(key, response) {
      const body = new Uint8Array(await response.arrayBuffer());
      entries.set(String(key), body);
    },
  };
}

function setup(options: { persist?: () => Promise<boolean>; stallMs?: number } = {}) {
  const server = fakeServer();
  const cache = fakeCache();
  const persistCalls: number[] = [];
  const store = createModelStore({
    source: SOURCE,
    keyBase: KEYS,
    fetch: server.fetch,
    openCache: async () => cache,
    persist: async () => {
      persistCalls.push(1);
      return options.persist ? options.persist() : true;
    },
    stallMs: options.stallMs,
  });
  return { store, server, cache, persistCalls };
}

const progressLog = () => {
  const log: DownloadProgress[] = [];
  return { log, onProgress: (p: DownloadProgress) => log.push(p) };
};

describe("model store", () => {
  it("isn't stored before the first download", async () => {
    const { store } = setup();
    expect(await store.isStored()).toBe(false);
  });

  it("downloads every model file into browser storage, keyed by the app's own URLs", async () => {
    const { store, cache } = setup();
    await store.download(() => {});

    expect(await store.isStored()).toBe(true);
    expect([...cache.entries.keys()].sort()).toEqual(
      ["image.onnx", "manifest.json", "text.onnx", "tokenizer.json", "tokenizer_config.json"].map((n) => KEYS + n),
    );
    expect(cache.entries.get(KEYS + "image.onnx")).toEqual(SERVER["image.onnx"]);
  });

  it("reports real byte progress across the model files, ending at the total", async () => {
    const { store } = setup();
    const { log, onProgress } = progressLog();
    await store.download(onProgress);

    expect(log.length).toBeGreaterThan(5);
    for (const p of log) expect(p.total).toBe(DOWNLOAD_BYTES);
    const loaded = log.map((p) => p.loaded);
    expect(loaded).toEqual([...loaded].sort((a, b) => a - b));
    expect(log.at(-1)).toEqual({ loaded: DOWNLOAD_BYTES, total: DOWNLOAD_BYTES });
  });

  it("asks for persistent storage once the download finishes", async () => {
    const { store, persistCalls } = setup({ persist: async () => false });
    const result = await store.download(() => {});

    expect(persistCalls).toHaveLength(1);
    expect(result).toEqual({ persisted: false });
  });

  it("fails when the connection drops mid-file, storing no partial file", async () => {
    const { store, server, cache, persistCalls } = setup();
    server.faults.set("image.onnx", { failAfter: 300 });

    await expect(store.download(() => {})).rejects.toThrow();
    expect(await store.isStored()).toBe(false);
    expect(cache.entries.has(KEYS + "image.onnx")).toBe(false);
    expect(persistCalls).toHaveLength(0);
  });

  it("fails on an HTTP error", async () => {
    const { store, server } = setup();
    server.faults.set("text.onnx", "http-500");

    await expect(store.download(() => {})).rejects.toThrow(/500/);
    expect(await store.isStored()).toBe(false);
  });

  it("fails when offline before anything arrives", async () => {
    const { store, server } = setup();
    server.faults.set("manifest.json", "offline");

    await expect(store.download(() => {})).rejects.toThrow();
    expect(await store.isStored()).toBe(false);
  });

  it("fails when a download stops sending bytes", async () => {
    const { store, server } = setup({ stallMs: 20 });
    server.faults.set("text.onnx", "stall");

    await expect(store.download(() => {})).rejects.toThrow(/stalled/i);
    expect(await store.isStored()).toBe(false);
  });

  it("retries cleanly, downloading only the files it doesn't already have", async () => {
    const { store, server } = setup();
    server.faults.set("image.onnx", { failAfter: 300 });
    await expect(store.download(() => {})).rejects.toThrow();

    server.faults.clear();
    server.requests.length = 0;
    const { log, onProgress } = progressLog();
    await store.download(onProgress);

    expect(await store.isStored()).toBe(true);
    expect(server.requests).toEqual(["image.onnx"]);
    // Files kept from the first try count as already downloaded.
    expect(log[0].total).toBe(DOWNLOAD_BYTES);
    expect(log[0].loaded).toBeGreaterThanOrEqual(DOWNLOAD_BYTES - 600);
    expect(log.at(-1)).toEqual({ loaded: DOWNLOAD_BYTES, total: DOWNLOAD_BYTES });
  });

  it("keeps the other files when one can't even start downloading", async () => {
    const { store, server } = setup();
    server.faults.set("image.onnx", "offline");
    await expect(store.download(() => {})).rejects.toThrow();

    server.faults.clear();
    server.requests.length = 0;
    await store.download(() => {});

    expect(server.requests).toEqual(["image.onnx"]);
  });

  it("isn't stored if the browser has since dropped one of the files", async () => {
    const { store, cache } = setup();
    await store.download(() => {});
    cache.entries.delete(KEYS + "text.onnx");

    expect(await store.isStored()).toBe(false);
  });

  it("reads stored model files for the photo check without the network", async () => {
    const { store, server } = setup();
    await store.download(() => {});
    server.requests.length = 0;
    for (const name of Object.keys(SERVER)) server.faults.set(name, "offline");

    expect(await store.read("image.onnx")).toEqual(SERVER["image.onnx"]);
    expect(server.requests).toEqual([]);
  });

  it("says the model is missing rather than downloading it on read", async () => {
    const { store, server } = setup();

    await expect(store.read("image.onnx")).rejects.toThrow(/isn't on this phone/);
    expect(server.requests).toEqual([]);
  });

  it("keeps progress sane when the server doesn't send a length", async () => {
    const server = fakeServer();
    const store = createModelStore({
      source: SOURCE,
      keyBase: KEYS,
      fetch: async (input, init) => {
        const response = await server.fetch(input, init);
        return new Response(response.body, { status: response.status });
      },
      openCache: async () => fakeCache(),
      persist: async () => true,
    });
    const { log, onProgress } = progressLog();
    await store.download(onProgress);

    for (const p of log) expect(p.loaded).toBeLessThanOrEqual(p.total);
    expect(log.at(-1)).toEqual({ loaded: DOWNLOAD_BYTES, total: DOWNLOAD_BYTES });
  });
});
