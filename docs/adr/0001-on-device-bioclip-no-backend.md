# On-device BioCLIP, no backend, no LLM

Trail Bingo checks Sightings with BioCLIP (`imageomics/bioclip`, ViT-B/16, MIT) running in the browser, and the app is a fully static PWA with no server of our own. Play has to work on the trail with no signal, so photo checking must run on the phone. BioCLIP is a CLIP-style model trained to match photos to taxon names, which fits "which of this Card's Squares is this?" far better than a general vision-language model. Building a Card runs in the browser too: iNaturalist and Wikipedia lookups, plus BioCLIP's text encoder for the Square labels. The cost is a one-time download of roughly 300 MB at first launch.

## Considered Options

- **Gemma 4 E2B/E4B on the phone** (which would also qualify for the challenge's "Best Use of Gemma" category): the browser ONNX build is about 2.5 GB, likely to crash a phone tab. It is also a text generator rather than a species matcher, so it is likely less accurate at fine-grained identification.
- **Gemma to write Cards, BioCLIP to check photos**: two model integrations in a 4-day build. Real iNaturalist and Wikipedia data covers species choice and facts more accurately than generated text.
- **Hosted model / small backend**: smaller download, but play would need signal and there would be a server to run. Kept as a possible plan B if the Day 1 spike shows in-browser BioCLIP is too slow or crashes the tab on Android Chrome.
- **Precomputed text embeddings for a fixed taxa list**: no text encoder on the phone, but Cards would be limited to that list instead of whatever has been observed near the chosen location.

## Consequences

- Plain dynamic int8 quantization is avoided because it measurably degrades this ViT.
- Both BioCLIP encoders are exported ourselves. Weights are stored as fp16 and computed in fp32; full fp16 math crashes ONNX Runtime's WebAssembly backend.
- The spike (ticket 01) confirmed it on the target Android phone: WebGPU, about 6 s cached load and about 1.3 s per photo check. Plan B is not needed.
