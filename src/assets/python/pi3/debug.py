"""
pi3.debug — algorithm-visualization module for competitive programming students.

Usage:
    from pi3 import debug

    for i in range(n):
        debug.array(arr, red=i)
        debug.show()
"""
import copy
import json
import inspect

from graphics import _state

__all__ = [
    "array",
    "cell",
    "grid",
    "label",
    "named",
    "queue",
    "range",
    "set",
    "show",
    "singles",
    "stack",
    "text",
]

_COLORS = frozenset({"red", "green", "blue", "yellow", "cyan", "gray"})
_STROKE_PREFIX = "stroke_"
_STROKE_COLORS = frozenset({_STROKE_PREFIX + c for c in _COLORS})
_V1_KINDS = frozenset({"array", "grid", "text", "stack", "queue", "set"})



# ── Selection sentinel types ──────────────────────────────────────────────────

class _Range:
    __slots__ = ("lo", "hi", "name")
    def __init__(self, lo: int, hi: int, name=None) -> None:
        self.lo = lo
        self.hi = hi
        self.name = name

class _Cell:
    __slots__ = ("r", "c", "name")
    def __init__(self, r: int, c: int, name=None) -> None:
        self.r = r
        self.c = c
        self.name = name

class _Singles:
    __slots__ = ("indices", "name")
    def __init__(self, indices, name=None) -> None:
        self.indices = list(indices)
        self.name = name

class _LabelWrapper:
    __slots__ = ("name", "value")
    def __init__(self, name: str, value) -> None:
        self.name = name
        self.value = value

class _Named:
    """Wraps any selector or bare value with a legend name."""
    __slots__ = ("value", "name")
    def __init__(self, value, name: str) -> None:
        self.value = value
        self.name = name


# ── Public selection helpers ──────────────────────────────────────────────────

def range(lo: int, hi: int, *, name=None) -> _Range:
    """Explicit range selector for 1-D structures: debug.range(lo, hi, name=...)."""
    return _Range(lo, hi, name)

def singles(*indices, name=None) -> _Singles:
    """Highlight several individual positions: debug.singles(lo, hi, ..., name=...).

    Unlike debug.range(lo, hi) which covers every index between lo and hi,
    this marks each argument as a distinct single-cell highlight. Useful for
    showing endpoint markers alongside a range selection.
    """
    flat = []
    for i in indices:
        if isinstance(i, (list, tuple)):
            flat.extend(i)
        else:
            flat.append(i)
    return _Singles(flat, name)

def cell(row: int, col: int, *, name=None) -> _Cell:
    """Explicit cell selector for grids: debug.cell(row, col, name=...)."""
    return _Cell(row, col, name)

def label(name: str, value) -> _LabelWrapper:
    """Wrap a value with an explicit slot title (not a legend name)."""
    return _LabelWrapper(name, value)

def named(value, name: str) -> _Named:
    """Attach a legend name to a bare value or selector without a name= kwarg.

    Use this for bare ints, lists, or when you want to add a legend label to
    a selector after the fact. The wrapped value/selector behaves exactly the
    same for highlighting; only the legend row for its color gains the name.
    """
    return _Named(value, name)


# ── Normalizers ───────────────────────────────────────────────────────────────

def _extract_name(value):
    """Return legend name attached to value (or nested), else None."""
    if isinstance(value, _Named) and value.name:
        return value.name
    if isinstance(value, (_Range, _Singles, _Cell)) and value.name:
        return value.name
    if isinstance(value, _LabelWrapper):
        return _extract_name(value.value)
    return None

def _normalize_1d(value):
    """Return list of canonical atoms for 1-D structure highlights."""
    if isinstance(value, _Named):
        return _normalize_1d(value.value)
    if isinstance(value, _Range):
        return [["range", value.lo, value.hi]]
    if isinstance(value, _Singles):
        return [["index", int(i)] for i in value.indices]
    if isinstance(value, _LabelWrapper):
        return _normalize_1d(value.value)
    if isinstance(value, int):
        return [["index", value]]
    if isinstance(value, (list, tuple)):
        if len(value) == 2 and all(isinstance(x, int) for x in value):
            return [["range", value[0], value[1]]]
        out = []
        for item in value:
            out.extend(_normalize_1d(item))
        return out
    return []

def _normalize_2d(value):
    """Return list of canonical atoms for 2-D grid highlights."""
    if isinstance(value, _Named):
        return _normalize_2d(value.value)
    if isinstance(value, _Cell):
        return [["cell", value.r, value.c]]
    if isinstance(value, _Range):
        return [["row", value.lo], ["row", value.hi]]
    if isinstance(value, _LabelWrapper):
        return _normalize_2d(value.value)
    if isinstance(value, int):
        return [["row", value]]
    if isinstance(value, (list, tuple)):
        if len(value) == 2 and all(isinstance(x, int) for x in value):
            return [["cell", value[0], value[1]]]
        if len(value) == 4 and all(isinstance(x, int) for x in value):
            return [["region", value[0], value[1], value[2], value[3]]]
        out = []
        for item in value:
            out.extend(_normalize_2d(item))
        return out
    return []


# ── Internal registration ─────────────────────────────────────────────────────

