import graphics as g
from graphics.actors import Circle


class Ball(Circle):
    def init(self):
        self.vy = 4

    def bounce(self):
        if self.y > g.height() - self.radius or self.y < self.radius:
            self.vy = -self.vy


ball = Ball(x=200, y=100, radius=20, color=g.Colors.cyan)


def tick():
    g.background("black")
    ball.move()
    ball.bounce()
    ball.draw()


g.size(400, 400)
g.run(tick, fps=60)
