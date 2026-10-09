import "./ui/style.css";
import { createGame } from "./game";
import { createBioclipEncoder } from "./encoder";
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

/** The game: the Card screen, with the Card builder over it until there's a Card. */
function startGame() {
  app.setAttribute("aria-label", "Trail Bingo Card");
  const encoder = createBioclipEncoder();
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

// The first launch downloads the model; later launches go straight to the game.
const models = browserModelStore();
const stored = await models.isStored().catch(() => false);
if (stored) startGame();
else mountSetupScreen(app, models, startGame);
