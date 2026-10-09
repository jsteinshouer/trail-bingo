import "./ui/style.css";
import { createGame, type CardSize } from "./game";
import { demoCard } from "./demo-card";
import { createBioclipEncoder } from "./encoder";
import { mountCardScreen } from "./ui/card-screen";

// Until the Card builder exists (ticket 05), `#3`, `#4` or `#5` picks the demo Card's size.
const sizeFromHash = (): CardSize => {
  const n = Number(location.hash.slice(1));
  return n === 3 || n === 4 ? n : 5;
};

const encoder = createBioclipEncoder();
const game = createGame({ encoder });
const screen = mountCardScreen(document.getElementById("app")!, game, encoder);
const loadDemoCard = () => {
  game.loadCard(demoCard(sizeFromHash()));
  screen.render();
};

addEventListener("hashchange", loadDemoCard);
loadDemoCard();
