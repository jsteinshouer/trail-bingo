import "./ui/style.css";
import { createGame } from "./game";
import { readDeviceFeatures, checkDevice } from "./device";
import { createBioclipEncoder, type BioclipEncoder } from "./encoder";
import { batteryNow, createHikeLog, entryFor, toExport } from "./hike-log";
import { browserModelStore } from "./model";
import { createInatFactSource } from "./facts";
import { createPlaceSearch, currentPosition } from "./places";
import { createInatSpeciesSource } from "./species";
import { createIndexedDbStore } from "./store";
import { mountBuilder } from "./ui/builder";
import { mountCardScreen } from "./ui/card-screen";
import { mountSetupScreen } from "./ui/setup-screen";

const app = document.getElementById("app")!;
const web = { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };

/** The photo check, started once: by the first-launch warm-up, or by the game. */
let photoCheck: BioclipEncoder | null = null;
const startPhotoCheck = () => (photoCheck ??= createBioclipEncoder());

/** A label to encode once after the download, proving the photo check runs here. */
const WARM_UP_LABEL = "a photo of Achillea millefolium, Common yarrow.";

/** The hike log as one JSON file, photos included. */
async function hikeLogFile(hikeLog: ReturnType<typeof createHikeLog>): Promise<File> {
  const now = new Date();
  const json = await toExport(await hikeLog.all(), now);
  return new File([json], `trail-bingo-hike-log-${now.toISOString().slice(0, 10)}.json`, { type: "application/json" });
}

/** Hands a file to the share sheet where the browser allows it, or downloads it. */
async function saveFile(file: File) {
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: "Trail Bingo hike log" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}

/** The game: the Card screen, with the Card builder over it until there's a Card. */
function startGame() {
  app.setAttribute("aria-label", "Trail Bingo Card");
  const encoder = startPhotoCheck();
  const game = createGame({
    encoder,
    species: createInatSpeciesSource(web),
    facts: createInatFactSource(web),
    store: createIndexedDbStore(),
  });
  const hikeLog = createHikeLog();
  /** The latest entry's save, so a pick is recorded after the Sighting it belongs to. */
  let lastEntry: Promise<string | null> = Promise.resolve(null);
  const screen = mountCardScreen(app, game, encoder, {
    onNewCard: () => builder.open(),
    record: {
      checked(outcome, photo, timing) {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const card = game.state();
        lastEntry = Promise.all([encoder.ready.catch(() => null), batteryNow()])
          .then(([info, battery]) =>
            hikeLog.add(entryFor(outcome, { id, at: new Date(), card, timing, backend: info?.backend, battery, photo })),
          )
          .then(() => id, () => null);
      },
      resolved(resolution) {
        lastEntry.then((id) => (id ? hikeLog.resolve(id, resolution) : undefined)).catch(() => {});
      },
    },
    hikeLog: { count: () => hikeLog.count(), export: async () => saveFile(await hikeLogFile(hikeLog)) },
  });
  const builder = mountBuilder(app, game, {
    locate: currentPosition,
    search: createPlaceSearch(web).search,
    photoCheck: encoder.ready,
    onBuilt: () => screen.render(),
  });
  // A Card saved on the phone comes back as it was; without one, it's time to build one.
  game.restore().then(
    (restored) => (restored ? screen.render() : builder.open()),
    () =>
      builder.open(
        "Your saved Card couldn't be read on this phone. Building a new Card will replace it, so only build one if you're ready to start over.",
      ),
  );
}

// The service worker keeps the app shell, so the installed app opens with no signal.
// Not in development, where it would serve stale files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { type: "module" }).catch(() => {});
}

// The first launch downloads the model; later launches go straight to the game.
const models = browserModelStore();
const stored = await models.isStored().catch(() => false);
if (stored) startGame();
else
  mountSetupScreen(app, models, {
    checkDevice: async () => checkDevice(await readDeviceFeatures()),
    async warmUp() {
      const encoder = startPhotoCheck();
      try {
        const info = await encoder.ready;
        await encoder.encodeText([WARM_UP_LABEL]);
        return info;
      } catch (error) {
        // Trying again starts a fresh photo check.
        photoCheck = null;
        throw error;
      }
    },
    onReady: startGame,
  });
