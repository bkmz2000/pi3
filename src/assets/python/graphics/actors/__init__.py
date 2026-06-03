"""
Actor system for the graphics module.

Provides Actor base class, Rect and Circle subclasses,
Group for managing collections of actors, and Collider for hitbox configuration.
"""

import math
import random


class Collider:
    """Hitbox for an actor. Attach via actor.collider.set_circle() or set_rect()."""

    def __init__(self, actor):
        self._actor = actor
        self.shape = None   # "circle" | "rect" | None
        self.radius = 0.0
        self.width = 0.0
        self.height = 0.0
        self.dx = 0.0       # offset from actor center
        self.dy = 0.0

    def set_circle(self, radius, *, dx=0, dy=0):
        self.shape = "circle"
        self.radius = float(radius)
        self.dx = float(dx)
        self.dy = float(dy)

    def set_rect(self, width, height, *, dx=0, dy=0):
        self.shape = "rect"
        self.width = float(width)
        self.height = float(height)
        self.dx = float(dx)
        self.dy = float(dy)

    def disable(self):
        self.shape = None

    @property
    def active_x(self):
        return self._actor._x + self.dx

    @property
    def active_y(self):
        return self._actor._y + self.dy


class Actor:
    _registry = []
    _id_counter = 0

    def __init__(self, asset=None, **kwargs):
        Actor._id_counter += 1
        self._id = Actor._id_counter

        self._x = 0.0
        self._y = 0.0
        self._angle = 0.0
        self._vx = 0.0
        self._vy = 0.0
        self._visible = True
        self._alive = True
        self.image = None
        self.scale = 1.0
        self.flip_x = False
        self.flip_y = False
        self.collider = Collider(self)
        self._anim_controllers = {}
        self._active_anim_ctrl = None
        self._last_active_anim = None

        # First positional arg can be an asset dict (sprite/animation result)
        if asset is not None:
            self.image = asset
            if isinstance(asset, dict):
                w = asset.get("width")
                h = asset.get("height")
                if w and h:
                    self.collider.set_rect(float(w), float(h))

        for key, value in kwargs.items():
            if hasattr(self.__class__, key) and isinstance(
                getattr(self.__class__, key), property
            ):
                setattr(self, key, value)
            else:
                object.__setattr__(self, key, value)

        Actor._registry.append(self)

        if hasattr(self, "init"):
            self.init()

    # --- properties ---

    @property
    def x(self):
        return self._x

    @x.setter
    def x(self, value):
        self._x = float(value)

    @property
    def y(self):
        return self._y

    @y.setter
    def y(self, value):
        self._y = float(value)

    @property
    def angle(self):
        return self._angle

    @angle.setter
    def angle(self, value):
        self._angle = float(value) % 360

    @property
    def vx(self):
        return self._vx

    @vx.setter
    def vx(self, value):
        self._vx = float(value)

    @property
    def vy(self):
        return self._vy

    @vy.setter
    def vy(self, value):
        self._vy = float(value)

    @property
    def pos(self):
        from graphics import Vector2
        return Vector2(self._x, self._y)

    @pos.setter
    def pos(self, value):
        from graphics import Vector2
        v = value if isinstance(value, Vector2) else Vector2(value)
        self._x = v.x
        self._y = v.y

    @property
    def vel(self):
        from graphics import Vector2
        return Vector2(self._vx, self._vy)

    @vel.setter
    def vel(self, value):
        from graphics import Vector2
        v = value if isinstance(value, Vector2) else Vector2(value)
        self._vx = v.x
        self._vy = v.y

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = bool(value)

    @property
    def collidable(self):
        return self.collider.shape is not None

    # --- anchor points (depend on collider shape for sizing) ---

    def _half_size(self):
        col = self.collider
        if col.shape == "circle":
            return col.radius, col.radius
        if col.shape == "rect":
            return col.width / 2, col.height / 2
        # Fall back to sprite dimensions when no explicit collider is set.
        img = self.image
        import graphics as _g
        if isinstance(img, _g.SpriteEntry):
            sprite = img._default_sprite()
            if sprite is not None:
                return sprite.width / 2, sprite.height / 2
        if isinstance(img, dict):
            w = img.get("width")
            h = img.get("height")
            if w and h:
                return w / 2, h / 2
        return 0, 0

    @property
    def center(self):
        from graphics import AnchorPoint
        return AnchorPoint(self._x, self._y, "center", "middle")

    @property
    def top(self):
        from graphics import AnchorPoint
        _, hy = self._half_size()
        return AnchorPoint(self._x, self._y - hy, "center", "bottom")

    @property
    def bottom(self):
        from graphics import AnchorPoint
        _, hy = self._half_size()
        return AnchorPoint(self._x, self._y + hy, "center", "top")

    @property
    def left(self):
        from graphics import AnchorPoint
        hx, _ = self._half_size()
        return AnchorPoint(self._x - hx, self._y, "right", "middle")

    @property
    def right(self):
        from graphics import AnchorPoint
        hx, _ = self._half_size()
        return AnchorPoint(self._x + hx, self._y, "left", "middle")

    @property
    def top_left(self):
        from graphics import AnchorPoint
        hx, hy = self._half_size()
        return AnchorPoint(self._x - hx, self._y - hy, "right", "bottom")

    @property
    def top_right(self):
        from graphics import AnchorPoint
        hx, hy = self._half_size()
        return AnchorPoint(self._x + hx, self._y - hy, "left", "bottom")

    @property
    def bottom_left(self):
        from graphics import AnchorPoint
        hx, hy = self._half_size()
        return AnchorPoint(self._x - hx, self._y + hy, "right", "top")

    @property
    def bottom_right(self):
        from graphics import AnchorPoint
        hx, hy = self._half_size()
        return AnchorPoint(self._x + hx, self._y + hy, "left", "top")

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        try:
            image = object.__getattribute__(self, 'image')
        except AttributeError:
            raise AttributeError(f"'{type(self).__name__}' has no attribute '{name}'")
        import graphics as _g
        if isinstance(image, _g.SpriteEntry):
            anims = object.__getattribute__(image, '_animations')
            if name in anims:
                ctrl_map = object.__getattribute__(self, '_anim_controllers')
                if name not in ctrl_map:
                    ctrl_map[name] = _g.AnimationController(self, name)
                return ctrl_map[name]
        raise AttributeError(f"'{type(self).__name__}' has no attribute '{name}'")

    # --- movement ---

    def move(self, distance):
        if not self._alive:
            return
        rad = math.radians(self._angle)
        self._x += distance * math.sin(rad)
        self._y -= distance * math.cos(rad)

    def move_to(self, x, y):
        if not self._alive:
            return
        self._x = float(x)
        self._y = float(y)

    def change_x_by(self, dx):
        if not self._alive:
            return
        self._x += float(dx)

    def change_y_by(self, dy):
        if not self._alive:
            return
        self._y += float(dy)

    def point_towards(self, x, y):
        if not self._alive:
            return
        dx = x - self._x
        dy = y - self._y
        self._angle = math.degrees(math.atan2(dx, -dy)) % 360

    def rotate(self, degrees):
        if not self._alive:
            return
        self._angle = (self._angle + float(degrees)) % 360

    # --- spatial helpers ---

    def random_position(self):
        """Teleport so the full hitbox is inside the canvas."""
        import graphics as g
        col = self.collider
        if col.shape == "circle":
            mx = my = col.radius
        elif col.shape == "rect":
            mx = col.width / 2
            my = col.height / 2
        else:
            mx = my = 0
        w, h = g._width, g._height
        self._x = g.random(mx, w - mx) if w > 2 * mx else w / 2
        self._y = g.random(my, h - my) if h > 2 * my else h / 2

    def wrap_x(self):
        """If actor leaves left/right edge, appear on the opposite side."""
        import graphics as g
        if self._x < 0:
            self._x += g._width
        elif self._x > g._width:
            self._x -= g._width

    def wrap_y(self):
        """If actor leaves top/bottom edge, appear on the opposite side."""
        import graphics as g
        if self._y < 0:
            self._y += g._height
        elif self._y > g._height:
            self._y -= g._height

    def wrap(self):
        """Wrap in both x and y."""
        self.wrap_x()
        self.wrap_y()

    def in_bounds(self) -> bool:
        """True if actor center is within the canvas."""
        import graphics as g
        return 0 <= self._x <= g._width and 0 <= self._y <= g._height

    # --- velocity (called by game loop) ---

    def _apply_velocity(self):
        if not self._alive:
            return
        if self._vx != 0 or self._vy != 0:
            self._x += self._vx
            self._y += self._vy

    # --- lifecycle ---

    def update(self):
        pass

    def draw(self):
        if not self._alive or not self._visible:
            return
        if self.image:
            import graphics as g
            g.push()
            g.translate(self._x, self._y)
            g.rotate(self._angle)
            sx = self.scale * (-1.0 if self.flip_x else 1.0)
            sy = self.scale * (-1.0 if self.flip_y else 1.0)
            if sx != 1.0 or sy != 1.0:
                g.scale(sx, sy)
            img = self.image
            if isinstance(img, g.SpriteEntry):
                ctrl = self._active_anim_ctrl
                sprite = None
                if ctrl is not None:
                    anim = img._animations.get(ctrl._anim_name)
                    if anim and anim._frames:
                        sprite = anim[ctrl._frame_idx]
                if sprite is None:
                    sprite = img._default_sprite()
                if sprite is not None:
                    sw, sh = sprite.width, sprite.height
                    g._draw_commands.append((
                        "sprite",
                        (bytes(sprite.pixels), int(sw), int(sh),
                         float(-sw / 2), float(-sh / 2), None, None),
                        {},
                    ))
                if ctrl is not None:
                    ctrl._ticked_this_frame = False
            elif isinstance(img, dict) and img.get("done"):
                if "anim_name" in img:
                    anim_name = img["anim_name"]
                    frame_idx = img.get("frame_idx", 0)
                    g._draw_commands.append(("animation_frame_centered", (anim_name, frame_idx, 0.0, 0.0, None, None), {}))
                elif "name" in img:
                    name = img["name"]
                    g._draw_commands.append(("image_centered", (name, 0.0, 0.0, None, None), {}))
            else:
                g._draw_commands.append(("image_centered", (str(img), 0.0, 0.0, None, None), {}))
            g.pop()
            if g._show_hitboxes:
                # Hitbox is drawn outside the scale transform: collider dimensions
                # are in world units, so collision math and overlay must match.
                g.push()
                g.translate(self._x, self._y)
                g.rotate(self._angle)
                sf, sfc, ss, ssc, ssw = g._current_fill, g._fill_color, g._current_stroke, g._stroke_color, g._stroke_width
                col = self.collider
                g.no_fill()
                g.stroke(0, 255, 0)
                g.stroke_width(1)
                if col.shape == "circle":
                    g.circle(col.dx, col.dy, col.radius)
                elif col.shape == "rect":
                    g.rect(col.dx - col.width / 2, col.dy - col.height / 2, col.width, col.height)
                g._current_fill, g._fill_color = sf, sfc
                g._current_stroke, g._stroke_color, g._stroke_width = ss, ssc, ssw
                g._draw_commands.append(("fill", sfc, {}) if sf else ("no_fill", (), {}))
                g._draw_commands.append(("stroke", ssc, {}) if ss else ("no_stroke", (), {}))
                g._draw_commands.append(("stroke_width", (ssw,), {}))
                g.pop()

    def reset(self):
        """Restore all sprite frames to their original pixel data.

        Useful to undo procedural pixel edits and re-apply them with a fresh
        random seed::

            sun.reset()
            for pixel in sun:
                if random.random() > 0.3:
                    pixel.color = Colors.orange
        """
        import graphics as _g
        image = object.__getattribute__(self, 'image')
        if isinstance(image, _g.SpriteEntry):
            for anim in image._animations.values():
                for frame in anim._frames:
                    frame.reset()
        elif isinstance(image, _g.SheetAnimation):
            for frame in image._frames:
                frame.reset()
        elif isinstance(image, _g.Sprite):
            image.reset()

    def __iter__(self):
        """Iterate over pixels of the default sprite frame, yielding PixelView objects.

            for pixel in sun:
                if pixel == Colors.red:
                    pixel.color = Colors.orange
        """
        import graphics as _g
        image = object.__getattribute__(self, 'image')
        sprite = None
        if isinstance(image, _g.SpriteEntry):
            sprite = image._default_sprite()
        elif isinstance(image, _g.SheetAnimation):
            sprite = image._default_sprite()
        elif isinstance(image, _g.Sprite):
            sprite = image
        if sprite is not None:
            yield from sprite

    def die(self):
        if not self._alive:
            return
        self._alive = False
        if self in Actor._registry:
            Actor._registry.remove(self)

    def is_alive(self):
        return self._alive

    # --- collision ---

    def collides_with(self, other):
        if not self._alive or not other._alive:
            return False

        sc = self.collider
        oc = other.collider

        if sc.shape is None or oc.shape is None:
            return False

        sx, sy = sc.active_x, sc.active_y
        ox, oy = oc.active_x, oc.active_y

        if sc.shape == "circle" and oc.shape == "circle":
            dx = sx - ox
            dy = sy - oy
            return dx * dx + dy * dy < (sc.radius + oc.radius) ** 2

        if sc.shape == "circle" and oc.shape == "rect":
            return _circle_rect_hit(sx, sy, sc.radius, ox, oy, oc.width / 2, oc.height / 2)
        if sc.shape == "rect" and oc.shape == "circle":
            return _circle_rect_hit(ox, oy, oc.radius, sx, sy, sc.width / 2, sc.height / 2)

        if sc.shape == "rect" and oc.shape == "rect":
            return (
                sx - sc.width / 2 < ox + oc.width / 2
                and sx + sc.width / 2 > ox - oc.width / 2
                and sy - sc.height / 2 < oy + oc.height / 2
                and sy + sc.height / 2 > oy - oc.height / 2
            )

        return False

    def collides_any(self, group):
        if not self._alive:
            return None
        for other in group:
            if self.collides_with(other):
                return other
        return None

    @property
    def future_state(self):
        """Snapshot at the position the actor will occupy after one velocity step."""
        return ActorSnapshot(self)

    # --- static helpers ---

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


