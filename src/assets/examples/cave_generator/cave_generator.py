# Cave generator — seed a grid from `noise()`, then smooth it with a few
# rounds of cellular automata. Each cell becomes a wall if most of its
# 8 neighbors are walls; otherwise floor. Repeat → caves emerge.
#
# Press space to regenerate with a new seed. Press s to step one more
# smoothing pass.

from graphics import *

W, H = 640, 480
size(W, H)

CELL = 8
COLS = W // CELL
ROWS = H // CELL

seed = 42
WALL_THRESHOLD = 0.55


def seed_grid(seed):
    """1 = wall, 0 = floor. Edges always wall — gives a closed cave."""
    grid = [[0] * COLS for _ in range(ROWS)]
    for r in range(ROWS):
        for c in range(COLS):
            if r == 0 or c == 0 or r == ROWS - 1 or c == COLS - 1:
                grid[r][c] = 1
            else:
                grid[r][c] = 1 if noise(c, r, scale=0.18, seed=seed) > WALL_THRESHOLD else 0
    return grid


def step(grid):
    """One cellular-automata pass: a cell becomes a wall if >= 5 of its
    8 neighbors (including itself) are walls."""
    out = [row[:] for row in grid]
    for r in range(1, ROWS - 1):
        for c in range(1, COLS - 1):
            walls = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    walls += grid[r + dr][c + dc]
            out[r][c] = 1 if walls >= 5 else 0
    return out


grid = seed_grid(seed)
# Smooth a few times so caves carve out naturally
for _ in range(4):
    grid = step(grid)


def tick():
    global grid, seed

    if Keyboard.space.pressed:
        seed = (seed * 31 + 17) % 9973
        grid = seed_grid(seed)
        for _ in range(4):
            grid = step(grid)

    if Keyboard.s.pressed:
        grid = step(grid)

    background(8, 10, 16)
    no_stroke()
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r][c]:
                # Wall — pick shade from noise so it isn't flat
                t = noise(c, r, scale=0.4, seed=seed + 99)
                fill(lerp(Colors.slate, Colors.gray, t))
                rect(c * CELL, r * CELL, CELL, CELL)

    # HUD
    fill(220, 220, 230)
    text_size(12)
    text_align("left", "top")
    text("seed " + str(seed) + "    space new    s step", 10, 10)


run(tick)
