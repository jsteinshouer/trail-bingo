import type { BackendChoice, CheckResult, LoadStats, Optimization, Precision, Request, Response } from "./protocol";

interface Label { scientific: string; common: string }
interface Fixture { file: string; taxon: string }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const precision = $<HTMLSelectElement>("precision");
const backend = $<HTMLSelectElement>("backend");
const optimization = $<HTMLSelectElement>("optimization");
const loadButton = $<HTMLButtonElement>("load");
const status = $<HTMLParagraphElement>("status");
const statsList = $<HTMLDListElement>("stats");
const camera = $<HTMLInputElement>("camera");
const cameraLabel = $<HTMLLabelElement>("camera-label");
const fixturesButton = $<HTMLButtonElement>("fixtures");
const results = $<HTMLOListElement>("results");
const report = $<HTMLPreElement>("report");
const copyButton = $<HTMLButtonElement>("copy");

const base = import.meta.env.BASE_URL;
const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const pending = new Map<number, (result: CheckResult) => void>();
let nextId = 0;
let labels: Label[] = [];
let loadStats: LoadStats | undefined;
const checks: string[] = [];

const ms = (value: number) => `${Math.round(value)} ms`;

function setStatus(message: string, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setReady(ready: boolean) {
  camera.disabled = !ready;
  fixturesButton.disabled = !ready;
  cameraLabel.classList.toggle("disabled", !ready);
}

function showStats(stats: LoadStats) {
  const rows: [string, string][] = [
    ["Backend", stats.backend + (stats.fallbackReason ? ` (fell back: ${stats.fallbackReason})` : "")],
    ["GPU", stats.gpu ?? "—"],
    ["shader-f16", stats.shaderF16 === undefined ? "—" : String(stats.shaderF16)],
    ["WASM threads", `${stats.wasmThreads} (cross-origin isolated: ${stats.crossOriginIsolated})`],
    ...stats.files.map((f): [string, string] => [
      f.file,
      `${f.megabytes.toFixed(0)} MB ${f.fromCache ? "from cache" : "downloaded"} in ${ms(f.ms)}` +
        (f.cacheError ? ` (not cached: ${f.cacheError})` : ""),
    ]),
    ["Create sessions", ms(stats.sessionMs)],
    [`Encode ${labels.length} labels`, ms(stats.labelEncodeMs)],
    ["Total load", ms(stats.totalMs)],
  ];
  statsList.replaceChildren(...rows.flatMap(([term, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    return [dt, dd];
  }));
}

function updateReport() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lines = [
    "BioCLIP spike report",
    `When: ${new Date().toISOString()}`,
    `Device: ${navigator.userAgent}`,
    `Cores: ${navigator.hardwareConcurrency}, memory: ${nav.deviceMemory ?? "?"} GB`,
    `Precision: ${precision.value}, backend choice: ${backend.value}, graph optimization: ${optimization.value}`,
  ];
  if (loadStats) {
    lines.push("", "Load:");
    for (let i = 0; i < statsList.children.length; i += 2) {
      lines.push(`  ${statsList.children[i].textContent}: ${statsList.children[i + 1].textContent}`);
    }
  }
  if (checks.length) lines.push("", "Checks:", ...checks.map((c) => `  ${c}`));
  report.textContent = lines.join("\n");
}

function check(image: Blob): Promise<CheckResult> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({ type: "check", id, image } satisfies Request);
  });
}

function showResult(name: string, result: CheckResult, expected?: string) {
  const [best, ...rest] = result.ranked;
  const top = labels[best.index];
  const item = document.createElement("li");

  const heading = document.createElement("div");
  const verdict = expected === undefined ? "" : top.scientific === expected ? "✓ " : "✗ ";
  heading.className = expected === undefined ? "" : verdict === "✓ " ? "pass" : "fail";
  heading.textContent = `${verdict}${name}: ${top.common} (cosine ${best.cosine.toFixed(3)}, p ${best.probability.toFixed(2)})`;

  const guesses = document.createElement("div");
  guesses.className = "guesses";
  guesses.textContent = `Next: ${rest.slice(0, 2).map((r) => `${labels[r.index].common} ${r.cosine.toFixed(3)}`).join(", ")} · preprocess ${ms(result.preprocessMs)}, model ${ms(result.inferenceMs)}`;

  item.append(heading, guesses);
  results.prepend(item);
  checks.push(`${verdict}${name} → ${top.scientific} cos ${best.cosine.toFixed(3)} p ${best.probability.toFixed(2)}; preprocess ${ms(result.preprocessMs)}, model ${ms(result.inferenceMs)}`);
  updateReport();
}

worker.onmessage = (event: MessageEvent<Response>) => {
  const message = event.data;
  switch (message.type) {
    case "progress":
      setStatus(message.message);
      break;
    case "loaded":
      loadStats = message.stats;
      showStats(message.stats);
      setStatus("Ready. Take a photo or run the test photos.");
      setReady(true);
      loadButton.disabled = false;
      updateReport();
      break;
    case "checked":
      pending.get(message.result.id)?.(message.result);
      pending.delete(message.result.id);
      break;
    case "error":
      setStatus(`Error: ${message.message}`, true);
      loadButton.disabled = false;
      checks.push(`Error: ${message.message}`);
      updateReport();
      if (message.id !== undefined) pending.delete(message.id);
      break;
  }
};

worker.onerror = (event) => {
  setStatus(`Worker crashed: ${event.message || "unknown error"} (the tab may be out of memory)`, true);
  loadButton.disabled = false;
};

loadButton.addEventListener("click", async () => {
  loadButton.disabled = true;
  setReady(false);
  setStatus("Loading…");
  labels = await (await fetch(`${base}models/labels.json`)).json();
  worker.postMessage({
    type: "load",
    precision: precision.value as Precision,
    backend: backend.value as BackendChoice,
    optimization: optimization.value as Optimization,
  } satisfies Request);
});

camera.addEventListener("change", async () => {
  const file = camera.files?.[0];
  if (!file) return;
  setStatus("Checking photo…");
  showResult("Your photo", await check(file));
  setStatus("Ready.");
  camera.value = "";
});

fixturesButton.addEventListener("click", async () => {
  fixturesButton.disabled = true;
  const fixtures: Fixture[] = await (await fetch(`${base}fixtures/CREDITS.json`)).json();
  for (const fixture of fixtures) {
    setStatus(`Checking ${fixture.file}…`);
    const image = await (await fetch(`${base}fixtures/${fixture.file}`)).blob();
    showResult(fixture.file, await check(image), fixture.taxon);
  }
  setStatus("Ready.");
  fixturesButton.disabled = false;
});

copyButton.addEventListener("click", async () => {
  updateReport();
  try {
    await navigator.clipboard.writeText(report.textContent ?? "");
    copyButton.textContent = "Copied";
  } catch {
    copyButton.textContent = "Copy failed: select the text below";
  }
  setTimeout(() => (copyButton.textContent = "Copy report"), 2000);
});

updateReport();
