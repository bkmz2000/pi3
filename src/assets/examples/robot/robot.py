from graphics import *
from graphics.actors import Rect, Circle

phrases = [
    "Hello, World!",
    "I love making games!",
    "Python is awesome!",
]
current = 0

head = Circle(x=250, y=155, radius=38, color=Colors.cyan)
body = Rect(x=250, y=245, width=72, height=90, color=Colors.blue)


def tick():
    global current

    background(Colors.black)

    if Keyboard.key_1.pressed:
        current = 0
    elif Keyboard.key_2.pressed:
        current = 1
    elif Keyboard.key_3.pressed:
        current = 2

    body.draw()
    head.draw()

    # Eyes
    no_stroke()
    fill(Colors.white)
    circle(head.x - 13, head.y - 6, 10)
    circle(head.x + 13, head.y - 6, 10)
    fill(Colors.black)
    circle(head.x - 13, head.y - 6, 5)
    circle(head.x + 13, head.y - 6, 5)

    # Mouth
    stroke(Colors.white)
    stroke_width(3)
    no_fill()
    line(head.x - 14, head.y + 14, head.x + 14, head.y + 14)

    # Speech bubble above the robot's head
    no_stroke()
    say(phrases[current], head.top)

    # Hint at the bottom
    fill(Colors.gray)
    text_size(13)
    text("Press 1, 2 or 3 to change phrase", Window.bottom)


size(500, 400)
run(tick)
