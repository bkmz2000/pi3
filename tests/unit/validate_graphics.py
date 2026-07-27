"""
Static validation tests for the graphics module and examples.

These tests check Python code correctness by parsing ASTs — they don't need
Pyodide or a browser, so they run fast and catch structural errors.
"""

import ast
import glob
import math
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
    "image",
    "run", "stop", "frame_rate",
    "random", "random_color",
    "lerp", "darker", "lighter", "saturated", "desaturated",
    "create_sprite", "get_pixel", "set_pixel", "palette_swap", "flood_fill",
    "darken", "lighten", "saturate", "desaturate",
    "_tick",
}

# Check that new public classes exist at module level (added by
# graphics-lighting-collisions-themes change).
expected_classes = {
    "TileRef", "TilemapLayer", "TileMap",
    "Light", "Camera",
    "Sprite",
}
for cls in expected_classes:
    test(f"Class '{cls}' is defined", cls in get_func_names(tree))

# Old tagging API has been removed in favor of cell-set Areas brushed in the
# Tile Editor. Check that the legacy methods are gone and the new entry points
# exist on TileMap.
tilemap_layer_methods = get_class_body_names(tree, "TilemapLayer")
for m in ("tag", "all_tiles"):
    test(f"TilemapLayer.{m} removed", m not in tilemap_layer_methods)
tilemap_methods = get_class_body_names(tree, "TileMap")
for m in ("tag", "all_tiles"):
    test(f"TileMap.{m} removed", m not in tilemap_methods)
test("TileMap.__init__ exists", "__init__" in tilemap_methods)

# Stage 3: Tile Tier-3 mutation + groups
for m in ("set", "get", "count_neighbors", "group"):
    test(f"TilemapLayer.{m} exists", m in tilemap_layer_methods)
test("TileMap.group exists", "group" in tilemap_methods)
test("TileGroup class defined", "TileGroup" in get_func_names(tree))
tilegroup_methods = get_class_body_names(tree, "TileGroup")
for m in ("cells", "bounds", "random_cell", "shrink", "border",
          "fill", "scatter", "fill_random"):
    test(f"TileGroup.{m} exists", m in tilegroup_methods)
test("noise() defined", "noise" in get_func_names(tree))

# Light API surface
light_methods = get_class_body_names(tree, "Light")
for m in ("__init__", "add_obstacles", "add_obst", "add_source",
          "shade", "flicker", "radius", "draw"):
    test(f"Light.{m} exists", m in light_methods)

test("SHADES assigned at module level", "SHADES" in module_names)

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
    "move", "forward", "move_to",
    "point_towards", "rotate",
    "distance_to", "bounce", "keep_in_bounds",
    "die", "is_alive",
    "update", "draw",
    "collides_with", "collides_any",
    "_apply_velocity",
}
for m in expected_actor_methods:
    test(f"Actor.{m}() exists", m in actor_methods)

# Check Actor has expected properties
expected_actor_props = {"x", "y", "angle", "vx", "vy", "visible", "collidable", "future_state"}
# Properties look like methods with @property decorator in AST
for prop in expected_actor_props:
    test(f"Actor.{prop} property", prop in actor_methods)

# ActorSnapshot is the lookahead returned by Actor.future_state.
test("ActorSnapshot class exists", "ActorSnapshot" in get_func_names(atree))
snapshot_methods = get_class_body_names(atree, "ActorSnapshot")
for m in ("collides_with", "collides_any"):
    test(f"ActorSnapshot.{m} exists", m in snapshot_methods)

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
test("No _state dict", "self._state" not in actors_src and "_state =" not in actors_src)


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
    "dungeon/dungeon.py",
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
from graphics._errors import FriendlyError

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


# --- fill / no_fill / stroke / no_stroke ---

reset(); g.fill(None)
test("fill(None) queues no_fill", cmd()[0] == "no_fill")

reset(); g.no_fill()
test("no_fill() queues no_fill", cmd()[0] == "no_fill")

reset(); g.fill("blue")
test("fill('blue') queues fill", cmd()[0] == "fill")
test("fill('blue') value is blue rgb", cmd()[1] == g.Colors.blue)

reset(); g.fill(100, 150, 200)
test("fill(r,g,b) queues correct rgb", cmd() == ("fill", (100, 150, 200)))

reset(); g.fill(128)
test("fill(gray) queues gray rgb", cmd() == ("fill", (128, 128, 128)))

reset(); g.fill((255, 0, 128))
test("fill(tuple) queues correct rgb", cmd() == ("fill", (255, 0, 128)))

reset(); g.stroke(None)
test("stroke(None) queues no_stroke", cmd()[0] == "no_stroke")

reset(); g.no_stroke()
test("no_stroke() queues no_stroke", cmd()[0] == "no_stroke")

reset(); g.stroke(255, 0, 0)
test("stroke(r,g,b) queues stroke", cmd() == ("stroke", (255, 0, 0)))

reset(); g.stroke("red")
test("stroke('red') queues stroke", cmd()[0] == "stroke")
test("stroke('red') value is red", cmd()[1] == g.Colors.red)

reset(); g.stroke_width(3)
test("stroke_width(3) queues correctly", cmd() == ("stroke_width", (3,)))


# --- background ---

reset(); g.background("black")
test("background('black') queues Colors.black", cmd() == ("background", g.Colors.black))

reset(); g.background(10, 20, 30)
test("background(r,g,b) queues correctly", cmd() == ("background", (10, 20, 30)))

reset(); g.background(100)
test("background(gray) queues gray", cmd() == ("background", (100, 100, 100)))

reset(); g.background((50, 60, 70))
test("background(tuple) queues correctly", cmd() == ("background", (50, 60, 70)))


# --- drawing shapes ---

reset(); g.circle(10, 20, 30)
test("circle queues circle cmd", cmd() == ("circle", (10.0, 20.0, 30.0)))

reset(); g.rect(1, 2, 3, 4)
test("rect queues rect cmd", cmd() == ("rect", (1.0, 2.0, 3.0, 4.0)))

reset(); g.ellipse(5, 5, 20)
test("ellipse with no h defaults to w", cmd() == ("ellipse", (5.0, 5.0, 20.0, 20.0)))

reset(); g.ellipse(5, 5, 20, 10)
test("ellipse(x,y,w,h) queues correctly", cmd() == ("ellipse", (5.0, 5.0, 20.0, 10.0)))

reset(); g.line(0, 0, 10, 10)
test("line queues line cmd", cmd() == ("line", (0.0, 0.0, 10.0, 10.0)))

reset(); g.point(5, 7)
test("point queues point cmd", cmd() == ("point", (5.0, 7.0)))

reset(); g.text("hi", 5, 10)
test("text(s,x,y) queues text cmd", cmd() == ("text", ("hi", 5.0, 10.0)))


# --- text_size / text_align ---

reset(); g.text_size(18)
test("text_size(18) queues correctly", cmd() == ("text_size", (18,)))

reset(); g.text_align("center", "middle")
test("text_align queues correctly", cmd() == ("text_align", ("center", "middle")))

reset(); g.text_align("right")
test("text_align with one arg queues correctly", cmd()[0] == "text_align" and cmd()[1][0] == "right")


# --- transforms ---

reset(); g.push(); g.translate(5, 10); g.rotate(45); g.pop()
cs = cmds()
test("push/translate/rotate/pop queued in order",
     [c[0] for c in cs] == ["push", "translate", "rotate", "pop"])
test("translate args", cs[1] == ("translate", (5.0, 10.0)))
test("rotate arg", cs[2] == ("rotate", (45.0,)))

reset(); g.scale(2)
test("scale(2) queues (2.0, 2.0)", cmd() == ("scale", (2.0, 2.0)))

reset(); g.scale(2, 3)
test("scale(x,y) queues correctly", cmd() == ("scale", (2.0, 3.0)))


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

try:
    _ = g.Keyboard.totally_invalid_key_xyz
    test("Keyboard.invalid raises FriendlyError", False)
except FriendlyError as e:
    test("Keyboard.invalid raises FriendlyError", e.message_key == "friendlyError.naming.unknownKey")
    test("Keyboard.invalid FriendlyError has name arg", e.message_args.get("name") == "totally_invalid_key_xyz")


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


# --- Vector2 ---

print("\n=== Runtime: Vector2 / Point ===")

from graphics import Vector2, Point

test("Vector2 in __all__", "Vector2" in g.__all__)
test("Point in __all__", "Point" in g.__all__)
test("Point is Vector2", Point is Vector2)

v = Vector2(3, 4)
test("Vector2(3,4).x == 3", v.x == 3)
test("Vector2(3,4).y == 4", v.y == 4)
test("Vector2 from tuple", Vector2((3, 4)) == Vector2(3, 4))
test("Vector2 from Vector2", Vector2(Vector2(3, 4)) == Vector2(3, 4))
test("Vector2 mutable x", (lambda v: (setattr(v, "x", 7), v.x == 7)[1])(Vector2(0, 0)))

# Arithmetic
test("v + w", Vector2(1, 2) + Vector2(3, 4) == Vector2(4, 6))
test("v + tuple", Vector2(1, 2) + (3, 4) == Vector2(4, 6))
test("v - w", Vector2(5, 5) - Vector2(2, 1) == Vector2(3, 4))
test("-v", -Vector2(3, 4) == Vector2(-3, -4))
test("v * scalar", Vector2(2, 3) * 2 == Vector2(4, 6))
test("scalar * v", 2 * Vector2(2, 3) == Vector2(4, 6))
test("v / scalar", Vector2(4, 6) / 2 == Vector2(2, 3))
inc = Vector2(1, 1); inc += Vector2(2, 3)
test("v += w", inc == Vector2(3, 4))
dec = Vector2(5, 5); dec -= Vector2(1, 2)
test("v -= w", dec == Vector2(4, 3))

