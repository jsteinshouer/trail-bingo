import type { CardState, Game, Mark, MarkedSquare, MarkOutcome } from "../game";
import {
  glyph,
  ICON_CAMERA,
  ICON_CLOSE,
  ICON_CONFIRMED,
  ICON_EYE,
  ICON_GRID,
  ICON_IMPRINT,
  ICON_READY,
  ICON_VERIFIED,
  KIND_LABEL,
  kindOf,
} from "./icons";
import { mountSighting, type SightingRecorder } from "./sighting";
import { factCard, photoCredit, photoUrl, referencePhoto, releasePhotos } from "./fact-card";
import {
  esc,
  looksLike,
  messageOf,
  monthName,
  namedTaxon,
  placeTitle,
  saveProblem,
  secondLine,
  theCard,
  withArticle,
} from "./text";

const MARK_LABEL: Record<Mark, string> = { verified: "Verified", confirmed: "Confirmed" };
const MARK_NOTE: Record<Mark, string> = {
  verified: "The photo check was sure.",
  confirmed: "You picked it from the top guesses.",
};

/** Degrees and minutes, as printed in a quad's corners. */
function dm(value: number): string {
  const total = Math.round(Math.abs(value) * 60);
  return `${Math.floor(total / 60)}°${String(total % 60).padStart(2, "0")}′`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The photo check's image side, as the Card screen needs it. */
export interface PhotoCheck {
  /** Settles when the photo check is ready to take Sightings, or failed to load. */
  ready: Promise<unknown>;
  onProgress?: (message: string) => void;
  encodeImage(image: Blob): Promise<Float32Array>;
}

export interface CardScreenOptions {
  onNewCard(): void;
  /** Keeps a record of each Sighting for the hike log. */
  record?: SightingRecorder;
  /** How many Sightings the hike log holds, and a way to save it as a file. */
  hikeLog?: { count(): Promise<number>; export(): Promise<void> };
}

/** The on-trail Card screen: the sheet, its collars, Square detail, Sightings and celebrations. */
export function mountCardScreen(root: HTMLElement, game: Game, photoCheck: PhotoCheck, options: CardScreenOptions) {
  let cells: HTMLButtonElement[] = [];
  let openIndex: number | null = null;
  let lastFocus: HTMLElement | null = null;

  root.innerHTML = `
    <header class="collar-top">
      <h1 class="quad-name" data-place></h1>
      <div class="quad-meta" data-meta></div>
      <button class="menu-btn" type="button" aria-label="Card menu" aria-haspopup="menu" aria-expanded="false" data-menu>${ICON_GRID}</button>
      <div class="card-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-new-card>New Card</button>
        ${options.hikeLog ? '<button type="button" role="menuitem" data-export-log>Export hike log<small></small></button>' : ""}
        <p class="menu-note" aria-live="polite"></p>
      </div>
    </header>
    <div class="sheet-wrap">
      <div class="coords" aria-hidden="true"><span data-north></span><span data-size-tag></span><span data-east></span></div>
      <div class="sheet">
        <svg class="contours" aria-hidden="true"></svg>
        <div class="grid" role="group" aria-label="Squares"></div>
        <svg class="routes" aria-hidden="true"></svg>
        <div class="stamp" role="status" aria-live="polite"><span class="big">BINGO</span><span class="small"></span></div>
        <svg class="ticks" aria-hidden="true"></svg>
      </div>
      <div class="coords bottom" aria-hidden="true"><span data-south></span><span class="imprint" data-imprint></span><span data-west></span></div>
    </div>
    <footer class="collar-bottom">
      <div class="scale">
        <div class="scale-bar" aria-hidden="true"></div>
        <div class="scale-label"></div>
      </div>
      <div class="bingos"><output aria-live="polite">0</output><span data-bingo-word>Bingos</span></div>
    </footer>
    <p class="problem save-problem" role="alert" hidden></p>
    <button class="sighting" type="button" data-take disabled>${ICON_CAMERA}<span class="label">Loading the photo check…</span></button>
    <div class="detail" hidden>
      <button class="scrim" type="button" tabindex="-1" aria-label="Close"></button>
      <section class="panel" role="dialog" aria-modal="true" aria-labelledby="detail-name"></section>
    </div>`;

  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)! as T;
  const sheet = $(".sheet");
  const grid = $(".grid");
  const routes = $<SVGSVGElement>(".routes");
  const detail = $(".detail");
  const panel = $(".panel");
  const bingoCount = $("output");
  const take = $<HTMLButtonElement>("[data-take]");
  const saveNotice = $(".save-problem");

  const sighting = mountSighting(root, game, {
    record: options.record,
    encodeImage: (image) => photoCheck.encodeImage(image),
    onMarked(index, outcome) {
      // A Sighting that can't be kept on the phone says so; the Card still has it until the app closes.
      game.saved().then(
        () => (saveNotice.hidden = true),
        (error) => {
          saveNotice.textContent = `Your last Sighting couldn't be saved on this phone, so it will be lost if the app closes. ${saveProblem(error)}`;
          saveNotice.title = messageOf(error);
          saveNotice.hidden = false;
        },
      );
      const state = game.state();
      paint(state);
      restart(cells[index], "just");
      drawRoutes(state, new Set(outcome.newBingos.map(String)));
      // The fact card comes up once the photo has developed; the celebration waits until it's dismissed.
      pendingCelebration = { state, outcome };
      setTimeout(() => {
        if (openIndex === null) openDetail(index);
      }, 800);
    },
    onClose: () => take.focus(),
  });
  take.addEventListener("click", sighting.open);
  /* ── The Card menu ─────────────────────────────────────────────── */

  const menuButton = $<HTMLButtonElement>("[data-menu]");
  const menu = $(".card-menu");
  const menuNote = $(".menu-note");

  function openMenu() {
    menu.hidden = false;
    menuButton.setAttribute("aria-expanded", "true");
    menuNote.textContent = "";
    const count = root.querySelector("[data-export-log] small");
    options.hikeLog?.count().then(
      (n) => count && (count.textContent = n === 1 ? "1 Sighting" : `${n} Sightings`),
      () => {},
    );
    menu.querySelector<HTMLElement>("button")!.focus();
  }

  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  }

  menuButton.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
  $("[data-new-card]").addEventListener("click", () => {
    closeMenu();
    options.onNewCard();
  });
  root.querySelector("[data-export-log]")?.addEventListener("click", async () => {
    menuNote.textContent = "Getting the hike log ready…";
    try {
      await options.hikeLog!.export();
      closeMenu();
    } catch (error) {
      // Closing the share sheet without choosing an app isn't a problem.
      menuNote.textContent = error instanceof Error && error.name === "AbortError" ? "" : `The hike log couldn't be saved. ${messageOf(error)}`;
    }
  });
  addEventListener("click", (event) => {
    if (!menu.contains(event.target as Node) && !menuButton.contains(event.target as Node)) closeMenu();
  });

  // The band says what the photo check is doing until it's ready for Sightings.
  const takeLabel = take.querySelector(".label")!;
  photoCheck.onProgress = (message) => (takeLabel.textContent = message);
  photoCheck.ready.then(
    () => {
      takeLabel.textContent = "Take a Sighting";
      take.disabled = false;
    },
    (error) => {
      takeLabel.textContent = "The photo check couldn't load";
      take.title = messageOf(error);
    },
  );

  /** Rebuilds the screen for the active Card. */
  function render() {
    hideDetail();
    shownClues.clear();
    releasePhotos();
    // A new Card doesn't celebrate the old one.
    pendingCelebration = null;
    const state = game.state();
    const { place, month, size } = state;
    const dLat = place.radiusKm / 111;
    const dLng = place.radiusKm / (111 * Math.cos((place.lat * Math.PI) / 180));

    $("[data-place]").textContent = placeTitle(place);
    // A built Card needs no signal to play. Keeping it across restarts is ticket 09.
    $("[data-meta]").innerHTML =
      `${[place.region, monthName(month)].flatMap((part) => (part ? [esc(part)] : [])).join(" · ")}<br>` +
      `<span class="ready">${ICON_READY}Ready offline</span>`;
    $("[data-north]").textContent = dm(place.lat + dLat);
    $("[data-south]").textContent = dm(place.lat - dLat);
    $("[data-east]").textContent = dm(place.lng + dLng);
    $("[data-west]").textContent = dm(place.lng - dLng);
    $("[data-size-tag]").textContent = `${size} × ${size} Card`;
    $("[data-imprint]").innerHTML = `${ICON_IMPRINT} Trail Bingo · ${place.radiusKm} km`;

    grid.dataset.size = String(size);
    grid.innerHTML = "";
    cells = state.squares.map((square, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = square.kind === "wildcard" ? "sq wild" : "sq";
      b.innerHTML =
        `<span class="ph">${glyph(square)}<img class="shot" alt=""></span>` +
        (square.kind === "wildcard"
          ? '<span class="nm">Wildcard<span class="sub"></span></span>'
          : `<span class="nm">${esc(square.name)}</span><span class="sci"></span>`) +
        `<span class="stamp-v">${ICON_VERIFIED}</span><span class="stamp-c">${ICON_CONFIRMED}</span>`;
      b.addEventListener("click", () => openDetail(i));
      grid.appendChild(b);
      return b;
    });

    paint(state);
    drawLinework();
    drawRoutes(state, new Set());
  }

  function paint(state: CardState) {
    state.squares.forEach((square, i) => {
      const el = cells[i];
      if (square.mark) el.dataset.mark = square.mark;
      else delete el.dataset.mark;
      const shot = el.querySelector<HTMLImageElement>(".shot")!;
      const photo = square.photo && photoUrl(square.photo);
      if (photo && shot.getAttribute("src") !== photo) shot.src = photo;
      el.toggleAttribute("data-photo", Boolean(photo));
      const status = square.mark ? MARK_LABEL[square.mark] : "not found yet";
      if (square.kind === "wildcard") {
        const sub = square.mark ? (square.found?.name ?? "filled") : "anything living";
        el.querySelector(".sub")!.textContent = sub;
        el.setAttribute("aria-label", `Wildcard, ${sub}, ${status}`);
      } else {
        el.querySelector(".sci")!.textContent = secondLine(square);
        el.setAttribute("aria-label", `${square.name}, ${square.found ? `${secondLine(square)}, ` : ""}${status}`);
      }
    });

    const total = state.squares.length;
    const marked = state.squares.filter((s) => s.mark).length;
    $(".scale-bar").innerHTML = Array.from({ length: total }, (_, k) => `<i class="${k < marked ? "on" : ""}"></i>`).join("");
    $(".scale-label").innerHTML = `<b>${marked}</b> of ${total} Squares marked`;

    if (bingoCount.textContent !== String(state.bingoCount)) {
      bingoCount.textContent = String(state.bingoCount);
      restart(bingoCount, "bump");
    }
    $("[data-bingo-word]").textContent = state.bingoCount === 1 ? "Bingo" : "Bingos";
  }

  /* ── Celebrations ─────────────────────────────────────────────── */

  /** A mark's celebration, held back while its fact card is open. */
  let pendingCelebration: { state: CardState; outcome: MarkOutcome } | null = null;

  function celebratePending() {
    if (!pendingCelebration) return;
    const { state, outcome } = pendingCelebration;
    pendingCelebration = null;
    celebrate(state, outcome);
  }

  function celebrate(state: CardState, outcome: MarkOutcome) {
    // The last mark always completes lines too; the bigger Blackout plate replaces the Bingo stamp.
    if (outcome.blackout) return celebrateBlackout(state);
    if (outcome.newBingos.length) celebrateBingo(state);
  }

  function celebrateBingo(state: CardState) {
    const n = state.bingoCount;
    $(".stamp .small").textContent =
      n === 1 ? `First Bingo on ${theCard(state.place)}` : `${n} Bingos on ${theCard(state.place)}`;
    restart($(".stamp"), "show");
    restart(sheet, "shake");
    setTimeout(() => navigator.vibrate?.([40, 60, 40]), 500);
  }

  function celebrateBlackout(state: CardState) {
    const now = new Date();
    const plate = document.createElement("button");
    plate.type = "button";
    plate.className = "blackout";
    plate.setAttribute("aria-label", "Blackout. Tap to keep exploring");
    plate.innerHTML = `<span class="plate">
        <span class="big">BLACKOUT</span>
        <span class="rev">Photorevised · ${monthName(now.getMonth() + 1)} ${now.getFullYear()}</span>
        <span class="text">Every Square on ${esc(theCard(state.place))} is marked. ${plural(state.bingoCount, "Bingo")} along the way.</span>
        <span class="tap">Tap to keep exploring</span>
      </span>`;
    // Stays until tapped, so everyone can look at the finished Card together.
    plate.addEventListener("click", () => {
      plate.remove();
      cells[0]?.focus();
    });
    setTimeout(() => {
      root.appendChild(plate);
      plate.focus();
    }, 700);
    navigator.vibrate?.([60, 80, 60, 80, 160]);
  }

  /* ── Square detail ────────────────────────────────────────────── */

  function openDetail(index: number) {
    openIndex = index;
    lastFocus = cells[index];
    renderDetail();
    detail.hidden = false;
    // A history entry lets the back gesture close the panel instead of leaving the app.
    history.pushState({ detail: true }, "");
    panel.querySelector<HTMLElement>(".close")!.focus();
  }

  function closeDetail() {
    if (openIndex === null) return;
    if (history.state?.detail) history.back();
    else hideDetail();
  }

  function hideDetail() {
    if (openIndex === null) return;
    detail.hidden = true;
    openIndex = null;
    if (lastFocus?.isConnected) lastFocus.focus();
    celebratePending();
  }

  function renderDetail() {
    const index = openIndex!;
    const square: MarkedSquare = game.state().squares[index];
    const name = square.kind === "wildcard" ? "Wildcard" : square.name;

    let meta: string;
    let body = "";
    if (square.kind === "wildcard") {
      meta = square.found
        ? `Filled by ${namedTaxon(square.found)}`
        : "Any living thing the photo check recognizes, on this Card or not.";
      if (!square.mark) body = '<p class="hint">Fill it by photographing anything living that isn\'t already marked on your Card.</p>';
    } else if (square.kind === "animal") {
      meta = square.found ? looksLike(square.found) : "Any species in this group counts.";
    } else {
      meta = `<i>${esc(square.scientificName)}</i> · ${KIND_LABEL[kindOf(square)]}`;
    }
    if (square.mark) {
      // A marked Square is its fact card: the player's photo, how it was marked, then what it was.
      const photo = square.photo && photoUrl(square.photo);
      const found = square.kind === "species" ? square : square.found;
      const status = `<div class="status ${square.mark}">${MARK_LABEL[square.mark]}<small>${MARK_NOTE[square.mark]}</small></div>`;
      body = found
        ? factCard(found, game.factFor(found), { sightingPhoto: photo, status })
        : (photo ? `<div class="photo"><img src="${photo}" alt="Your Sighting of ${esc(name)}"></div>` : "") + status;
    } else if (square.kind !== "wildcard") {
      body = clueHtml(index);
    }

    panel.innerHTML = `<div class="panel-head${square.kind === "wildcard" ? " wild" : ""}">${glyph(square)}
        <div><h2 id="detail-name">${esc(name)}</h2><p class="meta">${meta}</p></div>
        <button class="close" type="button" aria-label="Close">${ICON_CLOSE}</button></div>${body}`;
    panel.querySelector(".close")!.addEventListener("click", closeDetail);
    const clueMap = panel.querySelector<SVGSVGElement>(".clue .contours");
    if (clueMap) contourField(clueMap, clueMap.clientWidth, clueMap.clientHeight, [{ x: 0.72, y: 0.3, rings: 14, ph: 1.4 }]);
    panel.querySelector("[data-clue]")?.addEventListener("click", () => {
      shownClues.add(index);
      renderDetail();
      panel.querySelector<HTMLElement>(".close")!.focus();
    });
  }

  /** Squares whose clue the player has revealed on this Card. */
  const shownClues = new Set<number>();

  /** An unmarked Square's clue: hidden behind a button until asked for, since spotting it unaided is the game. */
  function clueHtml(index: number): string {
    const clue = game.clue(index);
    const photo = clue?.fact?.photo;
    if (!clue || !photo) return '<p class="hint">There\'s no clue photo for this one.</p>';
    const square = game.state().squares[index];
    if (!shownClues.has(index)) {
      return `<div class="clue"><svg class="contours" aria-hidden="true"></svg>
          <button class="clue-btn" type="button" data-clue>${ICON_EYE}Show a clue</button></div>
        <p class="hint">Stuck? A clue shows a photo of what to look for.</p>`;
    }
    const example = square.kind === "animal" ? `For example, ${withArticle(clue.taxon.name)}. ` : "";
    return `<div class="clue">${referencePhoto(clue.taxon, photo.image)}</div>
      <p class="credit">${esc(example)}${photoCredit(photo.credit)}</p>`;
  }

  $(".scrim").addEventListener("click", closeDetail);
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenu();
    closeDetail();
  });
  addEventListener("popstate", hideDetail);

  /* ── Map linework ─────────────────────────────────────────────── */

  /** Draws the trail symbol through every Bingo; `fresh` lines animate in. */
  function drawRoutes(state: CardState, fresh: Set<string>) {
    const box = sheet.getBoundingClientRect();
    routes.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    const center = (i: number) => {
      const r = cells[i].getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height * 0.42];
    };
    routes.innerHTML = state.bingos
      .map((line) => {
        const a = center(line[0]);
        const b = center(line[line.length - 1]);
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const ext = 14 / Math.hypot(dx, dy);
        const d = `M${(a[0] - dx * ext).toFixed(1)} ${(a[1] - dy * ext).toFixed(1)}L${(b[0] + dx * ext).toFixed(1)} ${(b[1] + dy * ext).toFixed(1)}`;
        return `<g class="${fresh.has(String(line)) ? "new" : ""}"><path class="casing" d="${d}"/><path class="trail" d="${d}"/></g>`;
      })
      .join("");
  }

  function drawLinework() {
    const w = sheet.clientWidth;
    const h = sheet.clientHeight;
    contourField($<SVGSVGElement>(".contours"), w, h, [
      { x: 0.78, y: 0.18, rings: 22, ph: 0.6 },
      { x: 0.12, y: 0.86, rings: 13, ph: 2.1, step: 0.03 },
    ]);

    // Graticule ticks outside the neatline at every Square boundary.
    const n = game.state().size;
    const ticks = $<SVGSVGElement>(".ticks");
    const tw = w + 14;
    const th = h + 14;
    ticks.setAttribute("viewBox", `0 0 ${tw} ${th}`);
    let d = "";
    for (let k = 1; k < n; k++) {
      const x = 7 + (w * k) / n;
      const y = 7 + (h * k) / n;
      d += `M${x} 0V6M${x} ${th - 6}V${th}M0 ${y}H6M${tw - 6} ${y}H${tw}`;
    }
    ticks.innerHTML = `<path d="${d}" stroke="#1b1b1a" stroke-width="1.2"/>`;
  }

  // Redraw map linework whenever the sheet changes size (font load, rotation).
  new ResizeObserver(() => {
    if (!cells.length) return;
    drawLinework();
    drawRoutes(game.state(), new Set());
  }).observe(sheet);

  return { render };
}

