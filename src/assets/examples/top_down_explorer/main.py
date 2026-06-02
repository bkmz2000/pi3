from graphics import *
from graphics.actors import Rect

TILE = 32
MAP = [
    "##################",
    "#c..c..##..c..c..#",
    "#.....##...^.....#",
    "#.##..........##.#",
    "#.##.c...c....##.#",
    "#.c.....^..c.....#",
    "#......###.......#",
    "#......#.#...c...#",
    "#c.....#.#.......#",
    "#..####...####...#",
    "#.c....c.......c.#",
    "##################",
]
COLS = len(MAP[0])
ROWS = len(MAP)
W, H = COLS * TILE, ROWS * TILE

layer = TilemapLayer("ground", TILE, {})
walls, coins, spikes = [], [], []
for r, row in enumerate(MAP):
    for c, ch in enumerate(row):
        name = {"#": "wall", "c": "coin", "^": "spike", ".": "floor"}.get(ch, "floor")
        layer.set(c, r, name)
        if ch == "#": walls.append((c, r))
        elif ch == "c": coins.append((c, r))
        elif ch == "^": spikes.append((c, r))

level = TileMap([layer], {"ground": layer}, {
    "walls":  {"cells": walls},
    "spikes": {"cells": spikes},
})

hero = Rect(TILE + TILE // 2, TILE + TILE // 2, 22, 22, color=Colors.cyan)
score = 0
lives = 3

COLORS = {"wall": Colors.slate, "floor": Colors.navy,
          "coin": Colors.yellow, "spike": Colors.red}


def tick():
    global score, lives

    speed = 2
    vx = (1 if Keyboard.arrow_right.down or Keyboard.d.down else 0) \
       - (1 if Keyboard.arrow_left.down  or Keyboard.a.down else 0)
    vy = (1 if Keyboard.arrow_down.down  or Keyboard.s.down else 0) \
       - (1 if Keyboard.arrow_up.down    or Keyboard.w.down else 0)
    hero.vx = vx * speed
    hero.vy = vy * speed

    if level.collides_with(hero.future_state, "walls"):
        hero.vx = 0
        hero.vy = 0

    if level.collides_with(hero.future_state, "spikes"):
        lives -= 1
        hero.x = TILE + TILE // 2
        hero.y = TILE + TILE // 2
        if lives <= 0:
            stop()

    col = int(hero.x / TILE)
    row = int(hero.y / TILE)
    if layer.tile_at(hero.x, hero.y) == "coin":
        score += 1
        layer.set(col, row, "floor")

    background(Colors.black)
    no_stroke()
    for r in range(ROWS):
        for c in range(COLS):
            tile = layer.get_tile(c, r)
            if tile:
                fill(COLORS.get(tile, Colors.black))
                rect(c * TILE, r * TILE, TILE, TILE)
    hero.draw()

    fill(Colors.white)
    text_size(14)
    text(f"★ {score}  ♥ {lives}  WASD to move", Window.top_left)
    if lives <= 0:
        fill(Colors.red)
        text_size(28)
        text("Game Over!", Window.center)


size(W, H)
run(tick, fps=60)
