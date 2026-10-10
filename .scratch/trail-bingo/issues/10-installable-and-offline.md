# 10 — Installable and offline

**What to build:** The player installs Trail Bingo to their home screen and plays a whole game with no signal. A web app manifest and a service worker that caches the app shell make the installed app open offline; together with the stored model, Card data, facts and progress, the full play loop works in airplane mode. Before the first-launch model download, a quick device check makes sure the phone can run the game at all, so nobody spends ~300 MB of data to find out it can't.

**Blocked by:** 04 — First-launch model download; 05 — Build a Card from my location; 08 — Fact cards; 09 — Progress survives restarts

**Status:** ready-for-agent

- [x] App has a web app manifest and icon and can be installed on Android Chrome
- [x] Service worker caches the app shell; new app versions update cleanly without re-downloading the model
- [x] With a Card built, in airplane mode: the installed app opens, Sightings are checked, Squares marked, fact cards shown, and progress saved
- [x] Building a Card while offline shows a clear "needs signal" message
- [x] Before the model download, the setup screen runs a device check: hard requirements block the download with a plain explanation; soft ones warn and let the player continue (tested with fake browser features)
- [x] After the download, a warm-up loads the model and encodes one label, and the setup screen says whether the photo check runs fast (WebGPU) or slower (WebAssembly); the Card builder warns that building may take several minutes on a slower phone

## Device check

Hard requirements (block the download):

| Check | Why | Detect |
|---|---|---|
| Secure context (HTTPS) | Camera, Cache API and WebGPU need it | `isSecureContext` |
| Free browser storage of about 450 MB or more | Model ~300 MB, plus 25–40 MB of facts and photos per Card; incognito and nearly full phones fail here ("Quota exceeded") | `navigator.storage.estimate()`: quota minus usage |
| Cache API and module Web Workers | The model is stored in the Cache API; the photo check runs in a worker | `"caches" in self`; the worker starts |
| WebAssembly with SIMD | ONNX Runtime's fallback build needs SIMD | `WebAssembly.validate()` on a tiny SIMD module |
| A camera API | No camera, no Sightings | `navigator.mediaDevices?.getUserMedia` (permission is asked later, not here) |

Soft requirements (warn, continue):

| Check | What it means | Detect |
|---|---|---|
| A WebGPU adapter | Without it the photo check is slower: about 2 s per photo, and about 5 minutes to build a 500-species Card on the dev machine | `navigator.gpu?.requestAdapter()` |
| Device memory of 4 GB or more | The fp16 weights are expanded to fp32 on load (about 600 MB of model in the worker), so low-memory phones may lose the tab | `navigator.deviceMemory` (Chrome only, coarse) |
| Chrome on Android | The only tested target; iOS Safari is out of scope | User agent, warning only |
| Cross-origin isolation | Without it, WebAssembly runs single-threaded | `crossOriginIsolated` |

**Suggested minimums:** a recent Chrome (or another Chromium browser) over HTTPS, about 450 MB of free browser storage, and a camera. **Recommended:** Android with WebGPU and 4 GB+ of RAM, which is what the spike measured on the target phone (about 6 s to load the model, about 1.3 s per photo check).

Two thresholds are estimates to tighten in ticket 11's hike test: the 4 GB memory line (the photo check's peak memory hasn't been measured on the phone) and the slower phone's Card build time (only measured on the dev machine).

Keep the check a pure function that takes the browser features as input, so it can be tested with fakes like the other adapters.

## Comments

**Implemented on branch `10-installable-and-offline`.**

- **Installable:** `public/manifest.webmanifest` (standalone, portrait, paper colours) and icons: a 3×3 Card in paper on photorevision purple with the legend's plant symbol in the centre Square, chosen from ten options (`public/icons/`, regenerate with `scripts/draw-icons.py`). Chrome reported no installability errors.
- **Service worker** (`src/offline/service-worker.ts`, built as `sw.js`):
  - A Vite plugin in `vite.config.ts` gives it the app shell (every built file, plus the manifest and icons, about 27 MB, mostly ONNX Runtime's WebAssembly) and a version that changes with them.
  - Pages in scope and the shell files come from the shell cache. `models/`, iNaturalist, OpenStreetMap and photos go to the network: the setup screen stores the model in its own cache.
  - A new version installs alongside, takes over once the old pages close (no `skipWaiting`), and deletes only old shell caches; the model's cache stays.
  - Registered in production builds only.
  - The routing decisions (`src/offline/routes.ts`) are unit-tested; the spec's testing note now says so.
- **Device check** (`src/device/`): `checkDevice(features)` is pure and unit-tested; `readDeviceFeatures()` reads the browser.
  - On the setup screen, hard requirements block the download with an explanation; soft ones warn and let the player go on.
  - If the check can't run, the download is allowed with a note.
- **Warm-up:** after the download, the photo check loads and encodes one label. The setup screen says "fast on this phone" (WebGPU) or "works here, but slower…" (WebAssembly).
  - A failed warm-up offers Try again (with a fresh photo check) instead of opening the game.
  - The warmed-up photo check is the one the game uses.
  - The Card builder shows a slow-phone note once the photo check reports WebAssembly.
- **No signal:** building a Card or searching offline says it needs signal, and that the current Card still plays.
  - The iNaturalist and Nominatim adapters throw `NoSignalError` when a request can't get through, so this works even when `navigator.onLine` claims to be online (Wi-Fi with no internet, or Chrome's offline emulation).
- **Checked in headless Chromium** against a production build (`vite preview`):
  - Setup: device check (two warnings), download, warm-up ("slower"), builder slow note.
  - A Card built online.
  - **Offline:** reload opened the app from the service worker with the Card; a Sighting was checked and marked and its fact card shown; the mark survived another offline reload. Building offline gave the needs-signal message, and so did searching.
  - **New build:** 0 model requests and no setup screen. After closing and reopening, the new shell was active and the old shell cache gone, with the model cache kept.
- **For ticket 11 (by hand on the phone):**
  - Install to the home screen and play in airplane mode.
  - Check how soon an installed app that Android suspends rather than closes picks up a new version.
  - The slow-phone note appears once the photo check has loaded (a few seconds after opening).
  - The module-worker check proves the browser knows module workers, not that one starts; the warm-up proves that.
  - Free storage is quota minus usage, so a half-finished download counts against it.
