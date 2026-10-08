"""The spike's hard-coded labels: a handful of species a Front Range hiker might plausibly see.

Also written to the web page's labels file by export.py so both sides use the same text.
"""

LABELS = [
    {"scientific": "Populus tremuloides", "common": "Quaking Aspen"},
    {"scientific": "Pinus ponderosa", "common": "Ponderosa Pine"},
    {"scientific": "Pseudotsuga menziesii", "common": "Douglas-fir"},
    {"scientific": "Achillea millefolium", "common": "Common Yarrow"},
    {"scientific": "Castilleja miniata", "common": "Giant Red Paintbrush"},
    {"scientific": "Amanita muscaria", "common": "Fly Agaric"},
    {"scientific": "Odocoileus hemionus", "common": "Mule Deer"},
    {"scientific": "Sciurus aberti", "common": "Abert's Squirrel"},
    {"scientific": "Cyanocitta stelleri", "common": "Steller's Jay"},
    {"scientific": "Vanessa cardui", "common": "Painted Lady"},
]


def prompt(label: dict) -> str:
    return f"a photo of {label['scientific']}, {label['common']}."
