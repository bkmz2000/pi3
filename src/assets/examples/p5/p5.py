from graphics import *
from graphics.actors import Actor


def draw(self):
    x, y = self.get_coords()
    fill(self.color)
    stroke("white")
    rect(x - 50, y - 50, 100, 100)


box = Actor(draw=draw, color="red")


@setup
def start():
    size(700, 410)
    box.set_coords(350, 205)


@on_mouse_move
def on_mouse_move(x, y):
    box.set_coords(x, y)


@on_mouse_click
def on_mouse_click(x, y):
    box.color = random_color()


@every(1)
def loop():
    background("black")
    box.draw()


run()
