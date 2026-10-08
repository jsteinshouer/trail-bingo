"""Export BioCLIP's image and text encoders to ONNX (fp32 and fp16) and check them against PyTorch.

Both encoders output L2-normalized 512-d vectors, so the browser only needs a dot product to compare.
Writes the models plus a manifest and the spike's labels into the web page's public folder.
"""

import json
import urllib.request
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import open_clip
import torch
from onnx import TensorProto, helper, numpy_helper
from PIL import Image

from labels import LABELS, prompt

MODEL_ID = "hf-hub:imageomics/bioclip"
ROOT = Path(__file__).parent.parent
OUT = ROOT / "web" / "public" / "models"
FIXTURES = ROOT / "web" / "public" / "fixtures"
OPSET = 17
MIN_COSINE = 0.99
TOKENIZER_REPO = "openai/clip-vit-base-patch16"


class ImageEncoder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, pixel_values):
        return self.model.encode_image(pixel_values, normalize=True)


class TextEncoder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids):
        return self.model.encode_text(input_ids, normalize=True)


def export(module, example, input_name, path):
    torch.onnx.export(
        module,
        (example,),
        str(path),
        input_names=[input_name],
        output_names=["embeddings"],
        dynamic_axes={input_name: {0: "batch"}, "embeddings": {0: "batch"}},
        opset_version=OPSET,
        dynamo=False,
    )
    # Fold any external data back into one file so the browser fetches a single model per encoder.
    onnx.save_model(onnx.load(str(path)), str(path))


def to_fp16(src, dst):
    """Store large weights as fp16 and cast them back to fp32 on load; all compute stays fp32.

    Halves the download. Full fp16 compute (onnxruntime's converter) segfaults the CPU backend,
    which is also the WebAssembly fallback in the browser, so it isn't used.
    """
    model = onnx.load(str(src))
    graph = model.graph
    kept, halved, upcasts = [], [], []
    for init in graph.initializer:
        weights = numpy_helper.to_array(init)
        if weights.dtype == np.float32 and weights.size >= 1024:
            half = numpy_helper.from_array(weights.astype(np.float16), f"{init.name}_fp16")
            halved.append(half)
            upcasts.append(helper.make_node(
                "Cast", [half.name], [init.name], to=TensorProto.FLOAT, name=f"{init.name}_upcast"
            ))
        else:
            kept.append(init)
    del graph.initializer[:]
    graph.initializer.extend(kept + halved)
    nodes = list(graph.node)
    del graph.node[:]
    graph.node.extend(upcasts + nodes)
    onnx.save_model(model, str(dst))


def run(path, input_name, value):
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    return session.run(None, {input_name: value})[0]


def min_cosine(a, b):
    a = a / np.linalg.norm(a, axis=1, keepdims=True)
    b = b / np.linalg.norm(b, axis=1, keepdims=True)
    return float((a * b).sum(axis=1).min())


def main() -> None:
    # The fused attention fast path has no ONNX export; fall back to plain ops.
    torch.backends.mha.set_fastpath_enabled(False)
    OUT.mkdir(parents=True, exist_ok=True)
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL_ID)
    model.eval()
    tokenizer = open_clip.get_tokenizer(MODEL_ID)

    fixture_files = sorted(FIXTURES.glob("*.jpg"))
    assert fixture_files, "run fetch_fixtures.py first"
    images = torch.stack([preprocess(Image.open(f).convert("RGB")) for f in fixture_files])
    prompts = [prompt(label) for label in LABELS]
    tokens = tokenizer(prompts)

    with torch.no_grad():
        ref_image = model.encode_image(images, normalize=True).numpy()
        ref_text = model.encode_text(tokens, normalize=True).numpy()

    encoders = {
        "image": (ImageEncoder(model), images[:1], "pixel_values", images.numpy(), ref_image),
        "text": (TextEncoder(model), tokens[:1], "input_ids", tokens.numpy(), ref_text),
    }
    results = {}
    for name, (module, example, input_name, value, reference) in encoders.items():
        fp32 = OUT / f"{name}_encoder_fp32.onnx"
        fp16 = OUT / f"{name}_encoder_fp16.onnx"
        with torch.no_grad():
            export(module, example, input_name, fp32)
        to_fp16(fp32, fp16)
        for path in (fp32, fp16):
            out = run(path, input_name, value)
            cos = min_cosine(out, reference)
            results[path.name] = cos
            print(f"{path.name}: {path.stat().st_size / 1e6:.1f} MB, min cosine vs PyTorch {cos:.5f}")
            if name == "image":
                results[f"{path.name}:out"] = out

    failed = [k for k, v in results.items() if not k.endswith(":out") and v < MIN_COSINE]

    print("\nZero-shot top-1 per fixture (fp16 image vs PyTorch text):")
    scores = results["image_encoder_fp16.onnx:out"] @ ref_text.T
    for file, row in zip(fixture_files, scores):
        best = int(row.argmax())
        print(f"  {file.stem:24s} -> {LABELS[best]['scientific']} ({row[best]:.3f})")

    manifest = {
        "model": MODEL_ID,
        "embeddingDim": int(ref_text.shape[1]),
        "logitScale": float(model.logit_scale.exp().item()),
        "contextLength": int(tokens.shape[1]),
        "preprocess": {
            "size": 224,
            "resize": "shortest-side-bicubic",
            "crop": "center",
            "mean": [0.48145466, 0.4578275, 0.40821073],
            "std": [0.26862954, 0.26130258, 0.27577711],
        },
        "files": {
            precision: {
                "image": f"image_encoder_{precision}.onnx",
                "text": f"text_encoder_{precision}.onnx",
            }
            for precision in ("fp16", "fp32")
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    labels_out = [
        {**label, "prompt": p, "tokenIds": [int(t) for t in row if t != 0]}
        for label, p, row in zip(LABELS, prompts, tokens.tolist())
    ]
    (OUT / "labels.json").write_text(json.dumps(labels_out, indent=2) + "\n")

    # BioCLIP uses OpenAI's CLIP BPE tokenizer; ship the Hugging Face format for tokenizers.js.
    for name in ("tokenizer.json", "tokenizer_config.json"):
        url = f"https://huggingface.co/{TOKENIZER_REPO}/resolve/main/{name}"
        with urllib.request.urlopen(url, timeout=60) as resp:
            (OUT / name).write_bytes(resp.read())

    if failed:
        raise SystemExit(f"FAILED: below {MIN_COSINE} cosine: {failed}")
    print("\nAll exports within tolerance.")


if __name__ == "__main__":
    main()