class ActorSnapshot:
    """Read-only one-frame-lookahead view of an actor.

    Exposes `collides_with` and `collides_any` evaluated at the position the
    source actor will occupy after one `_apply_velocity` step. Computation
    mirrors `_apply_velocity` exactly so the prediction matches the next frame.
    The source actor's state is unchanged by use of the snapshot.
    """

    def __init__(self, actor):
        self._actor = actor
        nx = actor._x
        ny = actor._y
        if actor._vx != 0 or actor._vy != 0:
            nx += actor._vx
            ny += actor._vy
        self._x = nx
        self._y = ny
        self._alive = actor._alive

    def collides_with(self, other):
        # Temporarily reposition the actor, reuse its collision math, restore.
        actor = self._actor
        ox, oy = actor._x, actor._y
        try:
            actor._x = self._x
            actor._y = self._y
            return actor.collides_with(other)
        finally:
            actor._x = ox
            actor._y = oy

    def collides_any(self, group):
        if not self._alive:
            return None
        for other in group:
            if self.collides_with(other):
                return other
        return None


def _circle_rect_hit(cx, cy, cr, rx, ry, hw, hh):
    closest_x = max(rx - hw, min(cx, rx + hw))
    closest_y = max(ry - hh, min(cy, ry + hh))
    dx = cx - closest_x
    dy = cy - closest_y
    return dx * dx + dy * dy < cr * cr