# Equality / hash
test("Vector2 == tuple", Vector2(3, 4) == (3, 4))
test("Vector2 != other", Vector2(3, 4) != Vector2(3, 5))
test("Vector2 hashable", isinstance(hash(Vector2(3, 4)), int))

# Geometry
test("length 3-4-5", Vector2(3, 4).length == 5)
test("length_sq", Vector2(3, 4).length_sq == 25)
test("distance_to", Vector2(0, 0).distance_to(Vector2(3, 4)) == 5)
test("distance_to tuple", Vector2(0, 0).distance_to((3, 4)) == 5)
test("dot", Vector2(1, 2).dot(Vector2(3, 4)) == 11)
test("normalized length ~ 1", abs(Vector2(3, 4).normalized().length - 1.0) < 1e-9)
test("normalized zero stays zero", Vector2(0, 0).normalized() == Vector2(0, 0))


# --- Shape base + Line + Vector2.bounce_of ---

print("\n=== Runtime: Line / Shape / bounce_of ===")

from graphics.shapes import Line, Polygon, Spline, Shape, Segment


def _vclose(v, x, y, eps=1e-9):
    return abs(v.x - x) < eps and abs(v.y - y) < eps


test("Line in __all__", "Line" in g.__all__)
test("Line is a Shape", issubclass(Line, Shape))

# Endpoints accept tuples and become Vector2.
_floor = Line((0, 400), (600, 400))
test("Line.a is Vector2", isinstance(_floor.a, Vector2) and _floor.a == (0, 400))
test("Line.b is Vector2", isinstance(_floor.b, Vector2) and _floor.b == (600, 400))

# segments: exactly one Segment spanning the endpoints.
_segs = _floor.segments
test("Line has one segment", len(_segs) == 1 and isinstance(_segs[0], Segment))
test("segment endpoints match", _segs[0].a == (0, 400) and _segs[0].b == (600, 400))

# bounds is the axis-aligned box, order-independent of endpoint order.
test("Line.bounds", Line((10, 20), (40, 80)).bounds == (10, 20, 40, 80))
test("Line.bounds endpoint-order invariant",
     Line((40, 80), (10, 20)).bounds == (10, 20, 40, 80))

# thickness is constructor-only / read-only.
test("Line.thickness default", Line((0, 0), (1, 0)).thickness == 2)
test("Line.thickness from ctor", Line((0, 0), (1, 0), thickness=6).thickness == 6)


def _thickness_is_readonly():
    ln = Line((0, 0), (1, 0))
    try:
        ln.thickness = 9
        return False
    except AttributeError:
        return True


test("Line.thickness read-only", _thickness_is_readonly())

# bounce_of a horizontal floor: x preserved, y reflected.
_b1 = Vector2(3, 5).bounce_of(_floor)
test("bounce_of horizontal floor", _vclose(_b1, 3, -5))

# Normal-sign invariance: Line(a,b) and Line(b,a) give identical bounces.
_fwd = Vector2(3, 5).bounce_of(Line((0, 400), (600, 400)))
_rev = Vector2(3, 5).bounce_of(Line((600, 400), (0, 400)))
test("bounce_of normal-sign invariant", _vclose(_rev, _fwd.x, _fwd.y))

# Arbitrary-angle wall: (1,0) off a 45° "/" wall bounces straight up.
_ramp = Line((0, 0), (10, 10))
test("bounce_of 45deg wall", _vclose(Vector2(1, 0).bounce_of(_ramp), 0, 1))

# restitution scales the whole reflected vector.
test("restitution 1.0", _vclose(Vector2(0, 5).bounce_of(_floor, restitution=1.0), 0, -5))
test("restitution 0.5", _vclose(Vector2(0, 5).bounce_of(_floor, restitution=0.5), 0, -2.5))
test("restitution 1.5", _vclose(Vector2(0, 5).bounce_of(_floor, restitution=1.5), 0, -7.5))

# `at` is accepted and ignored for a Line (single normal).
test("bounce_of accepts at=", _vclose(Vector2(3, 5).bounce_of(_floor, at=(123, 400)), 3, -5))

# normal_at returns a unit vector.
test("Line.normal_at is unit", abs(_floor.normal_at().length - 1.0) < 1e-9)


# --- Polygon (closed region) ---

print("\n=== Runtime: Polygon ===")

test("Polygon in __all__", "Polygon" in g.__all__)
test("Polygon is a Shape", issubclass(Polygon, Shape))

_square = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
test("Polygon.points are Vector2", all(isinstance(p, Vector2) for p in _square.points))

# Closed loop: one segment per edge, last wraps back to the first point.
test("Polygon has one segment per edge", len(_square.segments) == 4)
test("Polygon last edge wraps to first",
     _square.segments[-1].a == (0, 100) and _square.segments[-1].b == (0, 0))
test("Polygon.bounds", _square.bounds == (0, 0, 100, 100))

# normal_at picks the nearest edge; expected (per formula) normals of the square.
test("Polygon.normal_at bottom edge", _vclose(_square.normal_at((50, 0)), 0, 1))
test("Polygon.normal_at right edge", _vclose(_square.normal_at((100, 50)), -1, 0))
test("Polygon.normal_at top edge", _vclose(_square.normal_at((50, 100)), 0, -1))
test("Polygon.normal_at left edge", _vclose(_square.normal_at((0, 50)), 1, 0))
test("Polygon.normal_at is unit", abs(_square.normal_at((50, 0)).length - 1.0) < 1e-9)

# contains: inside / outside / on-edge / vertex (on boundary counts as inside).
test("Polygon.contains inside", _square.contains((50, 50)) is True)
test("Polygon.contains outside (right)", _square.contains((150, 50)) is False)
test("Polygon.contains outside (left)", _square.contains((-10, 50)) is False)
test("Polygon.contains on edge is inside", _square.contains((50, 0)) is True)
test("Polygon.contains on vertex is inside", _square.contains((0, 0)) is True)
test("Polygon.contains accepts Vector2", _square.contains(Vector2(50, 50)) is True)

# Bounce off a polygon edge, using the contact point to pick the side.
test("bounce_of polygon bottom edge",
     _vclose(Vector2(0, -5).bounce_of(_square, at=(50, 1)), 0, 5))
test("bounce_of polygon right edge",
     _vclose(Vector2(5, 0).bounce_of(_square, at=(99, 50)), -5, 0))

# A triangle exercises non-axis-aligned edges.
_tri = Polygon([(0, 0), (100, 0), (50, 100)])
test("Triangle contains inside", _tri.contains((50, 20)) is True)
test("Triangle contains outside", _tri.contains((50, -5)) is False)
test("Triangle normal_at base edge", _vclose(_tri.normal_at((50, 0)), 0, 1))


# --- Spline (smooth cardinal curve + incremental add) ---

print("\n=== Runtime: Spline ===")

import time as _time
from graphics.shapes import _SPLINE_STEPS as _SP_S

test("Spline in __all__", "Spline" in g.__all__)
test("Spline is a Shape", issubclass(Spline, Shape))
test("Spline default is open", Spline([(0, 0), (1, 1)]).closed is False)

# --- The non-negotiable test: incremental add() must reproduce the one-shot
#     constructor build byte-for-byte (same _segments and _draw_points). ---
_curve_pts = [(0, 0), (50, 80), (120, 40), (200, 120), (260, 60), (320, 140), (380, 90)]
_one_shot = Spline(_curve_pts)
_incremental = Spline([])
for _p in _curve_pts:
    _incremental.add(_p)
_one_shot._ensure_built()
_incremental._ensure_built()
test("Spline incremental add() == constructor (draw_points)",
     _one_shot._draw_points == _incremental._draw_points)
test("Spline incremental add() == constructor (segments)",
     _one_shot._segments == _incremental._segments)
test("Spline add() returns self for chaining",
     Spline([(0, 0)]).add((1, 1)) is not None)

# --- O(1) guard (deterministic, not timing-based): add() must rebuild ONLY the
#     tail, leaving every earlier flattened vertex untouched. ---
_grow = Spline([(0, 0), (20, 10), (40, 0), (60, 15), (80, 5), (100, 12)])
_before = list(_grow._vertices)
_grow.add((120, 20))
_prefix_len = len(_before) - _SP_S   # everything except the old last span
test("Spline.add rebuilds only the tail (prefix vertices unchanged)",
     _grow._vertices[:_prefix_len] == _before[:_prefix_len])
test("Spline.add grows vertices by exactly one span",
     len(_grow._vertices) == len(_before) + _SP_S)

# --- Rough timing sanity (informational; the structural guard above is the real
#     gate). Adds at length ~1000 must not be dramatically slower than at ~100. ---
_timer = Spline([(0, 0), (1, 0)])
for _i in range(100):
    _timer.add((_i, (_i * 7) % 60))
_t0 = _time.perf_counter()
for _i in range(100):
    _timer.add((_i, (_i * 13) % 60))
_dt_small = _time.perf_counter() - _t0
for _i in range(800):
    _timer.add((_i, (_i * 3) % 60))
_t0 = _time.perf_counter()
for _i in range(100):
    _timer.add((_i, (_i * 17) % 60))
_dt_large = _time.perf_counter() - _t0
# O(1) => ratio ~1; a full re-flatten regression would be ~10x. 25x tolerates
# CI noise while still catching catastrophic O(n) blow-up.
test("Spline.add time does not blow up with length",
     _dt_large <= _dt_small * 25 + 0.02)

# --- closed vs open contains: the default (open) must NOT act as a region. ---
_ring_pts = [(0, 0), (100, 0), (100, 100), (0, 100)]
_closed = Spline(_ring_pts, closed=True)
_open = Spline(_ring_pts, closed=False)
test("Spline closed loop contains its center", _closed.contains((50, 50)) is True)
test("Spline OPEN does not contain center (not a filled region)",
     _open.contains((50, 50)) is False)
test("Spline open contains a point on the curve", _open.contains((100, 0)) is True)
test("Spline closed contains reports outside points False",
     _closed.contains((200, 50)) is False)

