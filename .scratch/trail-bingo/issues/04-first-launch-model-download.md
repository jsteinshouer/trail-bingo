# 04 — First-launch model download

**What to build:** On first launch, a setup screen explains that the app needs a one-time download of about 300 MB and recommends Wi-Fi. The player starts the download and sees a progress bar. If the connection drops, the download can be retried without breaking the app. Once it finishes, the model is stored in the browser and the app asks for persistent storage. On later launches, if the model is already stored, the setup screen is skipped.

**Blocked by:** 01 — Spike: BioCLIP in Android Chrome; 02 — Playable hard-coded Card with Bingo

**Status:** ready-for-agent

- [x] First launch shows the setup screen with the download size and a Wi-Fi recommendation
- [x] A progress bar reflects real download progress of the model files
- [x] A failed or interrupted download shows an error with a retry option
- [x] After a successful download, persistent storage is requested
- [x] Relaunching with the model stored skips the setup screen
- [x] The photo check loads the model from browser storage with no network access

## Comments

**Implemented on branch `04-model-download`.**

- **Model store** (`src/model/`): `createModelStore({ base, fetch, openCache, persist })`. `isStored()` checks that every file in the stored manifest is in the Cache API (`trail-bingo-models-v1`). `download(onProgress)` streams each missing file straight into storage, so the phone never holds 300 MB in memory, and asks for persistent storage when the download finishes. `read(name)` never touches the network. Tested with a fake fetch and an in-memory cache.
- **Progress** is in real bytes. The total comes from every file's `Content-Length`, collected before the bar starts moving. Files kept from an earlier try count as already downloaded. Downloads use `cache: "no-store"`, so there's no second copy in the HTTP cache.
- **Failures:**
  - Retrying resumes **one whole file at a time**: files that finished are kept and the retry fetches only the rest, but a file that dropped partway restarts from zero (no HTTP Range requests). Range requests would help most with the 173 MB image encoder if this shows up on the hike.
  - A download that sends no bytes for 30 s counts as dropped, because a lost signal can hang rather than fail.
  - Messages cover: offline, connection dropped, stalled, and out of space.
- **Launch flow** (`main.ts`): if the model is stored, the demo Card opens; otherwise the setup screen shows. The worker now reads only from storage, so a missing model fails with a clear error rather than a silent download.
- **Setup screen** (`src/ui/setup-screen.ts`):
  - It has a ~300 MB note, a Wi-Fi recommendation, a progress bar with MB counts, and a retry.
  - It keeps a screen wake lock during the download.
  - If the browser refuses persistent storage, it shows a note suggesting installing to the home screen.
- **Checked in headless Chromium:**
  - The image encoder failed at the network → error and Try again → the retry requested only `image_encoder_fp16.onnx`.
  - A fresh download moved the bar through real values to 100.
  - Relaunch skipped setup, and the photo check loaded with every `/models/` request blocked (0 model requests).
  - Use a persistent profile (`launchPersistentContext`): Playwright's default contexts have a small in-memory quota and fail with "Quota exceeded."
- **Left for later:**
  - If the browser evicts the model *after* launch, the Card screen shows "The photo check couldn't load" and the next launch shows setup again. Nothing sends the player back to setup mid-session.
  - Hosting: `npm run models` still links the spike's export into `public/models/`, and the build copies it into `dist/`. The 173 MB image encoder is over GitHub Pages' 100 MB file limit, so ticket 10 needs to choose where the model is served from. If that's another origin, it needs CORS headers, because the app sends COEP `require-corp`.
- **Not checked yet:** the target phone.
