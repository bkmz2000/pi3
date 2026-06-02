from graphics import *
from graphics.actors import Rect, Circle, Group

FRUIT_COLORS = [Colors.red, Colors.yellow, Colors.orange, Colors.wine, Colors.lime]

score = 0
lives = 3
frame = 0

basket = Rect(x=250, y=370, width=80, height=20, color=Colors.orange)
falling = Group()


def spawn():
    idx = int(random(0, len(FRUIT_COLORS)))
    c = Circle(x=random(20, 480), y=-15, radius=14, color=FRUIT_COLORS[idx])
    c.vy = random(2, 5)
    falling.add(c)


def tick():
    global score, lives, frame
    frame += 1

    background(Colors.black)

    if Keyboard.arrow_left.down or Keyboard.a.down:
        basket.x -= 5
    if Keyboard.arrow_right.down or Keyboard.d.down:
        basket.x += 5
    basket.x = max(40, min(460, basket.x))

    if frame % 50 == 0:
        spawn()

    for fruit in falling:
        if basket.collides_with(fruit):
            score += 1
            fruit.die()
        elif fruit.y > height() + 20:
            lives -= 1
            fruit.die()
        else:
            fruit.draw()

    basket.draw()

    no_stroke()
    text_size(18)
    fill(Colors.white)
    text(f"Score: {score}", Window.top_left)
    text(f"{'♥' * lives}", Window.top_right)

    if lives <= 0:
        text_size(32)
        fill(Colors.red)
        text("Game Over!", Window.center)
        stop()


size(500, 400)
run(tick)
