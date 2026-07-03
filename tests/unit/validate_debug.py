#!/usr/bin/env python3
"""
Standalone test harness for pi3.debug.
Run via: PYTHONPATH=src/assets/python python3 tests/unit/validate_debug.py
"""
import sys
import traceback

# Stub out JS interop before importing debug
import types as _types
_js_mod = _types.ModuleType("js")
sys.modules["js"] = _js_mod

# Stub out graphics._state (the real module uses JS globals)
import importlib, pathlib
_gpath = pathlib.Path("src/assets/python")
sys.path.insert(0, str(_gpath))

# We need graphics._state but NOT the full graphics module (which needs a canvas)
# Import just _state directly
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location("graphics._state", _gpath / "graphics/_state.py")
_state_mod = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_state_mod)

import sys as _sys
if "graphics" not in _sys.modules:
    _g_mod = _types.ModuleType("graphics")
    _g_mod._state = _state_mod
    _sys.modules["graphics"] = _g_mod
    _sys.modules["graphics._state"] = _state_mod

from pi3 import debug

failures = []

def check(label, condition, msg=""):
    if not condition:
        failures.append(f"FAIL [{label}]: {msg}")

def reset():
    """Reset debug state between tests."""
    from graphics import _state
    _state._debug_slots.clear()
    _state._debug_frames.clear()
    _state._debug_fresh_slots.clear()

# ── Test: capture-by-value ────────────────────────────────────────────────────
reset()
arr = [1, 2, 3]
debug.array(arr, red=0)
arr[0] = 99  # mutate after registration
debug.show()
from graphics import _state
frame = _state._debug_frames[0]
check("capture-by-value", frame["slots"][0]["data"][0] == 1,
      f"expected 1, got {frame['slots'][0]['data'][0]}")

# ── Test: slot identity by line ───────────────────────────────────────────────
reset()
a = [1, 2]; b = [3, 4]
debug.array(a)
debug.array(b)
debug.show()
frame = _state._debug_frames[-1]
check("two-slots-two-lines", len(frame["slots"]) == 2,
      f"expected 2 slots, got {len(frame['slots'])}")

# ── Test: same line = one slot ────────────────────────────────────────────────
reset()
for _v in [[1], [2], [3]]:
    debug.array(_v)  # same line → one slot (replaced each iteration)
debug.show()
frame = _state._debug_frames[-1]
check("same-line-one-slot", len(frame["slots"]) == 1,
      f"expected 1 slot, got {len(frame['slots'])}")
check("same-line-last-value", frame["slots"][0]["data"] == [3],
      f"expected [3], got {frame['slots'][0]['data']}")

# ── Test: two distinct calls on the same line → two slots (D7 regression) ─────
reset()
_a = [1]; _b = [2]
debug.array(_a); debug.array(_b)  # two calls, same lineno, different f_lasti
debug.show()
frame = _state._debug_frames[-1]
check("same-line-distinct-calls-two-slots", len(frame["slots"]) == 2,
      f"expected 2 slots (D7), got {len(frame['slots'])}")

# ── Test: stale marking ───────────────────────────────────────────────────────
reset()
debug.array([1, 2, 3])
debug.show()  # frame 0: fresh
debug.show()  # frame 1: stale (no re-registration)
frame0 = _state._debug_frames[0]
frame1 = _state._debug_frames[1]
check("fresh-in-frame0", frame0["slots"][0]["fresh"] is True)
check("stale-in-frame1", frame1["slots"][0]["fresh"] is False)

# ── Test: selection normalization (1D) ────────────────────────────────────────
reset()
debug.array([1, 2, 3], red=1)
from graphics import _state as st
slot = list(st._debug_slots.values())[0]
check("1d-int-atom", slot["highlights"]["red"] == [["index", 1]],
      f"got {slot['highlights']['red']}")

reset()
debug.array([1, 2, 3], blue=(0, 2))
slot = list(st._debug_slots.values())[0]
check("1d-tuple-range-atom", slot["highlights"]["blue"] == [["range", 0, 2]],
      f"got {slot['highlights']['blue']}")

reset()
debug.array([1, 2, 3], green=debug.range(0, 2))
slot = list(st._debug_slots.values())[0]
check("1d-range-sentinel", slot["highlights"]["green"] == [["range", 0, 2]],
      f"got {slot['highlights']['green']}")

# ── Test: selection normalization (2D) ────────────────────────────────────────
reset()
debug.grid([[1, 2], [3, 4]], red=(1, 0))
slot = list(st._debug_slots.values())[0]
check("2d-tuple-cell", slot["highlights"]["red"] == [["cell", 1, 0]],
      f"got {slot['highlights']['red']}")

reset()
debug.grid([[1, 2], [3, 4]], green=debug.cell(0, 1))
slot = list(st._debug_slots.values())[0]
check("2d-cell-sentinel", slot["highlights"]["green"] == [["cell", 0, 1]],
      f"got {slot['highlights']['green']}")

# ── Test: implicit final show (no explicit show()) ────────────────────────────
reset()
debug.array([9, 8, 7])
# Simulate the implicit show logic
if st._debug_fresh_slots:
    debug.show()
check("implicit-show", len(st._debug_frames) == 1,
      f"expected 1 frame, got {len(st._debug_frames)}")

# ── Test: graceful no-op on empty ────────────────────────────────────────────
reset()
debug.show()  # no slots → should be silent no-op
check("noop-empty-show", len(st._debug_frames) == 0,
      f"expected 0 frames, got {len(st._debug_frames)}")

# ── Test: grid data structure ─────────────────────────────────────────────────
reset()
debug.grid([[1, 2, 3], [4, 5, 6]])
slot = list(st._debug_slots.values())[0]
check("grid-data", slot["data"] == [[1, 2, 3], [4, 5, 6]],
      f"got {slot['data']}")

# ── Test: set data is sorted ──────────────────────────────────────────────────
reset()
debug.set({3, 1, 2})
slot = list(st._debug_slots.values())[0]
check("set-sorted", slot["data"] == [1, 2, 3], f"got {slot['data']}")

# ── Results ───────────────────────────────────────────────────────────────────
if failures:
    print("\n".join(failures))
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
