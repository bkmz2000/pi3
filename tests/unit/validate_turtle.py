"""
Runtime tests for the turtle shim.

Import graphics + turtle directly via PYTHONPATH (no Pyodide/browser).
Assert draw commands accumulate correctly in graphics._state._draw_commands.
`turtle.done()` calls graphics.show() which needs `js` — tests skip it.
"""

import math
import os
import sys
import traceback

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
sys.path.insert(0, os.path.join(ROOT, "src", "assets", "python"))

errors = 0


def test(name, ok, detail=""):
    global errors
    if ok:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}  {detail}")
        errors += 1


def _reset():
    """Fresh module + fresh draw state."""
    for mod in ("turtle", "graphics", "graphics._state"):
        sys.modules.pop(mod, None)
    import graphics
    from graphics import _state
    _state._draw_commands.clear()
    _state._width = 400
    _state._height = 400
    import turtle
    return turtle, graphics, _state


def cmds_of(state, name):
    return [c for c in state._draw_commands if c[0] == name]


# === movement ===

def test_forward_emits_line():
    t, g, s = _reset()
    t.forward(100)
    lines = cmds_of(s, "line")
    test("forward(100) emits 1 line", len(lines) == 1)
    (_, args, _) = lines[0]
    # origin center (200,200) → (300,200)
    test("forward line start=center", math.isclose(args[0], 200) and math.isclose(args[1], 200))
    test("forward line end=(300,200)", math.isclose(args[2], 300) and math.isclose(args[3], 200))
    test("turtle x moved to 100", math.isclose(t.xcor(), 100))
    test("turtle y unchanged", math.isclose(t.ycor(), 0))


def test_left_turns_ccw():
    t, g, s = _reset()
    t.left(90)
    t.forward(50)
    lines = cmds_of(s, "line")
    _, args, _ = lines[0]
    # heading=90 → moves +y → screen -y (up)
    test("left(90)+forward moves up on screen",
         math.isclose(args[2], 200) and math.isclose(args[3], 150))


def test_right_turns_cw():
    t, g, s = _reset()
    t.right(90)
    t.forward(50)
    _, args, _ = cmds_of(s, "line")[0]
    # heading=-90 → -y in turtle → +y on screen (down)
    test("right(90)+forward moves down on screen",
         math.isclose(args[2], 200) and math.isclose(args[3], 250))


def test_backward():
    t, g, s = _reset()
    t.backward(50)
    _, args, _ = cmds_of(s, "line")[0]
    test("backward(50) moves opposite heading", math.isclose(args[2], 150))


def test_penup_prevents_line():
    t, g, s = _reset()
    t.penup()
    t.forward(100)
    test("penup: no line emitted", len(cmds_of(s, "line")) == 0)
    test("penup: position still updated", math.isclose(t.xcor(), 100))
    t.pendown()
    t.forward(10)
    test("pendown resumes drawing", len(cmds_of(s, "line")) == 1)


def test_goto_absolute():
    t, g, s = _reset()
    t.goto(50, -25)
    _, args, _ = cmds_of(s, "line")[0]
    test("goto ends at (50,-25) turtle → (250,225) screen",
         math.isclose(args[2], 250) and math.isclose(args[3], 225))
    test("xcor after goto", math.isclose(t.xcor(), 50))
    test("ycor after goto", math.isclose(t.ycor(), -25))


def test_setx_sety():
    t, g, s = _reset()
    t.setx(30)
    t.sety(40)
    test("setx", math.isclose(t.xcor(), 30))
    test("sety", math.isclose(t.ycor(), 40))


def test_home():
    t, g, s = _reset()
    t.goto(100, 100)
    t.left(45)
    t.home()
    test("home resets x", math.isclose(t.xcor(), 0))
    test("home resets y", math.isclose(t.ycor(), 0))
    test("home resets heading", math.isclose(t.heading(), 0))


def test_setheading():
    t, g, s = _reset()
    t.setheading(180)
    test("setheading(180)", math.isclose(t.heading(), 180))
    t.seth(-90)
    test("seth wraps negatives", math.isclose(t.heading(), 270))


# === pen state ===

def test_pensize():
    t, g, s = _reset()
    t.pensize(5)
    t.forward(10)
    widths = cmds_of(s, "stroke_width")
    test("pensize emits stroke_width", len(widths) >= 1)
    test("stroke_width value", widths[-1][1][0] == 5)
    test("pensize() query returns value", t.pensize() == 5)


def test_pencolor_named():
    t, g, s = _reset()
    t.pencolor("red")
    t.forward(10)
    strokes = [c for c in s._draw_commands if c[0] == "stroke"]
    test("pencolor emits stroke", len(strokes) == 1)
    test("pencolor('red') resolves to RGB tuple", isinstance(strokes[0][1], tuple) and len(strokes[0][1]) == 3)


def test_pencolor_rgb():
    t, g, s = _reset()
    t.pencolor(10, 20, 30)
    test("pencolor(r,g,b) stored", t.pencolor() == (10, 20, 30))


def test_color_pair():
    t, g, s = _reset()
    t.color("red", "blue")
    pen, fill = t.color()
    test("color(pen, fill) stores both differently", pen != fill)


