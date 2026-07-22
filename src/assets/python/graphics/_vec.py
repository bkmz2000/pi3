"""Vector types: Vector2, Point, Polar, AnchorPoint."""

import math


class Vector2:
    """2D vector with arithmetic and geometry helpers.

    Vector2(3, 4); Vector2((3, 4)); Vector2(other_vec). Mutable x, y.
    Use `Point` as an alias when reading as a position is clearer.
    """

    def __init__(self, x=0.0, y=0.0):
        if isinstance(x, Vector2):
            self.x, self.y = float(x.x), float(x.y)
        elif isinstance(x, (tuple, list)):
            self.x, self.y = float(x[0]), float(x[1])
        else:
            self.x, self.y = float(x), float(y)

    def __repr__(self):
        return f"Vector2({self.x}, {self.y})"

    def __iter__(self):
        yield self.x
        yield self.y

    def __eq__(self, other):
        if isinstance(other, Vector2):
            return self.x == other.x and self.y == other.y
        if isinstance(other, (tuple, list)) and len(other) == 2:
            return self.x == other[0] and self.y == other[1]
        return NotImplemented

    def __hash__(self):
        return hash((self.x, self.y))

    def __add__(self, other):
        ox, oy = _vec_pair(other)
        return Vector2(self.x + ox, self.y + oy)

    def __radd__(self, other):
        return self.__add__(other)

    def __sub__(self, other):
        ox, oy = _vec_pair(other)
        return Vector2(self.x - ox, self.y - oy)

    def __rsub__(self, other):
        ox, oy = _vec_pair(other)
        return Vector2(ox - self.x, oy - self.y)

    def __neg__(self):
        return Vector2(-self.x, -self.y)

    def __mul__(self, scalar):
        return Vector2(self.x * scalar, self.y * scalar)

    def __rmul__(self, scalar):
        return Vector2(self.x * scalar, self.y * scalar)

    def __truediv__(self, scalar):
        return Vector2(self.x / scalar, self.y / scalar)

    def __iadd__(self, other):
        ox, oy = _vec_pair(other)
        self.x += ox
        self.y += oy
        return self

    def __isub__(self, other):
        ox, oy = _vec_pair(other)
        self.x -= ox
        self.y -= oy
        return self

    @property
    def length(self):
        return math.sqrt(self.x * self.x + self.y * self.y)

    @property
    def length_sq(self):
        return self.x * self.x + self.y * self.y

    def distance_to(self, other):
        ox, oy = _vec_pair(other)
        dx = self.x - ox
        dy = self.y - oy
        return math.sqrt(dx * dx + dy * dy)

    def dot(self, other):
        ox, oy = _vec_pair(other)
        return self.x * ox + self.y * oy

    def normalized(self):
        n = self.length
        if n == 0:
            return Vector2(0, 0)
        return Vector2(self.x / n, self.y / n)

    def bounce_of(self, shape, at=None, restitution=1.0):
        """Reflect this velocity off a shape's surface and return the new vector.

        Mirrors the velocity across the shape's surface normal at the contact
        point `at` (ignored for a straight Line, which has a single normal)::

            ball.vel = ball.vel.bounce_of(wall)                    # perfect bounce
            ball.vel = ball.vel.bounce_of(floor, restitution=0.8)  # loses energy

        `restitution` scales the bounced speed: 1.0 keeps it, 0.5 halves it,
        values above 1.0 speed it up. The result never depends on which way the
        surface normal happens to point.
        """
        n = shape.normal_at(at)
        d = self.x * n.x + self.y * n.y
        rx = self.x - 2.0 * d * n.x
        ry = self.y - 2.0 * d * n.y
        r = float(restitution)
        return Vector2(rx * r, ry * r)


def _vec_pair(other):
    if isinstance(other, Vector2):
        return other.x, other.y
    if isinstance(other, (tuple, list)) and len(other) == 2:
        return float(other[0]), float(other[1])
    raise TypeError(f"Expected Vector2 or 2-tuple, got {type(other).__name__}")


# `Point` reads more naturally for positions; same class as Vector2.
Point = Vector2


def Polar(magnitude, angle_degrees):
    """Vector2 from a magnitude and angle in degrees.

    Angle convention matches actor.angle and actor.move(): 0° = north (up, -y),
    90° = east (+x), 180° = south (+y), 270° = west (-x) — clockwise on screen.

    Common uses:
        player.vel = Polar(120, 60)         # 120 px/frame at 60°
        bullet.vel = Polar(8, ship.angle)   # match the ship's facing
        wind = Polar(2, 90)                 # blow east
    """
    rad = math.radians(float(angle_degrees))
    return Vector2(float(magnitude) * math.sin(rad), -float(magnitude) * math.cos(rad))


class AnchorPoint(Vector2):
    """A resolved position with alignment hints for text() and say().

    Behaves as a Vector2 for arithmetic and `tile_at(anchor)`; its x/y may be
    lazy (e.g. Window.center recomputes when the canvas size changes).
    """

    def __init__(self, x, y, h_align="left", v_align="top"):
        self._x = x        # callable or number
        self._y = y
        self.h_align = h_align   # "left" | "center" | "right"
        self.v_align = v_align   # "top" | "middle" | "bottom"

    @property
    def x(self):
        return self._x() if callable(self._x) else self._x

    @x.setter
    def x(self, value):
        self._x = value

    @property
    def y(self):
        return self._y() if callable(self._y) else self._y

    @y.setter
    def y(self, value):
        self._y = value
