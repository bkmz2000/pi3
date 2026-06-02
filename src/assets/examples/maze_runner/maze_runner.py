from graphics import *

W, H = 480, 360
CELL = 24
COLS = W // CELL
ROWS = H // CELL
seed = 42


def gen(s):
    g = [[0] * COLS for _ in range(ROWS)]
    for r in range(ROWS):
        for c in range(COLS):
            edge = r == 0 or c == 0 or r == ROWS - 1 or c == COLS - 1
            g[r][c] = 1 if edge or noise(c, r, scale=0.2, seed=s) > 0.50 else 0
    g[1][1] = 0
    g[ROWS - 2][COLS - 2] = 0
    return g


grid = gen(seed)
px, py = 1, 1
won = False


def move(dc, dr):
    global px, py, won
    nc, nr = px + dc, py + dr
    if 0 <= nc < COLS and 0 <= nr < ROWS and not grid[nr][nc]:
        px, py = nc, nr
        if (px, py) == (COLS - 2, ROWS - 2):
            won = True


def tick():
    global grid, seed, px, py, won

    if Keyboard.r.pressed or (won and Keyboard.space.pressed):
        seed = (seed * 31 + 17) % 9973
        grid = gen(seed)
        px, py = 1, 1
        won = False

    if not won:
        if Keyboard.arrow_left.pressed or Keyboard.a.pressed:  move(-1,  0)
        if Keyboard.arrow_right.pressed or Keyboard.d.pressed: move( 1,  0)
        if Keyboard.arrow_up.pressed or Keyboard.w.pressed:    move( 0, -1)
        if Keyboard.arrow_down.pressed or Keyboard.s.pressed:  move( 0,  1)

    background(8, 10, 16)
    no_stroke()
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r][c]:
                fill(lerp(Colors.slate, Colors.gray, noise(c, r, scale=0.4, seed=seed + 7)))
                rect(c * CELL, r * CELL, CELL, CELL)

    ex, ey = (COLS - 2) * CELL + CELL // 2, (ROWS - 2) * CELL + CELL // 2
    fill(Colors.yellow)
    circle(ex, ey, CELL // 2)
    fill(Colors.cyan)
    circle(px * CELL + CELL // 2, py * CELL + CELL // 2, CELL // 2 - 2)

    fill(Colors.silver)
    text_size(11)
    text("Arrows/WASD move   R new maze", Window.bottom_left)

    if won:
        fill(Colors.yellow)
        text_size(28)
        text("You escaped!  Space new maze", Window.center)


size(W, H)
run(tick, fps=30)
