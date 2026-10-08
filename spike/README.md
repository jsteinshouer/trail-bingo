# Spike: BioCLIP in Android Chrome (ticket 01)

Throwaway code to answer one question: can BioCLIP check a Sighting in the phone's browser, fast enough and without crashing the tab? See `.scratch/trail-bingo/issues/01-spike-bioclip-in-android-chrome.md` and ADR 0001.

## 1. Export the model

Needs [uv](https://docs.astral.sh/uv/). Downloads BioCLIP (~600 MB) and writes ~900 MB of ONNX files to `web/public/models/` (git-ignored).

```sh
cd export
uv sync
uv run python fetch_fixtures.py   # optional: test photos are already committed
uv run python export.py
```

`export.py` fails if any exported encoder's vectors drift below 0.99 cosine similarity from PyTorch's.

**fp16 here means fp16 weights, fp32 math.** Weights are stored as fp16 and cast back to fp32 when the model loads. This halves the download with no accuracy loss. Full fp16 math (onnxruntime's converter) segfaults ONNX Runtime's CPU backend, which is also the browser's WebAssembly fallback.

## 2. Run the page

```sh
cd web
npm install
npm test        # needs step 1 (the tokenizer test reads the exported labels)
npm run dev
```

The page loads both encoders in a Web Worker, encodes the 10 hard-coded labels, then checks photos: one from the camera, or the 4 committed test photos. It reports load time, session creation time, label encoding time, photo check time and which backend ran. **Copy report** puts it all on the clipboard.

WebGPU only works on a secure origin (HTTPS or `localhost`), so the phone has to reach the dev server through one of those.

## Results so far

Headless Chromium on the dev machine (2 cores, 4 GB, WebAssembly backend, fp16, 1 thread):

| Graph optimization | Create sessions | Encode 10 labels | Photo check | Test photos correct |
|---|---|---|---|---|
| disabled | 3.9 s | 4.9 s | ~2.5 s | 4/4 |
| basic | 5.3 s | 4.0 s | ~1.75 s | 4/4 |
| all | 6.0 s | 4.4 s | ~1.75 s | 4/4 |

Downloading the two fp16 encoders from a local server took about 25 s. One earlier "all" run took 47 s to create sessions, most likely due to memory pressure right after a build; it didn't happen again.

The phone results are still to come (see the ticket).
