from graphics import *

W, H = 480, 360
CELL = 24
COLS = W // CELL
ROWS = H // CELL
def gen(s):
    g = [[0] * COLS for _ in range(ROWS)]
    for r in range(ROWS):
        for c in range(COLS):
            edge = r == 0 or c == 0 or r == ROWS - 1 or c == COLS - 1
            g[r][c] = 1 if edge or noise(c, r, scale=0.2, seed=s) > 0.50 else 0
    g[1][1] = 0
    g[ROWS - 2][COLS - 2] = 0
    return g


state = State(seed=42, grid=gen(42), px=1, py=1, won=False)


def step(dc, dr):
    nc, nr = state.px + dc, state.py + dr
    if 0 <= nc < COLS and 0 <= nr < ROWS and not state.grid[nr][nc]:
        state.px, state.py = nc, nr
        if (state.px, state.py) == (COLS - 2, ROWS - 2):
            state.won = True


def tick():
    if Keyboard.r.pressed or (state.won and Keyboard.space.pressed):
        state.seed = (state.seed * 31 + 17) % 9973
        state.grid = gen(state.seed)
        state.px, state.py = 1, 1
        state.won = False

    if not state.won:
        if Keyboard.arrow_left.pressed or Keyboard.a.pressed:  step(-1,  0)
        if Keyboard.arrow_right.pressed or Keyboard.d.pressed: step( 1,  0)
        if Keyboard.arrow_up.pressed or Keyboard.w.pressed:    step( 0, -1)
        if Keyboard.arrow_down.pressed or Keyboard.s.pressed:  step( 0,  1)

    background(8, 10, 16)
    no_stroke()
    for r in range(ROWS):
        for c in range(COLS):
            if state.grid[r][c]:
                fill(lerp(Colors.slate, Colors.gray, noise(c, r, scale=0.4, seed=state.seed + 7)))
                rect(c * CELL, r * CELL, CELL, CELL)

    ex, ey = (COLS - 2) * CELL + CELL // 2, (ROWS - 2) * CELL + CELL // 2
    fill(Colors.yellow)
    circle(ex, ey, CELL // 2)
    fill(Colors.cyan)
    circle(state.px * CELL + CELL // 2, state.py * CELL + CELL // 2, CELL // 2 - 2)

    fill(Colors.silver)
    text_size(11)
    text("Arrows/WASD move   R new maze", Window.bottom_left())

    if state.won:
        fill(Colors.yellow)
        text_size(28)
        text("You escaped!  Space new maze", Window.center())


size(W, H)
run(tick, fps=30)
