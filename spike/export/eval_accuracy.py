"""How accurate is BioCLIP zero-shot against a realistic local species list?

Pulls research-grade iNaturalist species seen near a location this season, then checks held-out
iNaturalist photos of the most-observed plants and fungi against the whole local plant/fungus list,
and photos of local animals against the broad animal groups a Card would use. Uses PyTorch directly;
the ONNX exports match it to cosine 1.0.
"""

import argparse
import hashlib
import io
import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
import open_clip
import torch
from PIL import Image

MODEL_ID = "hf-hub:imageomics/bioclip"
API = "https://api.inaturalist.org/v1"
CACHE = Path(__file__).parent / ".eval-cache"
HEADERS = {"User-Agent": "trail-bingo-spike/0.0 (accuracy eval)"}
RANKS = ["kingdom", "phylum", "class", "order", "family", "genus"]

# Broad animal groups as a Card would name them, with the iNaturalist taxon that defines each.
ANIMAL_GROUPS = {
    "a mammal": ("Mammalia", 40151),
    "a bird": ("Aves", 3),
    "a reptile": ("Reptilia", 26036),
    "an amphibian": ("Amphibia", 20978),
    "a butterfly or moth": ("Lepidoptera", 47157),
    "a spider": ("Araneae", 47118),
    "another insect": ("Insecta", 47158),
}


def get(url: str) -> bytes:
    CACHE.mkdir(exist_ok=True)
    key = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if key.exists():
        return key.read_bytes()
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    if url.startswith(API):
        time.sleep(1)  # iNaturalist asks for about one API request per second
    key.write_bytes(body)
    return body


def api(path: str, **params) -> dict:
    return json.loads(get(f"{API}/{path}?{urllib.parse.urlencode(params)}"))


def local_species(lat, lng, radius, months, iconic, limit):
    params = dict(lat=lat, lng=lng, radius=radius, month=months, quality_grade="research",
                  rank="species", iconic_taxa=iconic, per_page=500)
    results = api("observations/species_counts", **params)["results"][:limit]
    return [{"id": r["taxon"]["id"], "name": r["taxon"]["name"],
             "common": r["taxon"].get("preferred_common_name") or "",
             "iconic": r["taxon"].get("iconic_taxon_name"), "count": r["count"],
             "ancestor_ids": r["taxon"].get("ancestor_ids", [])} for r in results]


def add_lineage(species):
    """Fill kingdom..genus names for BioCLIP's taxonomic prompt format."""
    ancestor_ids = sorted({a for s in species for a in s["ancestor_ids"]})
    names = {}
    for i in range(0, len(ancestor_ids), 30):
        chunk = ",".join(map(str, ancestor_ids[i:i + 30]))
        for t in api(f"taxa/{chunk}", per_page=30)["results"]:
            names[t["id"]] = (t["rank"], t["name"])
    for s in species:
        by_rank = dict(names[a] for a in s["ancestor_ids"] if a in names)
        s["lineage"] = [by_rank.get(rank, "") for rank in RANKS]


def photos_for(taxon_id, lat, lng, radius, n, exclude=()):
    params = dict(taxon_id=taxon_id, lat=lat, lng=lng, radius=radius, quality_grade="research",
                  photos="true", per_page=30, order_by="random")
    urls = []
    for obs in api("observations", **params)["results"]:
        if obs["id"] in exclude or not obs["photos"]:
            continue
        urls.append(obs["photos"][0]["url"].replace("square", "medium"))
        if len(urls) == n:
            break
    return urls


def prompts(species, style):
    if style == "name":
        return [f"a photo of {s['name']}, {s['common']}." if s["common"] else f"a photo of {s['name']}."
                for s in species]
    out = []
    for s in species:
        taxonomy = " ".join(p for p in s["lineage"] if p) + " " + s["name"].split(" ", 1)[-1]
        out.append(f"a photo of {taxonomy} with common name {s['common']}." if s["common"]
                   else f"a photo of {taxonomy}.")
    return out


