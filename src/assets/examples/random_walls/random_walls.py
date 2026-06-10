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

SCALES = [0.06, 0.10, 0.16, 0.24, 0.40]
threshold = 0.5
state = State(scale_idx=2, seed=7)


def tick():
    if Keyboard.arrow_left.pressed:
        state.scale_idx = max(0, state.scale_idx - 1)
    if Keyboard.arrow_right.pressed:
        state.scale_idx = min(len(SCALES) - 1, state.scale_idx + 1)
    if Keyboard.space.pressed:
        state.seed = (state.seed * 31 + 17) % 9973

    background(20, 22, 30)
    s = SCALES[state.scale_idx]
    no_stroke()

    for col in range(COLS):
        for row in range(ROWS):
            n = noise(col, row, scale=s, seed=state.seed)
            if n > threshold:
                # Wall — slight color variation from a second noise channel
                shade = noise(col, row, scale=s * 2, seed=state.seed + 1)
                fill(lerp(Colors.slate, Colors.gray, shade))
            else:
                # Floor
                fill(Colors.navy)
            rect(col * CELL, row * CELL, CELL, CELL)

    # HUD
    fill(220, 220, 230)
    text_size(12)
    text_align("left", "top")
    text("scale " + str(s) + "   seed " + str(state.seed), 10, 10)
    text("← / →  change scale     space  new seed", 10, 28)


run(tick)
