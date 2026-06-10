from graphics import *
from graphics.actors import Circle

SPEED = 4
COLORS = [Colors.cyan, Colors.sky, Colors.white, Colors.sky]
W, H = 400, 400

ball = Circle(x=200, y=200, radius=18, color=COLORS[0])
ball.vx = SPEED
ball.vy = SPEED

state = State(tick_count=0)


def tick():
    state.tick_count += 1

    background(Colors.black)

    ball.move()

    # Arrow-key control
    if Keyboard.arrow_left.down:   ball.vx = -SPEED
    if Keyboard.arrow_right.down:  ball.vx = SPEED
    if Keyboard.arrow_up.down:     ball.vy = -SPEED
    if Keyboard.arrow_down.down:   ball.vy = SPEED

    # Bounce off edges
    bounced = False
    if ball.x < ball.radius or ball.x > W - ball.radius:
        ball.vx = -ball.vx
        ball.x = max(ball.radius, min(W - ball.radius, ball.x))
        bounced = True
    if ball.y < ball.radius or ball.y > H - ball.radius:
        ball.vy = -ball.vy
        ball.y = max(ball.radius, min(H - ball.radius, ball.y))
        bounced = True

    if bounced:
        ball.color = Colors.orange
        # assets.sounds.bounce.play()  # add a bounce.wav to hear the hit
    else:
        # Cycle through COLORS every 8 ticks to animate
        ball.color = COLORS[(state.tick_count // 8) % len(COLORS)]

    ball.draw()


size(W, H)
run(tick)
