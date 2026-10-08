"""Download a few CC-licensed research-grade iNaturalist photos to use as spike fixtures."""

import json
import urllib.parse
import urllib.request
from pathlib import Path

from labels import LABELS

OUT = Path(__file__).parent.parent / "web" / "public" / "fixtures"
FIXTURE_TAXA = ["Populus tremuloides", "Amanita muscaria", "Odocoileus hemionus", "Achillea millefolium"]


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "trail-bingo-spike/0.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    known = {label["scientific"] for label in LABELS}
    credits = []
    for name in FIXTURE_TAXA:
        assert name in known, f"{name} must be one of the spike labels"
        query = urllib.parse.urlencode({
            "taxon_name": name,
            "quality_grade": "research",
            "photo_license": "cc0,cc-by",
            "photos": "true",
            "per_page": 1,
            "order_by": "votes",
        })
        obs = get_json(f"https://api.inaturalist.org/v1/observations?{query}")["results"][0]
        photo = obs["photos"][0]
        url = photo["url"].replace("square", "medium")
        slug = name.lower().replace(" ", "-")
        target = OUT / f"{slug}.jpg"
        req = urllib.request.Request(url, headers={"User-Agent": "trail-bingo-spike/0.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            target.write_bytes(resp.read())
        credits.append({
            "file": target.name,
            "taxon": name,
            "attribution": photo["attribution"],
            "license": photo["license_code"],
            "observation": f"https://www.inaturalist.org/observations/{obs['id']}",
        })
        print(f"{target.name}: {photo['attribution']}")
    (OUT / "CREDITS.json").write_text(json.dumps(credits, indent=2) + "\n")


if __name__ == "__main__":
    main()
