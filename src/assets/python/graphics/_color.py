"""Color palette data and private math helpers.

Public functions (lerp, darker, lighter, saturated, desaturated) remain in
__init__.py because the static validator requires them as def statements there.
"""

from graphics._errors import FriendlyError

# Sweetie 16 palette by GrafxKid (https://lospec.com/palette-list/sweetie-16).
# Locked color palette — used by both Colors.<name> and fill("<name>") lookups.
COLOR_NAMES = {
    "black":  ( 26,  28,  44),
    "wine":   ( 93,  39,  93),
    "red":    (177,  62,  83),
    "orange": (239, 125,  87),
    "yellow": (255, 205, 117),
    "lime":   (167, 240, 112),
    "green":  ( 56, 183, 100),
    "teal":   ( 37, 113, 121),
    "navy":   ( 41,  54, 111),
    "blue":   ( 59,  93, 201),
    "sky":    ( 65, 166, 246),
    "cyan":   (115, 239, 247),
    "white":  (244, 244, 244),
    "silver": (148, 176, 194),
    "gray":   ( 86, 108, 134),
    "slate":  ( 51,  60,  87),
}


class _Colors:
    """Named color palette. Locked to Sweetie 16."""
    black  = COLOR_NAMES["black"]
    wine   = COLOR_NAMES["wine"]
    red    = COLOR_NAMES["red"]
    orange = COLOR_NAMES["orange"]
    yellow = COLOR_NAMES["yellow"]
    lime   = COLOR_NAMES["lime"]
    green  = COLOR_NAMES["green"]
    teal   = COLOR_NAMES["teal"]
    navy   = COLOR_NAMES["navy"]
    blue   = COLOR_NAMES["blue"]
    sky    = COLOR_NAMES["sky"]
    cyan   = COLOR_NAMES["cyan"]
    white  = COLOR_NAMES["white"]
    silver = COLOR_NAMES["silver"]
    gray   = COLOR_NAMES["gray"]
    slate  = COLOR_NAMES["slate"]


Colors = _Colors()

_SHADE_STEP = 0.13


def _is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _to_rgb(c):
    """Normalize a color input to an (r, g, b) int tuple."""
    if isinstance(c, (tuple, list)) and len(c) == 3:
        return (int(c[0]), int(c[1]), int(c[2]))
    if isinstance(c, str):
        lo = c.lower()
        if lo in COLOR_NAMES:
            return COLOR_NAMES[lo]
        s = lo.lstrip("#")
        if len(s) == 6:
            try:
                return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
            except ValueError:
                pass
        raise FriendlyError(
            "friendlyError.naming.badColor",
            {"color": str(c)},
            raw=f"Unknown color: {c!r}",
        )
    raise FriendlyError(
        "friendlyError.types.badColorType",
        {"type": type(c).__name__},
        raw=f"Expected color tuple, hex string, or color name; got {type(c).__name__}",
    )


def _resolve_color(r, g=None, b=None):
    """Returns an (r, g, b) tuple from various input forms."""
    if isinstance(r, tuple):
        return (int(r[0]), int(r[1]), int(r[2]))
    if isinstance(r, str):
        return COLOR_NAMES.get(r.lower(), (255, 255, 255))
    if g is None:
        return (int(r), int(r), int(r))
    return (int(r), int(g), int(b))


def _rgb_to_hsl(r, g, b):
    rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
    mx, mn = max(rf, gf, bf), min(rf, gf, bf)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == rf:
        h = ((gf - bf) / d + (6 if gf < bf else 0)) / 6
    elif mx == gf:
        h = ((bf - rf) / d + 2) / 6
    else:
        h = ((rf - gf) / d + 4) / 6
    return h, s, l


def _hsl_to_rgb(h, s, l):
    if s == 0:
        v = int(round(l * 255))
        return (v, v, v)

    def hue(p, q, t):
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1 / 6:
            return p + (q - p) * 6 * t
        if t < 1 / 2:
            return q
        if t < 2 / 3:
            return p + (q - p) * (2 / 3 - t) * 6
        return p

    q = l * (1 + s) if l < 0.5 else l + s - l * s
    p = 2 * l - q
    return (
        int(round(hue(p, q, h + 1 / 3) * 255)),
        int(round(hue(p, q, h) * 255)),
        int(round(hue(p, q, h - 1 / 3) * 255)),
    )
