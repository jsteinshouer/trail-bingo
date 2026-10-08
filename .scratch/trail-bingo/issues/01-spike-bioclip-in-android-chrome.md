# 01 — Spike: BioCLIP in Android Chrome

**What to build:** Prove (or disprove) that BioCLIP can check a Sighting in the phone's browser. Export both BioCLIP encoders (image and text, `imageomics/bioclip` ViT-B/16) to fp16 ONNX, and build a bare throwaway page that loads them in a Web Worker via Transformers.js / ONNX Runtime Web, takes a photo, and scores it against a handful of hard-coded labels. The page reports what the player needs to know: how long the model takes to load, how long one photo check takes, and whether WebGPU or WebAssembly was used. See ADR 0001.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Both encoders exported to ONNX at fp16; embeddings match the original PyTorch model (cosine similarity ≥ 0.99 on a few test images and labels)
- [ ] Spike page loads both encoders in a Web Worker, using WebGPU when available and WebAssembly otherwise, and shows which backend is active
- [ ] Taking a photo shows the top label with its score, ranked against about 10 hard-coded labels
- [ ] Page displays model load time (cold and cached) and photo check time
- [ ] Record the results from a run on the player's Android phone in Chrome (load time, check time, backend, whether the tab stayed stable) as a comment on this ticket
- [ ] Plan B decision recorded: proceed in-browser, or update ADR 0001 with the chosen fallback
