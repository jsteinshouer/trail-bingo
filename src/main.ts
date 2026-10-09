import "./ui/style.css";
import { createGame } from "./game";
import { createBioclipEncoder } from "./encoder";
import { browserModelStore } from "./model";
import { createPlaceNamer, currentPosition } from "./places";
import { createInatSpeciesSource } from "./species";
import { mountBuilder } from "./ui/builder";
import { mountCardScreen } from "./ui/card-screen";
import { mountSetupScreen } from "./ui/setup-screen";

const app = document.getElementById("app")!;
const web = { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };

/** The game: the Card screen, with the Card builder over it until there's a Card. */
function startGame() {
  app.setAttribute("aria-label", "Trail Bingo Card");
  const encoder = createBioclipEncoder();
  const game = createGame({ encoder, species: createInatSpeciesSource(web) });
  const places = createPlaceNamer(web);
  const screen = mountCardScreen(app, game, encoder, { onNewCard: () => builder.open() });
  const builder = mountBuilder(app, game, {
    locate: currentPosition,
    nameOf: places.nameOf,
    onBuilt: () => screen.render(),
  });
  builder.open();
}

// The first launch downloads the model; later launches go straight to the game.
const models = browserModelStore();
const stored = await models.isStored().catch(() => false);
if (stored) startGame();
else mountSetupScreen(app, models, startGame);
