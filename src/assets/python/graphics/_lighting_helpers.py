"""Private ray-casting and noise helpers for the Light class."""

import math


def _flicker_value(seed, frame):
    """Deterministic noise in [0.85, 1.0] from (seed, frame_count)."""
    h = (seed * 2654435761 + frame * 40503) & 0xFFFFFFFF
    h = ((h >> 16) ^ h) * 0x45D9F3B & 0xFFFFFFFF
    h = ((h >> 16) ^ h) & 0xFFFFFFFF
    return 0.85 + (h / 0xFFFFFFFF) * 0.15


def _ray_rect(ox, oy, dx, dy, xmin, ymin, xmax, ymax):
    """Slab ray-AABB intersection; returns smallest non-negative t or None."""
    tmin = -math.inf
    tmax = math.inf
    if abs(dx) < 1e-9:
        if ox < xmin or ox > xmax:
            return None
    else:
        tx1 = (xmin - ox) / dx
        tx2 = (xmax - ox) / dx
        tmin = max(tmin, min(tx1, tx2))
        tmax = min(tmax, max(tx1, tx2))
    if abs(dy) < 1e-9:
        if oy < ymin or oy > ymax:
            return None
    else:
        ty1 = (ymin - oy) / dy
        ty2 = (ymax - oy) / dy
        tmin = max(tmin, min(ty1, ty2))
        tmax = min(tmax, max(ty1, ty2))
    if tmax < tmin or tmax < 0:
        return None
    return tmin if tmin >= 0 else tmax


def _ray_circle(ox, oy, dx, dy, cx, cy, r):
    fx, fy = ox - cx, oy - cy
    a = dx * dx + dy * dy
    b = 2 * (fx * dx + fy * dy)
    c = fx * fx + fy * fy - r * r
    disc = b * b - 4 * a * c
    if disc < 0:
        return None
    sq = math.sqrt(disc)
    t1 = (-b - sq) / (2 * a)
    t2 = (-b + sq) / (2 * a)
    if t1 >= 0:
        return t1
    if t2 >= 0:
        return t2
    return None


def _obstacle_rect(obs):
    """Return (xmin, ymin, xmax, ymax) bounding rect for an obstacle, or None."""
    col = getattr(obs, "collider", None)
    if col is None or col.shape is None:
        return None
    cx, cy = col.active_x, col.active_y
    if col.shape == "rect":
        hw, hh = col.width / 2, col.height / 2
        return (cx - hw, cy - hh, cx + hw, cy + hh)
    if col.shape == "circle":
        r = col.radius
        return (cx - r, cy - r, cx + r, cy + r)
    return None


def _compute_visibility_polygon(sx, sy, radius, obstacles):
    """Cast rays to obstacle bbox corners ± epsilon; return ordered polygon."""
    EPS = 1e-4
    angles = []
    rects = [r for r in (_obstacle_rect(o) for o in obstacles) if r is not None]

    for (xmin, ymin, xmax, ymax) in rects:
        for (px, py) in ((xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)):
            base = math.atan2(py - sy, px - sx)
            angles.append(base - EPS)
            angles.append(base)
            angles.append(base + EPS)

    if not angles:
        # No obstacles → emit a regular polygon approximating the radius circle.
        N = 24
        angles = [2 * math.pi * i / N for i in range(N)]

    angles.sort()

    poly = []
    for ang in angles:
        dx = math.cos(ang)
        dy = math.sin(ang)
        t_min = radius
        for (xmin, ymin, xmax, ymax) in rects:
            t = _ray_rect(sx, sy, dx, dy, xmin, ymin, xmax, ymax)
            if t is not None and 0 <= t < t_min:
                t_min = t
        poly.append((sx + dx * t_min, sy + dy * t_min))
    return poly
