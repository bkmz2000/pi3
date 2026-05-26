# Gradient sky — lerp between two colors for each pixel row, then sprinkle
# stars on top using `random` and a tiny noise-driven horizon line.

from graphics import *

W, H = 640, 360
size(W, H)

TOP    = Colors.navy
BOTTOM = Colors.orange
HORIZON_Y = int(H * 0.7)

# Pre-pick star positions once so they don't dance every frame
import random as _r
_r.seed(7)
STARS = [(_r.randint(0, W), _r.randint(0, HORIZON_Y - 10)) for _ in range(60)]


def tick():
    # Sky — one rect per row, color lerped by row index
    no_stroke()
    for y in range(HORIZON_Y):
        t = y / HORIZON_Y
        fill(lerp(TOP, BOTTOM, t))
        rect(0, y, W, 1)

    # Stars (above horizon only). Twinkle a few based on frame_count.
    for i, (sx, sy) in enumerate(STARS):
        bright = 200 if (frame_count + i) % 90 > 30 else 255
        fill(bright, bright, bright)
        rect(sx, sy, 2, 2)

    # Ground — flat fill plus a noise-jittered horizon line
    fill(Colors.slate)
    rect(0, HORIZON_Y, W, H - HORIZON_Y)

    fill(Colors.white)
    for x in range(W):
        # noise gives [0, 1]; bias and scale into a 6-pixel jitter band
        h = int(noise(x, 0, scale=0.02, seed=1) * 6)
        rect(x, HORIZON_Y - h, 1, h + 1)


run(tick)
