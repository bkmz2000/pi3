#!/usr/bin/env python3
"""Worker reset behavior — real assertions on graphics state.

The old tests/unit/workerReset.test.ts was an expect(true) placeholder.
The invariants are pure-Python and testable without Pyodide:
  1. _reset_run_state() resets frame_count and input state,
  2. it does NOT bump _loop_generation (A2: _run() bumps exactly once),
  3. _clear() fully resets _loop_generation (fresh run starts clean).
A tiny `js` stub (clearTimeout) lets _clear() run without Pyodide.
"""
import os
import sys
import types

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
sys.path.insert(0, os.path.join(ROOT, "src", "assets", "python"))

# Stub the `js` module that graphics imports lazily inside _clear().
js_stub = types.ModuleType("js")
js_stub.clearTimeout = lambda tid: None
sys.modules.setdefault("js", js_stub)

import graphics  # noqa: E402
from graphics import _state  # noqa: E402

errors = 0


def test(name, ok, detail=""):
    global errors
    if ok:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}  {detail}")
        errors += 1


print("Worker reset — _reset_run_state() (A2 invariant)")
gen_before = _state._loop_generation
graphics.frame_count = 42
_state._mouse_down = True
_state._mouse_x = 10
_state._keys_pressed = set(["w"])
_state._keys_released = set(["a"])
graphics._reset_run_state()
test("frame_count resets to 0", graphics.frame_count == 0,
      f"got {graphics.frame_count}")
test("_loop_generation NOT bumped (A2)",
      _state._loop_generation == gen_before,
      f"{gen_before} -> {_state._loop_generation}")
test("mouse state resets",
      _state._mouse_down is False and _state._mouse_x == 0)
test("key state resets",
      _state._keys_pressed == set() and _state._keys_released == set())


print("Worker reset — _clear() full reset")
_state._loop_generation = 7
_state._running = True
_state._draw_commands = ["stale"]
graphics._clear()
test("_clear() zeroes _loop_generation", _state._loop_generation == 0,
      f"got {_state._loop_generation}")
test("_clear() stops running", _state._running is False)
test("_clear() empties draw commands", _state._draw_commands == [])


if errors == 0:
    print("ALL TESTS PASSED")
    sys.exit(0)
else:
    print(f"{errors} TEST(S) FAILED")
    sys.exit(1)
