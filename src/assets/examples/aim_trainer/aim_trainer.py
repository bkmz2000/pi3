from graphics import *

W, H = 600, 420
targets = []   # [x, y, radius, max_radius, decay]
state = State(score=0, streak=0, missed=0)
MAX_MISSED = 5


def spawn():
    x = random(50, W - 50)
    y = random(60, H - 40)
    r = random(18, 38)
    targets.append([x, y, r, r, random(0.25, 0.6)])


spawn()
spawn()
spawn()


def tick():
    background(Colors.black)
    clicked = Mouse.pressed
    hit = False

    for t in targets[:]:
        t[2] -= t[4]
        if t[2] <= 0:
            targets.remove(t)
            state.missed += 1
            state.streak = 0
            spawn()
            continue

        frac = t[2] / t[3]
        fill(lerp(Colors.red, Colors.lime, frac))
        no_stroke()
        circle(t[0], t[1], t[2])

        if clicked and not hit:
            dist = ((Mouse.x - t[0]) ** 2 + (Mouse.y - t[1]) ** 2) ** 0.5
            if dist < t[2]:
                state.score += 1
                state.streak += 1
                targets.remove(t)
                spawn()
                hit = True

    if len(targets) < 2:
        spawn()

    fill(Colors.white)
    no_stroke()
    text_size(16)
    text(f"Score: {state.score}   Streak: {state.streak}", Window.top_left)
    fill(Colors.red)
    text("✕" * state.missed + "○" * (MAX_MISSED - state.missed), Window.top_right)

    if state.missed >= MAX_MISSED:
        fill(Colors.orange)
        text_size(30)
        text(f"Final score: {state.score}", Window.center)
        stop()


size(W, H)
run(tick, fps=60)
