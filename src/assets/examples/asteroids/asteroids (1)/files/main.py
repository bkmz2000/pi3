import random

from graphics import *
from graphics.actors import *

size(800, 800)


def update_asteroid(self):
    self.move_forward(2)
    if self.x > 800:
        self.set_coords(0, self.y)

    if self.x < 0:
        self.set_coords(800, self.y)

    if self.y > 800:
        self.set_coords(self.x, 0)

    if self.y < 0:
        self.set_coords(self.x, 800)


ship = Actor(image=assets.sprites.spaceship, radius=10)
bullets = []
asteroids = []

for i in range(10):
    a = Actor(image=assets.sprites.asteroid, update=update_asteroid, radius=30)
    x, y = a.random_coords()
    angle = random.randint(0, 360)
    a.set_coords(x, y)
    a.set_angle(angle)
    asteroids.append(a)


@on_mouse_click
def handle_click(x, y):
    b = Actor(image=assets.sprites.bullet, radius=10)
    b.set_coords(ship.x, ship.y)
    b.set_angle(ship.angle)
    b.move_forward(10)
    bullets.append(b)


@on_mouse_move
def handle_mouse(x, y):
    ship.point_to(x, y)


@every(1)
def loop():
    background("black")
    ship.draw()
    ship.move_forward(5)

    for b in bullets:
        b.move_forward(10)
        b.draw()

    for a in asteroids:
        if a.collides_with(ship):
            stop()
        a.update()
        a.draw()

    for b in bullets[:]:
        for a in asteroids[:]:
            if b.collides_with(a):
                asteroids.remove(a)
                bullets.remove(b)


run()
