# 01 — Spike: BioCLIP in Android Chrome

**What to build:** Prove (or disprove) that BioCLIP can check a Sighting in the phone's browser. Export both BioCLIP encoders (image and text, `imageomics/bioclip` ViT-B/16) to fp16 ONNX, and build a bare throwaway page that loads them in a Web Worker via Transformers.js / ONNX Runtime Web, takes a photo, and scores it against a handful of hard-coded labels. The page reports what the player needs to know: how long the model takes to load, how long one photo check takes, and whether WebGPU or WebAssembly was used. See ADR 0001.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] Both encoders exported to ONNX at fp16; embeddings match the original PyTorch model (cosine similarity ≥ 0.99 on a few test images and labels)
- [x] Spike page loads both encoders in a Web Worker, using WebGPU when available and WebAssembly otherwise, and shows which backend is active
- [x] Taking a photo shows the top label with its score, ranked against about 10 hard-coded labels
- [x] Page displays model load time (cold and cached) and photo check time
- [x] Record the results from a run on the player's Android phone in Chrome (load time, check time, backend, whether the tab stayed stable) as a comment on this ticket
- [x] Plan B decision recorded: proceed in-browser, or update ADR 0001 with the chosen fallback

## Comments

### 2026-10-08: spike results

**Phone:** Android 10, Chrome 154, 8 cores, 8 GB, Imagination PowerVR D-Series GPU. fp16 export, backend Auto, graph optimization All.

| | Result |
|---|---|
| Backend | WebGPU (shader-f16 supported); WASM fallback not needed |
| Cold load (first download, through a Cloudflare tunnel from home upload) | 93 s total: 51 s + 38 s downloading, 1.0 s sessions, 2.2 s encoding 10 labels |
| Cached load | 5.7–7.0 s total: 0.3–0.5 s per model file, 2.3–3.0 s sessions, 2.3–2.7 s encoding 10 labels |
| Photo check | ~1.3 s (1.3–1.6 s fixtures, 1.4 s camera-app photo, 2.2 s live-camera 1280×1280 frame) |
| Test photos | 4/4 correct (same as Python and headless WASM) |
| Tab stability | Stable across repeated loads. **With Android's camera app the page was sometimes reset** ("Not loaded" after returning), consistent with Chrome discarding the backgrounded tab. The in-page live camera (getUserMedia) worked with no discard. |

Dev PC headless Chromium (2 cores, WASM, 1 thread) for comparison: ~13 s load, ~1.75 s per check, 4/4 correct.

**Export:** both encoders match PyTorch at cosine 1.00000. "fp16" = fp16 weights, fp32 math (full fp16 math crashes ONNX Runtime's CPU/WASM backend). The WebGPU build of onnxruntime-web 1.30 uses the "asyncify" WebAssembly files.

**Real-world photos:** a blue spruce came back as Douglas-fir (twice) and a weeping mulberry as Quaking Aspen. Neither species was among the spike's 10 labels, so these were forced choices, not model errors. The spruce's p dropped to 0.57 on the second try.

**Accuracy test** (`spike/export/eval_accuracy.py`, `eval_animal_groups.py`; Elkhorn, NE 68022, 25 km, Sept–Nov, iNaturalist research-grade photos — likely optimistic, since BioCLIP trained partly on iNaturalist):

- Plants/fungi, 200 photos of the 50 most-observed species vs all 500 local plants/fungi: **top-1 80–81%, top-3 92–94%, top-5 95%** (two runs). Misses are mostly look-alikes (bluestems, goldenrods, sunflowers, shelf fungi). "Scientific + common name" labels score the same as BioCLIP's full-taxonomy format.
- Animal broad groups, 84 photos: Latin group prompts 56%, descriptive prompts 60%, **roll-up via ~500 local animal species 93%** (other insect weakest at 7/12).
- Confidence: raw cosine of right vs wrong answers overlaps (medians 0.33 vs 0.29); the **gap between the top two** separates them. Gap ≥ 0.03 auto-marks 63% of photos with 4.8% of those wrong; 0.04 → 52% / 1.9%.

**Plan B decision: not needed.** BioCLIP runs in the browser on the target phone. Spec, ADR 0001 and tickets 03, 05 and 07 updated: in-page camera, gap-based confidence starting at 0.03, animal Squares by roll-up.
