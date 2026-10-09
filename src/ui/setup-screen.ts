import type { DeviceCheck } from "../device";
import type { EncoderInfo } from "../encoder";
import { DownloadStalledError, type DownloadProgress, type ModelStore } from "../model";
import { ICON_DOWNLOAD } from "./icons";
import { esc, messageOf } from "./text";

/** What the setup copy promises; the real total comes from the download itself. */
const ABOUT_MB = 300;

const mb = (bytes: number) => Math.round(bytes / 1e6);

/** Says what went wrong in words a hiker can act on. */
function problem(error: unknown): string {
  if (error instanceof Error && error.name === "QuotaExceededError") return `Your phone ran out of space for it. Free up about ${ABOUT_MB} MB, then try again.`;
  if (!navigator.onLine) return "You're offline. Connect to Wi-Fi, then try again.";
  if (error instanceof DownloadStalledError) return "The download stalled. Check your connection, then try again.";
  return "The connection dropped. Check your connection, then try again.";
}

export interface SetupOptions {
  /** Whether this phone can run the game, checked before anything is downloaded. */
  checkDevice(): Promise<DeviceCheck>;
  /** Starts the photo check from the stored model and runs it once. */
  warmUp(): Promise<EncoderInfo>;
  /** Opens the game. */
  onReady(): void;
}

/**
 * First launch: checks the phone can run the game, explains the one-time
 * model download, runs it with a progress bar, offers a retry if it fails,
 * then warms up the photo check and says how fast it is here.
 */
export function mountSetupScreen(root: HTMLElement, models: ModelStore, options: SetupOptions) {
  root.setAttribute("aria-label", "Set up Trail Bingo");
  root.innerHTML = `
    <header class="collar-top">
      <h1 class="quad-name">Trail Bingo</h1>
      <div class="quad-meta">First launch<br>Setup</div>
    </header>
    <div class="setup">
      <p class="lede">Before your first hike, Trail Bingo needs its photo check. It recognizes plants, fungi
        and animals right on your phone, so it works on the trail with no signal.</p>
      <dl class="legend">
        <div><dt>About ${ABOUT_MB} MB</dt><dd>A one-time download. After this, the photo check never needs the internet.</dd></div>
        <div><dt>Use Wi-Fi</dt><dd>It's a big download for mobile data. Keep this screen open until it's done.</dd></div>
      </dl>
      <div class="device" aria-live="polite"><p class="hint">Checking this phone…</p></div>
      <div class="download" aria-live="polite">
        <div class="dl-bar" role="progressbar" aria-label="Download progress" aria-valuemin="0" aria-valuemax="100" hidden><i></i></div>
        <p class="dl-label"></p>
        <p class="dl-note"></p>
      </div>
    </div>
    <button class="sighting" type="button" data-go disabled>${ICON_DOWNLOAD}<span class="label">Download the photo check</span></button>`;

  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)! as T;
  const bar = $(".dl-bar");
  const fill = $(".dl-bar i");
  const label = $(".dl-label");
  const note = $(".dl-note");
  const go = $<HTMLButtonElement>("[data-go]");
  const goLabel = $("[data-go] .label");
  const device = $(".device");
  let ready = false;

  // Nothing is downloaded until the phone passes; warnings don't stop anyone.
  options.checkDevice().then(
    ({ blockers, warnings }) => {
      const list = (problems: DeviceCheck["blockers"], className: string) =>
        problems.map((p) => `<p class="${className}">${esc(p.message)}</p>`).join("");
      device.innerHTML = blockers.length
        ? `<h2>This phone can't run Trail Bingo</h2>${list(blockers, "problem")}`
        : list(warnings, "hint");
      if (blockers.length) goLabel.textContent = "Can't download on this phone";
      go.disabled = blockers.length > 0;
    },
    // A check that can't run shouldn't stand in the way; the download reports real trouble.
    () => {
      device.innerHTML = "";
      go.disabled = false;
    },
  );
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
      go.querySelector("svg")?.remove();
      const keep = persisted
        ? ""
        : " Your browser may clear it if your phone runs low on space. Installing Trail Bingo to your home screen helps keep it.";
      label.innerHTML = "<b>Downloaded.</b> Getting the photo check ready…";
      goLabel.textContent = "Starting the photo check…";
      note.textContent = keep.trim();
      label.innerHTML = await warmUp();
      goLabel.textContent = "Open your Card";
    } catch (error) {
      root.dataset.state = "failed";
      // A file that never started has no size yet, so the bar's total would be wrong until the next try.
      bar.hidden = true;
      label.innerHTML = "<b>The download stopped.</b>";
      note.textContent = `${problem(error)}${latest?.stored ? " The files that finished are kept." : ""}`;
      note.title = messageOf(error);
      goLabel.textContent = "Try again";
    } finally {
      await wake?.release().catch(() => {});
      go.disabled = false;
      go.focus();
    }
  }

  /** Runs the photo check once, so the player knows it works here and how fast it is. */
  async function warmUp(): Promise<string> {
    try {
      const { backend } = await options.warmUp();
      return backend === "webgpu"
        ? "<b>Ready.</b> The photo check is fast on this phone."
        : "<b>Ready.</b> The photo check works here, but slower: each check takes a few seconds, and building a Card can take several minutes.";
    } catch (error) {
      return `<b>Downloaded,</b> but the photo check couldn't start: ${esc(messageOf(error))}`;
    }
  }

  go.addEventListener("click", () => (ready ? options.onReady() : download()));
}