/** Restarts a CSS animation by toggling its class. */
function restart(el: Element, className: string) {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

interface Hill {
  x: number;
  y: number;
  rings: number;
  ph: number;
  step?: number;
}

/** Contour field: concentric wobbly rings per hill, every fifth one an index contour. */
function contourField(svg: SVGSVGElement, w: number, h: number, hills: Hill[]) {
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const m = Math.max(w, h);
  let out = "";
  for (const hill of hills) {
    const cx = hill.x * w;
    const cy = hill.y * h;
    const step = m * (hill.step ?? 0.034);
    for (let k = 1; k <= hill.rings; k++) {
      const r0 = k * step;
      const pts: string[] = [];
      for (let t = 0; t <= 96; t++) {
        const a = (t / 96) * Math.PI * 2;
        const r =
          r0 *
          (1 +
            0.13 * Math.sin(3 * a + hill.ph + k * 0.09) +
            0.06 * Math.sin(5 * a + hill.ph * 2 - k * 0.05) +
            0.03 * Math.sin(9 * a + k * 0.3));
        pts.push((t ? "L" : "M") + (cx + Math.cos(a) * r * 1.15).toFixed(1) + " " + (cy + Math.sin(a) * r * 0.88).toFixed(1));
      }
      const index = k % 5 === 0;
      out += `<path d="${pts.join("")}Z" fill="none" stroke="#9c5a26" stroke-opacity="${index ? 0.55 : 0.36}" stroke-width="${index ? 1.3 : 0.7}"/>`;
    }
  }
  svg.innerHTML = out;
}
