from graphics import *
from graphics.actors import Rect


box = Rect(x=350, y=205, width=100, height=100, color="red")


def tick():
    box.move_to(Mouse.x, Mouse.y)
    if Mouse.pressed:
        box.color = random_color()
    background("black")
    box.draw()


size(700, 410)
run(tick)
