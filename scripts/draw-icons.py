# Usage: spike/export/.venv/bin/python -I scripts/draw-icons.py public/icons
# Draws the app icons: the Card's triangulation-station mark in paper on photorevision purple.
import sys
from PIL import Image, ImageDraw

PURPLE = (123, 50, 148)
PAPER = (253, 253, 251)

def icon(size, safe):
    """`safe` is the share of the icon the mark may use (maskable icons are cropped to a circle)."""
    scale = 4  # draw big, then shrink, for smooth edges
    s = size * scale
    img = Image.new("RGB", (s, s), PURPLE)
    d = ImageDraw.Draw(img)
    span = s * safe
    cx, cy = s / 2, s / 2 + span * 0.04
    half = span * 0.42
    top, base = cy - half * 0.95, cy + half * 0.78
    tri = [(cx, top), (cx + half, base), (cx - half, base)]
    # A filled triangle with a smaller one cut out about its incenter: clean, even-width sides.
    (ax, ay), (bx, by), (qx, qy) = tri
    la, lb, lc = (((bx - qx) ** 2 + (by - qy) ** 2) ** 0.5, ((ax - qx) ** 2 + (ay - qy) ** 2) ** 0.5, ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5)
    ix, iy = (la * ax + lb * bx + lc * qx) / (la + lb + lc), (la * ay + lb * by + lc * qy) / (la + lb + lc)
    inradius = abs(base - iy)
    k = (inradius - span * 0.075) / inradius
    inner = [(ix + (x - ix) * k, iy + (y - iy) * k) for x, y in tri]
    d.polygon(tri, fill=PAPER)
    d.polygon(inner, fill=PURPLE)
    r = span * 0.075
    dot_y = top + (base - top) * 0.62
    d.ellipse([cx - r, dot_y - r, cx + r, dot_y + r], fill=PAPER)
    return img.resize((size, size), Image.LANCZOS)

out = sys.argv[1]
icon(192, 0.78).save(f"{out}/icon-192.png")
icon(512, 0.78).save(f"{out}/icon-512.png")
icon(512, 0.6).save(f"{out}/maskable-512.png")
