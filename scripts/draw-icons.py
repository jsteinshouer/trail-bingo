# Usage: spike/export/.venv/bin/python -I scripts/draw-icons.py public/icons
# Draws the app icons: a 3×3 Card in paper on photorevision purple, with the
# legend's plant symbol growing in the centre Square, where the Wildcard sits.
import sys
from PIL import Image, ImageDraw

PURPLE = (123, 50, 148)
PAPER = (253, 253, 251)
# Paper section lines at 55% over purple, as in the Card's paper-on-tint lines.
FAINT = tuple(round(p * 0.55 + q * 0.45) for p, q in zip(PAPER, PURPLE))

# The legend's plant or wildflower symbol (src/ui/icons.ts), as lines on a 24×24 grid.
PLANT = [((5, 20.5), (19, 20.5)), ((12, 20.5), (12, 8)), ((12, 20.5), (7, 12.5)),
         ((12, 20.5), (17, 12.5)), ((12, 20.5), (9.2, 10)), ((12, 20.5), (14.8, 10))]


def stroke(d, a, b, width, colour):
    """A line with round ends, as the legend symbols are drawn."""
    d.line([a, b], fill=colour, width=round(width))
    r = width / 2
    for x, y in (a, b):
        d.ellipse([x - r, y - r, x + r, y + r], fill=colour)


def icon(size, card_share):
    """`card_share` is the share of the icon the Card spans; maskable icons are cropped to a circle, so theirs is smaller."""
    scale = 4  # draw big, then shrink, for smooth edges
    s = size * scale
    img = Image.new("RGB", (s, s), PURPLE)
    d = ImageDraw.Draw(img)
    side = s * card_share
    cell = side / 3
    g0 = (s - side) / 2
    unit = s / 512  # line widths are set for a 512 px icon

    for k in (1, 2):
        x = g0 + k * cell
        d.line([(x, g0), (x, g0 + side)], fill=FAINT, width=round(8 * unit * card_share / 0.76))
        d.line([(g0, x), (g0 + side, x)], fill=FAINT, width=round(8 * unit * card_share / 0.76))
    frame = 10 * unit * card_share / 0.76
    d.rectangle([g0, g0, g0 + side, g0 + side], outline=PAPER, width=round(frame))

    # The centre Square, in paper, with the plant in purple.
    inset = 6 * unit * card_share / 0.76
    c0 = g0 + cell
    d.rectangle([c0 + inset, c0 + inset, c0 + cell - inset, c0 + cell - inset], fill=PAPER)
    glyph = cell * 0.8
    origin = c0 + (cell - glyph) / 2
    k = glyph / 24
    for a, b in PLANT:
        stroke(d, (origin + a[0] * k, origin + a[1] * k), (origin + b[0] * k, origin + b[1] * k), 2 * k, PURPLE)
    return img.resize((size, size), Image.LANCZOS)


out = sys.argv[1]
icon(192, 0.76).save(f"{out}/icon-192.png")
icon(512, 0.76).save(f"{out}/icon-512.png")
# Inside the circle Android crops maskable icons to (the middle 80%), corners included.
icon(512, 0.56).save(f"{out}/maskable-512.png")