# === fills ===

def test_begin_end_fill():
    t, g, s = _reset()
    t.begin_fill()
    t.forward(50); t.left(90)
    t.forward(50); t.left(90)
    t.forward(50); t.left(90)
    t.forward(50)
    t.end_fill()
    polys = cmds_of(s, "polygon")
    test("end_fill emits polygon", len(polys) == 1)
    flat = polys[0][1][0]
    test("polygon has ≥4 vertices (8 coords)", len(flat) >= 8)


def test_end_fill_without_begin_is_noop():
    t, g, s = _reset()
    t.end_fill()
    test("end_fill w/o begin: no polygon", len(cmds_of(s, "polygon")) == 0)


# === shapes ===

def test_circle_positive_radius():
    t, g, s = _reset()
    t.circle(50)
    lines = cmds_of(s, "line")
    test("circle emits many line segments", len(lines) > 10)
    # After full circle (extent=360), turtle should be back at start with heading advanced 360.
    test("circle returns to origin (approx)",
         math.isclose(t.xcor(), 0, abs_tol=1e-6) and math.isclose(t.ycor(), 0, abs_tol=1e-6))


def test_circle_partial_arc():
    t, g, s = _reset()
    t.circle(50, 90)
    test("circle(r, 90) advances heading by 90", math.isclose(t.heading(), 90))


def test_dot():
    t, g, s = _reset()
    t.dot(10)
    circles = cmds_of(s, "circle")
    test("dot emits circle", len(circles) == 1)
    _, args, _ = circles[0]
    test("dot radius = size/2", math.isclose(args[2], 5))


# === queries ===

def test_distance_towards():
    t, g, s = _reset()
    test("distance((3,4))", math.isclose(t.distance((3, 4)), 5))
    test("towards(0,10) == 90", math.isclose(t.towards(0, 10), 90))
    test("towards(10,0) == 0", math.isclose(t.towards(10, 0), 0))


def test_position_tuple():
    t, g, s = _reset()
    t.goto(7, 9)
    test("position()", t.position() == (7.0, 9.0))
    test("pos() alias", t.pos() == (7.0, 9.0))


# === multiple turtles ===

def test_independent_turtles():
    t, g, s = _reset()
    a = t.Turtle()
    b = t.Turtle()
    a.forward(10)
    b.left(90)
    b.forward(20)
    test("turtle a moved", math.isclose(a.xcor(), 10) and math.isclose(a.ycor(), 0))
    test("turtle b independent",
         math.isclose(b.xcor(), 0, abs_tol=1e-9) and math.isclose(b.ycor(), 20))


# === screen helpers ===

def test_setup_resizes():
    t, g, s = _reset()
    t.setup(800, 600)
    test("setup sets width", g.width() == 800)
    test("setup sets height", g.height() == 600)


def test_bgcolor_emits_background():
    t, g, s = _reset()
    t.bgcolor(10, 20, 30)
    bgs = cmds_of(s, "background")
    test("bgcolor emits background", len(bgs) >= 1)
    test("bgcolor(r,g,b) last color matches", bgs[-1][1] == (10, 20, 30))


def test_screen_returns_object():
    t, g, s = _reset()
    scr = t.getscreen()
    test("getscreen returns Screen", isinstance(scr, t.Screen))
    scr.bgcolor(255, 255, 255)
    test("Screen.bgcolor works", len(cmds_of(s, "background")) >= 1)


def test_hideturtle_showturtle():
    t, g, s = _reset()
    t.hideturtle()
    test("isvisible false after hideturtle", t.isvisible() is False)
    t.showturtle()
    test("isvisible true after showturtle", t.isvisible() is True)


# === visibility of module API ===

def test_module_api_present():
    t, g, s = _reset()
    for name in ("forward", "backward", "left", "right", "goto", "penup",
                 "pendown", "pencolor", "fillcolor", "color", "begin_fill",
                 "end_fill", "circle", "dot", "home", "setheading",
                 "position", "heading", "xcor", "ycor", "hideturtle",
                 "showturtle", "isvisible", "speed", "done", "mainloop",
                 "Turtle", "Screen", "bgcolor", "setup"):
        test(f"turtle.{name} exists", hasattr(t, name))


def test_stdlib_shadowed():
    """Our /turtle.py shadows CPython stdlib turtle when imported from src/assets/python."""
    t, g, s = _reset()
    test("turtle module has no tkinter dep (no _Screen singleton attr)",
         not hasattr(t, "_Screen"))
    test("turtle.Turtle is our class",
         t.Turtle.__module__ == "turtle" and hasattr(t.Turtle, "_goto"))


ALL_TESTS = [v for k, v in list(globals().items()) if k.startswith("test_")]


def main():
    for fn in ALL_TESTS:
        try:
            fn()
        except Exception:
            global errors
            errors += 1
            print(f"  FAIL  {fn.__name__}  (exception)")
            traceback.print_exc()
    print()
    if errors:
        print(f"FAILED: {errors} assertion(s) failed")
        sys.exit(1)
    print("ALL TESTS PASSED")


if __name__ == "__main__":
    main()
