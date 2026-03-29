from graphics import *
import random

def create_asteroid(size="big", pos=None):
    if size == "big":
        a = Actor(image=assets.sprites.big_asteroid, size=size, radius=30)
    if size == "small":
        a = Actor(image=assets.sprites.small_asteroid, size=size, radius=10)

    if pos is None:
        pos = a.random_coords()

    x, y = pos
    a.set_coords(x, y)

    a.set_angle(random.randint(0, 360))
    asteroids.append(a)

@on_mouse_click
def shoot(x, y):
    b = Actor(image=assets.sprites.bullet, radius=10)
    b.set_coords(ship.x, ship.y)
    b.set_angle(ship.angle)
    b.move_forward(10)
    bullets.append(b)

@every(1)
def loop():
    background("black")
    ship.point_to(mouse_x(), mouse_y())
    ship.move_forward(5)
    ship.draw()

    for b in bullets[:]:
        b.move_forward(10)
        b.draw()

    for a in asteroids:
        if a.size == "big":
            a.move_forward(2)
        if a.size == "small":
            a.move_forward(3)

        x, y = a.get_coords()
        x = (x+800)%800
        y = (y+800)%800
        a.set_coords(x, y)
        a.draw()

        if a.collides_with(ship):
                print("You lost!")
                stop()

    for a in asteroids[:]:
        for b in bullets[:]:
            if a.collides_with(b):
                if a.size == "big":
                    for i in range(3):
                        create_asteroid("small", a.get_coords())
                asteroids.remove(a)
                bullets.remove(b)

size(800, 800)

ship = Actor(image=assets.sprites.ship, radius=15)
bullets = []
asteroids = []

for i in range(10):
    create_asteroid("big")

run()