"""Slime Runner — endless side-scroller using sprites from the project sheet.

Space / Up arrow — jump.
Dodge the slimes and collect coins for bonus points!

The hero's animation switches automatically:
  idle  → standing still
  run   → moving
  jump  → in the air
"""

from graphics import *

W, H = 480, 270
GROUND = 210        # hero y when standing
SPEED  = 3          # obstacle scroll speed
GRAVITY = 0.6
JUMP_V  = -11

hero = Actor(assets.sheet.hero, x=80, y=GROUND, scale=2)

obstacles = [
    Actor(assets.sheet.slime, x=600, y=GROUND + 6, scale=2),
    Actor(assets.sheet.slime, x=900, y=GROUND + 6, scale=2),
]
coins = [
    Actor(assets.sheet.coin, x=500, y=GROUND - 30, scale=2),
    Actor(assets.sheet.coin, x=750, y=GROUND - 30, scale=2),
]

state = State(vy=0, on_ground=True, score=0, alive=True, distance=0)


def reset_actor(actor, base_y, spread=400):
    actor.x = W + random(spread)
    actor.y = base_y


def tick():
    background(Colors.sky)

    # Scrolling ground
    fill(Colors.green)
    rect(0, GROUND + 32, W, H)
    fill(Colors.lime)
    rect(0, GROUND + 28, W, 8)

    if state.alive:
        state.distance += 1

        # Physics
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

        # Scroll obstacles & coins
        for s in obstacles:
            s.x -= SPEED
            if s.x < -40:
                reset_actor(s, GROUND + 6)

        for c in coins:
            c.x -= SPEED
            if c.x < -40:
                reset_actor(c, GROUND - 30)

        # Coin pickup
        for c in list(coins):
            if c.is_alive() and hero.collides_with(c):
                c.die()
                state.score += 5

        # Collision with slimes
        for s in obstacles:
            if hero.collides_with(s):
                state.alive = False

    # Draw coins (spinning)
    for c in coins:
        if c.is_alive():
            c.spin.tick()
            c.draw()

    # Draw slimes (bobbing idle)
    for s in obstacles:
        s.idle.tick()
        s.draw()

    # Hero animation based on state
    if not state.alive:
        hero.jump.tick()          # slumped pose
        hero.flip_y = True
    elif not state.on_ground:
        hero.jump.tick()
    elif state.distance % 2 == 0:  # run at half-tick rate looks better at scale=2
        hero.run.tick()
    else:
        hero.idle.tick()

    hero.draw()

    # HUD
    no_stroke()
    fill(Colors.white)
    text_size(14)
    text(f"Score: {state.score}", 8, 20)
    text(f"Distance: {state.distance // 60}m", 8, 40)

    if not state.alive:
        fill(Colors.red)
        text_size(22)
        text("Game Over!", Window.center)
        text_size(13)
        fill(Colors.white)
        text("Press R to restart", Window.bottom)
        if Keyboard.r.pressed:
            stop()


size(W, H)
run(tick, fps=60)