# --- Bounce off an open ramp at several contact points (dispatches to the
#     nearest-segment normal at `at`). ---
_ramp = Spline([(0, 400), (200, 300), (400, 380)])
for _at in [(100, 355), (200, 300), (300, 345)]:
    _n = _ramp.normal_at(_at)
    _v = Vector2(1, 3)
    _dot = _v.x * _n.x + _v.y * _n.y
    _exp = (_v.x - 2 * _dot * _n.x, _v.y - 2 * _dot * _n.y)
    test("bounce_of open ramp at %s" % (_at,),
         _vclose(_v.bounce_of(_ramp, at=_at), _exp[0], _exp[1]))
    test("Spline ramp normal is unit at %s" % (_at,), abs(_n.length - 1.0) < 1e-9)

# --- Bounce off a closed loop at several contact points. ---
_track = Spline([(0, 0), (120, 0), (120, 120), (0, 120)], closed=True)
for _at in [(60, 0), (120, 60), (60, 120)]:
    _n = _track.normal_at(_at)
    _v = Vector2(2, -1)
    _dot = _v.x * _n.x + _v.y * _n.y
    _exp = (_v.x - 2 * _dot * _n.x, _v.y - 2 * _dot * _n.y)
    test("bounce_of closed loop at %s" % (_at,),
         _vclose(_v.bounce_of(_track, at=_at), _exp[0], _exp[1]))

# --- thickness: default 6, constructor-only / read-only. ---
test("Spline.thickness default 6", Spline([(0, 0), (1, 1)]).thickness == 6)


def _spline_thickness_readonly():
    sp = Spline([(0, 0), (1, 1)])
    try:
        sp.thickness = 3
        return False
    except AttributeError:
        return True


test("Spline.thickness read-only", _spline_thickness_readonly())


# --- Shape.texture (draw-only; decoupled from collision) ---

print("\n=== Runtime: Shape.texture ===")

_tex = g.create_sprite(10, 10, fill=(200, 100, 50))

# Chaining: texture() returns the shape.
_chain = Line((0, 0), (10, 0))
test("texture() returns self", _chain.texture(_tex) is _chain)

# Tiling counts: one tile every `spacing` px along the whole outline.
_ln = Line((0, 0), (100, 0)).texture(_tex, spacing=10)
_ln._ensure_built()
test("texture tiles a line (len 100 / step 10 -> 10)", len(_ln._texture_blits) == 10)

# spacing=None defaults to the sprite's own width (10), same 10 tiles.
_ln2 = Line((0, 0), (100, 0)).texture(_tex)
_ln2._ensure_built()
test("texture spacing=None uses sprite width", len(_ln2._texture_blits) == 10)

# Spacing carries continuously across a polygon's corners (perimeter 400 / 10 = 40).
_sq = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)]).texture(_tex, spacing=10)
_sq._ensure_built()
test("texture wraps around a polygon perimeter (40 tiles)", len(_sq._texture_blits) == 40)

# Sheet entry / animation is resolved to its default frame via _default_sprite.
class _FakeEntry:
    def __init__(self, s):
        self._s = s

    def _default_sprite(self):
        return self._s


_lf = Line((0, 0), (50, 0)).texture(_FakeEntry(_tex), spacing=10)
_lf._ensure_built()
test("texture resolves _default_sprite", _lf._texture_sprite is _tex)
test("resolved sprite tiles (len 50 / step 10 -> 5)", len(_lf._texture_blits) == 5)

# Decoupling guarantee: collision results are identical with and without texture.
_deco = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
_n_before = _deco.normal_at((50, 0))
_c_before = _deco.contains((50, 50))
_b_before = Vector2(0, -5).bounce_of(_deco, at=(50, 1))
_deco.texture(_tex, spacing=10)
_deco._ensure_built()
test("texture leaves normal_at unchanged", _deco.normal_at((50, 0)) == _n_before)
test("texture leaves contains unchanged", _deco.contains((50, 50)) == _c_before)
test("texture leaves bounce_of unchanged",
     _vclose(Vector2(0, -5).bounce_of(_deco, at=(50, 1)), _b_before.x, _b_before.y))

# Textured draw emits rotated sprite blits; plain draw still strokes.
_sd = g._state
_sd._draw_commands.clear()
Line((0, 0), (100, 0)).texture(_tex, spacing=50).draw()
_cmds = [c[0] for c in _sd._draw_commands]
test("textured draw emits sprite blits", _cmds.count("sprite") == 2)
test("textured draw rotates each tile", "rotate" in _cmds and "push" in _cmds)
test("textured draw emits no polyline", "polyline" not in _cmds)

_sd._draw_commands.clear()
Line((0, 0), (100, 0)).draw()
test("plain draw still strokes a polyline", "polyline" in [c[0] for c in _sd._draw_commands])

# texture(None) clears it and reverts to a plain stroke.
_clr = Line((0, 0), (100, 0)).texture(_tex, spacing=10)
_clr._ensure_built()
test("texture applied before clear", len(_clr._texture_blits) == 10)
_clr.texture(None)
_clr._ensure_built()
test("texture(None) clears the blits", _clr._texture_blits == [])


# --- contains / random / `in` / distance_to(shape) ---

print("\n=== Runtime: contains / random / __contains__ ===")

from graphics._errors import FriendlyError

_region = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])

# random(): reject-sampling returns points that satisfy contains().
_many = _region.random(n=10)
test("random(n=10) returns a list of 10", isinstance(_many, list) and len(_many) == 10)
test("random points are all Vector2", all(isinstance(p, Vector2) for p in _many))
test("random points are all inside the shape", all(_region.contains(p) for p in _many))
test("random() n=1 returns a single inside Vector2",
     isinstance(_region.random(), Vector2) and _region.contains(_region.random()))


def _random_rect_miss():
    try:
        _region.random(rect=(500, 500, 600, 600), n=5)
        return False
    except FriendlyError as e:
        return e.message_key == "friendlyError.apiMisuse.shapeRandomFailed" \
            and e.message_args.get("found") == 0
test("random() raises FriendlyError when rect misses the shape", _random_rect_miss())

# __contains__: `point in shape` mirrors shape.contains(point) for all three.
test("`in` matches contains (Polygon inside)", ((50, 50) in _region) is True)
test("`in` matches contains (Polygon outside)", ((200, 200) in _region) is False)
_line_c = Line((0, 0), (100, 0))
test("`in` matches contains (Line)", ((50, 0) in _line_c) == _line_c.contains((50, 0)))
_loop_c = Spline([(0, 0), (100, 0), (100, 100), (0, 100)], closed=True)
test("`in` matches contains (closed Spline)",
     ((50, 50) in _loop_c) == _loop_c.contains((50, 50)))

# Line.contains is a nearness test (a line is never a filled region).
test("Line.contains on the line", Line((0, 0), (100, 0)).contains((50, 0)) is True)
test("Line.contains off the line", Line((0, 0), (100, 0)).contains((50, 20)) is False)

# Vector2.distance_to(shape): distance to the shape's outline.
_wall = Line((0, 0), (100, 0))
test("distance_to(Line) perpendicular", abs(Vector2(50, 10).distance_to(_wall) - 10.0) < 1e-9)
test("distance_to(Line) past the end clamps to endpoint",
     abs(Vector2(-10, 0).distance_to(_wall) - 10.0) < 1e-9)
test("distance_to(Polygon) nearest edge",
     abs(Vector2(50, -5).distance_to(_region) - 5.0) < 1e-9)
# Existing point/tuple behavior is unchanged.
test("distance_to still handles Vector2", Vector2(0, 0).distance_to(Vector2(3, 4)) == 5)
test("distance_to still handles tuple", Vector2(0, 0).distance_to((3, 4)) == 5)


# --- AnchorPoint is a Vector2 ---

print("\n=== Runtime: AnchorPoint ⊂ Vector2 ===")

reset()
ap_actor = Rect(10, 20, 40, 20)
ap = ap_actor.bottom  # x=10, y=30 (10+20/2... wait collider rect)
# Rect collider is set: width=40, height=20 → half=(20, 10). bottom = (10, 20+10=30)
test("AnchorPoint is Vector2 subclass", isinstance(ap, Vector2))
test("AnchorPoint arithmetic", (ap + Vector2(0, 5)).y == 35)
test("AnchorPoint == AnchorPoint same coords",
     Rect(10, 20, 40, 20).center == Rect(10, 20, 40, 20).center)
test("AnchorPoint.distance_to", ap.distance_to(Vector2(10, 30)) == 0)


# --- Actor pos / vel proxies ---

print("\n=== Runtime: Actor.pos / Actor.vel ===")

reset()
a_p = Actor(); a_p._x = 5; a_p._y = 7
p = a_p.pos
test("actor.pos returns Vector2", isinstance(p, Vector2))
test("actor.pos.x matches _x", p.x == 5)
test("actor.pos.y matches _y", p.y == 7)
a_p.pos = Vector2(100, 200)
test("actor.pos = v sets _x", a_p._x == 100)
test("actor.pos = v sets _y", a_p._y == 200)
a_p.pos = (1, 2)
test("actor.pos = tuple", a_p._x == 1 and a_p._y == 2)
a_p.pos += Vector2(10, 20)
test("actor.pos += v", a_p._x == 11 and a_p._y == 22)

a_v = Actor(); a_v._vx = 3; a_v._vy = 4
test("actor.vel.x matches _vx", a_v.vel.x == 3)
a_v.vel = Vector2(5, 6)
test("actor.vel = v sets _vx/_vy", a_v._vx == 5 and a_v._vy == 6)


# --- Actor anchors fall back to image dimensions when no collider ---

print("\n=== Runtime: Actor anchors use image size ===")

