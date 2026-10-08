# 04 — First-launch model download

**What to build:** On first launch, a setup screen explains that the app needs a one-time download of about 300 MB and recommends Wi-Fi. The player starts the download and sees a progress bar. If the connection drops, the download can be retried without breaking the app. Once it finishes, the model is stored in the browser and the app asks for persistent storage. On later launches, if the model is already stored, the setup screen is skipped.

**Blocked by:** 01 — Spike: BioCLIP in Android Chrome; 02 — Playable hard-coded Card with Bingo

**Status:** ready-for-agent

- [ ] First launch shows the setup screen with the download size and a Wi-Fi recommendation
- [ ] A progress bar reflects real download progress of the model files
- [ ] A failed or interrupted download shows an error with a retry option
- [ ] After a successful download, persistent storage is requested
- [ ] Relaunching with the model stored skips the setup screen
- [ ] The photo check loads the model from browser storage with no network access
