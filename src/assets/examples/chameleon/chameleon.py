from graphics import *

W, H = 400, 360
ZONES = [Colors.teal, Colors.navy, Colors.wine]
ZONE_H = H // 3
SPEED = 3

# Build a small sprite for the chameleon body + eye
cham = create_sprite(10, 7)
for _cy in range(1, 6):
    for _cx in range(1, 9):
        set_pixel(cham, _cx, _cy, Colors.lime)
set_pixel(cham, 7, 2, Colors.white)
set_pixel(cham, 7, 3, Colors.black)

state = State(
    cx=float(W // 2), cy=float(H // 2),
    skin=Colors.lime,
    hidden=False,
    lives=3, score=0, done=False,
)

# Hunters: simple [x, y] positions
hunters = [[80.0, 60.0], [300.0, 270.0]]


def zone_color_at(x, y):
    zi = min(2, int(y / ZONE_H))
    return ZONES[zi]


def tick():
    if state.done:
        if Keyboard.r.pressed:
            state.done = False
            state.cx, state.cy = float(W // 2), float(H // 2)
            state.lives = 3
            state.score = 0
        return

    if Keyboard.arrow_left.down or Keyboard.a.down:  state.cx -= SPEED
    if Keyboard.arrow_right.down or Keyboard.d.down: state.cx += SPEED
    if Keyboard.arrow_up.down or Keyboard.w.down:    state.cy -= SPEED
    if Keyboard.arrow_down.down or Keyboard.s.down:  state.cy += SPEED
    state.cx = max(0, min(W - 30, state.cx))
    state.cy = max(0, min(H - 21, state.cy))

    if Keyboard.space.pressed:
        new_skin = zone_color_at(state.cx + 15, state.cy + 10)
        palette_swap(cham, state.skin, new_skin)
        state.skin = new_skin

    state.hidden = (state.skin == zone_color_at(state.cx + 15, state.cy + 10))
    state.score += 1

    no_stroke()
    for i, zc in enumerate(ZONES):
        fill(zc)
        rect(0, i * ZONE_H, W, ZONE_H)

    for h in hunters:
        if not state.hidden:
            dx, dy = state.cx - h[0], state.cy - h[1]
            d = (dx * dx + dy * dy) ** 0.5
            if d > 0:
                h[0] += dx / d * 1.4
                h[1] += dy / d * 1.4
        fill(Colors.orange)
        circle(h[0], h[1], 10)
        if not state.hidden and abs(h[0] - state.cx) < 18 and abs(h[1] - state.cy) < 14:
            state.lives -= 1
            h[0], h[1] = random(20, W - 20), random(20, H - 20)
            if state.lives <= 0:
                state.done = True

    image(cham, int(state.cx), int(state.cy), 30, 21)

    fill(Colors.white)
    text_size(12)
    text(f"{'[hidden]' if state.hidden else '[VISIBLE]'}  ♥{state.lives}  Space=camouflage  R=restart", Window.top_left)

    if state.done:
        fill(Colors.red)
        text_size(26)
        text("Caught!  R to restart", Window.center)


size(W, H)
run(tick, fps=60)
