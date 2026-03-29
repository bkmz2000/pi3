import apple_cfg
import graphics as g
import snake_cfg
from graphics.actors import Actor

g.size(400, 400)

snake = Actor.from_cfg(snake_cfg)
apple = Actor.from_cfg(apple_cfg)

apple.avoid = snake.tail


@g.on_key_press("w", "arrow_up")
def go_up():
    if snake.direction != "down":
        snake.next_direction = "up"


@g.on_key_press("s", "arrow_down")
def go_down():
    if snake.direction != "up":
        snake.next_direction = "down"


@g.on_key_press("a", "arrow_left")
def go_left():
    if snake.direction != "right":
        snake.next_direction = "left"


@g.on_key_press("d", "arrow_right")
def go_right():
    if snake.direction != "left":
        snake.next_direction = "right"


@g.every(5)
def game_loop():
    snake.direction = snake.next_direction
    snake.update()
    g.background("grey")
    snake.draw()
    apple.draw()

    sx, sy = snake.get_coords()
    ax, ay = apple.get_coords()
    if sx == ax and sy == ay:
        apple.relocate()
        snake.grow_pending += 3


g.run()