def summarize(label, scores, truth):
    order = np.argsort(-scores, axis=1)
    rank_of_truth = np.array([int(np.where(order[i] == truth[i])[0][0]) for i in range(len(truth))])
    top1 = rank_of_truth == 0
    best = scores[np.arange(len(scores)), order[:, 0]]
    margin = best - scores[np.arange(len(scores)), order[:, 1]]
    print(f"\n{label}: {len(truth)} photos")
    print(f"  top-1 {top1.mean():.0%}   top-3 {(rank_of_truth < 3).mean():.0%}   top-5 {(rank_of_truth < 5).mean():.0%}")
    for name, mask in (("right", top1), ("wrong", ~top1)):
        if mask.any():
            print(f"  when top-1 {name}: cosine median {np.median(best[mask]):.3f} "
                  f"(p10 {np.percentile(best[mask], 10):.3f}), "
                  f"gap to #2 median {np.median(margin[mask]):.3f} (p10 {np.percentile(margin[mask], 10):.3f})")
    return {"top1": float(top1.mean()), "top3": float((rank_of_truth < 3).mean()),
            "best": best.tolist(), "margin": margin.tolist(), "correct": top1.tolist()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, default=41.2864)   # Elkhorn, NE (68022)
    ap.add_argument("--lng", type=float, default=-96.2370)
    ap.add_argument("--radius", type=float, default=25)
    ap.add_argument("--months", default="9,10,11")
    ap.add_argument("--test-species", type=int, default=50)
    ap.add_argument("--photos", type=int, default=4)
    ap.add_argument("--animal-photos", type=int, default=6)
    args = ap.parse_args()
    where = dict(lat=args.lat, lng=args.lng, radius=args.radius)

    model, _, preprocess = open_clip.create_model_and_transforms(MODEL_ID)
    model.eval()
    tokenizer = open_clip.get_tokenizer(MODEL_ID)

    def encode_text(texts):
        with torch.no_grad():
            return np.concatenate([model.encode_text(tokenizer(texts[i:i + 64]), normalize=True).numpy()
                                   for i in range(0, len(texts), 64)])

    def encode_images(urls):
        tensors = [preprocess(Image.open(io.BytesIO(get(u))).convert("RGB")) for u in urls]
        with torch.no_grad():
            return np.concatenate([model.encode_image(torch.stack(tensors[i:i + 16]), normalize=True).numpy()
                                   for i in range(0, len(tensors), 16)])

    # Plants and fungi: species-level Squares.
    species = local_species(args.lat, args.lng, args.radius, args.months, "Plantae,Fungi", 500)
    add_lineage(species)
    by_kingdom = defaultdict(int)
    for s in species:
        by_kingdom[s["iconic"]] += 1
    print(f"Local plant/fungus species ({args.months}, {args.radius} km): {len(species)} {dict(by_kingdom)}")

    test_urls, truth = [], []
    for index, s in enumerate(species[:args.test_species]):
        urls = photos_for(s["id"], n=args.photos, **where)
        test_urls += urls
        truth += [index] * len(urls)
    print(f"Test photos: {len(test_urls)} across the {args.test_species} most-observed species")
    image_vectors = encode_images(test_urls)
    truth = np.array(truth)

    results = {}
    for style in ("name", "taxonomy"):
        label_vectors = encode_text(prompts(species, style))
        results[style] = summarize(f"Species vs all {len(species)} local plants/fungi, prompt style '{style}'",
                                   image_vectors @ label_vectors.T, truth)

    # Which species get confused, for the best prompt style.
    best_style = max(results, key=lambda k: results[k]["top1"])
    label_vectors = encode_text(prompts(species, best_style))
    top = np.argmax(image_vectors @ label_vectors.T, axis=1)
    misses = defaultdict(int)
    for t, p in zip(truth, top):
        if t != p:
            misses[(species[t]["common"] or species[t]["name"], species[p]["common"] or species[p]["name"])] += 1
    print(f"\nMost common confusions ('{best_style}' prompts):")
    for (actual, guessed), n in sorted(misses.items(), key=lambda kv: -kv[1])[:12]:
        print(f"  {n}× {actual} → {guessed}")

    # Animals: broad-group Squares.
    group_names = list(ANIMAL_GROUPS)
    animal_urls, animal_truth = [], []
    for index, (_, taxon_id) in enumerate(ANIMAL_GROUPS.values()):
        urls = photos_for(taxon_id, n=args.animal_photos, **where)
        animal_urls += urls
        animal_truth += [index] * len(urls)
    group_prompts = [f"a photo of {latin}." for latin, _ in ANIMAL_GROUPS.values()]
    animal_scores = encode_images(animal_urls) @ encode_text(group_prompts).T
    results["animal_groups"] = summarize(f"Animal photos vs {len(group_names)} broad groups",
                                         animal_scores, np.array(animal_truth))
    per_group = defaultdict(list)
    for t, p in zip(animal_truth, np.argmax(animal_scores, axis=1)):
        per_group[group_names[t]].append(group_names[p])
    for group, guesses in per_group.items():
        right = sum(g == group for g in guesses)
        wrong = sorted({g for g in guesses if g != group})
        print(f"  {group}: {right}/{len(guesses)}" + (f" (wrong: {', '.join(wrong)})" if wrong else ""))

    out = Path(__file__).parent.parent / "eval-results.json"
    out.write_text(json.dumps({"args": vars(args), "local_species": len(species), "results": results}, indent=1))
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
