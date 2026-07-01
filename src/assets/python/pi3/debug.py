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
    "queue",
    "range",
    "set",
    "show",
    "stack",
    "text",
]

_COLORS = frozenset({"red", "green", "blue", "yellow", "cyan", "gray"})
_V1_KINDS = frozenset({"array", "grid", "text", "stack", "queue", "set"})


# ── Selection sentinel types ──────────────────────────────────────────────────

class _Range:
    __slots__ = ("lo", "hi")
    def __init__(self, lo: int, hi: int) -> None:
        self.lo = lo
        self.hi = hi

class _Cell:
    __slots__ = ("r", "c")
    def __init__(self, r: int, c: int) -> None:
        self.r = r
        self.c = c

class _LabelWrapper:
    __slots__ = ("name", "value")
    def __init__(self, name: str, value) -> None:
        self.name = name
        self.value = value


# ── Public selection helpers ──────────────────────────────────────────────────

def range(lo: int, hi: int) -> _Range:
    """Explicit range selector for 1-D structures: debug.range(lo, hi)."""
    return _Range(lo, hi)

def cell(r: int, c: int) -> _Cell:
    """Explicit cell selector for grids: debug.cell(row, col)."""
    return _Cell(r, c)

def label(name: str, value) -> _LabelWrapper:
    """Wrap a value with an explicit display label."""
    return _LabelWrapper(name, value)


# ── Normalizers ───────────────────────────────────────────────────────────────

def _normalize_1d(value):
    """Return list of canonical atoms for 1-D structure highlights."""
    if isinstance(value, _Range):
        return [["range", value.lo, value.hi]]
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

def _register(kind: str, data, highlights_raw: dict, labels: dict) -> None:
    # Walk up: _register → array/grid/etc → user code
    frame = inspect.currentframe()
    caller = frame.f_back.f_back if (frame and frame.f_back) else None
    filename = caller.f_code.co_filename if caller else "<unknown>"
    lineno = caller.f_lineno if caller else 0
    slot_id = (filename, lineno)

    is_grid = kind == "grid"
    normalizer = _normalize_2d if is_grid else _normalize_1d
    highlights = {
        color: normalizer(val)
        for color, val in highlights_raw.items()
        if normalizer(val)
    }

    slot = {
        "kind": kind,
        "data": _safe_copy(data),
        "highlights": highlights,
        "labels": labels,
        "filename": filename,
        "line": lineno,
        "captured_at_frame": len(_state._debug_frames),
    }
    _state._debug_slots[slot_id] = slot
    _state._debug_fresh_slots.add(slot_id)

def _split_kwargs(kwargs: dict):
    """Return (highlights_dict, labels_dict) from a **kwargs call."""
    labels = kwargs.pop("_labels", {})
    highlights = {k: v for k, v in kwargs.items() if k in _COLORS}
    return highlights, labels


# ── Public registration functions ─────────────────────────────────────────────

def array(data, **kwargs):
    """Register a 1-D sequence snapshot."""
    h, lbl = _split_kwargs(kwargs)
    _register("array", list(data) if not isinstance(data, (list, str)) else data, h, lbl)

def grid(data, **kwargs):
    """Register a 2-D grid snapshot."""
    h, lbl = _split_kwargs(kwargs)
    _register("grid", [list(row) for row in data], h, lbl)

def text(data, **kwargs):
    """Register a string snapshot."""
    h, lbl = _split_kwargs(kwargs)
    _register("text", str(data), h, lbl)

def stack(data, **kwargs):
    """Register a stack (list, top=last) snapshot."""
    h, lbl = _split_kwargs(kwargs)
    _register("stack", list(data), h, lbl)

def queue(data, **kwargs):
    """Register a queue snapshot."""
    h, lbl = _split_kwargs(kwargs)
    _register("queue", list(data), h, lbl)

def set(data, **kwargs):
    """Register a set snapshot."""
    h, lbl = _split_kwargs(kwargs)
    _register("set", sorted(data), h, lbl)


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
