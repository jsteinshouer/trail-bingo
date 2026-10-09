import "./ui/style.css";
import { createGame, type CardSize } from "./game";
import { demoCard } from "./demo-card";
import { createBioclipEncoder } from "./encoder";
import { browserModelStore } from "./model";
import { mountCardScreen } from "./ui/card-screen";
import { mountSetupScreen } from "./ui/setup-screen";

// Until the Card builder exists (ticket 05), `#3`, `#4` or `#5` picks the demo Card's size.
const sizeFromHash = (): CardSize => {
  const n = Number(location.hash.slice(1));
  return n === 3 || n === 4 ? n : 5;
};

const app = document.getElementById("app")!;

/** Opens the demo Card; the photo check loads from browser storage. */
function startGame() {
  app.setAttribute("aria-label", "Trail Bingo Card");
  const encoder = createBioclipEncoder();
  const game = createGame({ encoder });
  const screen = mountCardScreen(app, game, encoder);
  const loadDemoCard = () => {
    game.loadCard(demoCard(sizeFromHash()));
    screen.render();
  };

  addEventListener("hashchange", loadDemoCard);
  loadDemoCard();
}

// The first launch downloads the model; later launches go straight to the game.
const models = browserModelStore();
const stored = await models.isStored().catch(() => false);
if (stored) startGame();
else mountSetupScreen(app, models, startGame);
