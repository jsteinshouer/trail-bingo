import { NotEnoughSpeciesError, type BuildProgress, type CardGroup, type CardSize, type Game } from "../game";
import { ICON_CLOSE, ICON_LOCATE, kindGlyph } from "./icons";
import { esc, messageOf, monthName } from "./text";

const SIZES: { size: CardSize; note: string }[] = [
  { size: 3, note: "A short walk" },
  { size: 4, note: "An afternoon" },
  { size: 5, note: "A long day" },
];

const GROUPS: { group: CardGroup; label: string }[] = [
  { group: "plant", label: "Plants and wildflowers" },
  { group: "tree", label: "Trees and shrubs" },
  { group: "fungus", label: "Fungi and lichens" },
  { group: "animal", label: "Animals" },
];

/** "41.29° N" */
const degrees = (value: number, positive: string, negative: string) =>
  `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`;

export interface BuilderOptions {
  /** The device's location. */
  locate(): Promise<{ lat: number; lng: number }>;
  /** The new Card is the active one and ready offline. */
  onBuilt(): void;
}

/**
 * Building a Card: where, what size, which groups. Shown over the Card screen,
 * and on its own when there's no Card yet.
 */
export function mountBuilder(root: HTMLElement, game: Game, options: BuilderOptions) {
  const overlay = document.createElement("section");
  overlay.className = "builder";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "builder-title");
  overlay.innerHTML = `
    <header class="camera-head">
      <h2 id="builder-title">New Card</h2>
      <button class="close" type="button" aria-label="Close">${ICON_CLOSE}</button>
    </header>
    <form class="builder-body">
      <fieldset class="where">
        <legend>Where</legend>
        <button class="btn locate" type="button">${ICON_LOCATE}Use my location</button>
        <p class="place-line" aria-live="polite"></p>
      </fieldset>
      <fieldset class="sizes">
        <legend>Card size</legend>
        ${SIZES.map(
          ({ size, note }) => `<label class="choice"><input type="radio" name="size" value="${size}"${size === 4 ? " checked" : ""}>
            <span><b>${size} × ${size}</b><small>${note}</small></span></label>`,
        ).join("")}
      </fieldset>
      <fieldset class="groups">
        <legend>What to look for</legend>
        ${GROUPS.map(
          ({ group, label }) => `<label class="choice"><input type="checkbox" name="group" value="${group}" checked>
            <span>${kindGlyph(group)}${label}</span></label>`,
        ).join("")}
      </fieldset>
      <div class="build-status" aria-live="polite"></div>
    </form>
    <button class="sighting" type="button" data-build disabled><span class="label">Build the Card</span></button>`;
  root.appendChild(overlay);

  const $ = <T extends Element = HTMLElement>(selector: string) => overlay.querySelector<T>(selector)! as T;
  const form = $<HTMLFormElement>("form");
  const locate = $<HTMLButtonElement>(".locate");
  const placeLine = $(".place-line");
  const status = $(".build-status");
  const build = $<HTMLButtonElement>("[data-build]");
  const buildLabel = $("[data-build] .label");
  const closeButton = $(".close");

  let place: { lat: number; lng: number } | null = null;
  let building = false;

  const size = () => Number(new FormData(form).get("size")) as CardSize;
  const groups = () => new FormData(form).getAll("group") as CardGroup[];

  function refresh() {
    build.disabled = building || !place || groups().length === 0;
    buildLabel.textContent = building ? "Building…" : "Build the Card";
    for (const field of form.querySelectorAll<HTMLFieldSetElement>("fieldset")) field.disabled = building;
    closeButton.hidden = building || !game.hasCard();
    if (!groups().length && !building) showStatus('<p class="hint">Choose at least one thing to look for.</p>');
  }

  function showStatus(html: string) {
    status.innerHTML = html;
    // It sits below the choices, which can push it off a short screen.
    if (html) status.scrollIntoView?.({ block: "nearest" });
  }

  async function findMe() {
    locate.disabled = true;
    placeLine.textContent = "Finding where you are…";
    try {
      place = await options.locate();
      placeLine.innerHTML = `<b>Your location</b> · ${degrees(place.lat, "N", "S")}, ${degrees(place.lng, "E", "W")}`;
      showStatus("");
    } catch (error) {
      place = null;
      placeLine.textContent = "";
      showStatus(`<p class="problem">${esc(messageOf(error))}</p>`);
    } finally {
      locate.disabled = false;
      refresh();
    }
  }

  /** Building replaces the current Card, so that needs a yes first. */
  function confirmReplace() {
    const current = game.state();
    const marked = current.squares.filter((s) => s.mark).length;
    showStatus(`<div class="confirm">
        <h3>Replace ${current.place.name ? `your ${esc(current.place.name)} Card` : "your current Card"}?</h3>
        <p class="hint">${marked ? `Its ${marked === 1 ? "marked Square" : `${marked} marked Squares`} will be cleared.` : "Nothing's marked on it yet."}</p>
        <div class="actions"><button class="btn" type="button" data-replace>Replace it</button><button class="btn" type="button" data-keep>Keep my Card</button></div>
      </div>`);
    status.querySelector<HTMLElement>("[data-keep]")!.focus();
  }

  function showProgress(progress: BuildProgress) {
    if (progress.step === "species") {
      const months = `${monthName(progress.months[0])} to ${monthName(progress.months.at(-1)!)}`;
      showStatus(
        `<p class="hint">${progress.radiusKm > 10 ? `Not enough within 10 km, so looking within ${progress.radiusKm} km` : `Looking for what's been seen within ${progress.radiusKm} km`}
          from ${months}, in any year…</p>`,
      );
    } else {
      const percent = progress.total ? Math.floor((progress.done / progress.total) * 100) : 0;
      showStatus(`<p class="hint">Getting the photo check ready for ${progress.total} local species, so it works with no signal.</p>
        <div class="dl-bar" role="progressbar" aria-label="Photo check ready" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
        <p class="dl-label"><b>${progress.done}</b> of ${progress.total} species</p>`);
    }
  }

  async function buildCard() {
    if (!place) return;
    // Read the choices first: the form's controls are disabled while building, and FormData skips disabled ones.
    const request = { place, size: size(), groups: groups() };
    building = true;
    refresh();
    try {
      await game.buildCard(request, showProgress);
      building = false;
      close();
      options.onBuilt();
    } catch (error) {
      building = false;
      showStatus(
        error instanceof NotEnoughSpeciesError
          ? `<p class="problem">${esc(error.message)}</p>`
          : `<p class="problem">The Card couldn't be built. ${esc(messageOf(error))}</p>`,
      );
    } finally {
      refresh();
    }
  }

  locate.addEventListener("click", findMe);
  form.addEventListener("change", () => {
    showStatus("");
    refresh();
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  build.addEventListener("click", () => (game.hasCard() ? confirmReplace() : buildCard()));
  status.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (button?.dataset.replace !== undefined) buildCard();
    else if (button?.dataset.keep !== undefined) close();
  });
  closeButton.addEventListener("click", () => close());

  function open() {
    overlay.hidden = false;
    showStatus("");
    refresh();
    (place ? build : locate).focus();
  }

  function close() {
    if (building || !game.hasCard()) return;
    overlay.hidden = true;
  }

  return { open };
}