class Rect(Actor):
    """A rectangle actor that draws itself centered at (x, y)."""

    def __init__(self, x=0, y=0, width=60, height=40, color="white",
                 stroke_color=None, stroke_width=0, **kwargs):
        super().__init__(x=x, y=y, **kwargs)
        self.width = float(width)
        self.height = float(height)
        self.color = color
        self.stroke_color = stroke_color
        self.stroke_width = float(stroke_width)
        self.collider.set_rect(self.width, self.height)

    def draw(self):
        if not self._alive or not self._visible:
            return
        import graphics as g
        g.push()
        g.translate(self._x, self._y)
        g.rotate(self._angle)
        if self.stroke_color is not None:
            g.stroke(self.stroke_color)
            g.stroke_width(self.stroke_width)
        else:
            g.no_stroke()
        g.fill(self.color)
        g.rect(-self.width / 2, -self.height / 2, self.width, self.height)
        if g._show_hitboxes:
            sf, sfc, ss, ssc, ssw = g._current_fill, g._fill_color, g._current_stroke, g._stroke_color, g._stroke_width
            col = self.collider
            g.no_fill()
            g.stroke(0, 255, 0)
            g.stroke_width(1)
            if col.shape == "rect":
                g.rect(col.dx - col.width / 2, col.dy - col.height / 2, col.width, col.height)
            elif col.shape == "circle":
                g.circle(col.dx, col.dy, col.radius)
            g._current_fill, g._fill_color = sf, sfc
            g._current_stroke, g._stroke_color, g._stroke_width = ss, ssc, ssw
            g._draw_commands.append(("fill", sfc, {}) if sf else ("no_fill", (), {}))
            g._draw_commands.append(("stroke", ssc, {}) if ss else ("no_stroke", (), {}))
            g._draw_commands.append(("stroke_width", (ssw,), {}))
        g.pop()


