"""PixelView — single-pixel reference into a Sprite buffer."""

from graphics._color import _to_rgb

_TRANSPARENT = (0, 0, 0, 0)


class PixelView:
    """Mutable reference to a single pixel inside a Sprite.

    Yielded by iterating a Sprite or an Actor::

        for pixel in sun:
            if pixel == Colors.red:
                pixel.color = Colors.orange  # writes back to the sprite

    .. note::
        ``pixel = Colors.orange`` only rebinds the loop variable in Python
        and does **not** write back.  Use ``pixel.color = ...`` or
        ``pixel.set(...)`` to mutate the sprite.

    Comparison against any color value (tuple, hex string, palette name)
    works on both sides::

        pixel == Colors.red
        Colors.red == pixel
        pixel == (255, 0, 0)

    Transparent pixels compare equal only to ``None``.
    """

    __slots__ = ("_sprite", "_x", "_y")

    def __init__(self, sprite, x, y):
        self._sprite = sprite
        self._x = int(x)
        self._y = int(y)

    @property
    def x(self):
        return self._x

    @property
    def y(self):
        return self._y

    @property
    def color(self):
        """Current (r, g, b) color, or None if transparent."""
        i = self._sprite._idx(self._x, self._y)
        if i < 0:
            return None
        p = self._sprite.pixels
        if p[i + 3] == 0:
            return None
        return (p[i], p[i + 1], p[i + 2])

    @color.setter
    def color(self, value):
        i = self._sprite._idx(self._x, self._y)
        if i < 0:
            return
        p = self._sprite.pixels
        if value is None:
            p[i] = p[i + 1] = p[i + 2] = p[i + 3] = 0
            return
        r, g, b = _to_rgb(value)
        p[i] = r
        p[i + 1] = g
        p[i + 2] = b
        p[i + 3] = 255

    def set(self, color):
        """Write a new color (same as ``pixel.color = color``)."""
        self.color = color

    def __eq__(self, other):
        c = self.color
        if other is None:
            return c is None
        if c is None:
            return False
        r, g, b = c
        try:
            or_, og, ob = _to_rgb(other)
        except Exception:
            return NotImplemented
        return r == or_ and g == og and b == ob

    def __repr__(self):
        return f"Pixel({self._x}, {self._y}, {self.color})"
