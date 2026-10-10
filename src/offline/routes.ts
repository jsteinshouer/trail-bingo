/** Where the service worker sends a request: the app-shell cache, or the network as if it weren't there. */
export type Route = { kind: "shell"; key: string } | { kind: "network" };

/** The model is downloaded and stored by the setup screen, not the service worker. */
const MODELS = "models/";

/**
 * Pages in the app's scope open from the cached app shell, and the app's own
 * files come from the shell cache. Everything else (the model download,
 * iNaturalist, OpenStreetMap, photos) goes to the network untouched.
 * `shell` lists the app's files relative to `scope`, with "./" for the page.
 */
export function routeFor(request: { url: string; method: string; mode: RequestMode }, scope: string, shell: string[]): Route {
  if (request.method !== "GET") return { kind: "network" };
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  if (!url.href.startsWith(scope)) return { kind: "network" };
  const path = url.href.slice(scope.length);
  if (path.startsWith(MODELS)) return { kind: "network" };
  if (request.mode === "navigate") return { kind: "shell", key: scope };
  return shell.includes(path) ? { kind: "shell", key: url.href } : { kind: "network" };
}