class Circle(Actor):
    """A circle actor that draws itself centered at (x, y)."""

    def __init__(self, x=0, y=0, radius=30, color="white",
                 stroke_color=None, stroke_width=0, **kwargs):
        super().__init__(x=x, y=y, **kwargs)
        self.radius = float(radius)
        self.color = color
        self.stroke_color = stroke_color
        self.stroke_width = float(stroke_width)
        self.collider.set_circle(self.radius)

    def draw(self):
        if not self._alive or not self._visible:
            return
        import graphics as g
        g.push()
        g.translate(self._x, self._y)
        g.rotate(self._angle)
        if self.stroke_color is not None:
            g.stroke(self.stroke_color)
            g.stroke_width(self.stroke_width)
        else:
            g.no_stroke()
        g.fill(self.color)
        g.circle(0, 0, self.radius)
        if g._show_hitboxes:
            sf, sfc, ss, ssc, ssw = g._current_fill, g._fill_color, g._current_stroke, g._stroke_color, g._stroke_width
            col = self.collider
            g.no_fill()
            g.stroke(0, 255, 0)
            g.stroke_width(1)
            if col.shape == "circle":
                g.circle(col.dx, col.dy, col.radius)
            elif col.shape == "rect":
                g.rect(col.dx - col.width / 2, col.dy - col.height / 2, col.width, col.height)
            g._current_fill, g._fill_color = sf, sfc
            g._current_stroke, g._stroke_color, g._stroke_width = ss, ssc, ssw
            g._draw_commands.append(("fill", sfc, {}) if sf else ("no_fill", (), {}))
            g._draw_commands.append(("stroke", ssc, {}) if ss else ("no_stroke", (), {}))
            g._draw_commands.append(("stroke_width", (ssw,), {}))
        g.pop()


class Group:
    """A collection of actors with safe iteration during modification."""

    def __init__(self):
        self._actors = []

    def add(self, actor):
        self._actors.append(actor)

    def remove(self, actor):
        if actor in self._actors:
            self._actors.remove(actor)

    def __iter__(self):
        self._actors = [a for a in self._actors if a.is_alive()]
        return iter(list(self._actors))

    def __len__(self):
        return len(self._actors)

    def __bool__(self):
        return len(self._actors) > 0
