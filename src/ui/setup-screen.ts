import type { DownloadProgress, ModelStore } from "../model";
import { messageOf } from "./text";

/** What the setup copy promises; the real total comes from the download itself. */
const ABOUT_MB = 300;

const ICON_DOWNLOAD =
  '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M13 3v13M7.5 10.5 13 16l5.5-5.5M4 18v4h18v-4"/></svg>';

const mb = (bytes: number) => Math.round(bytes / 1e6);

/** Says what went wrong in words a hiker can act on. */
function problem(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError") return `Your phone ran out of space for it. Free up about ${ABOUT_MB} MB, then try again.`;
  if (!navigator.onLine) return "You're offline. Connect to Wi-Fi, then try again.";
  if (name === "DownloadStalledError") return "The download stalled. Check your connection, then try again.";
  return "The connection dropped. Check your connection, then try again.";
}

/**
 * First launch: explains the one-time model download, runs it with a progress
 * bar, and offers a retry if it fails. `onReady` opens the game.
 */
export function mountSetupScreen(root: HTMLElement, models: ModelStore, onReady: () => void) {
  root.setAttribute("aria-label", "Set up Trail Bingo");
  root.innerHTML = `
    <header class="collar-top">
      <h1 class="quad-name">Trail Bingo</h1>
      <div class="quad-meta">First launch<br>Setup</div>
    </header>
    <div class="setup">
      <p class="lede">Before your first hike, Trail Bingo needs its photo check: an open model called BioCLIP
        that recognizes plants, fungi and animals right on your phone, so it works on the trail with no signal.</p>
      <dl class="legend">
        <div><dt>About ${ABOUT_MB} MB</dt><dd>A one-time download. After this, the photo check never needs the internet.</dd></div>
        <div><dt>Use Wi-Fi</dt><dd>It's a big download for mobile data. Keep this screen open until it's done.</dd></div>
      </dl>
      <div class="download" aria-live="polite">
        <div class="dl-bar" role="progressbar" aria-label="Download progress" aria-valuemin="0" aria-valuemax="100" hidden><i></i></div>
        <p class="dl-label"></p>
        <p class="dl-note"></p>
      </div>
    </div>
    <button class="sighting" type="button" data-go>${ICON_DOWNLOAD}<span class="label">Download the photo check</span></button>`;

  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)! as T;
  const bar = $(".dl-bar");
  const fill = $(".dl-bar i");
  const label = $(".dl-label");
  const note = $(".dl-note");
  const go = $<HTMLButtonElement>("[data-go]");
  const goLabel = $("[data-go] .label");
  let ready = false;
  let latest: DownloadProgress | null = null;

  function showProgress(progress: DownloadProgress) {
    latest = progress;
    const percent = progress.total ? Math.floor((progress.loaded / progress.total) * 100) : 0;
    bar.hidden = false;
    bar.setAttribute("aria-valuenow", String(percent));
    fill.style.width = `${percent}%`;
    label.innerHTML = `<b>${mb(progress.loaded)}</b> of ${mb(progress.total)} MB`;
  }

  async function download() {
    go.disabled = true;
    goLabel.textContent = "Downloading…";
    root.dataset.state = "downloading";
    note.textContent = "";
    if (!latest) label.textContent = "Starting the download…";
    // A sleeping screen can pause the download, so keep it awake while this runs.
    const wake = await navigator.wakeLock?.request("screen").catch(() => null);
    try {
      const { persisted } = await models.download(showProgress);
      ready = true;
      root.dataset.state = "done";
      label.innerHTML = "<b>Downloaded.</b> The photo check is on your phone.";
      note.textContent = persisted
        ? ""
        : "Your browser may clear it if your phone runs low on space. Installing Trail Bingo to your home screen helps keep it.";
      go.querySelector("svg")?.remove();
      goLabel.textContent = "Open your Card";
    } catch (error) {
      root.dataset.state = "failed";
      // A file that never started has no size yet, so the bar's total would be wrong until the next try.
      bar.hidden = true;
      label.innerHTML = "<b>The download stopped.</b>";
      note.textContent = `${problem(error)}${latest?.loaded ? " The part already downloaded is kept." : ""}`;
      note.title = messageOf(error);
      goLabel.textContent = "Try again";
    } finally {
      await wake?.release().catch(() => {});
      go.disabled = false;
      go.focus();
    }
  }

  go.addEventListener("click", () => (ready ? onReady() : download()));
}
