from graphics import *

W, H = 400, 360
ZONES = [Colors.teal, Colors.navy, Colors.wine]
ZONE_H = H // 3
SPEED = 3

# Build a small sprite for the chameleon body + eye
skin = Colors.lime
cham = create_sprite(10, 7)
for cy in range(1, 6):
    for cx in range(1, 9):
        set_pixel(cham, cx, cy, skin)
set_pixel(cham, 7, 2, Colors.white)
set_pixel(cham, 7, 3, Colors.black)

cx, cy = float(W // 2), float(H // 2)
hidden = False

# Hunters: simple [x, y] positions
hunters = [[80.0, 60.0], [300.0, 270.0]]
lives = 3
score = 0
done = False


def zone_color_at(x, y):
    zi = min(2, int(y / ZONE_H))
    return ZONES[zi]


def tick():
    global cx, cy, skin, hidden, lives, score, done

    if done:
        if Keyboard.r.pressed:
            done = False
            cx, cy = float(W // 2), float(H // 2)
            lives = 3
            score = 0
        return

    if Keyboard.arrow_left.down or Keyboard.a.down:  cx -= SPEED
    if Keyboard.arrow_right.down or Keyboard.d.down: cx += SPEED
    if Keyboard.arrow_up.down or Keyboard.w.down:    cy -= SPEED
    if Keyboard.arrow_down.down or Keyboard.s.down:  cy += SPEED
    cx = max(0, min(W - 30, cx))
    cy = max(0, min(H - 21, cy))

    if Keyboard.space.pressed:
        new_skin = zone_color_at(cx + 15, cy + 10)
        palette_swap(cham, skin, new_skin)
        skin = new_skin

    hidden = (skin == zone_color_at(cx + 15, cy + 10))
    score += 1

    no_stroke()
    for i, zc in enumerate(ZONES):
        fill(zc)
        rect(0, i * ZONE_H, W, ZONE_H)

    for h in hunters:
        if not hidden:
            dx, dy = cx - h[0], cy - h[1]
            d = (dx * dx + dy * dy) ** 0.5
            if d > 0:
                h[0] += dx / d * 1.4
                h[1] += dy / d * 1.4
        fill(Colors.orange)
        circle(h[0], h[1], 10)
        if not hidden and abs(h[0] - cx) < 18 and abs(h[1] - cy) < 14:
            lives -= 1
            h[0], h[1] = random(20, W - 20), random(20, H - 20)
            if lives <= 0:
                done = True

    image(cham, int(cx), int(cy), 30, 21)

    fill(Colors.white)
    text_size(12)
    text(f"{'[hidden]' if hidden else '[VISIBLE]'}  ♥{lives}  Space=camouflage  R=restart", Window.top_left)

    if done:
        fill(Colors.red)
        text_size(26)
        text("Caught!  R to restart", Window.center)


size(W, H)
run(tick, fps=60)
