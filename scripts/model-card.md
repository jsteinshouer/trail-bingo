---
license: mit
base_model: imageomics/bioclip
library_name: onnx
pipeline_tag: zero-shot-image-classification
tags:
  - onnx
  - bioclip
  - biology
  - onnxruntime-web
---

# BioCLIP for the browser (ONNX)

[BioCLIP](https://huggingface.co/imageomics/bioclip) (ViT-B/16) exported to ONNX for in-browser
inference with ONNX Runtime Web: both the image encoder and the text encoder, plus the tokenizer.
It powers [Trail Bingo](https://github.com/jsteinshouer/trail-bingo), a bingo game played on a hike
whose photo check runs entirely on the phone.

## Files

| File | What it is |
|---|---|
| `image_encoder_fp16.onnx` | Image encoder: `pixel_values` [batch, 3, 224, 224] → `embeddings` [batch, 512] (L2-normalized) |
| `text_encoder_fp16.onnx` | Text encoder: `input_ids` [batch, 77] (int64) → `embeddings` [batch, 512] (L2-normalized) |
| `tokenizer.json`, `tokenizer_config.json` | open_clip's tokenizer, for tokenizers.js |
| `manifest.json` | Embedding size, context length and image preprocessing (224 px, center crop, CLIP mean and std) |

**fp16 weights, fp32 math.** Weights are stored as fp16 and cast to fp32 when the model loads, so
the download is halved with no accuracy loss. Full fp16 math crashes ONNX Runtime's CPU backend,
which is also the browser's WebAssembly fallback.

## How it was made

Exported from `hf-hub:imageomics/bioclip` with open_clip and `torch.onnx` by
[`spike/export/export.py`](https://github.com/jsteinshouer/trail-bingo/blob/main/spike/export/export.py),
which fails if any encoder's vectors fall below 0.99 cosine similarity to PyTorch's.

## Credit

BioCLIP is by the Imageomics Institute, released under the MIT licence; this export keeps that licence.
If you use it, please cite the BioCLIP paper:

> Stevens, S., Wu, J., Thompson, M. J., Campolongo, E. G., Song, C. H., Carlyn, D. E., Dong, L., Dahdul, W. M.,
> Stewart, C., Berger-Wolf, T., Chao, W.-L., & Su, Y. (2024). BioCLIP: A Vision Foundation Model for the Tree of Life.
> CVPR 2024.
