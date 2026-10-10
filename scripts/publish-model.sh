#!/bin/sh
# Publishes the ONNX export (spike/web/public/models, from spike/export/export.py)
# to a Hugging Face model repository, for the deployed app to download.
#
# Usage, after `spike/export/.venv/bin/hf auth login` with a write token:
#   HF_REPO=yourname/trail-bingo-bioclip-onnx scripts/publish-model.sh
set -e

REPO=${HF_REPO:?Set HF_REPO, for example HF_REPO=yourname/trail-bingo-bioclip-onnx}
HF=spike/export/.venv/bin/hf
MODELS=spike/web/public/models
FILES="manifest.json tokenizer.json tokenizer_config.json image_encoder_fp16.onnx text_encoder_fp16.onnx"

for file in $FILES; do
  [ -f "$MODELS/$file" ] || { echo "Missing $MODELS/$file: run spike/export/export.py first" >&2; exit 1; }
done

# Only the files the app downloads, and the model card; not the fp32 export or the labels.
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
for file in $FILES; do cp -L "$MODELS/$file" "$STAGE/"; done
cp scripts/model-card.md "$STAGE/README.md"

"$HF" repos create "$REPO" --repo-type model --exist-ok
"$HF" upload "$REPO" "$STAGE" . --repo-type model --commit-message "Trail Bingo's BioCLIP ONNX export"

REVISION=$("$HF" models info "$REPO" --format json 2>/dev/null | sed -n 's/.*"sha": *"\([0-9a-f]*\)".*/\1/p' | head -1)
echo
echo "Published. Set the GitHub Actions variable MODEL_URL to:"
echo "  https://huggingface.co/$REPO/resolve/${REVISION:-main}/"
echo "(a commit, so the files the app downloads never change under it)"
