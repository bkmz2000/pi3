"""
Actor base class for the graphics module.

Use Actor() directly or Actor.from_cfg() for config-based creation.
"""

import math
import random
from types import MethodType

RECT = "rect"
CIRCLE = "circle"


class Actor:
    _registry = []
    _id_counter = 0

    def __init__(self, **kwargs):
        Actor._id_counter += 1
        self._id = Actor._id_counter

        self._x = 0.0
        self._y = 0.0
        self._angle = 0.0
        self._vx = 0.0
        self._vy = 0.0
        self._visible = True
        self._collidable = True
        self._alive = True

        self._state = {}

        self.image = None
        self._update_func = None
        self._draw_func = None

        for key, value in kwargs.items():
            if key == "update":
                self._update_func = MethodType(value, self)
            elif key == "draw":
                self._draw_func = MethodType(value, self)
            else:
                if callable(value):
                    setattr(self, key, MethodType(value, self))
                else:
                    super().__setattr__(key, value)

        Actor._registry.append(self)

        if hasattr(self, "init"):
            self.init()

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )

    def __setattr__(self, name, value):
        super().__setattr__(name, value)

    def update(self):
        if self._update_func:
            self._update_func()

    def draw(self):
        import graphics

        if self._draw_func:
            self._draw_func()
        elif self.image:
            x, y = self.get_coords()
            img = self.image["img"]
            w = img.width if hasattr(img, "width") else 0
            h = img.height if hasattr(img, "height") else 0
            graphics.push()
            graphics.translate(x, y)
            graphics.rotate(self._angle)
            graphics.image(self.image, -w / 2, -h / 2)
            graphics.pop()

        if graphics._show_hitboxes:
            self._draw_hitbox()

    def _draw_hitbox(self):
        import graphics

        x, y = self.get_coords()
        graphics.push()
        graphics.no_fill()
        graphics.stroke(255, 0, 0)
        graphics.stroke_width(1)
        if hasattr(self, "radius"):
            graphics.circle(x, y, self.radius)
        else:
            img = self.image["img"] if self.image else None
            if img:
                w = img.width if hasattr(img, "width") else 0
                h = img.height if hasattr(img, "height") else 0
                graphics.rect(x - w / 2, y - h / 2, w, h)
        graphics.pop()

    def point_to(self, x, y):
        dx = x - self._x
        dy = y - self._y
        angle_rad = math.atan2(dy, dx)
        angle_deg = angle_rad * 180.0 / math.pi
        self._angle = angle_deg

    def set_coords(self, x, y):
        self._x = float(x)
        self._y = float(y)

    def get_coords(self):
        return (self._x, self._y)

    def get_x(self):
        return self._x

    def get_y(self):
        return self._y

    def rotate_clockwise(self, degrees):
        self._angle = (self._angle + float(degrees)) % 360

    def get_angle(self):
        return self._angle

    def set_angle(self, degrees):
        self._angle = float(degrees) % 360

    def move_forward(self, distance):
        angle_rad = self._angle * math.pi / 180.0
        self._x += float(distance) * math.cos(angle_rad)
        self._y += float(distance) * math.sin(angle_rad)

    def move_left(self, distance):
        self._x -= float(distance)

    def move_right(self, distance):
        self._x += float(distance)

    def move_up(self, distance):
        self._y -= float(distance)

    def move_down(self, distance):
        self._y += float(distance)

    def set_speed(self, vx, vy):
        self._vx = float(vx)
        self._vy = float(vy)

    def get_speed(self):
        return (self._vx, self._vy)

    def move(self, distance):
        if self._vx != 0 or self._vy != 0:
            self._x += self._vx
            self._y += self._vy
        else:
            self.move_forward(distance)

    @property
    def x(self):
        return self._x

    @property
    def y(self):
        return self._y

    @property
    def angle(self):
        return self._angle

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = bool(value)

    @property
    def collidable(self):
        return self._collidable

    @collidable.setter
    def collidable(self, value):
        self._collidable = bool(value)

    def hide(self):
        self._visible = False
        self._collidable = False

    def ghost(self):
        self._visible = True
        self._collidable = False

    def die(self):
        self._alive = False
        if self in Actor._registry:
            Actor._registry.remove(self)

    def is_alive(self):
        return self._alive

    def bring_to_front(self):
        if self in Actor._registry:
            Actor._registry.remove(self)
            Actor._registry.append(self)

    def send_to_back(self):
        if self in Actor._registry:
            Actor._registry.remove(self)
            Actor._registry.insert(0, self)

    @staticmethod
    def all_actors():
        return list(Actor._registry)

    @staticmethod
    def random_coords():
        import graphics

        try:
            w = graphics.width() or 400
            h = graphics.height() or 400
        except Exception:
            w = 400
            h = 400
        return (random.randint(0, int(w)), random.randint(0, int(h)))

    def collides_with(self, other):
        if not self._collidable or not other._collidable:
            return False

        if hasattr(self, "radius") and hasattr(other, "radius"):
            dx = self._x - other._x
            dy = self._y - other._y
            dist_sq = dx * dx + dy * dy
            radius_sum = self.radius + other.radius
            return dist_sq < radius_sum * radius_sum

        ax, ay = self._x, self._y
        bx, by = other._x, other._y

        aw = 0
        ah = 0
        if hasattr(self, "width") and hasattr(self, "height"):
            aw = self.width
            ah = self.height
        elif hasattr(self, "radius"):
            r = self.radius
            ax = self._x - r
            ay = self._y - r
            aw = r * 2
            ah = r * 2

        bw = 0
        bh = 0
        if hasattr(other, "width") and hasattr(other, "height"):
            bw = other.width
            bh = other.height
        elif hasattr(other, "radius"):
            r = other.radius
            bw = r * 2
            bh = r * 2

        return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by

    @classmethod
    def from_cfg(cls, module):
        from graphics.actors.config import from_cfg

        return from_cfg(module)
