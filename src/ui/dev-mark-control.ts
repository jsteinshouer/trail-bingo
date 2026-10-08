import type { Mark } from "../game";

// TEMPORARY, developer only: stands in for the photo check until ticket 03
// replaces it with real Sightings. Delete this file and its one call site then.

export interface DevMarkControlOptions {
  /** False when the Square is already marked: only "Start over" is offered. */
  canMark: boolean;
  onMark(mark: Mark): void;
  onStartOver(): void;
}

export function devMarkControl({ canMark, onMark, onStartOver }: DevMarkControlOptions): HTMLElement {
  const box = document.createElement("div");
  box.className = "dev";
  box.innerHTML = `<p>Dev only · removed in ticket 03</p><div class="row">${
    canMark
      ? '<button type="button" data-mark="verified">Mark Verified</button><button type="button" data-mark="confirmed">Mark Confirmed</button>'
      : ""
  }<button type="button" data-start-over>Start over</button></div>`;
  box.querySelectorAll<HTMLButtonElement>("[data-mark]").forEach((b) =>
    b.addEventListener("click", () => onMark(b.dataset.mark as Mark)),
  );
  box.querySelector("[data-start-over]")!.addEventListener("click", onStartOver);
  return box;
}
