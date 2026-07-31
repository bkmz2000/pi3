"""Coin Hop — collect all coins before the slime catches you!

Arrow keys to move and jump.
Collect every spinning coin to win. Don't let the slime touch you!

This example shows how to:
  - Use sprites from your sheet: assets.sheet.hero, .slime, .coin
  - Switch animations based on what the character is doing
  - Give a simple enemy basic follow-along movement
"""

from graphics import *

W, H = 400, 240
GROUND = 185
GRAVITY = 0.55
JUMP_V  = -10
WALK    = 3
SLIME_V = 1.2

hero = Actor(assets.sheet.hero, x=60, y=GROUND, scale=2)
slime = Actor(assets.sheet.slime, x=340, y=GROUND + 8, scale=2)

coins = [
    Actor(assets.sheet.coin, x=x, y=y, scale=2)
    for x, y in [(120, GROUND), (200, GROUND - 50), (280, GROUND),
                 (160, GROUND - 90), (240, GROUND - 90)]
]

state = State(vy=0, on_ground=True, won=False, lost=False, moving=False)


def tick():
    background(Colors.midnight)

    # Ground platform
    fill(Colors.slate)
    rect(0, GROUND + 32, W, H)
    fill(Colors.sky)
    rect(0, GROUND + 28, W, 5)

    if not state.won and not state.lost:
        # Horizontal movement
        state.moving = False
        if Keyboard.arrow_left.down:
            hero.x -= WALK
            hero.flip_x = True
            state.moving = True
        if Keyboard.arrow_right.down:
            hero.x += WALK
            hero.flip_x = False
            state.moving = True

        hero.x = max(16, min(W - 16, hero.x))

        # Jump
        state.vy += GRAVITY
        hero.y += state.vy
        if hero.y >= GROUND:
            hero.y = GROUND
            state.vy = 0
            state.on_ground = True
        else:
            state.on_ground = False

        if (Keyboard.space.pressed or Keyboard.arrow_up.pressed) and state.on_ground:
            state.vy = JUMP_V

        # Slime follows hero
        if hero.x > slime.x:
            slime.x += SLIME_V
            slime.flip_x = False
        elif hero.x < slime.x:
            slime.x -= SLIME_V
            slime.flip_x = True

        # Coin pickup
        for c in list(coins):
            if c.is_alive() and hero.collides_with(c):
                c.die()

        state.won  = all(not c.is_alive() for c in coins)
        state.lost = slime.collides_with(hero)

    # Draw coins
    for c in coins:
        if c.is_alive():
            c.spin.tick()
            c.draw()

    # Draw slime
    slime.idle.tick()
    slime.draw()

    # Hero animation
    if not state.on_ground:
        hero.jump.tick()
    elif state.moving:
        hero.run.tick()
    else:
        hero.idle.tick()
    hero.draw()

    # HUD
    remaining = sum(1 for c in coins if c.is_alive())
    fill(Colors.white)
    text_size(13)
    text(f"Coins left: {remaining}", 8, 18)

    if state.won:
        fill(Colors.lime)
        text_size(22)
        text("You win!", Window.center())
    elif state.lost:
        fill(Colors.red)
        text_size(22)
        text("Caught!", Window.center())


size(W, H)
run(tick, fps=60)
