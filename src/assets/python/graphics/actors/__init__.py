"""
Actor system for the graphics module.

Provides Actor base class, Rect and Circle subclasses,
Group for managing collections of actors, and Collider for hitbox configuration.
"""

import math
import random

from graphics._errors import FriendlyError, FriendlyAttrError, _compute_suggestions

# Valid kwargs for Actor (and broadly for Rect/Circle) — used for typo detection.
_ACTOR_KWARG_ATTRS = frozenset([
    'x', 'y', 'vx', 'vy', 'angle', 'image', 'scale', 'flip_x', 'flip_y',
    'pos', 'vel', 'visible',
    'width', 'height', 'radius', 'color', 'stroke_color', 'stroke_width',
])

# Per-class cache for suggestion candidates.
_CLASS_ATTRS_CACHE: dict = {}


def _get_class_attrs(cls):
    if cls not in _CLASS_ATTRS_CACHE:
        _CLASS_ATTRS_CACHE[cls] = frozenset(n for n in dir(cls) if not n.startswith('_'))
    return _CLASS_ATTRS_CACHE[cls]


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
        # Check for kwarg typos BEFORE anything else.
        for key in kwargs:
            if key not in _ACTOR_KWARG_ATTRS:
                sug = _compute_suggestions(key, _ACTOR_KWARG_ATTRS, max_distance=1)
                if sug:
                    raise FriendlyError(
                        "friendlyError.naming.actorKwargTypo",
                        {"name": key, "nearest": sug[0]},
                        raw=f"Unknown Actor keyword argument '{key}'. Did you mean '{sug[0]}'?",
                    )

        Actor._id_counter += 1
        # All builtin attrs are set via object.__setattr__ to bypass the sealing hook.
        object.__setattr__(self, '_id', Actor._id_counter)
        object.__setattr__(self, '_sealed', False)
        object.__setattr__(self, '_x', 0.0)
        object.__setattr__(self, '_y', 0.0)
        object.__setattr__(self, '_angle', 0.0)
        object.__setattr__(self, '_vx', 0.0)
        object.__setattr__(self, '_vy', 0.0)
        object.__setattr__(self, '_visible', True)
        object.__setattr__(self, '_alive', True)
        object.__setattr__(self, 'image', None)
        object.__setattr__(self, 'scale', 1.0)
        object.__setattr__(self, 'flip_x', False)
        object.__setattr__(self, 'flip_y', False)
        object.__setattr__(self, 'collider', Collider(self))
        object.__setattr__(self, '_anim_controllers', {})
        object.__setattr__(self, '_active_anim_ctrl', None)
        object.__setattr__(self, '_last_active_anim', None)

        if asset is not None:
            object.__setattr__(self, 'image', asset)
            if isinstance(asset, dict):
                w = asset.get("width")
                h = asset.get("height")
                if w and h:
                    self.collider.set_rect(float(w), float(h))

        # Process kwargs: properties via their setter, plain attrs via object.__setattr__.
        for key, value in kwargs.items():
            cls_attr = None
            for cls in type(self).__mro__:
                if key in cls.__dict__:
                    cls_attr = cls.__dict__[key]
                    break
            if isinstance(cls_attr, property):
                if cls_attr.fset:
                    cls_attr.fset(self, value)
            else:
                object.__setattr__(self, key, value)

        Actor._registry.append(self)

        # Call init() (if defined on a subclass) BEFORE sealing so it can
        # declare custom attrs via self.xxx = yyy.
        _init_fn = getattr(type(self), 'init', None)
        if _init_fn is not None:
            self.init()

        object.__setattr__(self, '_sealed', True)

    # --- attribute access hooks ---

    def __setattr__(self, name, value):
        if name.startswith('_'):
            object.__setattr__(self, name, value)
            return
        # Property descriptor check.
        for cls in type(self).__mro__:
            if name in cls.__dict__:
                d = cls.__dict__[name]
                if isinstance(d, property):
                    if d.fset:
                        d.fset(self, value)
                    return
                break
        # Sealed: only allow attrs that already exist in the instance dict.
        sealed = object.__getattribute__(self, '_sealed')
        if sealed and name not in self.__dict__:
            class_attrs = _get_class_attrs(type(self))
            instance_attrs = {k for k in self.__dict__ if not k.startswith('_')}
            candidates = list(class_attrs | instance_attrs)
            sug = _compute_suggestions(name, candidates)
            raise FriendlyAttrError(
                "friendlyError.naming.actorSealed",
                {"actor": type(self).__name__, "name": name},
                suggestions=[{"token": name, "candidates": sug}] if sug else [],
                raw=f"'{type(self).__name__}' actor has no attribute '{name}'",
            )
        object.__setattr__(self, name, value)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        # Animation controller lookup.
        try:
            image = object.__getattribute__(self, 'image')
        except AttributeError:
            image = None
        if image is not None:
            import graphics as _g
            if isinstance(image, _g.SpriteEntry):
                anims = object.__getattribute__(image, '_animations')
                if name in anims:
                    ctrl_map = object.__getattribute__(self, '_anim_controllers')
                    if name not in ctrl_map:
                        ctrl_map[name] = _g.AnimationController(self, name)
                    return ctrl_map[name]
        # Sealed attribute error with suggestions.
        try:
            sealed = object.__getattribute__(self, '_sealed')
        except AttributeError:
            sealed = False
        if sealed:
            class_attrs = _get_class_attrs(type(self))
            instance_attrs = {k for k in self.__dict__ if not k.startswith('_')}
            candidates = list(class_attrs | instance_attrs)
            sug = _compute_suggestions(name, candidates)
            raise FriendlyAttrError(
                "friendlyError.naming.actorUnknown",
                {"actor": type(self).__name__, "name": name},
                suggestions=[{"token": name, "candidates": sug}] if sug else [],
                raw=f"'{type(self).__name__}' has no attribute '{name}'",
            )
        raise AttributeError(f"'{type(self).__name__}' has no attribute '{name}'")

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

    # --- movement ---

    def move(self):
        """Apply vx/vy to position once — the manual physics step."""
        self._apply_velocity()

    def forward(self, distance):
        """Move along the current facing direction."""
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

    def distance_to(self, other):
        """Distance in pixels from this actor's center to another actor or (x, y)."""
        if isinstance(other, Actor):
            dx = other._x - self._x
            dy = other._y - self._y
        else:
            dx = float(other[0]) - self._x
            dy = float(other[1]) - self._y
        return math.sqrt(dx * dx + dy * dy)

    def bounce(self):
        """Reverse vx/vy when the actor's hitbox touches a canvas edge."""
        import graphics as g
        col = self.collider
        if col.shape == "circle":
            mx = my = col.radius
        elif col.shape == "rect":
            mx = col.width / 2
            my = col.height / 2
        else:
            mx = my = 0.0
        if self._x - mx < 0 or self._x + mx > g._width:
            self._vx = -self._vx
        if self._y - my < 0 or self._y + my > g._height:
            self._vy = -self._vy

    def keep_in_bounds(self):
        """Clamp position so the actor stays fully inside the canvas."""
        import graphics as g
        col = self.collider
        if col.shape == "circle":
            mx = my = col.radius
        elif col.shape == "rect":
            mx = col.width / 2
            my = col.height / 2
        else:
            mx = my = 0.0
        self._x = max(mx, min(g._width - mx, self._x))
        self._y = max(my, min(g._height - my, self._y))

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

    # --- velocity ---

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
                g.push()
                g.translate(self._x, self._y)
                g.rotate(self._angle)
                sf, sfc, ss, ssc, ssw = g._state._current_fill, g._state._fill_color, g._state._current_stroke, g._state._stroke_color, g._state._stroke_width
                col = self.collider
                g.no_fill()
                g.stroke(0, 255, 0)
                g.stroke_width(1)
                if col.shape == "circle":
                    g.circle(col.dx, col.dy, col.radius)
                elif col.shape == "rect":
                    g.rect(col.dx - col.width / 2, col.dy - col.height / 2, col.width, col.height)
                g._state._current_fill, g._state._fill_color = sf, sfc
                g._state._current_stroke, g._state._stroke_color, g._state._stroke_width = ss, ssc, ssw
                g._state._draw_commands.append(("fill", sfc, {}) if sf else ("no_fill", (), {}))
                g._state._draw_commands.append(("stroke", ssc, {}) if ss else ("no_stroke", (), {}))
                g._state._draw_commands.append(("stroke_width", (ssw,), {}))
                g.pop()

    def reset(self):
        """Restore all sprite frames to their original pixel data."""
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
        """Iterate over pixels of the default sprite frame, yielding PixelView objects."""
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
    source actor will occupy after one `move()` step. Computation mirrors
    `_apply_velocity` exactly so the prediction matches the next frame.
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
        # Pre-set Rect attrs before super().__init__() so init() can access them
        # and _sealed check finds them already in __dict__.
        object.__setattr__(self, 'width', float(width))
        object.__setattr__(self, 'height', float(height))
        object.__setattr__(self, 'color', color)
        object.__setattr__(self, 'stroke_color', stroke_color)
        object.__setattr__(self, 'stroke_width', float(stroke_width))
        super().__init__(x=x, y=y, **kwargs)
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
            sf, sfc, ss, ssc, ssw = g._state._current_fill, g._state._fill_color, g._state._current_stroke, g._state._stroke_color, g._state._stroke_width
            col = self.collider
            g.no_fill()
            g.stroke(0, 255, 0)
            g.stroke_width(1)
            if col.shape == "rect":
                g.rect(col.dx - col.width / 2, col.dy - col.height / 2, col.width, col.height)
            elif col.shape == "circle":
                g.circle(col.dx, col.dy, col.radius)
            g._state._current_fill, g._state._fill_color = sf, sfc
            g._state._current_stroke, g._state._stroke_color, g._state._stroke_width = ss, ssc, ssw
            g._state._draw_commands.append(("fill", sfc, {}) if sf else ("no_fill", (), {}))
            g._state._draw_commands.append(("stroke", ssc, {}) if ss else ("no_stroke", (), {}))
            g._state._draw_commands.append(("stroke_width", (ssw,), {}))
        g.pop()


