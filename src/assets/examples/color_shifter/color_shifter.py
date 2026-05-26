# Color shifter — see how `lerp` and the shade helpers transform a color.
#
# Top row: take Colors.orange and step it through darker, lighter, saturated,
# desaturated. Bottom row: a 12-stop gradient from red to sky using `lerp`,
# with a marker that walks through it over time.

from graphics import *

size(720, 360)

VARIANTS = [
    ("base",            lambda c: c),
    ("darker(2)",       lambda c: darker(c, 2)),
    ("lighter(2)",      lambda c: lighter(c, 2)),
    ("saturated(2)",    lambda c: saturated(c, 2)),
    ("desaturated(2)",  lambda c: desaturated(c, 2)),
]

STOPS = 12


def tick():
    background(22, 24, 32)
    text_align("center", "top")
    text_size(11)

    # Top: variants of one color
    base = Colors.orange
    for i, (label, fn) in enumerate(VARIANTS):
        x = 30 + i * 130
        no_stroke()
        fill(fn(base))
        rect(x, 50, 110, 90)
        fill(220, 220, 225)
        text(label, x + 55, 145)

    fill(150, 150, 160)
    text("Colors.orange transformed", 360, 24)

    # Bottom: animated lerp from red to sky
    t = (frame_count % 240) / 240.0
    fill(150, 150, 160)
    text("lerp(red, sky, t)   t = " + str(round(t, 2)), 360, 195)

    cell_w = 56
    for i in range(STOPS):
        ti = i / (STOPS - 1)
        no_stroke()
        fill(lerp(Colors.red, Colors.sky, ti))
        rect(20 + i * cell_w, 225, cell_w - 6, 70)

    # Marker on the active stop
    idx = round(t * (STOPS - 1))
    no_fill()
    stroke(255, 255, 255)
    stroke_width(2)
    rect(20 + idx * cell_w, 225, cell_w - 6, 70)


run(tick)