reset()
a_img = Actor()
a_img._x = 100
a_img._y = 200
a_img.image = {"done": True, "name": "hero", "width": 32, "height": 48}
test("Actor with image: bottom.y == y + h/2", a_img.bottom.y == 200 + 24)
test("Actor with image: top.y == y - h/2", a_img.top.y == 200 - 24)
test("Actor with image: left.x == x - w/2", a_img.left.x == 100 - 16)
test("Actor with image: right.x == x + w/2", a_img.right.x == 100 + 16)

# Explicit collider wins over image
reset()
a_both = Actor()
a_both._x = 100; a_both._y = 200
a_both.image = {"done": True, "name": "hero", "width": 32, "height": 48}
a_both.collider.set_rect(10, 10)
test("Explicit collider wins over image dims", a_both.bottom.y == 200 + 5)

# Image without width/height still falls back to (0, 0)
reset()
a_noimg = Actor(); a_noimg._x = 100; a_noimg._y = 200
a_noimg.image = {"done": True, "name": "hero"}
test("Image without dims → anchors at center", a_noimg.bottom.y == 200)


# --- Tilemap tile_at accepts Vector2 / AnchorPoint ---

print("\n=== Runtime: tile_at accepts Vector2/AnchorPoint ===")

tl = g.TilemapLayer("ground", 32, {0: {3: "tile_stone"}}, {})
test("tile_at(x, y) numeric still works", tl.tile_at(5, 100) == "tile_stone")
test("tile_at(Vector2)", tl.tile_at(Vector2(5, 100)) == "tile_stone")
test("tile_at(tuple)", tl.tile_at((5, 100)) == "tile_stone")
test("tile_at(empty cell) is None", tl.tile_at(200, 200) is None)

# An actor's bottom anchor should be usable directly
reset()
a_tile = Actor()
a_tile._x = 5; a_tile._y = 80
a_tile.image = {"done": True, "name": "hero", "width": 16, "height": 40}  # bottom.y = 100
test("tile_at(actor.bottom) works", tl.tile_at(a_tile.bottom) == "tile_stone")


# --- Camera ---

print("\n=== Runtime: Camera ===")

from graphics import Camera

test("Camera in __all__", "Camera" in g.__all__)
cam = Camera()
test("Camera default pos", cam.x == 0 and cam.y == 0)
cam.x = 10; cam.y = 20
test("Camera.x/y setters update pos", cam.pos.x == 10 and cam.pos.y == 20)

# follow snaps pos to actor coords (default lerp=1.0)
reset()
target = Actor(); target._x = 50; target._y = 60
cam2 = Camera()
cam2.follow(target)
g._width = 200; g._height = 100
reset()
with cam2:
    pass
# Camera should have snapped to actor position
test("Camera follow snaps to target", cam2.x == 50 and cam2.y == 60)
# The context manager should emit a push + translate then pop
kinds = [c[0] for c in g._draw_commands]
test("Camera emits push", "push" in kinds)
test("Camera emits translate", "translate" in kinds)
test("Camera emits pop", "pop" in kinds)
# translate args center the view: (width/2 - cam.x, height/2 - cam.y) = (100-50, 50-60) = (50, -10)
trans_args = next(c[1] for c in g._draw_commands if c[0] == "translate")
test("Camera translate centers on target",
     trans_args == (200/2 - 50, 100/2 - 60))

# lerp < 1 smooths
reset()
target.move_to(100, 0)
cam3 = Camera(0, 0)
cam3.follow(target, lerp=0.5)
with cam3:
    pass
test("Camera lerp halves toward target", cam3.x == 50 and cam3.y == 0)

# unfollow stops snapping
cam3.unfollow()
target.move_to(999, 999)
with cam3:
    pass
test("Camera unfollow holds pos", cam3.x == 50 and cam3.y == 0)


# --- TileMap.areas (cell-set zones brushed in the Tile Editor) ---

print("\n=== Runtime: TileMap.areas ===")

from graphics import TileRef, TileMap

reset()
# Layers are required to derive the tile size for area cells.
la = g.TilemapLayer("ground", 32, {}, {})
# Two areas: a 5-tile horizontal stripe at row 0, and a 2x2 block at (10..11, 5..6).
stripe_cells = [[c, 0] for c in range(5)]
block_cells = [[c, r] for c in (10, 11) for r in (5, 6)]
tm = TileMap([la], {"ground": la}, {
    "floor": {"cells": stripe_cells},
    "boss_arena": {"cells": block_cells},
})

# Attribute access on the areas namespace.
floor = tm.areas.floor
boss = tm.areas.boss_arena
test("tm.areas.floor returns Group", isinstance(floor, Group))
test("tm.areas.boss_arena returns Group", isinstance(boss, Group))

# Merging: 5-cell stripe collapses to 1 rect, 2x2 block to 1 rect.
test("floor merges to 1 rectangle", len(floor) == 1)
test("boss_arena merges to 1 rectangle", len(boss) == 1)

# Returned actors are TileRefs with correct rect colliders.
for a in floor:
    test("area actor is TileRef", isinstance(a, TileRef))
    test("area actor collider shape == rect", a.collider.shape == "rect")
    test("floor rect width == 5 * tile_size", a.collider.width == 5 * 32)
    test("floor rect height == 1 * tile_size", a.collider.height == 32)
    break

# Area coverage equals raw cell count × tile_size².
def _covered_area(grp):
    return sum(a.collider.width * a.collider.height for a in grp)
test("floor coverage matches cell count", _covered_area(floor) == 5 * 32 * 32)
test("boss_arena coverage matches cell count", _covered_area(boss) == 4 * 32 * 32)

# Empty area is valid and produces an empty Group.
tm_empty = TileMap([la], {"ground": la}, {"empty_zone": {"cells": []}})
test("empty area is valid", isinstance(tm_empty.areas.empty_zone, Group))
test("empty area has length 0", len(tm_empty.areas.empty_zone) == 0)

# TileRefs from areas are not in Actor._registry (would otherwise tick).
reg_before = len(Actor._registry)
_ = TileMap([la], {"ground": la}, {"x": {"cells": [[0, 0]]}})
test("area TileRefs not in Actor._registry", len(Actor._registry) == reg_before)

# collides_any against an area Group works like any other Group.
reset()
g._width = 400; g._height = 400
la3 = g.TilemapLayer("g", 32, {}, {})
tm3 = TileMap([la3], {"g": la3}, {"wall": {"cells": [[2, 2]]}})  # center (80, 80)
hero = Circle(80, 80, 10)
test("collides_any hits the area", hero.collides_any(tm3.areas.wall) is not None)
hero._x = 200; hero._y = 200
test("collides_any misses when far", hero.collides_any(tm3.areas.wall) is None)

# TileMap with no areas argument exposes an empty areas namespace.
tm_none = TileMap([la], {"ground": la})
test("areas defaults to empty namespace", not hasattr(tm_none.areas, "anything"))

# Areas are tilemap-wide: they don't belong to a specific layer.
test("TilemapLayer no longer has tag method", not hasattr(la, "tag"))
test("TilemapLayer no longer has all_tiles method", not hasattr(la, "all_tiles"))


# --- TileMap.collides_with: multi-tile merge reports top-left cell (regression: A1) ---
# Prior to the fix, col/row were derived from the merged rect's CENTER, so a 5-tile
# horizontal wall at cols 3..7 reported col=5. Correct answer: leftmost cell (col=3).
print("\n=== Runtime: TileMap.collides_with multi-tile cell coord ===")
reset()
g._width = 800; g._height = 400
la4 = g.TilemapLayer("g", 32, {c: {4: "brick"} for c in range(3, 8)}, {})
wall_cells = [[c, 4] for c in range(3, 8)]
tm4 = TileMap([la4], {"g": la4}, {"wall": {"cells": wall_cells}})
# Merged rect: cols 3..7, row 4 → left=96, top=128, width=160, height=32.
# Hero centered inside the merged rect at world (150, 140) — well inside.
hero4 = Circle(150, 140, 4)
hit = tm4.collides_with(hero4, "wall")
test("collides_with returns a hit for multi-tile wall", hit is not None)
test("hit.col == 3 (leftmost cell of merged rect)", hit is not None and hit.col == 3)
test("hit.row == 4 (topmost cell of merged rect)", hit is not None and hit.row == 4)
test("hit.tile == 'brick' (looked up at top-left cell)", hit is not None and hit.tile == "brick")


# --- Actor.future_state ---

print("\n=== Runtime: Actor.future_state ===")

reset()
wall_actor = Rect(20, 0, 10, 10)   # center (20, 0), half=5 → spans x=15..25
mover = Circle(0, 0, 5)
mover._vx = 20  # snapshot x=20, inside wall
test("Current collides_any: None", mover.collides_any([wall_actor]) is None)
fs = mover.future_state
test("future_state.collides_any returns the wall", fs.collides_any([wall_actor]) is wall_actor)
test("future_state.collides_with works", fs.collides_with(wall_actor))

# Actor state unchanged after snapshot use
saved_x, saved_y = mover._x, mover._y
_ = mover.future_state.collides_any([wall_actor])
test("Actor.x unchanged after snapshot use", mover._x == saved_x)
test("Actor.y unchanged after snapshot use", mover._y == saved_y)

# Snapshot pos equals next-frame actual pos after _apply_velocity
reset()
runner = Rect(10, 20, 8, 8)
runner._vx = 3
runner._vy = -2
pre_snap = runner.future_state
runner._apply_velocity()
test("Snapshot x matches post-_apply_velocity x", abs(pre_snap._x - runner._x) < 1e-9)
test("Snapshot y matches post-_apply_velocity y", abs(pre_snap._y - runner._y) < 1e-9)