class Circle(Actor):
    """A circle actor that draws itself centered at (x, y)."""

    def __init__(self, x=0, y=0, radius=30, color="white",
                 stroke_color=None, stroke_width=0, **kwargs):
        # Pre-set Circle attrs before super().__init__() so init() can access them.
        object.__setattr__(self, 'radius', float(radius))
        object.__setattr__(self, 'color', color)
        object.__setattr__(self, 'stroke_color', stroke_color)
        object.__setattr__(self, 'stroke_width', float(stroke_width))
        super().__init__(x=x, y=y, **kwargs)
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
            sf, sfc, ss, ssc, ssw = g._state._current_fill, g._state._fill_color, g._state._current_stroke, g._state._stroke_color, g._state._stroke_width
            col = self.collider
            g.no_fill()
            g.stroke(0, 255, 0)
            g.stroke_width(1)
            if col.shape == "circle":
                g.circle(col.dx, col.dy, col.radius)
            elif col.shape == "rect":
                g.rect(col.dx - col.width / 2, col.dy - col.height / 2, col.width, col.height)
            g._state._current_fill, g._state._fill_color = sf, sfc
            g._state._current_stroke, g._state._stroke_color, g._state._stroke_width = ss, ssc, ssw
            g._state._draw_commands.append(("fill", sfc, {}) if sf else ("no_fill", (), {}))
            g._state._draw_commands.append(("stroke", ssc, {}) if ss else ("no_stroke", (), {}))
            g._state._draw_commands.append(("stroke_width", (ssw,), {}))
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
