from graphics import *
from graphics.actors import Actor, Group
import random


def create_asteroid(size="big", pos=None):
    if size == "big":
        a = Actor(image=assets.sprites.big_asteroid)
        a.collider.set_circle(30)
    if size == "small":
        a = Actor(image=assets.sprites.small_asteroid)
        a.collider.set_circle(10)

    if pos is None:
        pos = Actor.random_coords()

    a.move_to(*pos)
    a.angle = random.randint(0, 360)
    a.size = size
    asteroids.add(a)


ship = Actor(image=assets.sprites.ship)
ship.collider.set_circle(15)

bullets = Group()
asteroids = Group()

for i in range(10):
    create_asteroid("big")


def tick():
    background("black")

    ship.point_towards(Mouse.x, Mouse.y)
    ship.move(5)
    ship.wrap()
    ship.draw()

    if Mouse.pressed:
        b = Actor(image=assets.sprites.bullet)
        b.collider.set_circle(10)
        b.move_to(ship.x, ship.y)
        b.angle = ship.angle
        b.move(10)
        bullets.add(b)

    for b in bullets:
        b.move(10)
        b.draw()
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
        a.move(2)
        a.wrap()
        a.draw()

        if a.collides_with(ship):
            print("You lost!")
            stop()


size(800, 800)
run(tick)
