"""
API surface manifest for the graphics library.

Provides EXPORTED_NAMES, NAMESPACE_ATTRS, and ACTOR_BUILTIN_ATTRS — used by
_errors.py and error_hook for suggestion engines. The validate_graphics.py
self-check test asserts this manifest stays in sync with the live module:
every EXPORTED_NAMES entry must exist in graphics, and every name in
graphics.__all__ must appear in EXPORTED_NAMES.

Update procedure: when adding or removing a name from graphics.__all__, update
EXPORTED_NAMES here in the same commit. CI will fail if they diverge.
"""

import sys as _sys


def _g():
    m = _sys.modules.get("graphics")
    if m is None:
        import graphics as m
    return m


# Must stay in sync with graphics.__all__ — self-check test enforces this.
EXPORTED_NAMES = [
    "_version",
    "size", "width", "height",
    "circle", "rect", "ellipse", "line", "point",
    "polyline", "polygon", "spline",
    "text", "text_size", "text_align",
    "say",
    "fill", "no_fill", "stroke", "no_stroke", "stroke_width",
    "background",
    "push", "pop", "translate", "rotate",
    "image",
    "frame_rate", "frame_count",
    "random", "random_color",
    "clamp", "randint", "pick",
    "Colors", "AnchorPoint",
    "lerp", "darker", "lighter", "saturated", "desaturated",
    "Sprite", "PixelView", "create_sprite", "get_pixel", "set_pixel",
    "palette_swap", "flood_fill",
    "darken", "lighten", "saturate", "desaturate",
    "Vector2", "Point", "Polar",
    "Line", "Polygon",
    "Mouse", "Keyboard", "Window",
    "Actor", "Rect", "Circle", "Group", "Collider",
    "Camera",
    "TilemapLayer", "TileMap", "TileRef",
    "TileGroup", "Cell", "Bounds", "noise",
    "Light",
    "Animation",
    "SheetAnimation", "SpriteEntry", "SheetNamespace", "AnimationController",
    "Timer",
    "State",
    "run", "stop",
    "assets",
    "sheet",
    "inspect",
    "watch",
]

# Derived from live module — no duplication of key/color name lists.
_keyboard_keys = list(_g()._KEY_CODES.keys())
_color_names = list(_g().COLOR_NAMES.keys())

NAMESPACE_ATTRS = {
    "Mouse": ["x", "y", "pos", "pressed", "down", "released"],
    "Keyboard": _keyboard_keys,
    "Window": [
        "width", "height",
        "top_left", "top_right", "bottom_left", "bottom_right",
        "center", "top", "bottom", "left", "right",
    ],
    "Colors": _color_names,
    "state": [],  # dynamic attrs; entry signals the name is recognized
}


def _build_actor_attrs():
    from graphics.actors import Actor as _A
    return [name for name in dir(_A) if not name.startswith("_")]


# Derived from the live Actor class — built from reality, not from memory.
ACTOR_BUILTIN_ATTRS = _build_actor_attrs()


def _build_actor_methods():
    """Return the names of callable instance methods on Actor (no staticmethods, no properties)."""
    import types
    from graphics.actors import Actor as _A
    out = []
    for name in dir(_A):
        if name.startswith("_"):
            continue
        # Skip static methods — they are not bound to an instance.
        raw = _A.__dict__.get(name)
        if isinstance(raw, staticmethod):
            continue
        attr = getattr(_A, name, None)
        if isinstance(attr, types.FunctionType):
            out.append(name)
    return sorted(out)


# Instance methods only — used by the linter's W_MethodNotCalled rule to
# detect `apple.draw` (statement) vs `apple.draw()` (call).
ACTOR_METHODS = _build_actor_methods()
