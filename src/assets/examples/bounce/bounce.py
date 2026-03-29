import graphics as g
from graphics.actors import Actor


class Ball(Actor):
    radius = 15

    @setup
    def init(self):
        self.set_coords(100, 100)

    def draw(self):
        x, y = self.get_coords()
        g.circle(x, y, self.radius * 2)


ball = Ball()

g.size(400, 400)
g.run()
