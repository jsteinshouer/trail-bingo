import type { CardState, Game, Mark, MarkedSquare, MarkOutcome } from "../game";
import { glyph, ICON_CAMERA, ICON_CLOSE, ICON_CONFIRMED, ICON_IMPRINT, ICON_VERIFIED, KIND_LABEL, kindOf } from "./icons";
import { mountSighting } from "./sighting";
import { esc, messageOf, secondLine } from "./text";

const MARK_LABEL: Record<Mark, string> = { verified: "Verified", confirmed: "Confirmed" };
const MARK_NOTE: Record<Mark, string> = {
  verified: "The photo check was sure.",
  confirmed: "You picked it from the top guesses.",
};

const monthName = (month: number) => new Date(2000, month - 1).toLocaleString("en", { month: "long" });

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

/** The on-trail Card screen: the sheet, its collars, Square detail, Sightings and celebrations. */
export function mountCardScreen(root: HTMLElement, game: Game, photoCheck: PhotoCheck) {
  let cells: HTMLButtonElement[] = [];
  /** Sighting photos (object URLs) by Square. Kept on the phone in ticket 09. */
  const photos = new Map<number, string>();
  let openIndex: number | null = null;
  let lastFocus: HTMLElement | null = null;

  root.innerHTML = `
    <header class="collar-top">
      <h1 class="quad-name" data-place></h1>
      <div class="quad-meta" data-meta></div>
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

  const sighting = mountSighting(root, game, {
    encodeImage: (image) => photoCheck.encodeImage(image),
    onMarked(index, outcome, photo) {
      photos.set(index, photo);
      const state = game.state();
      paint(state);
      restart(cells[index], "just");
      drawRoutes(state, new Set(outcome.newBingos.map(String)));
      celebrate(state, outcome);
    },
    onClose: () => take.focus(),
  });
  take.addEventListener("click", sighting.open);

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
    for (const url of photos.values()) URL.revokeObjectURL(url);
    photos.clear();
    const state = game.state();
    const { place, month, size } = state;
    const dLat = place.radiusKm / 111;
    const dLng = place.radiusKm / (111 * Math.cos((place.lat * Math.PI) / 180));

    $("[data-place]").textContent = place.name;
    $("[data-meta]").innerHTML = `${esc(place.region)} · ${monthName(month)}<br>Demo Card`;
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
      const photo = photos.get(i);
      if (photo && shot.getAttribute("src") !== photo) shot.src = photo;
      el.toggleAttribute("data-photo", Boolean(photo));
      const status = square.mark ? MARK_LABEL[square.mark] : "not found yet";
      if (square.kind === "wildcard") {
        el.querySelector(".sub")!.textContent = square.mark ? "filled" : "anything living";
        el.setAttribute("aria-label", `Wildcard, ${square.mark ? "filled" : "anything living"}, ${status}`);
      } else {
        el.querySelector(".sci")!.textContent = secondLine(square);
        el.setAttribute("aria-label", `${square.name}, ${status}`);
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

  function celebrate(state: CardState, outcome: MarkOutcome) {
    // The last mark always completes lines too; the bigger Blackout plate replaces the Bingo stamp.
    if (outcome.blackout) return celebrateBlackout(state);
    if (outcome.newBingos.length) celebrateBingo(state);
  }

  function celebrateBingo(state: CardState) {
    const n = state.bingoCount;
    $(".stamp .small").textContent =
      n === 1 ? `First Bingo on the ${state.place.name} Card` : `${n} Bingos on the ${state.place.name} Card`;
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
        <span class="text">Every Square on the ${esc(state.place.name)} Card is marked. ${plural(state.bingoCount, "Bingo")} along the way.</span>
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
  }

  function renderDetail() {
    const index = openIndex!;
    const square: MarkedSquare = game.state().squares[index];
    const name = square.kind === "wildcard" ? "Wildcard" : square.name;

    let meta: string;
    let body = "";
    if (square.kind === "wildcard") {
      meta = "Any living thing the photo check recognizes, on this Card or not.";
      if (!square.mark) body = '<p class="hint">Fill it by photographing anything living that isn\'t already marked on your Card.</p>';
    } else if (square.kind === "animal") {
      meta = "Any species in this group counts.";
    } else {
      meta = `<i>${esc(square.scientificName)}</i> · ${KIND_LABEL[kindOf(square)]}`;
    }
    if (square.mark) {
      const photo = photos.get(index);
      body =
        (photo ? `<div class="photo"><img src="${photo}" alt="Your Sighting of ${esc(name)}"></div>` : "") +
        `<div class="status ${square.mark}">${MARK_LABEL[square.mark]}<small>${MARK_NOTE[square.mark]}</small></div>`;
    }

    panel.innerHTML = `<div class="panel-head${square.kind === "wildcard" ? " wild" : ""}">${glyph(square)}
        <div><h2 id="detail-name">${esc(name)}</h2><p class="meta">${meta}</p></div>
        <button class="close" type="button" aria-label="Close">${ICON_CLOSE}</button></div>${body}`;
    panel.querySelector(".close")!.addEventListener("click", closeDetail);
  }

  $(".scrim").addEventListener("click", closeDetail);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
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