# Polar(magnitude, angle_degrees) returns a Vector2 in screen coords:
# 0° = north (up, -y), 90° = east (+x), 180° = south (+y), 270° = west (-x).
print("\n=== Runtime: Polar(magnitude, angle_degrees) ===")
from graphics import Polar
test("Polar in __all__", "Polar" in g.__all__)
n = Polar(10, 0)
test("Polar(10, 0) points north (up)", abs(n.x) < 1e-9 and abs(n.y + 10) < 1e-9)
e = Polar(10, 90)
test("Polar(10, 90) points east (+x)", abs(e.x - 10) < 1e-9 and abs(e.y) < 1e-9)
s = Polar(10, 180)
test("Polar(10, 180) points south (+y)", abs(s.x) < 1e-9 and abs(s.y - 10) < 1e-9)
test("Polar returns a Vector2", isinstance(Polar(1, 0), Vector2))
test("Polar magnitude is preserved", abs(Polar(7, 33).length - 7) < 1e-9)
# Setting actor.vel = Polar(5, 90) drives motion east via _apply_velocity.
reset()
mover = Rect(0, 0, 4, 4)
mover.vel = Polar(5, 90)
mover._apply_velocity()
test("actor.vel = Polar then apply moves east", abs(mover._x - 5) < 1e-9 and abs(mover._y) < 1e-9)


# --- Colors (Sweetie 16 palette) ---

print("\n=== Runtime: Colors (Sweetie 16) ===")

test("Colors.red matches Sweetie", g.Colors.red == (177, 62, 83))
test("Colors.black matches Sweetie", g.Colors.black == (26, 28, 44))
test("Colors.white matches Sweetie", g.Colors.white == (244, 244, 244))
test("Colors.cyan matches Sweetie", g.Colors.cyan == (115, 239, 247))
test("Colors has 16 named slots",
     len([n for n in dir(g.Colors) if not n.startswith("_") and isinstance(getattr(g.Colors, n), tuple)]) == 16)


# --- Light ---

print("\n=== Runtime: Light ===")

from graphics import Light, SHADES

test("Light in __all__", "Light" in g.__all__)

reset()
torch = Circle(50, 50, 4)
tl = Light(ambient=(30, 30, 50), radius=120)
test("Light chain: add_source returns self", tl.add_source(torch) is tl)
test("Light chain: shade returns self", tl.shade("warm") is tl)
test("Light chain: flicker returns self", tl.flicker(True) is tl)
test("Light chain: radius returns self", tl.radius(100) is tl)
test("Light shade('warm') sets warm RGB", tl._shade_rgb == SHADES["warm"])

try:
    tl.shade("rainbow")
    test("Unknown shade raises", False)
except ValueError as e:
    test("Unknown shade raises ValueError naming it", "rainbow" in str(e))

# Flicker is deterministic in [0.85, 1.0] range
from graphics import _flicker_value
vals = [_flicker_value(42, f) for f in range(50)]
test("Flicker values in [0.85, 1.0]", all(0.85 <= v <= 1.0 for v in vals))
test("Flicker varies across frames", len(set(vals)) > 1)
test("Flicker deterministic (same input → same value)",
     _flicker_value(42, 7) == _flicker_value(42, 7))

# Position-only source via add_source
tl4 = Light()
tl4.add_source((100, 200))
test("add_source(tuple) registers a pos source", tl4._sources == [("pos", (100.0, 200.0))])
tl4.add_source(g.Vector2(5, 6))
test("add_source(Vector2) registers a pos source", tl4._sources[-1] == ("pos", (5.0, 6.0)))

# Single Actor as obstacle
reset()
wall1 = Rect(50, 50, 20, 20)
tlw = Light()
tlw.add_obst(wall1)
test("add_obst(actor) registers obstacle", tlw._obstacles == [wall1])
group = Group(); group.add(wall1)
tlw2 = Light()
tlw2.add_obstacles(group)
test("add_obstacles(group) registers from iterable", tlw2._obstacles == [wall1])

# Light.draw emits begin/poly/end
reset()
g._width = 400; g._height = 400
src_actor = Circle(100, 100, 4)
tld = Light(ambient=(20, 20, 40), radius=80).add_source(src_actor).shade("warm")
tld.draw()
kinds = [c[0] for c in g._draw_commands]
test("Light.draw emits light_begin first", kinds[0] == "light_begin")
test("Light.draw emits exactly one light_poly per source", kinds.count("light_poly") == 1)
test("Light.draw emits light_end last", kinds[-1] == "light_end")
# light_begin payload is the ambient
begin_cmd = g._draw_commands[0]
test("light_begin payload == ambient", begin_cmd[1] == (20, 20, 40))
poly_cmd = next(c for c in g._draw_commands if c[0] == "light_poly")
poly_flat, sx, sy, radius_val, shade_rgb, intensity = poly_cmd[1]
test("light_poly sx/sy match source pos", sx == 100.0 and sy == 100.0)
test("light_poly radius matches Light.radius", radius_val == 80.0)
test("light_poly shade_rgb is warm", shade_rgb == SHADES["warm"])
test("light_poly intensity is 1.0 (no flicker)", intensity == 1.0)
test("light_poly polygon has even-length flat coords", len(poly_flat) > 0 and len(poly_flat) % 2 == 0)

# Shadow notch: with a wall between source and far points, polygon should
# contain at least one vertex much closer than full radius behind the wall.
reset()
g._width = 400; g._height = 400
wall_block = Rect(60, 50, 20, 20)  # center 60,50, half=10 → spans 50..70, 40..60
notch_light = Light(ambient=(0,0,0), radius=300).add_source((50, 50)).add_obstacles([wall_block])
notch_light.draw()
poly_cmd2 = next(c for c in g._draw_commands if c[0] == "light_poly")
poly_flat2 = poly_cmd2[1][0]
# Distance from source (50,50) to each polygon vertex
dists = []
for i in range(0, len(poly_flat2), 2):
    px, py = poly_flat2[i], poly_flat2[i+1]
    dists.append(((px - 50) ** 2 + (py - 50) ** 2) ** 0.5)
test("Shadow notch present (min vertex dist << radius)", min(dists) < 100)

# Light.draw with flicker uses [0.85, 1.0] intensity
reset()
fl_light = Light(radius=50).add_source((10, 10)).flicker(True)
fl_light.draw()
poly_intensity = next(c[1][5] for c in g._draw_commands if c[0] == "light_poly")
test("Flicker intensity in range", 0.85 <= poly_intensity <= 1.0)


# --- Polygon caching ---

print("\n=== Runtime: Light polygon cache ===")
reset()
g._width = 400; g._height = 400
cache_walls = [Rect(50 + i*30, 50, 20, 20) for i in range(5)]
cache_light = Light(radius=120)
for w in cache_walls:
    cache_light.add_obst(w)
for pos in [(10, 10), (200, 200), (350, 350)]:
    cache_light.add_source(pos)

# Frame 1: nothing cached yet → all 3 recomputed.
reset_draw = lambda: g._draw_commands.clear()
reset_draw(); cache_light.draw()
test("First draw computes all source polygons",
     cache_light._cache_counters == {"recomputed": 3, "reused": 0})

# Frames 2-10: static scene → every source reuses its cached polygon.
for _ in range(9):
    reset_draw(); cache_light.draw()
test("Static scene reuses polygons (no recompute in 9 subsequent frames)",
     cache_light._cache_counters == {"recomputed": 3, "reused": 27})

# Moving any obstacle invalidates every source (the obstacle could shadow any of them).
cache_walls[2]._x += 50
reset_draw(); cache_light.draw()
test("Obstacle move triggers full recompute",
     cache_light._cache_counters == {"recomputed": 6, "reused": 27})

# After the move settles, polygons are cached again.
reset_draw(); cache_light.draw()
test("Polygons cached again after obstacle settles",
     cache_light._cache_counters == {"recomputed": 6, "reused": 30})

# Radius change invalidates every source (encoded in the per-source cache key).
cache_light.radius(200)
reset_draw(); cache_light.draw()
test("Radius change invalidates all sources",
     cache_light._cache_counters == {"recomputed": 9, "reused": 30})

# Adding a new source only computes that one; existing sources still cached.
cache_light.add_source((100, 100))
reset_draw(); cache_light.draw()
test("Adding a source only recomputes the new one",
     cache_light._cache_counters == {"recomputed": 10, "reused": 33})

# Moving a single source recomputes that source only (other source positions/radius unchanged).
# Re-bake first so counters are at a known steady state.
reset_draw(); cache_light.draw()
# Snapshot before moving.
before = dict(cache_light._cache_counters)
moving_src = Circle(50, 50, 4)
cache_light.add_source(moving_src)
reset_draw(); cache_light.draw()   # +1 recompute (the new actor source), 4 reuses
moving_src._x += 30                # move only the new actor source
reset_draw(); cache_light.draw()
# Expect: just the moved source recomputed, the other 4 reused.
delta_recompute = cache_light._cache_counters["recomputed"] - before["recomputed"]
delta_reused = cache_light._cache_counters["reused"] - before["reused"]
# After adding source: recompute +1, reuse +4. After move: recompute +1, reuse +4. Total: +2, +8.
test("Moving one source only recomputes that source",
     delta_recompute == 2 and delta_reused == 8)

# The cached polygon objects are the same Python list across frames (identity check).
reset()
g._width = 400; g._height = 400
stable_light = Light(radius=80).add_obst(Rect(50, 50, 20, 20)).add_source((10, 10))
reset_draw(); stable_light.draw()
poly_first = stable_light._source_polys[0][3]
reset_draw(); stable_light.draw()
poly_second = stable_light._source_polys[0][3]
test("Cached polygon is the same list object across frames",
     poly_first is poly_second)


# === 7.1: SheetAnimation / SpriteEntry / SheetNamespace ===

print("\n=== Sheet sprites: SheetAnimation / SpriteEntry / SheetNamespace ===")

from graphics import SheetAnimation, SpriteEntry, SheetNamespace

# Build some fake Sprite objects for frames
reset()
_fake_sprite = lambda w, h: g.Sprite(w, h, bytearray(w * h * 4))

