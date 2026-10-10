import "./ui/style.css";
import { createGame, type Game } from "./game";
import { readDeviceFeatures, checkDevice } from "./device";
import { createBioclipEncoder, type BioclipEncoder } from "./encoder";
import {
  batteryNow,
  createHikeLog,
  entryFor,
  failedEntryFor,
  hikeLogOn,
  setHikeLogOn,
  toExport,
  type CheckTiming,
  type EntryContext,
  type HikeEntry,
  type ScreenSpell,
} from "./hike-log";
import { browserModelStore } from "./model";
import { createInatFactSource } from "./facts";
import { createPlaceSearch, currentPosition } from "./places";
import { createInatSpeciesSource } from "./species";
import { createIndexedDbStore } from "./store";
import { mountBuilder } from "./ui/builder";
import { mountCardScreen, type HikeLogControls } from "./ui/card-screen";
import type { SightingRecorder } from "./ui/sighting";
import { mountSetupScreen } from "./ui/setup-screen";

const app = document.getElementById("app")!;
const web = { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };

/** The photo check, started once: by the first-launch warm-up, or by the game. */
let photoCheck: BioclipEncoder | null = null;
const startPhotoCheck = () => (photoCheck ??= createBioclipEncoder());

/** A label to encode once after the download, proving the photo check runs here. */
const WARM_UP_LABEL = "a photo of Achillea millefolium, Common yarrow.";

/** Hands a file to the share sheet where the browser allows it, or downloads it. */
async function saveFile(file: File) {
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: "Trail Bingo hike log" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}

/**
 * The optional hike log: records Sightings and screen time while it's on, and
 * gives the Card menu its controls.
 */
function hikeLogFor(game: Game, encoder: BioclipEncoder): { record: SightingRecorder; controls: HikeLogControls } {
  const log = createHikeLog();
  let checks = 0;
  /** The latest entry's id once it's saved, so a pick is recorded after the Sighting it belongs to. */
  let lastEntryId: Promise<string | null> = Promise.resolve(null);

  function save(entry: (context: EntryContext) => HikeEntry, photo: Blob, timing: CheckTiming) {
    if (!hikeLogOn()) return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const context = { id, at: new Date(), card: game.state(), timing, firstSinceLaunch: ++checks === 1, photo };
    lastEntryId = Promise.all([encoder.ready.catch(() => null), batteryNow()])
      .then(([info, battery]) => log.add(entry({ ...context, backend: info?.backend, battery })))
      .then(() => id, () => null);
  }

  // Screen time: each stretch the app is on screen, while the log is on.
  let onScreenSince = document.visibilityState === "visible" ? new Date() : null;
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onScreenSince = new Date();
    else if (onScreenSince) {
      if (hikeLogOn()) log.addScreenTime({ start: onScreenSince.toISOString(), end: new Date().toISOString() }).catch(() => {});
      onScreenSince = null;
    }
  });
  /** Screen time so far, including the stretch the app is on screen now. */
  const screenSoFar = (screen: ScreenSpell[]) =>
    onScreenSince ? [...screen, { start: onScreenSince.toISOString(), end: new Date().toISOString() }] : screen;

  return {
    record: {
      checked: (outcome, photo, timing) => save((context) => entryFor(outcome, context), photo, timing),
      failed: (error, photo, timing) => save((context) => failedEntryFor(error, context), photo, timing),
      resolved(resolution) {
        if (!hikeLogOn()) return;
        lastEntryId.then((id) => (id ? log.resolve(id, resolution) : undefined)).catch(() => {});
      },
    },
    controls: {
      isOn: hikeLogOn,
      async start() {
        // A new log starts with the hike, so test shots from home don't mix in.
        await log.clear();
        onScreenSince = new Date();
        setHikeLogOn(true);
      },
      async stop() {
        setHikeLogOn(false);
        await log.clear();
      },
      count: () => log.count(),
      async export() {
        const now = new Date();
        const { entries, screen } = await log.all();
        const json = await toExport(entries, screenSoFar(screen), now);
        await saveFile(new File([json], `trail-bingo-hike-log-${now.toISOString().slice(0, 10)}.json`, { type: "application/json" }));
      },
    },
  };
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
  const hikeLog = hikeLogFor(game, encoder);
  const screen = mountCardScreen(app, game, encoder, {
    onNewCard: () => builder.open(),
    record: hikeLog.record,
    hikeLog: hikeLog.controls,
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
