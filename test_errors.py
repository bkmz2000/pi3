"""
Friendly error system — test all categories.

Uncomment ONE error block at a time, then click Run.
Expected error cards appear in the console with category colors and suggestion chips.

Categories covered:
  naming   — NameError, AttributeError
  types    — TypeError
  grammar  — SyntaxError / IndentationError (linter only, blocks running)
  missing  — ImportError, KeyError, ModuleNotFoundError
  logic    — IndexError, ValueError, ZeroDivisionError, RecursionError
"""

from graphics import *

size(400, 400)


# ═══════════════════════════════════════════════════════════════════════════
#  NAMING  —  NameError / AttributeError
# ═══════════════════════════════════════════════════════════════════════════

# --- NameError: typo in function name ---
# prnit("hello")                     # did you mean 'print'?

# --- NameError: typo in variable ---
# bakcground(Colors.black)           # did you mean 'background'?

# --- NameError: missing variable ---
# circle(x, y, 20)                   # 'x' and 'y' not defined

# --- AttributeError: wrong color name ---
# fill(Colors.redd)                  # did you mean 'red'?

# --- AttributeError: wrong method on actor ---
# b = Circle(x=200, y=200, radius=20, color=Colors.red)
# b.mve_to(100, 100)                 # did you mean 'move_to'?

# --- NameError: typo in color string ---
# fill("blak")                       # did you mean 'black'?


# ═══════════════════════════════════════════════════════════════════════════
#  TYPES  —  TypeError
# ═══════════════════════════════════════════════════════════════════════════

# --- TypeError: wrong arg count ---
# circle(100, 100)                   # missing radius argument

# --- TypeError: unsupported operand ---
# x = "hello" + 42                   # can't add str and int

# --- TypeError: wrong arg type ---
# fill(Colors.red)
# rect("ten", 100, 50, 30)           # x must be number, not string


# ═══════════════════════════════════════════════════════════════════════════
#  GRAMMAR  —  SyntaxError / IndentationError (linter only, blocks running)
# ═══════════════════════════════════════════════════════════════════════════

# These are caught by the linter before execution. To test, uncomment and Run.
# The linter will show a "Grammar problem" message and block the run.

# --- missing colon ---
# if True
#     print("missing colon")

# --- bad indentation ---
# def foo():
# print("bad indent")                # should be indented 4 spaces

# --- unmatched bracket ---
# fill(Colors.red
# circle(100, 100, 20)


# ═══════════════════════════════════════════════════════════════════════════
#  MISSING  —  ImportError / KeyError / ModuleNotFoundError
# ═══════════════════════════════════════════════════════════════════════════

# --- ModuleNotFoundError ---
# import nonexistent_module_xyz

# --- ImportError (bad sub-import) ---
# from graphics import nonexistent_function

# --- KeyError on dict ---
# d = {"name": "pi3", "version": 1}
# print(d["author"])                 # key 'author' doesn't exist


# ═══════════════════════════════════════════════════════════════════════════
#  LOGIC  —  IndexError / ValueError / ZeroDivisionError / RecursionError
# ═══════════════════════════════════════════════════════════════════════════

# --- IndexError ---
# nums = [1, 2, 3]
# print(nums[99])

# --- ValueError ---
# int("hello")                       # can't convert 'hello' to int

# --- ZeroDivisionError ---
# points = len([])
# avg = 100 / points                 # divide by zero

# --- RecursionError ---
# def forever():
#     forever()
# forever()


# ═══════════════════════════════════════════════════════════════════════════
#  CLEAN FALLBACK (runs when nothing is uncommented)
# ═══════════════════════════════════════════════════════════════════════════

background(Colors.black)
fill(Colors.green)
circle(200, 200, 40)

print("All error tests are commented out.")
print("Uncomment one block at a time and click Run to test each category.")