# SheetAnimation: indexing and wrap
sa = SheetAnimation([_fake_sprite(16, 16), _fake_sprite(16, 16), _fake_sprite(16, 16)])
test("SheetAnimation: len returns frame count", len(sa) == 3)
test("SheetAnimation: [0] returns first frame", sa[0].width == 16)
test("SheetAnimation: [2] returns last frame", sa[2].width == 16)
test("SheetAnimation: [3] wraps to [0]", sa[3] is sa[0])
test("SheetAnimation: [-1] wraps to last", sa[-1] is sa[2])
test("SheetAnimation: large index wraps", sa[100] is sa[100 % 3])
test("SheetAnimation._default_sprite() is frames[0]", sa._default_sprite() is sa[0])

sa_empty = SheetAnimation([])
try:
    _ = sa_empty[0]
    test("Empty SheetAnimation: index raises FriendlyError", False)
except FriendlyError as e:
    test("Empty SheetAnimation: index raises FriendlyError", e.message_key == "friendlyError.logic.spriteNoFrames")
test("Empty SheetAnimation._default_sprite() is None", sa_empty._default_sprite() is None)

# SpriteEntry: attribute access
idle_anim = SheetAnimation([_fake_sprite(32, 32)])
run_anim  = SheetAnimation([_fake_sprite(32, 32), _fake_sprite(32, 32)])
se = SpriteEntry("hero", {"idle": idle_anim, "run": run_anim})
test("SpriteEntry.idle returns correct SheetAnimation", se.idle is idle_anim)
test("SpriteEntry.run returns correct SheetAnimation", se.run is run_anim)
try:
    _ = se.fly
    test("SpriteEntry: unknown animation raises FriendlyError", False)
except FriendlyError as e:
    test("SpriteEntry: unknown animation raises FriendlyError", e.message_args.get("name") == "fly")
try:
    _ = se._private
    test("SpriteEntry: _private raises AttributeError", False)
except AttributeError:
    test("SpriteEntry: _private raises AttributeError", True)
test("SpriteEntry._default_sprite() returns first frame of first anim",
     se._default_sprite() is idle_anim[0])

# SheetNamespace: attribute access
hero_entry  = SpriteEntry("hero",  {"idle": idle_anim})
enemy_entry = SpriteEntry("enemy", {"idle": idle_anim})
ns = SheetNamespace({"hero": hero_entry, "enemy": enemy_entry})
test("SheetNamespace.hero returns correct SpriteEntry", ns.hero is hero_entry)
test("SheetNamespace.enemy returns correct SpriteEntry", ns.enemy is enemy_entry)
try:
    _ = ns.ghost
    test("SheetNamespace: unknown sprite raises FriendlyError", False)
except FriendlyError as e:
    test("SheetNamespace: unknown sprite raises FriendlyError", e.message_args.get("name") == "ghost")
try:
    _ = ns._private
    test("SheetNamespace: _private raises AttributeError", False)
except AttributeError:
    test("SheetNamespace: _private raises AttributeError", True)


# === 7.2: AnimationController.tick() semantics ===

print("\n=== Sheet sprites: AnimationController.tick() ===")

from graphics import AnimationController

# Build an actor with a SpriteEntry image
reset()
f3 = [_fake_sprite(16, 16), _fake_sprite(16, 16), _fake_sprite(16, 16)]
anim3 = SheetAnimation(f3)
entry = SpriteEntry("hero", {"walk": anim3})
a_ctrl = Actor()
a_ctrl.image = entry

# First tick: no prior animation → switch, frame resets to 0, no advance
ctrl = a_ctrl.walk
test("actor.walk returns AnimationController", isinstance(ctrl, AnimationController))
test("ctrl.frame_idx starts at 0", ctrl.frame_idx == 0)
ctrl.tick()
test("First tick (switch from None): frame stays 0", ctrl.frame_idx == 0)
ctrl._ticked_this_frame = False   # simulate end-of-frame draw()

# Second tick: same animation → advances by 1
ctrl.tick()
test("Second tick (same anim): frame advances to 1", ctrl.frame_idx == 1)
ctrl._ticked_this_frame = False

# Third tick: wraps at frameCount=3
ctrl.tick()
test("Third tick: frame advances to 2", ctrl.frame_idx == 2)
ctrl._ticked_this_frame = False
ctrl.tick()
test("Fourth tick: wraps back to 0", ctrl.frame_idx == 0)
ctrl._ticked_this_frame = False

# Switch semantics: create a second controller for a different animation
ctrl2_anim = SheetAnimation([_fake_sprite(8, 8), _fake_sprite(8, 8)])
entry2 = SpriteEntry("hero", {"idle": ctrl2_anim, "run": anim3})
a2 = Actor(); a2.image = entry2
idle_ctrl = a2.idle
idle_ctrl.tick()           # tick idle once (switch from None → frame 0)
idle_ctrl._ticked_this_frame = False
idle_ctrl.tick()           # advance to frame 1
test("idle: after 2 ticks frame == 1", idle_ctrl.frame_idx == 1)
idle_ctrl._ticked_this_frame = False
run_ctrl = a2.run
run_ctrl.tick()            # switch from idle to run → reset, no advance
test("Switch to run: frame resets to 0", run_ctrl.frame_idx == 0)

# Double-tick guard: warn on stderr but don't advance
import io
reset()
dbl_entry = SpriteEntry("hero", {"walk": SheetAnimation([_fake_sprite(8, 8), _fake_sprite(8, 8)])})
dbl_actor = Actor(); dbl_actor.image = dbl_entry
dbl_ctrl = dbl_actor.walk
dbl_ctrl.tick()   # first tick — frame stays 0 (switch from None)
dbl_ctrl.tick()   # double-tick in same frame — should warn, not advance
test("Double-tick: frame stays 0 (no advance)", dbl_ctrl.frame_idx == 0)

# _ticked_this_frame is reset by draw()
reset()
drw_entry = SpriteEntry("hero", {"walk": SheetAnimation([_fake_sprite(16, 16), _fake_sprite(16, 16)])})
drw_actor = Actor(); drw_actor.image = drw_entry; drw_actor._x = 0; drw_actor._y = 0
drw_ctrl = drw_actor.walk
drw_ctrl.tick()                      # switch tick (frame=0, ticked=True)
test("Before draw: _ticked_this_frame is True", drw_ctrl._ticked_this_frame)
g._draw_commands.clear()
drw_actor.draw()                     # draw() should reset the guard
test("After draw: _ticked_this_frame is False", not drw_ctrl._ticked_this_frame)


# === 7.3: Sheet marshaling from raw pixel buffer ===

print("\n=== Sheet sprites: worker sheet marshaling ===")

import json as _json

# Simulate the worker's Python code that builds assets.sheet from globals.
# Create a minimal 4×8 sheet: two 4×4 frames side by side for "hero/idle".
_fw, _fh, _fc = 4, 4, 2
_sheet_w, _sheet_h = _fw * _fc, _fh  # 8×4 sheet

# Fill frame 0 with all-red, frame 1 with all-blue
_sheet_raw = bytearray(_sheet_w * _sheet_h * 4)
for _row in range(_fh):
    for _col in range(_fw):
        _i = (_row * _sheet_w + _col) * 4
        _sheet_raw[_i:_i+4] = [255, 0, 0, 255]          # frame 0: red
    for _col in range(_fw, _fw * 2):
        _i = (_row * _sheet_w + _col) * 4
        _sheet_raw[_i:_i+4] = [0, 0, 255, 255]          # frame 1: blue

_meta = {
    "hero": {
        "animations": {
            "idle": {"x": 0, "y": 0, "frameW": _fw, "frameH": _fh, "frameCount": _fc}
        }
    }
}

_sheet_ns_dict2 = {}
for _sname, _sentry in _meta.items():
    _anim_dict2 = {}
    for _aname, _astrip in _sentry.get("animations", {}).items():
        _sx  = int(_astrip["x"])
        _sy  = int(_astrip["y"])
        _fw2 = int(_astrip["frameW"])
        _fh2 = int(_astrip["frameH"])
        _fc2 = int(_astrip["frameCount"])
        _frames2 = []
        for _fi in range(_fc2):
            _fx = _sx + _fi * _fw2
            _sprite_buf2 = bytearray(_fw2 * _fh2 * 4)
            for _r in range(_fh2):
                _dst = _r * _fw2 * 4
                _src = ((_sy + _r) * _sheet_w + _fx) * 4
                _sprite_buf2[_dst:_dst + _fw2 * 4] = _sheet_raw[_src:_src + _fw2 * 4]
            _frames2.append(g.Sprite(_fw2, _fh2, _sprite_buf2))
        _anim_dict2[_aname] = SheetAnimation(_frames2)
    _sheet_ns_dict2[_sname] = SpriteEntry(_sname, _anim_dict2)
_built_ns = SheetNamespace(_sheet_ns_dict2)

test("Marshaled namespace has hero", hasattr(_built_ns, "hero"))
test("hero has idle animation", hasattr(_built_ns.hero, "idle"))
_idle = _built_ns.hero.idle
test("idle has 2 frames", len(_idle) == 2)
_f0 = _idle[0]
test("Frame 0 dimensions are frameW×frameH", _f0.width == _fw and _f0.height == _fh)
test("Frame 0 pixel size matches", len(_f0.pixels) == _fw * _fh * 4)
test("Frame 0 first pixel is red", list(_f0.pixels[:4]) == [255, 0, 0, 255])
_f1 = _idle[1]
test("Frame 1 first pixel is blue", list(_f1.pixels[:4]) == [0, 0, 255, 255])


# === 7.4: Actor.__getattr__ + draw() with SpriteEntry ===

print("\n=== Sheet sprites: Actor.__getattr__ + draw() ===")

reset()
g._width = 200; g._height = 200

# Build a SpriteEntry with known pixel content
_px = bytearray(16 * 16 * 4)
for _i in range(0, len(_px), 4):
    _px[_i:_i+4] = [128, 0, 128, 255]  # purple frame
