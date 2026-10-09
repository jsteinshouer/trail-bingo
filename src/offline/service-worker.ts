import { routeFor } from "./routes";

// The service worker: the installed app opens with no signal. It caches the
// app shell; the model, Card, facts and photos are stored by the app itself.

// Filled in by the build (see vite.config.ts): the app's files, and a version that changes with them.
declare const __SHELL_FILES__: string[];
declare const __SHELL_VERSION__: string;

/** The parts of the service worker scope this file uses (the DOM types don't describe it). */
interface WaitableEvent extends Event {
  waitUntil(work: Promise<unknown>): void;
}
interface FetchEvent extends WaitableEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
const worker = self as unknown as {
  registration: { scope: string };
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", listener: (event: WaitableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
};

const SHELL_CACHE_PREFIX = "trail-bingo-shell-";
const SHELL_CACHE = SHELL_CACHE_PREFIX + __SHELL_VERSION__;
const scope = worker.registration.scope;

worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(__SHELL_FILES__.map((file) => new URL(file, scope).href))),
  );
});

// A new version replaces the old shell. The model's cache isn't a shell cache, so it stays.
worker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener("fetch", (event) => {
  const route = routeFor(event.request, scope, __SHELL_FILES__);
  if (route.kind === "network") return;
  event.respondWith(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.match(route.key))
      .then((cached) => cached ?? fetch(event.request)),
  );
});