def _safe_copy(data):
    try:
        return copy.deepcopy(data)
    except Exception:
        return data

def _register(kind: str, data, fills_raw: dict, strokes_raw: dict,
              legend: dict, labels: dict, stroke_width: int) -> None:
    # Walk up: _register → array/grid/etc → user code
    frame = inspect.currentframe()
    caller = frame.f_back.f_back if (frame and frame.f_back) else None
    filename = caller.f_code.co_filename if caller else "<unknown>"
    lineno = caller.f_lineno if caller else 0
    # D7: disambiguate by bytecode-instruction pointer so two distinct calls on
    # the SAME line (e.g. `debug.array(a); debug.array(b)`) get separate slots,
    # while a single call in a loop keeps the same slot (same f_lasti).
    lasti = caller.f_lasti if caller else 0
    slot_id = (filename, lineno, lasti)

    is_grid = kind == "grid"
    normalizer = _normalize_2d if is_grid else _normalize_1d

    def _build(raw: dict) -> dict:
        out = {}
        for color, val in raw.items():
            atoms = normalizer(val)
            if atoms:
                out[color] = atoms
        return out

    fills = _build(fills_raw)
    strokes = _build(strokes_raw)

    slot = {
        "kind": kind,
        "data": _safe_copy(data),
        "highlights": fills,
        "strokes": strokes,
        "strokeWidth": int(stroke_width),
        "legend": legend,
        "labels": labels,
        "filename": filename,
        "line": lineno,
        "captured_at_frame": len(_state._debug_frames),
    }
    _state._debug_slots[slot_id] = slot
    _state._debug_fresh_slots.add(slot_id)


def _split_kwargs(kwargs: dict):
    """Return (fills, strokes, legend, labels, stroke_width) from a **kwargs call.

    - Fill kwargs: red/green/blue/yellow/cyan/gray
    - Stroke kwargs: stroke_red/... — same colors, border layer
    - stroke_width kwarg (default 2)
    - Slot title label survives via the private _labels dict
    - Legend map is built from name= on selectors and debug.named() wrappers.
      Bare color kwarg keys drop the stroke_ prefix so one label covers both
      layers of that color. Last non-None name wins.
    """
    labels = kwargs.pop("_labels", {})
    stroke_width = kwargs.pop("stroke_width", 2)

    fills: dict = {}
    strokes: dict = {}
    legend: dict = {}

    for k, v in kwargs.items():
        if k in _COLORS:
            fills[k] = v
            n = _extract_name(v)
            if n is not None:
                legend[k] = n
        elif k in _STROKE_COLORS:
            bare = k[len(_STROKE_PREFIX):]
            strokes[bare] = v
            n = _extract_name(v)
            if n is not None:
                legend[bare] = n
        # else: silently ignore unknown kwargs — best-effort API surface

    return fills, strokes, legend, labels, stroke_width


# ── Public registration functions ─────────────────────────────────────────────

def array(data, **kwargs):
    """Register a 1-D sequence snapshot."""
    f, s, lg, lbl, sw = _split_kwargs(kwargs)
    _register("array",
              list(data) if not isinstance(data, (list, str)) else data,
              f, s, lg, lbl, sw)

def grid(data, **kwargs):
    """Register a 2-D grid snapshot."""
    f, s, lg, lbl, sw = _split_kwargs(kwargs)
    _register("grid", [list(row) for row in data], f, s, lg, lbl, sw)

def text(data, **kwargs):
    """Register a string snapshot."""
    f, s, lg, lbl, sw = _split_kwargs(kwargs)
    _register("text", str(data), f, s, lg, lbl, sw)

def stack(data, **kwargs):
    """Register a stack (list, top=last) snapshot."""
    f, s, lg, lbl, sw = _split_kwargs(kwargs)
    _register("stack", list(data), f, s, lg, lbl, sw)

def queue(data, **kwargs):
    """Register a queue snapshot."""
    f, s, lg, lbl, sw = _split_kwargs(kwargs)
    _register("queue", list(data), f, s, lg, lbl, sw)

def set(data, **kwargs):
    """Register a set snapshot."""
    f, s, lg, lbl, sw = _split_kwargs(kwargs)
    _register("set", sorted(data), f, s, lg, lbl, sw)


# ── show() ────────────────────────────────────────────────────────────────────

def show() -> None:
    """Capture a timeline frame from all registered slots and emit it to JS."""
    if not _state._debug_slots:
        return
    frame = {
        "index": len(_state._debug_frames),
        "slots": [
            {
                "kind": slot["kind"],
                "data": slot["data"],
                "highlights": slot["highlights"],
                "strokes": slot.get("strokes", {}),
                "strokeWidth": slot.get("strokeWidth", 2),
                "legend": slot.get("legend", {}),
                "labels": slot["labels"],
                "filename": slot["filename"],
                "line": slot["line"],
                "fresh": slot_id in _state._debug_fresh_slots,
            }
            for slot_id, slot in _state._debug_slots.items()
        ],
    }
    _state._debug_frames.append(frame)
    _state._debug_fresh_slots.clear()
    try:
        import js
        js._ide_post_debug_frame(json.dumps(frame, default=list))
    except Exception:
        pass  # no JS environment (unit tests)
