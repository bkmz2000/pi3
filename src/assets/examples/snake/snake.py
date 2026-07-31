from graphics import *
from graphics.actors import Actor

TILE_SIZE = 20
GRID_SIZE = 20


class Snake(Actor):
    def init(self):
        self.move_to(10, 10)
        self.tail = []
        self.direction = "up"
        self.next_direction = "up"
        self.score = 0
        self.grow_pending = 0

    def update(self):
        cx, cy = self.x, self.y
        if (int(cx), int(cy)) in self.tail:
            stop()
            print(f"Game Over! Score: {self.score}")
            return

        self.tail.append((int(cx), int(cy)))
        if len(self.tail) > self.score:
            self.tail.pop(0)

        if self.direction == "right":
            self.x = (cx + 1) % GRID_SIZE
        elif self.direction == "left":
            self.x = (cx - 1) % GRID_SIZE
        elif self.direction == "down":
            self.y = (cy + 1) % GRID_SIZE
        elif self.direction == "up":
            self.y = (cy - 1) % GRID_SIZE

        self.next_direction = self.direction

        if self.grow_pending > 0:
            self.score += 1
            self.grow_pending -= 1

    def draw(self):
        fill(Colors.green)
        rect(self.x * TILE_SIZE, self.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        fill(50, 170, 55)
        for tx, ty in self.tail:
            rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)


class Apple(Actor):
    def init(self):
        self.move_to(15, 15)
        self.avoid = []

    def relocate(self):
        from random import randint

        while True:
            nx = randint(0, GRID_SIZE - 1)
            ny = randint(0, GRID_SIZE - 1)
            if (nx, ny) not in self.avoid:
                break
        self.move_to(nx, ny)

    def draw(self):
        fill(Colors.red)
        circle(
            self.x * TILE_SIZE + TILE_SIZE // 2,
            self.y * TILE_SIZE + TILE_SIZE // 2,
            TILE_SIZE // 2,
        )


snake = Snake()
apple = Apple()
apple.avoid = snake.tail


def tick():
    if Keyboard.w.pressed or Keyboard.arrow_up.pressed:
        if snake.direction != "down":
            snake.next_direction = "up"
    elif Keyboard.s.pressed or Keyboard.arrow_down.pressed:
        if snake.direction != "up":
            snake.next_direction = "down"
    elif Keyboard.a.pressed or Keyboard.arrow_left.pressed:
        if snake.direction != "right":
            snake.next_direction = "left"
    elif Keyboard.d.pressed or Keyboard.arrow_right.pressed:
        if snake.direction != "left":
            snake.next_direction = "right"

    snake.direction = snake.next_direction
    snake.update()
    background(Colors.gray)
    snake.draw()
    apple.draw()

    if int(snake.x) == int(apple.x) and int(snake.y) == int(apple.y):
        apple.relocate()
        snake.grow_pending += 3


size(400, 400)
run(tick, fps=12)
