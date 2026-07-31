from graphics import *

TILE_SIZE = 40

board = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 1, 0, 2, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 0, 2, 0, 1, 0],
    [0, 1, 3, 0, 2, 2, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

boxes = []
walls = []
goals = []

for x in range(10):
    for y in range(10):
        tile = board[y][x]
        if tile == 1:
            walls.append([x, y])
        elif tile == 2:
            boxes.append([x, y])
        elif tile == 3:
            goals.append([x, y])

state = State(px=7, py=4)


def try_move(dx, dy):
    target = [state.px + dx, state.py + dy]
    if target not in boxes and target not in walls:
        state.px += dx
        state.py += dy
    elif target in boxes:
        push = [state.px + 2 * dx, state.py + 2 * dy]
        if push not in boxes and push not in walls:
            boxes.remove(target)
            boxes.append(push)
            state.px += dx
            state.py += dy


def tick():
    if Keyboard.w.pressed or Keyboard.arrow_up.pressed:
        try_move(0, -1)
    elif Keyboard.s.pressed or Keyboard.arrow_down.pressed:
        try_move(0, 1)
    elif Keyboard.a.pressed or Keyboard.arrow_left.pressed:
        try_move(-1, 0)
    elif Keyboard.d.pressed or Keyboard.arrow_right.pressed:
        try_move(1, 0)

    background(Colors.black)

    for gx, gy in goals:
        fill(Colors.wine)
        rect(gx * 30 + 7.5, gy * 30 + 7.5, 15, 15)

    for wx, wy in walls:
        fill(Colors.yellow)
        rect(wx * 30, wy * 30, 30, 30)

    fill(Colors.blue)
    rect(state.px * 30, state.py * 30, 30, 30)

    left = 0
    for bx, by in boxes:
        if [bx, by] in goals:
            fill(Colors.green)
            rect(bx * 30, by * 30, 30, 30)
            rect(bx * 30 + 7.5, by * 30 + 7.5, 15, 15)
        else:
            fill(Colors.wine)
            rect(bx * 30, by * 30, 30, 30)
            fill(Colors.black)
            rect(bx * 30 + 7.5, by * 30 + 7.5, 15, 15)
            left += 1

    if left == 0:
        print("You won!!!")


size(300, 300)
run(tick, fps=12)
