from graphics import *
from graphics.actors import Rect

TILE = 32
COLS = 16
ROWS = 12
W = COLS * TILE
H = ROWS * TILE

FLOOR_WEIGHTS = {"floor_a": 3, "floor_b": 2, "floor_c": 1}
COLORS = {
    "wall":    Colors.slate,
    "floor_a": (45, 55, 90),
    "floor_b": (38, 48, 78),
    "floor_c": (50, 38, 70),
    "exit":    Colors.lime,
}

hero = Rect(TILE + TILE // 2, TILE + TILE // 2, 20, 20, color=Colors.cyan)
layer = None
won = False


def make_room():
    global layer, won
    l = TilemapLayer("room", TILE, {})
    all_cells = {(c, r) for c in range(COLS) for r in range(ROWS)}
    room = TileGroup(l, all_cells)
    room.shrink(1).fill_random(FLOOR_WEIGHTS)
    room.border().fill("wall")
    l.set(COLS - 2, ROWS - 2, "exit")
    layer = l
    hero.x = TILE + TILE // 2
    hero.y = TILE + TILE // 2
    won = False


make_room()


def tick():
    global won

    if won and Keyboard.r.pressed:
        make_room()
        return

    if not won:
        speed = 3
        vx = (1 if Keyboard.arrow_right.down or Keyboard.d.down else 0) \
           - (1 if Keyboard.arrow_left.down  or Keyboard.a.down else 0)
        vy = (1 if Keyboard.arrow_down.down  or Keyboard.s.down else 0) \
           - (1 if Keyboard.arrow_up.down    or Keyboard.w.down else 0)

        if layer.tile_at(hero.x + vx * speed, hero.y) != "wall":
            hero.vx = vx * speed
        else:
            hero.vx = 0
        if layer.tile_at(hero.x, hero.y + vy * speed) != "wall":
            hero.vy = vy * speed
        else:
            hero.vy = 0

        if layer.tile_at(hero.x, hero.y) == "exit":
            won = True

    background(Colors.black)
    no_stroke()
    for c, r, name in layer.tiles():
        fill(COLORS.get(name, (20, 20, 40)))
        rect(c * TILE, r * TILE, TILE, TILE)
    hero.draw()

    fill(Colors.white)
    text_size(13)
    text("WASD to move — reach the green exit", Window.bottom_left)

    if won:
        fill(Colors.lime)
        text_size(28)
        text("Escaped!  R for new room", Window.center)


size(W, H)
run(tick, fps=60)
