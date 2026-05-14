"""
Static validation tests for the graphics module and examples.

These tests check Python code correctness by parsing ASTs — they don't need
Pyodide or a browser, so they run fast and catch structural errors.
"""

import ast
import glob
import os
import sys
import traceback

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
GRAPHICS_DIR = os.path.join(ROOT, "src", "assets", "python", "graphics")
EXAMPLES_DIR = os.path.join(ROOT, "src", "assets", "examples")

errors = 0


def test(name, ok):
    global errors
    if ok:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}")
        errors += 1


def get_func_names(tree):
    """Return set of function/method names defined at top level."""
    names = set()
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names.add(node.name)
        elif isinstance(node, ast.ClassDef):
            names.add(node.name)
    return names


def get_class_body_names(tree, class_name):
    """Return set of method names inside a class definition."""
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return {
                n.name
                for n in node.body
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            }
    return set()


def get_all_names(tree):
    """Return set of all names assigned, defined, or imported at top level of a module."""
    names = set()
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    names.add(target.id)
                elif isinstance(target, ast.Tuple):
                    for elt in target.elts:
                        if isinstance(elt, ast.Name):
                            names.add(elt.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            names.add(node.target.id)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.asname or alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name != "*":
                    names.add(alias.asname or alias.name)
    return names


def get_all_of_type(tree, node_type):
    """Return top-level nodes of a given type."""
    return [
        n for n in ast.iter_child_nodes(tree) if isinstance(n, node_type)
    ]


class_names = set()


# === 1. Graphics module validation ===

print("\n=== Graphics module: __init__.py ===")

init_path = os.path.join(GRAPHICS_DIR, "__init__.py")
with open(init_path) as f:
    init_src = f.read()

tree = ast.parse(init_src, filename=init_path)

# Check it compiles
test("Compiles", True)

# Check __all__ exists
all_node = None
for node in ast.iter_child_nodes(tree):
    if isinstance(node, ast.Assign):
        for t in node.targets:
            if isinstance(t, ast.Name) and t.id == "__all__":
                all_node = node
test("Has __all__ export list", all_node is not None)

# Check every name in __all__ actually exists in the module
all_names = set()
for elt in all_node.value.elts if all_node else []:
    if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
        all_names.add(elt.value)

module_names = get_all_names(tree)
missing = all_names - module_names
test("All __all__ names exist as module-level names", len(missing) == 0)
if missing:
    print(f"       Missing from module: {missing}")

extra = module_names - all_names - {"__all__"}
# Internal _-prefixed names and imports shouldn't be in __all__
internal = {n for n in extra if n.startswith("_") or n in {"math", "traceback", "Optional", "Union", "Callable", "Any", "Actor"}}
real_extra = extra - internal
if real_extra:
    print(f"       Public names not in __all__: {sorted(real_extra)}")

# Check that expected functions exist
expected_funcs = {
    "size", "width", "height",
    "circle", "rect", "ellipse", "line", "point",
    "text", "text_size", "text_align",
    "fill", "no_fill", "stroke", "no_stroke", "stroke_width",
    "background",
    "push", "pop", "translate", "rotate", "scale",
    "image", "image_mode", "rect_mode",
    "run", "stop", "frame_rate",
    "random", "random_color",
    "_tick",
}

func_names = get_func_names(tree)
for fn in expected_funcs:
    test(f"Function '{fn}' is defined", fn in func_names)
    if fn not in func_names:
        print(f"       Expected {fn} in {sorted(func_names)}")

# Check Mouse and Keyboard classes exist
test("Mouse class exists", "_Mouse" in get_class_body_names(tree, "_Mouse") or "_Mouse" in func_names)
test("Keyboard class exists", "_Keyboard" in get_class_body_names(tree, "_Keyboard") or "_Keyboard" in func_names)

# Check Mouse has expected properties
mouse_methods = get_class_body_names(tree, "_Mouse")
for prop in ["x", "y", "pressed", "down", "released"]:
    test(f"Mouse.{prop} exists", prop in mouse_methods)

# Check Keyboard has _Key class and _Keyboard class
key_methods = get_class_body_names(tree, "_Key")
for prop in ["pressed", "down", "released"]:
    test(f"Keyboard._Key.{prop} exists", prop in key_methods)

# Verify no old decorators remain
old_decorators = {"setup", "every", "on_key_press", "on_mouse_move", "on_mouse_click", "on_collide", "on_collide_any"}
for d in old_decorators:
    test(f"Old decorator '{d}' is removed", d not in func_names)

# Verify no old mouse state remains
for old in {"_mouse_handlers", "_collision_handlers"}:
    test(f"Old state '{old}' is removed", old not in module_names)


# === 2. Actors module validation ===

print("\n=== Graphics module: actors/__init__.py ===")

actors_path = os.path.join(GRAPHICS_DIR, "actors", "__init__.py")
with open(actors_path) as f:
    actors_src = f.read()

atree = ast.parse(actors_src, filename=actors_path)
test("Actors compiles", True)

# Check Actor class exists and has expected methods
actor_methods = get_class_body_names(atree, "Actor")
test("Actor class exists", "Actor" in get_func_names(atree))

expected_actor_methods = {
    "move", "move_to", "change_x_by", "change_y_by",
    "point_towards", "rotate",
    "die", "is_alive",
    "update", "draw",
    "collides_with", "collides_any",
    "_apply_velocity",
}
for m in expected_actor_methods:
    test(f"Actor.{m}() exists", m in actor_methods)

# Check Actor has expected properties
expected_actor_props = {"x", "y", "angle", "vx", "vy", "speed", "visible", "collidable"}
# Properties look like methods with @property decorator in AST
for prop in expected_actor_props:
    test(f"Actor.{prop} property", prop in actor_methods)

# Verify old Actor methods are removed
old_methods = {"hide", "show", "ghost", "from_cfg", "set_coords", "get_coords",
               "get_x", "get_y", "set_angle", "get_angle", "rotate_clockwise",
               "move_forward", "move_left", "move_right", "move_up", "move_down",
               "set_speed", "get_speed"}
for m in old_methods:
    test(f"Old actor method '{m}' removed", m not in actor_methods)

# Check Rect and Circle exist
rect_methods = get_class_body_names(atree, "Rect")
circle_methods = get_class_body_names(atree, "Circle")
test("Rect class exists", "Rect" in get_func_names(atree))
test("Circle class exists", "Circle" in get_func_names(atree))
test("Rect has draw()", "draw" in rect_methods)
test("Circle has draw()", "draw" in circle_methods)

# Check Group class
group_methods = get_class_body_names(atree, "Group")
test("Group class exists", "Group" in get_func_names(atree))
for m in {"add", "remove", "__iter__", "__len__"}:
    test(f"Group.{m}() exists", m in group_methods)

# Check no imports from config.py
test("No import of config.py", "import config" not in actors_src and "from config" not in actors_src)
test("No MethodType import", "MethodType" not in actors_src)
test("No from_cfg reference", "from_cfg" not in actors_src)
test("No _state dict", "_state" not in actors_src)


# === 3. Config.py is gone ===

print("\n=== Config system ===")

config_path = os.path.join(GRAPHICS_DIR, "actors", "config.py")
test("config.py is deleted", not os.path.exists(config_path))


# === 4. Example validation ===

print("\n=== Example syntax check ===")

example_files = []
for root_dir, dirs, files in os.walk(EXAMPLES_DIR):
    for f in files:
        if f.endswith(".py"):
            example_files.append(os.path.join(root_dir, f))

# Known old examples that should still be there (not deleted)
expected_examples = {
    "asteroids/files/main.py",
    "bounce/bounce.py",
    "catch/catch.py",
    "hello_world/hello_world.py",
    "input/input.py",
    "p5/p5.py",
    "robot/robot.py",
    "snake/snake.py",
    "sokoban/sokoban.py",
    "swatches/swatches.py",
}

for ex in expected_examples:
    path = os.path.join(EXAMPLES_DIR, ex)
    test(f"Example '{ex}' exists", os.path.exists(path))
    if os.path.exists(path):
        with open(path) as f:
            try:
                ast.parse(f.read(), filename=path)
                test(f"Example '{ex}' compiles", True)
            except SyntaxError as e:
                test(f"Example '{ex}' compiles", False)
                print(f"       {e}")

# Check deleted config files are gone
test("snake_cfg.py deleted", not os.path.exists(os.path.join(EXAMPLES_DIR, "snake", "snake_cfg.py")))
test("apple_cfg.py deleted", not os.path.exists(os.path.join(EXAMPLES_DIR, "snake", "apple_cfg.py")))

# Check no old API usage in examples
for ex_path in example_files:
    with open(ex_path) as f:
        src = f.read()
    rel = os.path.relpath(ex_path, EXAMPLES_DIR)
    # Keyboard.ArrowXxx is broken (lowercases to "arrowup" not "arrow_up")
    for bad_key in ["Keyboard.ArrowUp", "Keyboard.ArrowDown", "Keyboard.ArrowLeft", "Keyboard.ArrowRight"]:
        if bad_key in src:
            test(f"No '{bad_key}' in {rel} (use arrow_up/down/left/right)", False)
            print(f"       Found in: {ex_path}")
    for old_api in ["set_coords", "get_coords", "set_angle", "get_angle",
                     "move_forward", "move_left", "move_right", "move_up", "move_down",
                     "rotate_clockwise", "set_speed", "get_speed",
                     "Actor.from_cfg", "from_cfg", "on_mouse_move",
                     "on_mouse_click", "on_collide", "on_collide_any",
                     "mouse_x()", "mouse_y()"]:
        if old_api in src:
            # frame_rate is still valid, don't flag it
            if old_api == "frame_rate":
                if "graphics.frame_rate" in src or "g.frame_rate" in src or "from graphics" in src:
                    continue
            test(f"No '{old_api}' in {rel}", False)
            print(f"       Found in: {ex_path}")

# Check all examples use new patterns
print("\n=== Example API usage ===")

# Sokoban should use Keyboard singleton and run()
soko_path = os.path.join(EXAMPLES_DIR, "sokoban", "sokoban.py")
with open(soko_path) as f:
    soko_src = f.read()
test("Sokoban uses run()", "run(" in soko_src)
test("Sokoban uses Keyboard", "Keyboard." in soko_src)
test("Sokoban no old @decorators", "@" not in soko_src.replace("@property", ""))
test("Sokoban no Keyboard.ArrowUp (use arrow_up)", "Keyboard.ArrowUp" not in soko_src)
test("Sokoban uses Colors", "Colors." in soko_src)

# Asteroids should use run(), Mouse.pressed
ast_path = os.path.join(EXAMPLES_DIR, "asteroids", "files", "main.py")
with open(ast_path) as f:
    ast_src = f.read()
test("Asteroids uses run()", "run(" in ast_src)
test("Asteroids uses Mouse.pressed", "Mouse.pressed" in ast_src)
test("Asteroids uses .x/.y not get_coords", "get_coords" not in ast_src)

# Snake should not use from_cfg, and must use correct arrow key names
snake_path = os.path.join(EXAMPLES_DIR, "snake", "snake.py")
with open(snake_path) as f:
    snake_src = f.read()
test("Snake no from_cfg", "from_cfg" not in snake_src)
test("Snake uses run()", "run(" in snake_src)
test("Snake uses Keyboard", "Keyboard." in snake_src)
test("Snake uses Colors", "Colors." in snake_src)
test("Snake no Keyboard.ArrowUp (use arrow_up)", "Keyboard.ArrowUp" not in snake_src)
test("Snake uses Keyboard.arrow_up", "Keyboard.arrow_up" in snake_src)

# P5 should use Rect and Mouse
p5_path = os.path.join(EXAMPLES_DIR, "p5", "p5.py")
with open(p5_path) as f:
    p5_src = f.read()
test("P5 uses Rect", "Rect(" in p5_src)
test("P5 uses Mouse", "Mouse." in p5_src)
test("P5 uses run()", "run(" in p5_src)

# Bounce should use Circle and not have the * 2 radius bug
bounce_path = os.path.join(EXAMPLES_DIR, "bounce", "bounce.py")
with open(bounce_path) as f:
    bounce_src = f.read()
test("Bounce uses Circle", "Circle" in bounce_src)
test("Bounce uses Colors", "Colors." in bounce_src)
test("Bounce no radius*2 bug", "radius * 2" not in bounce_src and "radius*2" not in bounce_src)

# Catch should use Colors, Window anchors, collides_with, run()
catch_path = os.path.join(EXAMPLES_DIR, "catch", "catch.py")
with open(catch_path) as f:
    catch_src = f.read()
test("Catch uses Colors", "Colors." in catch_src)
test("Catch uses Window.top_left", "Window.top_left" in catch_src)
test("Catch uses Window.top_right", "Window.top_right" in catch_src)
test("Catch uses collides_with", "collides_with" in catch_src)
test("Catch uses run()", "run(" in catch_src)
test("Catch no Keyboard.Arrow (use arrow_up etc.)", "Keyboard.Arrow" not in catch_src)

# Robot should use say(), Keyboard.key_N, Window.bottom, run()
robot_path = os.path.join(EXAMPLES_DIR, "robot", "robot.py")
with open(robot_path) as f:
    robot_src = f.read()
test("Robot uses say()", "say(" in robot_src)
test("Robot uses Keyboard.key_1", "Keyboard.key_1" in robot_src)
test("Robot uses Window.bottom", "Window.bottom" in robot_src)
test("Robot uses Colors", "Colors." in robot_src)
test("Robot uses run()", "run(" in robot_src)
test("Robot uses actor anchor (.top)", ".top)" in robot_src or ".top," in robot_src)

# Swatches should reference every Colors.* name and use run()
swatches_path = os.path.join(EXAMPLES_DIR, "swatches", "swatches.py")
with open(swatches_path) as f:
    swatches_src = f.read()
test("Swatches uses run()", "run(" in swatches_src)
for color_name in ["red", "green", "blue", "yellow", "orange", "purple",
                   "pink", "cyan", "white", "black", "gray", "brown"]:
    test(f"Swatches references Colors.{color_name}", f"Colors.{color_name}" in swatches_src)


# === 5. IdeState.ts example references ===

print("\n=== TypeScript example references ===")

ts_path = os.path.join(ROOT, "src", "state", "IdeState.ts")
with open(ts_path) as f:
    ts_src = f.read()
test("No snake_cfg import in IdeState.ts", "snake_cfg" not in ts_src)
test("No apple_cfg import in IdeState.ts", "apple_cfg" not in ts_src)


# === 6. Runtime tests (no browser needed — inspect _draw_commands) ===

print("\n=== Runtime: graphics module ===")

sys.path.insert(0, os.path.join(ROOT, "src", "assets", "python"))
import graphics as g
from graphics.actors import Actor, Rect, Circle, Group, Collider
from graphics import AnchorPoint

def cmd(): return g._draw_commands[-1]
def cmds(): return list(g._draw_commands)
def reset():
    g._draw_commands.clear()
    Actor._registry.clear()
    Actor._id_counter = 0


# --- Colors ---

test("Colors.red is a 3-tuple", isinstance(g.Colors.red, tuple) and len(g.Colors.red) == 3)
test("Colors.green is a 3-tuple", isinstance(g.Colors.green, tuple) and len(g.Colors.green) == 3)
test("Colors.blue is a 3-tuple", isinstance(g.Colors.blue, tuple) and len(g.Colors.blue) == 3)

reset(); g.fill(g.Colors.red)
test("fill(Colors.red) queues fill", cmd()[0] == "fill")
test("fill(Colors.red) value matches Colors.red", cmd()[1] == g.Colors.red)

saved_red = g.Colors.red
g.Colors._update_theme({"red": (200, 50, 50)})
test("_update_theme updates Colors.red", g.Colors.red == (200, 50, 50))
g.Colors._update_theme({"red": saved_red})
test("_update_theme restores Colors.red", g.Colors.red == saved_red)

g.Colors._update_theme({"nonexistent_color": (1, 2, 3)})
test("_update_theme ignores unknown colors", not hasattr(g.Colors, "nonexistent_color"))


# --- fill / no_fill / stroke / no_stroke ---

reset(); g.fill(None)
test("fill(None) queues no_fill", cmd()[0] == "no_fill")

reset(); g.no_fill()
test("no_fill() queues no_fill", cmd()[0] == "no_fill")

reset(); g.fill("blue")
test("fill('blue') queues fill", cmd()[0] == "fill")
test("fill('blue') value is blue rgb", cmd()[1] == (0, 0, 255))

reset(); g.fill(100, 150, 200)
test("fill(r,g,b) queues correct rgb", cmd() == ("fill", (100, 150, 200), {}))

reset(); g.fill(128)
test("fill(gray) queues gray rgb", cmd() == ("fill", (128, 128, 128), {}))

reset(); g.fill((255, 0, 128))
test("fill(tuple) queues correct rgb", cmd() == ("fill", (255, 0, 128), {}))

reset(); g.stroke(None)
test("stroke(None) queues no_stroke", cmd()[0] == "no_stroke")

reset(); g.no_stroke()
test("no_stroke() queues no_stroke", cmd()[0] == "no_stroke")

reset(); g.stroke(255, 0, 0)
test("stroke(r,g,b) queues stroke", cmd() == ("stroke", (255, 0, 0), {}))

reset(); g.stroke("red")
test("stroke('red') queues stroke", cmd()[0] == "stroke")
test("stroke('red') value is red", cmd()[1] == (255, 0, 0))

reset(); g.stroke_width(3)
test("stroke_width(3) queues correctly", cmd() == ("stroke_width", (3,), {}))


# --- background ---

reset(); g.background("black")
test("background('black') queues (0,0,0)", cmd() == ("background", (0, 0, 0), {}))

reset(); g.background(10, 20, 30)
test("background(r,g,b) queues correctly", cmd() == ("background", (10, 20, 30), {}))

reset(); g.background(100)
test("background(gray) queues gray", cmd() == ("background", (100, 100, 100), {}))

reset(); g.background((50, 60, 70))
test("background(tuple) queues correctly", cmd() == ("background", (50, 60, 70), {}))


# --- drawing shapes ---

reset(); g.circle(10, 20, 30)
test("circle queues circle cmd", cmd() == ("circle", (10.0, 20.0, 30.0), {}))

reset(); g.rect(1, 2, 3, 4)
test("rect queues rect cmd", cmd() == ("rect", (1.0, 2.0, 3.0, 4.0), {}))

reset(); g.ellipse(5, 5, 20)
test("ellipse with no h defaults to w", cmd() == ("ellipse", (5.0, 5.0, 20.0, 20.0), {}))

reset(); g.ellipse(5, 5, 20, 10)
test("ellipse(x,y,w,h) queues correctly", cmd() == ("ellipse", (5.0, 5.0, 20.0, 10.0), {}))

reset(); g.line(0, 0, 10, 10)
test("line queues line cmd", cmd() == ("line", (0.0, 0.0, 10.0, 10.0), {}))

reset(); g.point(5, 7)
test("point queues point cmd", cmd() == ("point", (5.0, 7.0), {}))

reset(); g.text("hi", 5, 10)
test("text(s,x,y) queues text cmd", cmd() == ("text", ("hi", 5.0, 10.0), {}))


# --- text_size / text_align ---

reset(); g.text_size(18)
test("text_size(18) queues correctly", cmd() == ("text_size", (18,), {}))

reset(); g.text_align("center", "middle")
test("text_align queues correctly", cmd() == ("text_align", ("center", "middle"), {}))

reset(); g.text_align("right")
test("text_align with one arg queues correctly", cmd()[0] == "text_align" and cmd()[1][0] == "right")


# --- transforms ---

reset(); g.push(); g.translate(5, 10); g.rotate(45); g.pop()
cs = cmds()
test("push/translate/rotate/pop queued in order",
     [c[0] for c in cs] == ["push", "translate", "rotate", "pop"])
test("translate args", cs[1] == ("translate", (5.0, 10.0), {}))
test("rotate arg", cs[2] == ("rotate", (45.0,), {}))

reset(); g.scale(2)
test("scale(2) queues (2.0, 2.0)", cmd() == ("scale", (2.0, 2.0), {}))

reset(); g.scale(2, 3)
test("scale(x,y) queues correctly", cmd() == ("scale", (2.0, 3.0), {}))


# --- text with AnchorPoint ---

g._width = 800; g._height = 600

reset(); g.text("Score", g.Window.top_right)
cs = cmds()
test("text(s, anchor) queues text_align then text", len(cs) == 2 and cs[0][0] == "text_align" and cs[1][0] == "text")
test("text(Window.top_right) aligns right", cs[0][1][0] == "right")
test("text(Window.top_right) baseline top", cs[0][1][1] == "top")
test("text(Window.top_right) x is padded left from right edge", cs[1][1][1] < 800)

reset(); g.text("Lives", g.Window.top_left)
cs = cmds()
test("text(Window.top_left) aligns left", cs[0][1][0] == "left")
test("text(Window.top_left) x > 0 (padded)", cs[1][1][1] > 0)

reset(); g.text("Center", g.Window.center)
cs = cmds()
test("text(Window.center) aligns center", cs[0][1][0] == "center")
test("text(Window.center) x near 400", 350 < cs[1][1][1] < 450)

reset(); g.text("Bottom", g.Window.bottom)
cs = cmds()
test("text(Window.bottom) baseline bottom", cs[0][1][1] == "bottom")
test("text(Window.bottom) y padded above bottom edge", cs[1][1][2] < 600)


# --- say() command queuing ---

reset(); g.say("Hello", g.Window.top_left)
cs = cmds()
test("say() queues a 'say' command", len(cs) == 1 and cs[0][0] == "say")
test("say() command has string first", cs[0][1][0] == "Hello")


# --- Keyboard ---

test("Keyboard.key_0.down is False", g.Keyboard.key_0.down == False)
test("Keyboard.key_9.pressed is False", g.Keyboard.key_9.pressed == False)
test("Keyboard.key_5.released is False", g.Keyboard.key_5.released == False)
test("Keyboard['0'].down is False", g.Keyboard["0"].down == False)
test("Keyboard['1'].pressed is False", g.Keyboard["1"].pressed == False)
test("Keyboard.arrow_left.down is False", g.Keyboard.arrow_left.down == False)
test("Keyboard.space.down is False", g.Keyboard.space.down == False)
test("Keyboard.enter.down is False", g.Keyboard.enter.down == False)

try:
    _ = g.Keyboard["totally_invalid_key_xyz"]
    test("Keyboard['invalid'] raises KeyError", False)
except KeyError:
    test("Keyboard['invalid'] raises KeyError", True)


# --- Window singleton ---

g._width = 500; g._height = 400
test("Window.width", g.Window.width == 500)
test("Window.height", g.Window.height == 400)

top_left = g.Window.top_left
test("Window.top_left x == 0", top_left.x == 0)
test("Window.top_left y == 0", top_left.y == 0)

top_right = g.Window.top_right
test("Window.top_right x == 500", top_right.x == 500)
test("Window.top_right y == 0", top_right.y == 0)

bot_left = g.Window.bottom_left
test("Window.bottom_left x == 0", bot_left.x == 0)
test("Window.bottom_left y == 400", bot_left.y == 400)

bot_right = g.Window.bottom_right
test("Window.bottom_right x == 500", bot_right.x == 500)
test("Window.bottom_right y == 400", bot_right.y == 400)

center = g.Window.center
test("Window.center x == 250", center.x == 250)
test("Window.center y == 200", center.y == 200)

top = g.Window.top
test("Window.top x == 250", top.x == 250)
test("Window.top y == 0", top.y == 0)

bottom = g.Window.bottom
test("Window.bottom x == 250", bottom.x == 250)
test("Window.bottom y == 400", bottom.y == 400)

left = g.Window.left
test("Window.left x == 0", left.x == 0)
test("Window.left y == 200", left.y == 200)

right = g.Window.right
test("Window.right x == 500", right.x == 500)
test("Window.right y == 200", right.y == 200)

# Window anchors are dynamic (lambda-based)
g._width = 600; g._height = 300
test("Window.top_right x updates with _width", g.Window.top_right.x == 600)
test("Window.center x updates with _width", g.Window.center.x == 300)
test("Window.bottom y updates with _height", g.Window.bottom.y == 300)


# --- AnchorPoint ---

ap = AnchorPoint(10, 20, "left", "top")
test("AnchorPoint static x", ap.x == 10)
test("AnchorPoint static y", ap.y == 20)
test("AnchorPoint h_align", ap.h_align == "left")
test("AnchorPoint v_align", ap.v_align == "top")

g._width = 500; g._height = 400
ap2 = AnchorPoint(lambda: g._width, lambda: g._height, "right", "bottom")
test("AnchorPoint callable x", ap2.x == 500)
test("AnchorPoint callable y", ap2.y == 400)
g._width = 700
test("AnchorPoint callable x updates", ap2.x == 700)


# --- Collider ---

reset()
g._width = 400; g._height = 300

a = Actor()
test("Actor has collider attribute", hasattr(a, "collider"))
test("Actor.collider is Collider instance", isinstance(a.collider, Collider))
test("Base Actor collider.shape is None", a.collider.shape is None)
test("Base Actor.collidable is False", not a.collidable)

a.collider.set_circle(20)
test("set_circle sets shape to 'circle'", a.collider.shape == "circle")
test("set_circle sets radius", a.collider.radius == 20)
test("collidable True after set_circle", a.collidable)
test("set_circle default dx == 0", a.collider.dx == 0)
test("set_circle default dy == 0", a.collider.dy == 0)

a._x = 100; a._y = 50
test("active_x == x when dx==0", a.collider.active_x == 100)
test("active_y == y when dy==0", a.collider.active_y == 50)

a.collider.set_circle(20, dx=5, dy=-3)
test("set_circle with dx", a.collider.dx == 5)
test("set_circle with dy", a.collider.dy == -3)
test("active_x = x + dx", a.collider.active_x == 105)
test("active_y = y + dy", a.collider.active_y == 47)

a.collider.set_rect(40, 30)
test("set_rect sets shape to 'rect'", a.collider.shape == "rect")
test("set_rect sets width", a.collider.width == 40)
test("set_rect sets height", a.collider.height == 30)
test("set_rect resets dx to 0", a.collider.dx == 0)

a.collider.set_rect(40, 30, dx=10, dy=5)
test("set_rect with dx", a.collider.dx == 10)
test("set_rect with dy", a.collider.dy == 5)
test("rect active_x = x + dx", a.collider.active_x == 110)

a.collider.disable()
test("disable() clears shape to None", a.collider.shape is None)
test("collidable False after disable", not a.collidable)


# --- Rect / Circle auto-configure colliders ---

reset()
r = Rect(0, 0, 60, 40)
test("Rect auto collider shape == 'rect'", r.collider.shape == "rect")
test("Rect auto collider width == 60", r.collider.width == 60)
test("Rect auto collider height == 40", r.collider.height == 40)
test("Rect.collidable is True", r.collidable)

ci = Circle(0, 0, 25)
test("Circle auto collider shape == 'circle'", ci.collider.shape == "circle")
test("Circle auto collider radius == 25", ci.collider.radius == 25)
test("Circle.collidable is True", ci.collidable)


# --- Collision detection ---

print("\n=== Runtime: collision detection ===")

# circle-circle
reset()
a1 = Actor(); a1.collider.set_circle(10); a1._x = 0; a1._y = 0
a2 = Actor(); a2.collider.set_circle(10); a2._x = 15; a2._y = 0
test("Overlapping circles collide (dist < r1+r2)", a1.collides_with(a2))
a2._x = 19
test("Circles with dist just < r1+r2 collide", a1.collides_with(a2))
a2._x = 20
test("Touching circles (dist == r1+r2) do NOT collide (strict boundary)", not a1.collides_with(a2))
a2._x = 21
test("Circles with dist > r1+r2 don't collide", not a1.collides_with(a2))

# rect-rect
reset()
r1 = Rect(20, 20, 40, 40)   # center (20,20), half=20 → spans 0..40 in x
r2 = Rect(50, 20, 40, 40)   # center (50,20), half=20 → spans 30..70 in x — overlapping
test("Overlapping rects collide", r1.collides_with(r2))
r2._x = 62                   # spans 42..82 — not overlapping
test("Non-overlapping rects don't collide", not r1.collides_with(r2))

# circle-rect
reset()
ci2 = Circle(0, 0, 10)
r3 = Rect(15, 0, 20, 20)    # center (15,0), half=10 → left edge at 5
test("Circle-rect: overlapping collide", ci2.collides_with(r3))
r3._x = 19                   # ci dx=max(9,0)=9; 81 < 100 → overlapping
test("Circle-rect: overlapping by 1 unit collides", ci2.collides_with(r3))
r3._x = 20                   # ci dx=max(10,0)=10; 100 < 100 → False (strict boundary)
test("Circle-rect: exact boundary does NOT collide (strict <)", not ci2.collides_with(r3))
r3._x = 21                   # gap of 1
test("Circle-rect: gap means no collision", not ci2.collides_with(r3))

# Non-collidable actors
reset()
b1 = Actor(); b1._x = 0; b1._y = 0   # no collider set
b2 = Actor(); b2.collider.set_circle(10); b2._x = 5; b2._y = 0
test("Non-collidable actor never collides", not b1.collides_with(b2))

# collides_any
reset()
g1 = Actor(); g1.collider.set_circle(10); g1._x = 0; g1._y = 0
targets = Group()
for i in range(3):
    t = Actor(); t.collider.set_circle(10); t._x = 50 + i * 50; t._y = 0
    targets.add(t)
near = Actor(); near.collider.set_circle(10); near._x = 10; near._y = 0
targets.add(near)
test("collides_any finds overlapping actor", g1.collides_any(targets) is near)

# Collision with offset collider
# a3 at x=0 with dx=30 → active_x=30; a4 at x=35 → dist=5 < 20 → collides
# Without dx, a3 would be at x=0, dist=35 > 20 → no collision
reset()
a3 = Actor(); a3.collider.set_circle(10, dx=30); a3._x = 0; a3._y = 0
a4 = Actor(); a4.collider.set_circle(10); a4._x = 35; a4._y = 0
test("Offset shifts zone toward a4: dist from active_x is 5 < 20 → collides", a3.collides_with(a4))
a4._x = 65  # a3 active_x=30, a4 at 65, dist=35 > 20 → no collision
test("Offset collider: a4 far from shifted zone, no collision", not a3.collides_with(a4))


# --- Spatial helpers ---

print("\n=== Runtime: spatial helpers ===")

g._width = 800; g._height = 600

# random_position with Circle (radius=20 margin)
reset()
ball = Circle(0, 0, 20)
for i in range(30):
    ball.random_position()
    in_x = 20 <= ball._x <= 780
    in_y = 20 <= ball._y <= 580
    test(f"random_position fully inside canvas (run {i+1})", in_x and in_y)

# random_position with Rect
reset()
box = Rect(0, 0, 60, 40)
for i in range(10):
    box.random_position()
    in_x = 30 <= box._x <= 770
    in_y = 20 <= box._y <= 580
    test(f"Rect random_position inside canvas (run {i+1})", in_x and in_y)

# random_position with base Actor (no collider shape → margin 0)
reset()
a_base = Actor(); a_base._x = 5; a_base._y = 5
a_base.random_position()
test("Base Actor random_position in bounds", 0 <= a_base._x <= 800 and 0 <= a_base._y <= 600)

# wrap_x
reset()
ball2 = Circle(0, 0, 10)
ball2._x = -5; ball2.wrap_x()
test("wrap_x from left: x becomes x + width", ball2._x == 795)
ball2._x = 805; ball2.wrap_x()
test("wrap_x from right: x becomes x - width", ball2._x == 5)
ball2._x = 400; ball2.wrap_x()
test("wrap_x mid-screen: no change", ball2._x == 400)

# wrap_y
ball2._y = -5; ball2.wrap_y()
test("wrap_y from top: y becomes y + height", ball2._y == 595)
ball2._y = 605; ball2.wrap_y()
test("wrap_y from bottom: y becomes y - height", ball2._y == 5)
ball2._y = 300; ball2.wrap_y()
test("wrap_y mid-screen: no change", ball2._y == 300)

# wrap()
ball2._x = -1; ball2._y = -1; ball2.wrap()
test("wrap() wraps both x and y", ball2._x == 799 and ball2._y == 599)

# in_bounds
reset()
probe = Actor()
probe._x = 400; probe._y = 300
test("in_bounds True when inside", probe.in_bounds())
probe._x = -1
test("in_bounds False when x < 0", not probe.in_bounds())
probe._x = 801
test("in_bounds False when x > width", not probe.in_bounds())
probe._x = 400; probe._y = -1
test("in_bounds False when y < 0", not probe.in_bounds())
probe._y = 601
test("in_bounds False when y > height", not probe.in_bounds())
probe._x = 0; probe._y = 0
test("in_bounds True at origin", probe.in_bounds())
probe._x = 800; probe._y = 600
test("in_bounds True at far corner", probe.in_bounds())


# --- Actor anchor properties ---

print("\n=== Runtime: actor anchor properties ===")

reset()
g._width = 800; g._height = 600

# Rect: center at (100,100), w=40, h=20 → half=(20,10)
r_anc = Rect(100, 100, 40, 20)
test("Rect.top.y == 90",          r_anc.top.y == 90)
test("Rect.bottom.y == 110",      r_anc.bottom.y == 110)
test("Rect.left.x == 80",         r_anc.left.x == 80)
test("Rect.right.x == 120",       r_anc.right.x == 120)
test("Rect.top.x == 100 (center)",  r_anc.top.x == 100)
test("Rect.left.y == 100 (center)", r_anc.left.y == 100)
test("Rect.top_right.x == 120",   r_anc.top_right.x == 120)
test("Rect.top_right.y == 90",    r_anc.top_right.y == 90)
test("Rect.top_left.x == 80",     r_anc.top_left.x == 80)
test("Rect.top_left.y == 90",     r_anc.top_left.y == 90)
test("Rect.bottom_right.x == 120", r_anc.bottom_right.x == 120)
test("Rect.bottom_right.y == 110", r_anc.bottom_right.y == 110)
test("Rect.bottom_left.x == 80",  r_anc.bottom_left.x == 80)
test("Rect.bottom_left.y == 110", r_anc.bottom_left.y == 110)
test("Rect.center.x == 100",      r_anc.center.x == 100)
test("Rect.center.y == 100",      r_anc.center.y == 100)

# Anchor h_align/v_align
test("Rect.top v_align == 'bottom'",    r_anc.top.v_align == "bottom")
test("Rect.bottom v_align == 'top'",    r_anc.bottom.v_align == "top")
test("Rect.left h_align == 'right'",    r_anc.left.h_align == "right")
test("Rect.right h_align == 'left'",    r_anc.right.h_align == "left")
test("Rect.top_right h_align == 'left'", r_anc.top_right.h_align == "left")
test("Rect.top_right v_align == 'bottom'", r_anc.top_right.v_align == "bottom")
test("Rect.center h_align == 'center'", r_anc.center.h_align == "center")
test("Rect.center v_align == 'middle'", r_anc.center.v_align == "middle")

# Circle: center at (50,50), radius=15
ci_anc = Circle(50, 50, 15)
test("Circle.top.y == 35",    ci_anc.top.y == 35)
test("Circle.bottom.y == 65", ci_anc.bottom.y == 65)
test("Circle.left.x == 35",   ci_anc.left.x == 35)
test("Circle.right.x == 65",  ci_anc.right.x == 65)
test("Circle.top.x == 50",    ci_anc.top.x == 50)
test("Circle.top_right.x == 65", ci_anc.top_right.x == 65)
test("Circle.top_right.y == 35", ci_anc.top_right.y == 35)
test("Circle.center.x == 50", ci_anc.center.x == 50)
test("Circle.center.y == 50", ci_anc.center.y == 50)

# Base Actor with no collider shape — anchors fall back to (x, y)
reset()
a_bare = Actor(); a_bare._x = 10; a_bare._y = 20
test("Base Actor.top.x == x", a_bare.top.x == 10)
test("Base Actor.top.y == y (no half-size)", a_bare.top.y == 20)
test("Base Actor.top_left.x == x", a_bare.top_left.x == 10)
test("Base Actor.top_left.y == y", a_bare.top_left.y == 20)
test("Base Actor.center.x == x", a_bare.center.x == 10)
test("Base Actor.center.y == y", a_bare.center.y == 20)

# Anchors are static snapshots (not lambdas)
snap = r_anc.top_right
r_anc._x = 200
test("Actor anchor is a static snapshot, not dynamic", snap.x == 120)


# === Summary ===

print(f"\n{'='*50}")
if errors == 0:
    print("ALL TESTS PASSED")
else:
    print(f"{errors} TEST(S) FAILED")

sys.exit(1 if errors else 0)
