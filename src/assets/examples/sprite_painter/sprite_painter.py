# Sprite painter — build a 32x32 sprite procedurally with `set_pixel`,
# fill it via `flood_fill`, then recolor it with `palette_swap`.
#
# Press 1 / 2 / 3 / 4 to switch palette.

from graphics import *
import math

size(480, 320)

INK = Colors.navy
INNER = Colors.yellow

PALS = {
    "1": (Colors.yellow, Colors.navy),    # default
    "2": (Colors.lime,   Colors.green),
    "3": (Colors.sky,    Colors.blue),
    "4": (Colors.silver, Colors.slate),
}


def build_face():
    """Draw a smiley face into a fresh 32x32 sprite, then bucket-fill the inside."""
    s = create_sprite(32, 32)

    # Face outline (circle, radius 14)
    cx, cy, r = 16, 16, 14
    for a_deg in range(0, 360):
        a = math.radians(a_deg)
        set_pixel(s, round(cx + math.cos(a) * r), round(cy + math.sin(a) * r), INK)

    # Eyes (2x1 each)
    for (ex, ey) in [(11, 12), (12, 12), (20, 12), (21, 12)]:
        set_pixel(s, ex, ey, INK)

    # Mouth (short flat smile with corners)
    for x in range(11, 22):
        set_pixel(s, x, 22, INK)
    set_pixel(s, 10, 21, INK)
    set_pixel(s, 22, 21, INK)

    # Bucket-fill the interior with the inner color
    flood_fill(s, 16, 16, INNER)
    return s


face = build_face()
active = 1


def tick():
    global face, active

    # Poll number keys — press → rebuild + recolor
    for k, (new_inner, new_ink) in PALS.items():
        if Keyboard[k].pressed:
            face = build_face()
            palette_swap(face, INNER, new_inner)
            palette_swap(face, INK,   new_ink)
            active = int(k)

    background(28, 30, 38)
    no_stroke()
    fill(200, 200, 210)
    text_size(12)
    text_align("left", "top")
    text("Press 1 / 2 / 3 / 4 to recolor", 16, 16)
    text("palette " + str(active), 16, 36)

    # Sprite shown at 8x scale (256 px), centred-ish
    image(face, 112, 48, 256, 256)


run(tick)
