"""Broad animal groups: compare three ways of deciding which group an animal photo shows.

1. bare Latin group prompts ("a photo of Reptilia.") - what eval_accuracy.py measured
2. descriptive group prompts ("a photo of a reptile, such as a snake, lizard or turtle.")
3. roll-up: match against every local animal species, then take that species' group
"""

import numpy as np
import open_clip
import torch

from eval_accuracy import (
    ANIMAL_GROUPS, MODEL_ID, add_lineage, local_species, photos_for, prompts, summarize,
)
from eval_accuracy import get
import io
from PIL import Image

LAT, LNG, RADIUS, MONTHS = 41.2864, -96.2370, 25, "9,10,11"
PHOTOS_PER_GROUP = 12

DESCRIPTIVE = {
    "a mammal": "a photo of a mammal, such as a deer, squirrel, rabbit, raccoon or fox.",
    "a bird": "a photo of a bird.",
    "a reptile": "a photo of a reptile, such as a snake, lizard or turtle.",
    "an amphibian": "a photo of an amphibian, such as a frog, toad or salamander.",
    "a butterfly or moth": "a photo of a butterfly or moth.",
    "a spider": "a photo of a spider.",
    "another insect": "a photo of an insect, such as a beetle, bee, grasshopper, fly or dragonfly.",
}


def group_of(ancestor_ids):
    """Most specific matching group: Lepidoptera before Insecta."""
    ids = set(ancestor_ids)
    for name in ("a butterfly or moth", "a spider", "a mammal", "a bird", "a reptile", "an amphibian",
                 "another insect"):
        if ANIMAL_GROUPS[name][1] in ids:
            return name
    return None


def main():
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL_ID)
    model.eval()
    tokenizer = open_clip.get_tokenizer(MODEL_ID)
    where = dict(lat=LAT, lng=LNG, radius=RADIUS)

    def encode_text(texts):
        with torch.no_grad():
            return np.concatenate([model.encode_text(tokenizer(texts[i:i + 64]), normalize=True).numpy()
                                   for i in range(0, len(texts), 64)])

    def encode_images(urls):
        tensors = [preprocess(Image.open(io.BytesIO(get(u))).convert("RGB")) for u in urls]
        with torch.no_grad():
            return np.concatenate([model.encode_image(torch.stack(tensors[i:i + 16]), normalize=True).numpy()
                                   for i in range(0, len(tensors), 16)])

    names = list(ANIMAL_GROUPS)
    urls, truth = [], []
    for index, (_, taxon_id) in enumerate(ANIMAL_GROUPS.values()):
        found = photos_for(taxon_id, n=PHOTOS_PER_GROUP, **where)
        urls += found
        truth += [index] * len(found)
    truth = np.array(truth)
    images = encode_images(urls)
    print(f"{len(urls)} animal photos, up to {PHOTOS_PER_GROUP} per group")

    latin = encode_text([f"a photo of {latin}." for latin, _ in ANIMAL_GROUPS.values()])
    summarize("1. Latin group prompts", images @ latin.T, truth)
    descriptive = encode_text([DESCRIPTIVE[n] for n in names])
    summarize("2. Descriptive group prompts", images @ descriptive.T, truth)

    animals = local_species(LAT, LNG, RADIUS, MONTHS, "Mammalia,Aves,Reptilia,Amphibia,Insecta,Arachnida", 500)
    animals = [a for a in animals if group_of(a["ancestor_ids"])]
    add_lineage(animals)
    species_vectors = encode_text(prompts(animals, "taxonomy"))
    best_species = np.argmax(images @ species_vectors.T, axis=1)
    rolled = np.array([names.index(group_of(animals[i]["ancestor_ids"])) for i in best_species])
    print(f"\n3. Roll-up via {len(animals)} local animal species: {len(urls)} photos")
    print(f"  top-1 {(rolled == truth).mean():.0%}")
    for index, name in enumerate(names):
        mask = truth == index
        wrong = sorted({names[r] for r in rolled[mask] if r != index})
        print(f"  {name}: {(rolled[mask] == index).sum()}/{mask.sum()}" + (f" (wrong: {', '.join(wrong)})" if wrong else ""))


if __name__ == "__main__":
    main()