_sp_f0 = g.Sprite(16, 16, _px)
_sp_anim = SheetAnimation([_sp_f0])
_sp_entry = SpriteEntry("wizard", {"cast": _sp_anim})

act4 = Actor()
act4.image = _sp_entry
act4._x = 50.0; act4._y = 60.0

# __getattr__: returns AnimationController for known animation names
cast_ctrl = act4.cast
test("actor.cast returns AnimationController", isinstance(cast_ctrl, AnimationController))
test("Same controller returned on second access", act4.cast is cast_ctrl)

try:
    _ = act4.fly
    test("actor.<unknown_anim> raises AttributeError", False)
except AttributeError as e:
    # FriendlyAttrError (subclass of AttributeError) uses message_args; plain AttributeError uses str.
    from graphics._errors import FriendlyAttrError as _FAttrErr
    if isinstance(e, _FAttrErr):
        test("actor.<unknown_anim> raises AttributeError", e.message_args.get("name") == "fly")
    else:
        test("actor.<unknown_anim> raises AttributeError", "fly" in str(e) or "wizard" in str(e))

# draw() without tick: uses _default_sprite() fallback
g._draw_commands.clear()
act4.draw()
sprite_cmds = [c for c in g._draw_commands if c[0] == "sprite"]
test("draw() without tick emits a sprite command", len(sprite_cmds) == 1)
_sc = sprite_cmds[0]
test("sprite command width == 16", _sc[1][1] == 16)
test("sprite command height == 16", _sc[1][2] == 16)
test("sprite centered: x offset == -8", _sc[1][3] == -8.0)
test("sprite centered: y offset == -8", _sc[1][4] == -8.0)

# draw() after tick: uses controller's frame
reset()
g._draw_commands.clear()
act4._active_anim_ctrl = None
cast_ctrl.tick()   # first tick: switch from None → frame 0, _ticked=True
act4._active_anim_ctrl = cast_ctrl
act4.draw()
sprite_cmds2 = [c for c in g._draw_commands if c[0] == "sprite"]
test("draw() after tick still emits sprite command", len(sprite_cmds2) == 1)
test("After draw(): _ticked_this_frame reset to False", not cast_ctrl._ticked_this_frame)

# frame advances on subsequent ticks
_build_frames = [g.Sprite(8, 8, bytearray(8*8*4)), g.Sprite(8, 8, bytearray(8*8*4)), g.Sprite(8, 8, bytearray(8*8*4))]
_adv_anim = SheetAnimation(_build_frames)
_adv_entry = SpriteEntry("hero", {"run": _adv_anim})
adv_actor = Actor(); adv_actor.image = _adv_entry
run_c = adv_actor.run

run_c.tick()   # switch from None → frame 0
adv_actor._active_anim_ctrl = run_c
g._draw_commands.clear(); adv_actor.draw()   # resets guard
test("Frame 0 after first tick (switch)", run_c.frame_idx == 0)

run_c.tick()   # advance: frame 1
adv_actor._active_anim_ctrl = run_c
g._draw_commands.clear(); adv_actor.draw()
test("Frame 1 after second tick", run_c.frame_idx == 1)

run_c.tick()   # advance: frame 2
adv_actor._active_anim_ctrl = run_c
g._draw_commands.clear(); adv_actor.draw()
test("Frame 2 after third tick", run_c.frame_idx == 2)

run_c.tick()   # wrap: back to frame 0
adv_actor._active_anim_ctrl = run_c
g._draw_commands.clear(); adv_actor.draw()
test("Frame wraps to 0 after third frame", run_c.frame_idx == 0)


# === 8: Manifest self-check ===

print("\n=== Manifest: _manifest.py vs live module ===")

from graphics._manifest import EXPORTED_NAMES, NAMESPACE_ATTRS, ACTOR_BUILTIN_ATTRS

# Every name in EXPORTED_NAMES must exist in the live graphics module.
for name in EXPORTED_NAMES:
    test(f"manifest '{name}' exists in graphics module", hasattr(g, name))

# Every name in graphics.__all__ must appear in EXPORTED_NAMES.
manifest_set = set(EXPORTED_NAMES)
for name in g.__all__:
    test(f"__all__ '{name}' in EXPORTED_NAMES", name in manifest_set)

# NAMESPACE_ATTRS has the expected namespaces.
for ns_name in ("Mouse", "Keyboard", "Window", "Colors", "state"):
    test(f"NAMESPACE_ATTRS has '{ns_name}'", ns_name in NAMESPACE_ATTRS)

# Keyboard keys in NAMESPACE_ATTRS match live _KEY_CODES.
live_keys = set(g._KEY_CODES.keys())
manifest_keys = set(NAMESPACE_ATTRS["Keyboard"])
test("NAMESPACE_ATTRS Keyboard keys match _KEY_CODES", live_keys == manifest_keys)

# Color names in NAMESPACE_ATTRS match live COLOR_NAMES.
live_colors = set(g.COLOR_NAMES.keys())
manifest_colors = set(NAMESPACE_ATTRS["Colors"])
test("NAMESPACE_ATTRS Colors match COLOR_NAMES", live_colors == manifest_colors)

# ACTOR_BUILTIN_ATTRS should include core Actor properties/methods.
for attr in ("x", "y", "vx", "vy", "pos", "vel", "angle", "visible", "move", "forward", "die", "is_alive",
             "collides_with", "collides_any", "update", "draw", "wrap", "in_bounds",
             "distance_to", "bounce", "keep_in_bounds"):
    test(f"ACTOR_BUILTIN_ATTRS has '{attr}'", attr in ACTOR_BUILTIN_ATTRS)

# FriendlyError self-check: _to_rgb bad color raises FriendlyError.
try:
    g._to_rgb("not_a_real_color_xyz")
    test("_to_rgb unknown name raises FriendlyError", False)
except FriendlyError as e:
    test("_to_rgb unknown name raises FriendlyError", e.message_key == "friendlyError.naming.badColor")
    test("_to_rgb badColor has color arg", e.message_args.get("color") == "not_a_real_color_xyz")

try:
    g._to_rgb(42)
    test("_to_rgb wrong type raises FriendlyError", False)
except FriendlyError as e:
    test("_to_rgb wrong type raises FriendlyError", e.message_key == "friendlyError.types.badColorType")
    test("_to_rgb badColorType has type arg", e.message_args.get("type") == "int")

# error_hook.classify_error passes FriendlyError straight through.
import error_hook as _eh
fe = FriendlyError("friendlyError.naming.unknownKey", {"name": "qq"})
result = _eh.classify_error(fe, "", "test.py")
test("classify_error: FriendlyError category extracted", result["category"] == "naming")
test("classify_error: FriendlyError messageKey preserved", result["messageKey"] == "friendlyError.naming.unknownKey")
test("classify_error: FriendlyError messageArgs preserved", result["messageArgs"] == {"name": "qq"})
test("classify_error: FriendlyError not blocking (naming)", result["isBlocking"] is False)

# === 9: Homoglyph table structural checks (Fix 1b) ===

print("\n=== Homoglyph table structural checks ===")

import syntax_hints as _sh

# Every key must be a single Cyrillic codepoint.
for _cyr, _lat in _sh._HOMOGLYPHS.items():
    test(f"homoglyph key '{_cyr!r}' is single char", len(_cyr) == 1)
    _cp = ord(_cyr)
    _is_cyr = (0x0400 <= _cp <= 0x04FF)
    test(f"homoglyph key '{_cyr!r}' is Cyrillic", _is_cyr)
    test(f"homoglyph value '{_lat!r}' is single ASCII letter", len(_lat) == 1 and _lat.isascii() and _lat.isalpha())

# Round-trip: Cyrillic homoglyph token → Latin equivalent.
# "аррlе" has Cyrillic а,р,р and Latin l, and Cyrillic е → should become "apple".
_mixed = "аррlе"   # аррlе
_result = _sh.transliterate_homoglyphs(_mixed)
test("transliterate_homoglyphs('аррlе') == 'apple'", _result == "apple")

# A pure-Latin token returns empty string (no Cyrillic → caller skips).
test("transliterate_homoglyphs('circle') returns ''", _sh.transliterate_homoglyphs("circle") == "")

# check_homoglyph: сircle (Cyrillic с + Latin ircle) matches 'circle'.
_tok = "сircle"   # с + ircle
_key, _args = _sh.check_homoglyph(_tok, {"circle"})
test("check_homoglyph('сircle', {'circle'}) key correct",
     _key == "friendlyError.naming.wrongLayout")
test("check_homoglyph('сircle', {'circle'}) got correct", _args.get("got") == _tok)
test("check_homoglyph('сircle', {'circle'}) fixed correct", _args.get("fixed") == "circle")

# A pure-Latin token returns (None, {}).
test("check_homoglyph('circle', {}) returns (None, {})", _sh.check_homoglyph("circle", {"circle"}) == (None, {}))

# === 10: Defense-in-depth (Fix 1c) ===

print("\n=== Defense-in-depth: broken enrichment still yields naming card ===")

import syntax_hints as _sh2
import error_hook as _eh2

# Save originals
_orig_check_homo = _sh2.check_homoglyph
_orig_failures = list(_eh2._enrichment_failures)

# Monkeypatch check_homoglyph to simulate a broken enrichment
def _broken_homo(*a, **k):
    raise RuntimeError("simulated homoglyph failure")

# Clear failure log, patch, call classify_error with an undefined name
_sh2.check_homoglyph = _broken_homo
_eh2._enrichment_failures.clear()

