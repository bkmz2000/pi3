from graphics import *

W, H = 480, 400
CELL = 16
COLS = W // CELL
ROWS = H // CELL


def smooth(g):
    out = [row[:] for row in g]
    for r in range(1, ROWS - 1):
        for c in range(1, COLS - 1):
            w = sum(g[r + dr][c + dc] for dr in (-1, 0, 1) for dc in (-1, 0, 1))
            out[r][c] = 1 if w >= 5 else 0
    return out


def gen_cave(s):
    g = [[0] * COLS for _ in range(ROWS)]
    for r in range(ROWS):
        for c in range(COLS):
            edge = r == 0 or c == 0 or r == ROWS - 1 or c == COLS - 1
            g[r][c] = 1 if edge or noise(c, r, scale=0.18, seed=s) > 0.52 else 0
    for _ in range(3):
        g = smooth(g)
    g[1][COLS // 2] = 0
    g[ROWS - 2][COLS // 2] = 0
    return g


def place_gems(g, n=8):
    gems = []
    tries = 0
    while len(gems) < n and tries < 500:
        tries += 1
        gc = int(random(1, COLS - 1))
        gr = int(random(ROWS // 2, ROWS - 2))
        if not g[gr][gc] and [gc, gr] not in gems:
            gems.append([gc, gr])
    return gems


_g = gen_cave(7)
state = State(seed=7, grid=_g, gems=place_gems(_g),
              px=COLS // 2, py=1, air=100.0, score=0, done=False, win=False)


def try_move(dc, dr):
    nc, nr = state.px + dc, state.py + dr
    if 0 <= nc < COLS and 0 <= nr < ROWS and not state.grid[nr][nc]:
        state.px, state.py = nc, nr


def reset():
    state.seed = (state.seed * 31 + 17) % 9973
    state.grid = gen_cave(state.seed)
    state.gems = place_gems(state.grid)
    state.px, state.py = COLS // 2, 1
    state.air, state.score, state.done, state.win = 100.0, 0, False, False


def tick():
    if state.done and Keyboard.r.pressed:
        reset()
        return

    if not state.done:
        if Keyboard.arrow_left.pressed or Keyboard.a.pressed:  try_move(-1,  0)
        if Keyboard.arrow_right.pressed or Keyboard.d.pressed: try_move( 1,  0)
        if Keyboard.arrow_up.pressed or Keyboard.w.pressed:    try_move( 0, -1)
        if Keyboard.arrow_down.pressed or Keyboard.s.pressed:  try_move( 0,  1)
        state.air -= 0.25
        for g in state.gems[:]:
            if g[0] == state.px and g[1] == state.py:
                state.gems.remove(g)
                state.air = min(100, state.air + 25)
                state.score += 10
        if state.air <= 0 or state.py >= ROWS - 2:
            state.done = True
            state.win = state.py >= ROWS - 2

    background(8, 10, 16)
    no_stroke()
    for r in range(ROWS):
        for c in range(COLS):
            if state.grid[r][c]:
                fill(lerp(Colors.slate, Colors.navy, noise(c, r, scale=0.4, seed=state.seed)))
                rect(c * CELL, r * CELL, CELL, CELL)
    for g in state.gems:
        fill(Colors.cyan)
        circle(g[0] * CELL + CELL // 2, g[1] * CELL + CELL // 2, CELL // 3)
    fill(Colors.lime)
    circle(state.px * CELL + CELL // 2, state.py * CELL + CELL // 2, CELL // 2 - 2)

    fill(Colors.navy)
    rect(8, 8, 104, 12)
    fill(lerp(Colors.red, Colors.sky, max(0, state.air / 100)))
    rect(8, 8, int(state.air), 12)
    fill(Colors.white)
    text_size(11)
    text(f"Air   Score: {state.score}", 118, 8)

    if state.done:
        text_size(26)
        fill(Colors.lime if state.win else Colors.red)
        text(f"{'Surface!' if state.win else 'Suffocated!'}  Score {state.score}  R retry", Window.center())


size(W, H)
run(tick, fps=30)
