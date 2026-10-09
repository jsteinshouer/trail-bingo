# 10 — Installable and offline

**What to build:** The player installs Trail Bingo to their home screen and plays a whole game with no signal. A web app manifest and a service worker that caches the app shell make the installed app open offline; together with the stored model, Card data, facts and progress, the full play loop works in airplane mode. Before the first-launch model download, a quick device check makes sure the phone can run the game at all, so nobody spends ~300 MB of data to find out it can't.

**Blocked by:** 04 — First-launch model download; 05 — Build a Card from my location; 08 — Fact cards; 09 — Progress survives restarts

**Status:** ready-for-agent

- [ ] App has a web app manifest and icon and can be installed on Android Chrome
- [ ] Service worker caches the app shell; new app versions update cleanly without re-downloading the model
- [ ] With a Card built, in airplane mode: the installed app opens, Sightings are checked, Squares marked, fact cards shown, and progress saved
- [ ] Building a Card while offline shows a clear "needs signal" message
- [ ] Before the model download, the setup screen runs a device check: hard requirements block the download with a plain explanation; soft ones warn and let the player continue (tested with fake browser features)
- [ ] After the download, a warm-up loads the model and encodes one label, and the setup screen says whether the photo check runs fast (WebGPU) or slower (WebAssembly); the Card builder warns that building may take several minutes on a slower phone

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
