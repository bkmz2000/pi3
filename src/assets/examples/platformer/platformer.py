"""Platformer starter — uses the built-in `assets.platformer` library.

Arrow keys to walk, space to jump. Try swapping `assets.platformer.hero`
for `assets.platformer.player` or `.warrior` and re-run — same code,
different look.
"""

from graphics import *

size(800, 450)

# Library sprites. Type `assets.platformer.` to see all options.
hero = Actor(assets.platformer.hero, x=120, y=300, scale=0.6)
ground = [Actor(assets.platformer.tile_grass, x=x, y=400, scale=0.6)
          for x in range(0, 1600, 42)]
coins = [Actor(assets.platformer.coin, x=x, y=340, scale=0.4)
         for x in range(300, 1500, 200)]

cam = Camera(hero)
vy = 0
on_ground = False
score = 0


def main():
    global vy, on_ground, score

    # Gravity
    vy += 0.6
    hero.y += vy

    # Horizontal input
    if Keyboard.arrow_left.down:
        hero.x -= 4
        hero.flip_x = True
    elif Keyboard.arrow_right.down:
        hero.x += 4
        hero.flip_x = False

    # Jump
    if Keyboard.space.pressed and on_ground:
        vy = -12

    # Ground collision
    on_ground = False
    for t in ground:
        if hero.collides_with(t):
            hero.y = t.y - 42
            vy = 0
            on_ground = True
            break

    # Coin pickup
    for c in list(coins):
        if hero.collides_with(c):
            c.die()
            coins.remove(c)
            score += 1

    # Draw
    background(60, 140, 220)
    with cam:
        for t in ground:
            t.draw()
        for c in coins:
            c.draw()
        hero.draw()

    fill(255)
    text_size(20)
    text(f"Coins: {score}", 20, 30)


run(main)