try:
    _exc = NameError("name 'apple' is not defined")
    _res = _eh2.classify_error(_exc, "apple\n", "test.py")
    test("broken homoglyph: result category is naming", _res["category"] == "naming")
    # When homoglyph fails and there are no other suggestions, messageKey is None
    # and the raw Python error is shown via the "message" field instead.
    test("broken homoglyph: messageKey is None or friendlyError.naming.*",
         _res.get("messageKey") is None or
         (_res.get("messageKey") or "").startswith("friendlyError.naming."))
    test("broken homoglyph: enrichment failure logged",
         any(f["name"] == "homoglyph" for f in _eh2._enrichment_failures))
    test("broken homoglyph: exactly one enrichment failure logged",
         len([f for f in _eh2._enrichment_failures if f["name"] == "homoglyph"]) == 1)
finally:
    _sh2.check_homoglyph = _orig_check_homo
    _eh2._enrichment_failures.clear()
    _eh2._enrichment_failures.extend(_orig_failures)

# === 11: Pattern fixtures (classify_syntax_error + linter) ===

print("\n=== Pattern fixtures ===")

import ast as _ast
import linter as _linter
from syntax_hints import classify_syntax_error as _cse

# Pattern 1: keyword argument missing =
# Simulate the SyntaxError Python raises for Actor(x=1, y300, z=2)
try:
    compile("Actor(x=1, y300, z=2)", "<test>", "eval")
    test("Pattern1: compile raised SyntaxError", False)
except SyntaxError as _e:
    _p1 = _cse("Actor(x=1, y300, z=2)", _e)
    test("Pattern1 keyword missing =: messageKey", _p1["messageKey"] == "linter.E999KeywordMissingEq")
    test("Pattern1 keyword missing =: arg captured", _p1.get("messageArgs", {}).get("arg") == "y300")

# Pattern 2: misspelled keyword
try:
    compile("lobal score", "<test>", "exec")
    test("Pattern2a: compile raised SyntaxError", False)
except SyntaxError as _e:
    _p2a = _cse("lobal score", _e)
    test("Pattern2a 'lobal': messageKey", _p2a["messageKey"] == "linter.E999KeywordTypo")
    test("Pattern2a 'lobal': got=lobal", _p2a.get("messageArgs", {}).get("got") == "lobal")
    test("Pattern2a 'lobal': candidate=global", _p2a.get("messageArgs", {}).get("candidate") == "global")

try:
    compile("rfom graphics import *", "<test>", "exec")
    test("Pattern2b: compile raised SyntaxError", False)
except SyntaxError as _e:
    _p2b = _cse("rfom graphics import *", _e)
    test("Pattern2b 'rfom': messageKey", _p2b["messageKey"] == "linter.E999KeywordTypo")
    test("Pattern2b 'rfom': got=rfom", _p2b.get("messageArgs", {}).get("got") == "rfom")
    test("Pattern2b 'rfom': candidate=from", _p2b.get("messageArgs", {}).get("candidate") == "from")

# Pattern 3: method not called — linter AST rule
_code_draw = "apple.draw\n"
_diags_draw = _linter.lint(_code_draw)
_w_draw = [d for d in _diags_draw if d.get("code") == "W_MethodNotCalled"]
test("Pattern3 'apple.draw' statement → W_MethodNotCalled", len(_w_draw) == 1)
test("Pattern3 'apple.draw': method arg = draw", _w_draw[0].get("messageArgs", {}).get("method") == "draw" if _w_draw else False)
test("Pattern3 'apple.draw': severity = warning", _w_draw[0].get("severity") == "warning" if _w_draw else False)

# apple.x (property) → no W_MethodNotCalled
_code_x = "apple.x\n"
_diags_x = _linter.lint(_code_x)
_w_x = [d for d in _diags_x if d.get("code") == "W_MethodNotCalled"]
test("Pattern3 'apple.x' (property) → no W_MethodNotCalled", len(_w_x) == 0)

# y = apple.draw (assignment) → no W_MethodNotCalled
_code_assign = "y = apple.draw\n"
_diags_assign = _linter.lint(_code_assign)
_w_assign = [d for d in _diags_assign if d.get("code") == "W_MethodNotCalled"]
test("Pattern3 'y = apple.draw' (assignment) → no W_MethodNotCalled", len(_w_assign) == 0)

# === 12: ACTOR_METHODS snapshot ===

print("\n=== ACTOR_METHODS snapshot ===")

from graphics._manifest import ACTOR_METHODS as _am

# Must include core instance methods
for _m in ("draw", "move", "forward", "bounce", "die", "update", "rotate",
           "wrap", "wrap_x", "wrap_y", "in_bounds", "is_alive", "keep_in_bounds",
           "distance_to", "collides_with", "collides_any", "reset"):
    test(f"ACTOR_METHODS has '{_m}'", _m in _am)

# Must NOT include static methods or properties
test("ACTOR_METHODS excludes all_actors (static)", "all_actors" not in _am)
test("ACTOR_METHODS excludes random_coords (static)", "random_coords" not in _am)
test("ACTOR_METHODS excludes x (property)", "x" not in _am)
test("ACTOR_METHODS excludes visible (property)", "visible" not in _am)
test("ACTOR_METHODS excludes future_state (property)", "future_state" not in _am)

# === 13: Outer catch-all in classify_error ===

print("\n=== classify_error outer catch-all ===")

import error_hook as _eh3

# Monkeypatch _classify_error_inner to simulate total classifier meltdown.
_orig_inner = _eh3._classify_error_inner

def _exploding_inner(*a, **k):
    raise RuntimeError("simulated total classifier failure")

_eh3._classify_error_inner = _exploding_inner
try:
    _exc2 = NameError("name 'x' is not defined")
    _res2 = _eh3.classify_error(_exc2, "x\n", "test.py")
    test("outer catch-all: category is internal", _res2.get("category") == "internal")
    test("outer catch-all: titleKey is friendlyError.internal.title",
         _res2.get("titleKey") == "friendlyError.internal.title")
    test("outer catch-all: messageKey is friendlyError.internal.classifierFailed",
         _res2.get("messageKey") == "friendlyError.internal.classifierFailed")
    test("outer catch-all: classifierFailed flag set", _res2.get("classifierFailed") is True)
    test("outer catch-all: isBlocking is False", _res2.get("isBlocking") is False)
    test("outer catch-all: suggestions is empty list", _res2.get("suggestions") == [])
finally:
    _eh3._classify_error_inner = _orig_inner

# Confirm normal path still works after restoring.
_res3 = _eh3.classify_error(NameError("name 'qq' is not defined"), "qq\n", "test.py")
test("outer catch-all: normal path unaffected after restore",
     _res3.get("category") == "naming")

# === 14: friendlyError.internal keys in ALL_MESSAGE_KEYS ===

print("\n=== friendlyError.internal keys registered ===")

from graphics._errors import ALL_MESSAGE_KEYS as _amk
test("ALL_MESSAGE_KEYS has friendlyError.internal.title",
     "friendlyError.internal.title" in _amk)
test("ALL_MESSAGE_KEYS has friendlyError.internal.classifierFailed",
     "friendlyError.internal.classifierFailed" in _amk)


# === 15: show() paints the pending buffer once ===

print("\n=== Runtime: show() ===")

import types as _types

# show() is the only public entry point that talks to the JS bridge outside a
# run loop, so stub the two globals Pyodide would supply.
_show_calls = {"resize": [], "flush": []}
_fake_js = _types.ModuleType("js")
_fake_js._ide_canvas_resize = lambda w, h: _show_calls["resize"].append((w, h))
_fake_js._ide_flush_draw_commands = lambda c: _show_calls["flush"].append(list(c))
_fake_ffi = _types.ModuleType("pyodide.ffi")
_fake_ffi.to_js = lambda obj, **kw: obj
_fake_pyodide = _types.ModuleType("pyodide")
_fake_pyodide.__path__ = []
_fake_pyodide.ffi = _fake_ffi

sys.modules["js"] = _fake_js
sys.modules["pyodide"] = _fake_pyodide
sys.modules["pyodide.ffi"] = _fake_ffi
try:
    reset()
    # A size() the student called before the first paint is queued, not applied.
    g._state._width, g._state._height = 100, 100
    g._state._pending_size = (321, 241)
    g.circle(10, 20, 5)
    g.show()

    test("show(): applies the pending size",
         (g._state._width, g._state._height) == (321, 241))
    test("show(): consumes the pending size", g._state._pending_size is None)
    test("show(): resizes the canvas to it", _show_calls["resize"] == [(321, 241)])
    test("show(): flushes once", len(_show_calls["flush"]) == 1)
    test("show(): flushes what was drawn",
         len(_show_calls["flush"][0]) == 1 and _show_calls["flush"][0][0][0] == "circle")
    test("show(): empties the buffer", list(g._draw_commands) == [])

    # Second call must not repaint the first call's commands.
    g.show()
    test("show(): a second call flushes nothing new", _show_calls["flush"][1] == [])
    test("show(): a second call still resizes", len(_show_calls["resize"]) == 2)
finally:
    for _m in ("js", "pyodide", "pyodide.ffi"):
        sys.modules.pop(_m, None)
    reset()


# === 16: turtle's graphics dependencies exist ===

# turtle.py reaches into the graphics module by name (`_g.show()` etc). A name
# that isn't there fails only at runtime, in the student's program — which is
# exactly how done()/mainloop() shipped broken once.

print("\n=== turtle -> graphics attribute references ===")

import re as _re

with open(os.path.join(ROOT, "src", "assets", "python", "turtle.py")) as f:
    _turtle_src = f.read()

_turtle_refs = sorted(set(_re.findall(r"\b_g\.([A-Za-z_]\w*)", _turtle_src)))
test("turtle.py references at least a dozen graphics names", len(_turtle_refs) >= 12)

_missing = [n for n in _turtle_refs if not hasattr(g, n)]
test(f"turtle.py: every graphics name it calls exists (missing: {_missing})",
     not _missing)


# === Summary ===

print(f"\n{'='*50}")
if errors == 0:
    print("ALL TESTS PASSED")
else:
    print(f"{errors} TEST(S) FAILED")

sys.exit(1 if errors else 0)
