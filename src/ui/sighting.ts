import type { Game, MarkOutcome, SightingOutcome, Taxon } from "../game";
import { glyph, ICON_CAMERA, ICON_CLOSE } from "./icons";
import { factCard } from "./fact-card";
import { esc, looksLike, messageOf, namedTaxon, secondLine, taxonName } from "./text";

/** Longest side of a stored Sighting photo: plenty for a Square and the detail panel, small to keep. */
const PHOTO_SIDE = 768;

export interface SightingOptions {
  /** Turns a Sighting photo into its vector with the photo check's image encoder. */
  encodeImage(image: Blob): Promise<Float32Array>;
  /** A Sighting marked a Square; the Square now holds its photo. */
  onMarked(index: number, outcome: MarkOutcome): void;
  /** Called when the overlay closes, so focus can go back to where it came from. */
  onClose(): void;
}

/**
 * Taking a Sighting: an in-page live camera with a square preview showing
 * exactly what the photo check sees, then the photo check's answer. Android's
 * camera app is avoided because Chrome discarded the page behind it in the spike.
 */
export function mountSighting(root: HTMLElement, game: Game, options: SightingOptions) {
  const overlay = document.createElement("section");
  overlay.className = "camera";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "camera-title");
  overlay.innerHTML = `
    <header class="camera-head">
      <h2 id="camera-title">Take a Sighting</h2>
      <button class="close" type="button" aria-label="Close">${ICON_CLOSE}</button>
    </header>
    <div class="finder">
      <video muted playsinline aria-hidden="true"></video>
      <img alt="" hidden>
      <span class="checking" hidden>Checking your Sighting…</span>
    </div>
    <div class="camera-body" aria-live="polite"></div>
    <button class="sighting shutter" type="button">${ICON_CAMERA}Take the photo</button>`;
  root.appendChild(overlay);

  const $ = <T extends Element = HTMLElement>(selector: string) => overlay.querySelector<T>(selector)! as T;
  const video = $<HTMLVideoElement>("video");
  const still = $<HTMLImageElement>(".finder img");
  const checking = $(".checking");
  const body = $(".camera-body");
  const shutter = $<HTMLButtonElement>(".shutter");

  let stream: MediaStream | null = null;
  /** The current Sighting's photo, and its preview while the photo check looks at it. */
  let photo: Blob | null = null;
  let preview: string | null = null;
  let open = false;
  /** The species each offered guess looks like, by Square, so a pick records it. */
  let guessTaxa = new Map<number, Taxon>();

  function show(html: string) {
    body.innerHTML = html;
    // Without scrolling, so the answer stays in view above any fact card.
    body.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }

  async function startCamera() {
    discardPhoto();
    guessTaxa = new Map();
    still.hidden = true;
    checking.hidden = true;
    shutter.hidden = false;
    shutter.disabled = true;
    show('<p class="hint">Fill the frame with what you spotted.</p>');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch (error) {
      return showProblem("The camera didn't open", cameraProblem(error));
    }
    if (!open) return stopCamera();
    video.srcObject = stream;
    await video.play().catch(() => {});
    shutter.disabled = false;
    shutter.focus();
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function discardPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    preview = null;
    photo = null;
  }

  /** The central square of the frame: the same square the preview shows and the photo check crops. */
  async function takePhoto(): Promise<Blob> {
    const side = Math.min(video.videoWidth, video.videoHeight);
    const out = Math.min(side, PHOTO_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = out;
    canvas
      .getContext("2d")!
      .drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("The photo couldn't be saved");
    return blob;
  }

  async function shoot() {
    if (!video.videoWidth) return;
    shutter.disabled = true;
    let taken: Blob;
    try {
      taken = await takePhoto();
    } catch (error) {
      return showError(error);
    }
    stopCamera();
    photo = taken;
    preview = URL.createObjectURL(taken);
    still.src = preview;
    still.hidden = false;
    checking.hidden = false;
    shutter.hidden = true;
    show("");
    try {
      // A sure match marks its Square with the photo.
      const outcome = await game.sighting(await options.encodeImage(taken), taken);
      if (open) showOutcome(outcome);
    } catch (error) {
      if (open) showError(error);
    } finally {
      checking.hidden = true;
    }
  }

  function showOutcome(outcome: SightingOutcome) {
    const squares = game.state().squares;
    const nameOf = (index: number) => {
      const square = squares[index];
      return square.kind === "wildcard" ? "Wildcard" : square.name;
    };
    const again = '<button class="btn" type="button" data-retry>Take another</button>';
    const done = '<button class="btn" type="button" data-close>Back to the Card</button>';

    switch (outcome.kind) {
      case "verified":
        return markWith(outcome.index, outcome.mark);
      case "already-marked":
        return show(`<h3>${esc(nameOf(outcome.index))}, again</h3>
          <p class="hint">You've already marked this Square, so your Card stays as it is.</p>
          ${factCard(outcome.taxon, game.factFor(outcome.taxon))}
          <div class="actions">${done}${again}</div>`);
      case "not-on-card": {
        const filledBy = outcome.wildcardFilledBy;
        const wildcardNote = filledBy
          ? ` Your Wildcard is already filled with ${taxonName(filledBy)}, so your Card stays as it is.`
          : "";
        return show(`<h3>Not on your Card</h3>
          <p class="hint">This looks like ${namedTaxon(outcome.taxon)}.${wildcardNote}</p>
          ${factCard(outcome.taxon, game.factFor(outcome.taxon))}
          <div class="actions">${done}${again}</div>`);
      }
      case "unsure":
        return show(`<h3>Which one is it?</h3>
          <p class="hint">The photo check isn't sure. If it's one of these, pick it.</p>
          <ul class="guesses">${outcome.guesses
            .map(({ index, taxon }) => {
              const square = squares[index];
              if (square.kind === "wildcard") return "";
              guessTaxa.set(index, taxon);
              // A broad animal guess says which animal it looks like.
              const second = square.kind === "animal" ? looksLike(taxon) : esc(secondLine(square));
              return `<li><button class="guess" type="button" data-pick="${index}">
                ${glyph(square)}<span class="name">${esc(square.name)}</span>
                <span class="second">${second}</span></button></li>`;
            })
            .join("")}</ul>
          <div class="actions"><button class="btn" type="button" data-close>None of these</button>${again}</div>`);
    }
  }

  function showProblem(title: string, message: string) {
    shutter.hidden = true;
    show(`<h3>${esc(title)}</h3><p class="hint">${esc(message)}</p>
      <div class="actions"><button class="btn" type="button" data-retry>Try again</button><button class="btn" type="button" data-close>Close</button></div>`);
  }

  const showError = (error: unknown) => showProblem("The photo check didn't work", messageOf(error));

  /** Goes back to the Card, where the marked Square now holds the photo. */
  function markWith(index: number, outcome: MarkOutcome) {
    close();
    options.onMarked(index, outcome);
  }

  body.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.pick !== undefined) {
      const index = Number(button.dataset.pick);
      markWith(index, game.mark(index, "confirmed", { found: guessTaxa.get(index), photo: photo ?? undefined }));
    } else if ("retry" in button.dataset) {
      startCamera();
    } else if ("close" in button.dataset) {
      close();
    }
  });
  shutter.addEventListener("click", shoot);
  $(".close").addEventListener("click", () => close());

  function openCamera() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    // A history entry lets the back gesture close the camera instead of leaving the app.
    history.pushState({ sighting: true }, "");
    startCamera();
  }

  /** Closes the camera; `fromHistory` when the back gesture already popped our entry. */
  function close(fromHistory = false) {
    if (!open) return;
    open = false;
    stopCamera();
    discardPhoto();
    overlay.hidden = true;
    if (!fromHistory && history.state?.sighting) history.back();
    options.onClose();
  }

  addEventListener("popstate", () => close(true));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return { open: openCamera };
}

function cameraProblem(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "Trail Bingo needs the camera to take a Sighting. Allow it in Chrome's site settings, then try again.";
  if (name === "NotFoundError") return "This device doesn't seem to have a camera.";
  return messageOf(error);
}
