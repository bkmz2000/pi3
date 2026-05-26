# Random walls — feed `noise()` into a grid to decide wall vs floor.
#
# Press ← / → to change the noise scale (chunkier vs finer).
# Press space to roll a new seed.

from graphics import *

W, H = 640, 480
size(W, H)

CELL  = 16
COLS  = W // CELL
ROWS  = H // CELL

scale_idx = 2
SCALES = [0.06, 0.10, 0.16, 0.24, 0.40]
seed = 7
threshold = 0.5


def tick():
    global scale_idx, seed

    if Keyboard.arrow_left.pressed:
        scale_idx = max(0, scale_idx - 1)
    if Keyboard.arrow_right.pressed:
        scale_idx = min(len(SCALES) - 1, scale_idx + 1)
    if Keyboard.space.pressed:
        seed = (seed * 31 + 17) % 9973  # cheap reshuffle

    background(20, 22, 30)
    s = SCALES[scale_idx]
    no_stroke()

    for col in range(COLS):
        for row in range(ROWS):
            n = noise(col, row, scale=s, seed=seed)
            if n > threshold:
                # Wall — slight color variation from a second noise channel
                shade = noise(col, row, scale=s * 2, seed=seed + 1)
                fill(lerp(Colors.slate, Colors.gray, shade))
            else:
                # Floor
                fill(Colors.navy)
            rect(col * CELL, row * CELL, CELL, CELL)

    # HUD
    fill(220, 220, 230)
    text_size(12)
    text_align("left", "top")
    text("scale " + str(s) + "   seed " + str(seed), 10, 10)
    text("← / →  change scale     space  new seed", 10, 28)


run(tick)
