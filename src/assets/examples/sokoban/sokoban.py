from graphics import *
from graphics.actors import Actor

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

for x in range(10):
    for y in range(10):
        if board[y][x] == 2:
            boxes.append([x, y])

walls = []

for x in range(10):
    for y in range(10):
        if board[y][x] == 1:
            walls.append([x, y])

goal = []

for x in range(10):
    for y in range(10):
        if board[y][x] == 3:
            goal.append([x, y])

px = 7
py = 4

stroke("black")


@on_key_press("w", "arrow_up")
def move_up():
    try_move(0, -1)


@on_key_press("s", "arrow_down")
def move_down():
    try_move(0, 1)


@on_key_press("a", "arrow_left")
def move_left():
    try_move(-1, 0)


@on_key_press("d", "arrow_right")
def move_right():
    try_move(1, 0)


def try_move(dx, dy):
    global px, py
    if [px + dx, py + dy] not in boxes and [px + dx, py + dy] not in walls:
        py = py + dy
        px = px + dx
    elif [px + dx, py + dy] in boxes:
        print("box", boxes)
        if [px + 2 * dx, py + 2 * dy] not in boxes and [
            px + 2 * dx,
            py + 2 * dy,
        ] not in walls:
            boxes.remove([px + dx, py + dy])
            boxes.append([px + 2 * dx, py + 2 * dy])
            py = py + dy
            px = px + dx


@every(5)
def draw():
    background("black")

    for i in range(len(goal)):
        x = goal[i][0]
        y = goal[i][1]

        fill("brown")
        rect(x * 30 + 7.5, y * 30 + 7.5, 15, 15)

    for x in range(10):
        for y in range(10):
            if board[y][x] == 1:
                fill("yellow")
                rect(x * 30, y * 30, 30, 30)

            if x == px and y == py:
                fill("blue")
                rect(x * 30, y * 30, 30, 30)

    left = 0
    for i in range(len(boxes)):
        x = boxes[i][0]
        y = boxes[i][1]

        if [x, y] in goal:
            fill("green")
            rect(x * 30, y * 30, 30, 30)
            rect(x * 30 + 7.5, y * 30 + 7.5, 15, 15)
        else:
            fill("brown")
            rect(x * 30, y * 30, 30, 30)
            fill("black")
            rect(x * 30 + 7.5, y * 30 + 7.5, 15, 15)
            left = left + 1
    if left == 0:
        print("You won!!!")


run()
