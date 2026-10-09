import "./ui/style.css";
import { createGame } from "./game";
import { readDeviceFeatures, checkDevice } from "./device";
import { createBioclipEncoder, type BioclipEncoder } from "./encoder";
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
  const screen = mountCardScreen(app, game, encoder, { onNewCard: () => builder.open() });
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
      const info = await encoder.ready;
      await encoder.encodeText([WARM_UP_LABEL]);
      return info;
    },
    onReady: startGame,
  });
