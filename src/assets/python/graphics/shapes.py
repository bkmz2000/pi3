"""Geometry shapes: the Shape base, Line, and the Segment primitive.

A Shape is a piece of level geometry that students can draw and bounce
velocities off of::

    wall = Line((0, 400), (600, 400))       # a floor
    ...
    ball.vel = ball.vel.bounce_of(wall)     # reflect off it
    wall.draw()

Subclasses (Line here; Polygon and Spline arrive in later stages) share this
base's dirty-tracking, its cached `segments`/`bounds`, and its `draw()` path.
Rebuild work is lazy — it happens the first time `segments`, `bounds`, or
`draw()` is used after the shape changes, never on construction alone.
"""

import math
from collections import namedtuple

from graphics._vec import Vector2
from graphics import _state


# One straight piece of a shape's outline, running from `a` to `b`.
# Both endpoints are Vector2. Used by normal_at / collision lookups.
Segment = namedtuple("Segment", ["a", "b"])

# A point within this squared-distance of an edge counts as "on the boundary"
# — and on-boundary counts as inside (documented contains() behavior).
_ON_EDGE_EPS_SQ = 1e-6


class Shape:
    """Base class for Line / Polygon / Spline. Not instantiated directly.

    Owns the lazy-rebuild machinery. A subclass implements `_rebuild()` to fill
    `self._segments` (list of Segment) and `self._draw_points` (a flat
    ``[x1, y1, x2, y2, ...]`` list); the base derives `bounds` from those points
    and renders `draw()` from them.
    """

    # Draw-command name emitted by draw(); subclasses that form a closed region
    # (Polygon) override this to "polygon" so the renderer fills and closes it.
    _draw_cmd = "polyline"

    def __init__(self, thickness=2):
        self._dirty = True
        self._segments = []
        self._draw_points = []
        self._bounds = None
        self._thickness = int(thickness)
        # Texture state — only ever read by the draw path. Kept fully decoupled
        # from collision: bounce_of / contains / normal_at must never touch these.
        self._texture_sprite = None
        self._texture_mode = "tile"
        self._texture_spacing = None
        self._texture_blits = []   # list of (x, y, angle_degrees) tile placements

    # --- lazy rebuild ---

    def _rebuild(self):
        """Populate self._segments and self._draw_points. Subclass responsibility."""
        raise NotImplementedError

    def _ensure_built(self):
        if self._dirty:
            self._rebuild()
            self._compute_bounds()
            self._rebuild_texture()   # depends on the fresh _segments
            self._dirty = False

    def _compute_bounds(self):
        pts = self._draw_points
        if not pts:
            self._bounds = None
            return
        xs = pts[0::2]
        ys = pts[1::2]
        self._bounds = (min(xs), min(ys), max(xs), max(ys))

    # --- read-only public surface ---

    @property
    def thickness(self):
        """Stroke width in pixels. Set once in the constructor; read-only after."""
        return self._thickness

    @property
    def segments(self):
        """The Segment(a, b) pieces making up the outline (rebuilt lazily)."""
        self._ensure_built()
        return self._segments

    @property
    def bounds(self):
        """Axis-aligned bounding box as (min_x, min_y, max_x, max_y), or None if empty."""
        self._ensure_built()
        return self._bounds

    def normal_at(self, point=None):
        """Unit normal of the segment nearest `point` (or the first, if point is None).

        The default for any multi-segment shape (Polygon, Spline). Line overrides
        it with its single-normal form. The sign is unspecified; Vector2.bounce_of
        is invariant to it.
        """
        self._ensure_built()
        if not self._segments:
            return Vector2(0, 0)
        seg = self._segments[0] if point is None else self._closest_segment(Vector2(point))
        d = Vector2(seg.b.x - seg.a.x, seg.b.y - seg.a.y)
        return Vector2(-d.y, d.x).normalized()

    # --- texture (draw-only; fully decoupled from collision) ---

    def texture(self, sprite, mode="tile", spacing=None):
        """Paint this shape's outline with a repeating sprite instead of a stroke.

            Line((0, 400), (600, 400)).texture(sheet["brick"]).draw()

        `sprite` is a Sprite (or a sheet entry / animation, resolved to its first
        frame). Tiles are laid every `spacing` px along the outline and rotated to
        follow it; `spacing=None` means tile edge-to-edge at the sprite's width.
        Pass `sprite=None` to clear the texture and go back to a plain stroke.
        Returns self so the call can chain. This changes only how the shape is
        drawn — bounce_of / contains / normal_at are unaffected.
        """
        self._texture_sprite = self._resolve_sprite(sprite)
        self._texture_mode = mode
        self._texture_spacing = spacing
        self._dirty = True   # rebuild so _rebuild_texture re-lays the tiles
        return self

    @staticmethod
    def _resolve_sprite(sprite):
        """Accept a Sprite directly, or a sheet entry/animation with a default frame."""
        if sprite is None:
            return None
        default = getattr(sprite, "_default_sprite", None)
        return default() if callable(default) else sprite

    # --- shared geometry helpers (used by Polygon and Spline) ---

    @staticmethod
    def _point_seg_dist_sq(p, a, b):
        """Squared distance from point `p` to the segment a->b (endpoints clamped)."""
        abx = b.x - a.x
        aby = b.y - a.y
        denom = abx * abx + aby * aby
        if denom == 0.0:
            dx = p.x - a.x
            dy = p.y - a.y
            return dx * dx + dy * dy
        t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / denom
        if t < 0.0:
            t = 0.0
        elif t > 1.0:
            t = 1.0
        dx = p.x - (a.x + t * abx)
        dy = p.y - (a.y + t * aby)
        return dx * dx + dy * dy

    def _closest_segment(self, p):
        """Return the Segment nearest to point `p` (O(edges) scan)."""
        best = None
        best_d = None
        for seg in self._segments:
            d = self._point_seg_dist_sq(p, seg.a, seg.b)
            if best_d is None or d < best_d:
                best_d = d
                best = seg
        return best

    def _point_in_polygon(self, p, points):
        """Even-odd ray-cast test. On-boundary (within eps of an edge) is inside."""
        n = len(points)
        if n < 3:
            return False
        # Boundary first: sitting on an edge counts as inside.
        for i in range(n):
            if self._point_seg_dist_sq(p, points[i], points[(i + 1) % n]) <= _ON_EDGE_EPS_SQ:
                return True
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = points[i].x, points[i].y
            xj, yj = points[j].x, points[j].y
            if ((yi > p.y) != (yj > p.y)) and \
                    (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def _near_curve(self, p, tolerance):
        """True if `p` is within `tolerance` of the nearest segment (open-curve test)."""
        seg = self._closest_segment(p)
        if seg is None:
            return False
        return self._point_seg_dist_sq(p, seg.a, seg.b) <= tolerance * tolerance

    def _rebuild_texture(self):
        """Lay tile placements along the outline. Reads _segments only; writes _texture_blits."""
        self._texture_blits = []
        sprite = self._texture_sprite
        if sprite is None:
            return
        step = self._texture_spacing
        if step is None:
            step = sprite.width   # tile edge-to-edge by default
        step = float(step)
        if step <= 0.0:
            return
        # Walk the outline as one continuous arc so spacing carries across corners
        # and curves; each tile is oriented along its local segment.
        carry = 0.0   # distance into the current segment before the next tile
        for seg in self._segments:
            ax, ay = seg.a.x, seg.a.y
            dx = seg.b.x - ax
            dy = seg.b.y - ay
            seg_len = math.hypot(dx, dy)
            if seg_len == 0.0:
                continue
            ux = dx / seg_len
            uy = dy / seg_len
            angle = math.degrees(math.atan2(dy, dx))
            d = carry
            while d < seg_len:
                self._texture_blits.append((ax + ux * d, ay + uy * d, angle))
                d += step
            carry = d - seg_len

    # --- rendering ---

    def draw(self):
        """Queue this shape to be drawn this frame.

        Draws a tiled texture if one was set via texture(); otherwise strokes the
        outline with the current stroke color.
        """
        self._ensure_built()
        if self._texture_blits:
            self._draw_textured()
            return
        pts = self._draw_points
        if len(pts) < 4:
            return
        # Wrap in push/pop so this shape's own thickness restores afterward and
        # does not leak into the global stroke width used by line()/rect()/etc.
        _state._draw_commands.append(("push", (), {}))
        _state._draw_commands.append(("stroke_width", (self._thickness,), {}))
        _state._draw_commands.append((self._draw_cmd, (list(pts),), {}))
        _state._draw_commands.append(("pop", (), {}))

    def _draw_textured(self):
        """Blit the texture sprite at each placement, rotated to follow the outline."""
        sprite = self._texture_sprite
        if sprite is None:
            return
        px = bytes(sprite.pixels)
        sw = int(sprite.width)
        sh = int(sprite.height)
        hw = sw / 2.0
        hh = sh / 2.0
        for (x, y, angle) in self._texture_blits:
            # Center each tile on its point and rotate via the transform stack —
            # the same push/translate/rotate path Actor.draw uses for sprites.
            _state._draw_commands.append(("push", (), {}))
            _state._draw_commands.append(("translate", (x, y), {}))
            _state._draw_commands.append(("rotate", (angle,), {}))
            _state._draw_commands.append(("sprite", (px, sw, sh, -hw, -hh, None, None), {}))
            _state._draw_commands.append(("pop", (), {}))


class Line(Shape):
    """A straight wall between two points.

        wall = Line((0, 400), (600, 400))       # a floor
        ball.vel = ball.vel.bounce_of(wall)     # reflect off it
        wall.draw()

    `thickness` is the stroke width and is fixed at construction time.
    """

    def __init__(self, a, b, thickness=2):
        super().__init__(thickness=thickness)
        self._a = Vector2(a)
        self._b = Vector2(b)

    @property
    def a(self):
        """First endpoint (Vector2)."""
        return self._a

    @property
    def b(self):
        """Second endpoint (Vector2)."""
        return self._b

    def _rebuild(self):
        a, b = self._a, self._b
        self._segments = [Segment(a, b)]
        self._draw_points = [a.x, a.y, b.x, b.y]

    def normal_at(self, point=None):
        """Unit normal to the line. `point` is ignored — a line has one normal.

        The sign is left unspecified (it points to one side or the other);
        Vector2.bounce_of is invariant to it, so callers never have to care which.
        """
        self._ensure_built()
        a, b = self._a, self._b
        d = Vector2(b.x - a.x, b.y - a.y)
        return Vector2(-d.y, d.x).normalized()


class Polygon(Shape):
    """A closed region defined by a ring of points.

        level = Polygon([(0, 0), (200, 0), (200, 150), (0, 150)])
        if level.contains(ball.pos):
            ball.vel = ball.vel.bounce_of(level, at=ball.pos)
        level.draw()

    The points form a closed loop — the last point connects back to the first,
    so you do not repeat the starting point. Being a region, draw() fills it
    with the current fill color and outlines it with the current stroke.
    """

    _draw_cmd = "polygon"

    def __init__(self, points, thickness=2):
        super().__init__(thickness=thickness)
        self._points = [Vector2(p) for p in points]

    @property
    def points(self):
        """The corner points (list of Vector2), in order."""
        return self._points

    def _rebuild(self):
        pts = self._points
        n = len(pts)
        segs = []
        draw = []
        for i in range(n):
            a = pts[i]
            b = pts[(i + 1) % n]   # closed loop: last edge wraps to the first point
            segs.append(Segment(a, b))
            draw.append(a.x)
            draw.append(a.y)
        self._segments = segs
        self._draw_points = draw

    def normal_at(self, point=None):
        """Unit normal of the edge nearest `point`.

        Pass the contact point (e.g. `at=ball.pos`) so the bounce uses the side
        the ball actually hit. With no point, falls back to the first edge. The
        sign is unspecified; Vector2.bounce_of is invariant to it.
        """
        self._ensure_built()
        if point is None:
            seg = self._segments[0]
        else:
            seg = self._closest_segment(Vector2(point))
        d = Vector2(seg.b.x - seg.a.x, seg.b.y - seg.a.y)
        return Vector2(-d.y, d.x).normalized()

    def contains(self, point):
        """True if `point` is inside the polygon. A point on an edge counts as inside."""
        self._ensure_built()
        return self._point_in_polygon(Vector2(point), self._points)


# --- Spline: cardinal (Catmull-Rom) curve through its control points ---
#
# Matches the renderer's spline() curve: a cardinal spline with tension 0.5,
# sampled as a cubic Bezier per span, with clamped endpoints (open) or wrapped
# neighbors (closed). Each span is flattened to _SPLINE_STEPS line points so the
# collision geometry (segments) is exactly the curve that gets drawn.
_SPLINE_STEPS = 8
_SPLINE_TENSION = 0.5


def _cardinal_point(p0, p1, p2, p3, t):
    """Sample the cardinal-spline span p1->p2 (neighbors p0, p3) at parameter t."""
    s = _SPLINE_TENSION
    cp1x = p1.x + (p2.x - p0.x) * s / 6.0
    cp1y = p1.y + (p2.y - p0.y) * s / 6.0
    cp2x = p2.x - (p3.x - p1.x) * s / 6.0
    cp2y = p2.y - (p3.y - p1.y) * s / 6.0
    u = 1.0 - t
    b0 = u * u * u
    b1 = 3.0 * u * u * t
    b2 = 3.0 * u * t * t
    b3 = t * t * t
    return Vector2(
        b0 * p1.x + b1 * cp1x + b2 * cp2x + b3 * p2.x,
        b0 * p1.y + b1 * cp1y + b2 * cp2y + b3 * p2.y,
    )


def _cardinal_span(p0, p1, p2, p3):
    """Flatten one span into _SPLINE_STEPS points, t = 1/S .. 1.0 (ends exactly at p2)."""
    s = _SPLINE_STEPS
    return [_cardinal_point(p0, p1, p2, p3, k / s) for k in range(1, s + 1)]


class Spline(Shape):
    """A smooth curve through a series of points.

        ramp = Spline([(0, 400), (200, 300), (400, 380)])   # an open ramp
        ball.vel = ball.vel.bounce_of(ramp, at=ball.pos)
        ramp.draw()

        trail = Spline([])
        def main():
            trail.add(player.pos)      # grows one point per frame, O(1)
            trail.draw()

    `closed=False` (the default) is an open curve — `contains()` tests nearness
    to the line, NOT whether a point is inside a filled region. `closed=True`
    makes a smooth loop that IS a region: `contains()` reports points inside it
    and `draw()` fills it. `thickness` is fixed at construction time.
    """

    def __init__(self, points, closed=False, thickness=6):
        super().__init__(thickness=thickness)
        self._closed = bool(closed)
        self._control = [Vector2(p) for p in points]
        # A closed loop draws as a filled region, like a Polygon; an open curve
        # draws as a stroked polyline. (Instance attr shadows the class default.)
        self._draw_cmd = "polygon" if self._closed else "polyline"
        # _vertices is the flattened polyline, maintained eagerly so add() can
        # splice its tail in O(1). The segments/draw_points/bounds caches are
        # derived from it lazily via the base _dirty machinery.
        self._vertices = self._full_vertices()

    @property
    def points(self):
        """The control points (list of Vector2), in order."""
        return self._control

    @property
    def closed(self):
        """True if the curve is a closed loop (a filled region)."""
        return self._closed

    # --- flattening ---

    def _full_vertices(self):
        """Flatten the whole curve from scratch (used on construct + closed add)."""
        c = self._control
        m = len(c)
        if m == 0:
            return []
        if m == 1:
            return [c[0]]
        verts = [c[0]]
        if self._closed and m >= 3:
            for j in range(m):
                p0 = c[(j - 1) % m]
                p1 = c[j]
                p2 = c[(j + 1) % m]
                p3 = c[(j + 2) % m]
                verts.extend(_cardinal_span(p0, p1, p2, p3))
        else:
            for j in range(m - 1):
                p0 = c[max(0, j - 1)]
                p1 = c[j]
                p2 = c[j + 1]
                p3 = c[min(m - 1, j + 2)]
                verts.extend(_cardinal_span(p0, p1, p2, p3))
        return verts

    def _open_span(self, j):
        """Compute open-curve span j (between control j and j+1) with clamped neighbors."""
        c = self._control
        m = len(c)
        p0 = c[max(0, j - 1)]
        p1 = c[j]
        p2 = c[j + 1]
        p3 = c[min(m - 1, j + 2)]
        return _cardinal_span(p0, p1, p2, p3)

    def add(self, point):
        """Append a control point. Open curves rebuild only the tail — O(1) amortized.

        Returns self so calls can chain. Adding to a closed loop rebuilds fully
        (loops are meant to be built once), which is why the O(1) guarantee is
        for the common open/growing case.
        """
        v = Vector2(point)
        c = self._control
        s = _SPLINE_STEPS

        if self._closed:
            c.append(v)
            self._vertices = self._full_vertices()
            self._dirty = True
            return self

        m0 = len(c)
        c.append(v)
        if m0 <= 1:
            # 0->1 (single point) or 1->2 (first span appears): cheap full build.
            self._vertices = self._full_vertices()
            self._dirty = True
            return self

        # m0 >= 2: the previously-last span (m0-2) had a phantom endpoint that is
        # now the real new point, so recompute it; then append the new span
        # (m0-1). Both live at the tail of _vertices, so this is O(_SPLINE_STEPS).
        del self._vertices[-s:]                  # drop old span (m0-2)
        self._vertices.extend(self._open_span(m0 - 2))   # recompute it, p3 now real
        self._vertices.extend(self._open_span(m0 - 1))   # brand-new tail span
        self._dirty = True
        return self

    def _rebuild(self):
        # Derive segments/draw_points from the eagerly-maintained _vertices.
        v = self._vertices
        draw = []
        for pt in v:
            draw.append(pt.x)
            draw.append(pt.y)
        self._segments = [Segment(v[i], v[i + 1]) for i in range(len(v) - 1)]
        self._draw_points = draw

    def contains(self, point):
        """Membership test — dispatches on `closed`.

        Closed: point-in-region (even-odd ray cast; on the boundary counts as
        inside). Open: nearness to the curve (within half the thickness), never a
        filled-region test — an unset `closed` must not behave like a region.
        """
        self._ensure_built()
        p = Vector2(point)
        if self._closed:
            # _vertices ends with a duplicate of the first point (the loop close);
            # drop it so the ring has no zero-length seam edge.
            ring = self._vertices[:-1] if len(self._vertices) > 1 else self._vertices
            return self._point_in_polygon(p, ring)
        return self._near_curve(p, self._thickness / 2.0 + 1.0)
