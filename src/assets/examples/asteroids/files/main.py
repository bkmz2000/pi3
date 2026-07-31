from graphics import *
from graphics.actors import Actor, Group
import random as _r  # aliased: graphics already exports random()


def create_asteroid(size="big", pos=None):
    if size == "big":
        a = Actor(image=assets.sheet.big_asteroid, scale=3, size="big")
        a.collider.set_circle(30)
    if size == "small":
        a = Actor(image=assets.sheet.small_asteroid, scale=2, size="small")
        a.collider.set_circle(10)

    if pos is None:
        pos = Actor.random_coords()

    a.move_to(*pos)
    a.angle = _r.randint(0, 360)
    asteroids.add(a)


ship = Actor(image=assets.sheet.ship, scale=3)
ship.collider.set_circle(15)

bullets = Group()
asteroids = Group()

for i in range(10):
    create_asteroid("big")


def tick():
    background("black")

    ship.point_towards(Mouse.x, Mouse.y)
    ship.forward(5)
    ship.wrap()
    ship.draw()

    if Mouse.pressed:
        b = Actor()
        b.collider.set_circle(4)
        b.move_to(ship.x, ship.y)
        b.angle = ship.angle
        b.forward(10)
        bullets.add(b)

    no_stroke()
    fill(Colors.white)
    for b in bullets:
        b.forward(10)
        circle(b.x, b.y, 4)
        for a in asteroids:
            if b.collides_with(a):
                if a not in asteroids:
                    continue
                bullets.remove(b)

                if a.size == "big":
                    for i in range(3):
                        create_asteroid("small", (a.x, a.y))
                asteroids.remove(a)
                b.die()

    for a in asteroids:
        a.forward(2)
        a.wrap()
        a.draw()

        if a.collides_with(ship):
            print("You lost!")
            stop()


size(500, 500)
run(tick)
