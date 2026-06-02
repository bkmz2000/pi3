from graphics import *

CELL = 38
SIZE = 10
PALETTE = [Colors.red, Colors.blue, Colors.lime, Colors.yellow, Colors.sky, Colors.wine]
MAX_MOVES = 22

board = create_sprite(SIZE, SIZE)
for py in range(SIZE):
    for px in range(SIZE):
        set_pixel(board, px, py, PALETTE[int(random(len(PALETTE)))])

moves = 0
done = False


def all_same():
    c = get_pixel(board, 0, 0)
    return all(get_pixel(board, px, py) == c for py in range(SIZE) for px in range(SIZE))


def tick():
    global moves, done
    background(Colors.slate)

    no_stroke()
    for row in range(SIZE):
        for col in range(SIZE):
            fill(get_pixel(board, col, row))
            rect(20 + col * CELL, 20 + row * CELL, CELL, CELL)

    fill(Colors.white)
    text_size(14)
    text(f"Moves: {moves} / {MAX_MOVES}", Window.top_right)

    for i, c in enumerate(PALETTE):
        bx = 20 + i * 64
        by = SIZE * CELL + 30
        fill(c)
        rect(bx, by, 56, 34)
        if not done and Mouse.pressed and bx <= Mouse.x <= bx + 56 and by <= Mouse.y <= by + 34:
            flood_fill(board, 0, 0, c)
            moves += 1
            done = all_same() or moves >= MAX_MOVES

    if done:
        text_size(24)
        fill(Colors.lime if all_same() else Colors.red)
        text("You win!" if all_same() else "No moves left!", Window.center)


size(20 + SIZE * CELL + 40, SIZE * CELL + 80)
run(tick, fps=30)
