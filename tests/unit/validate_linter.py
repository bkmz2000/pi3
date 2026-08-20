"""
Real linter behavior tests (replaces the old expect(true) placeholders).

These execute the actual src/assets/python/linter.py against code snippets and
assert the diagnostics it emits. Run standalone:

    PYTHONPATH=src/assets/python python3 tests/unit/validate_linter.py

and wired into Jest via tests/unit/linterAccuracy.test.ts.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
sys.path.insert(0, os.path.join(ROOT, "src", "assets", "python"))

import linter  # noqa: E402

errors = 0


def test(name, ok, detail=""):
    global errors
    if ok:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}  {detail}")
        errors += 1


def codes(code):
    """Return the set of diagnostic codes lint() emits for a snippet."""
    return [d.get("code") for d in linter.lint(code, "main.py")]


def has(diags, code):
    return code in diags


print("Linter accuracy — repetition (E225 must NOT fire)")
# Sequence repetition is valid Python and common in student code
# ("=" * 20 draws a divider line; [0] * 10 builds a grid row).
for name, snippet in [
    ("string repetition str*int", 'x = "=" * 20'),
    ("string repetition int*str", 'x = 20 * "="'),
    ("list repetition list*int", "x = [0] * 10"),
    ("list repetition int*list", "x = 10 * [0]"),
]:
    diags = codes(snippet)
    test(f"{name}: no E225", "E225" not in diags, f"got {diags}")

print("Linter accuracy — genuinely invalid Mult must still fire")
for name, snippet in [
    ("str*float", 'x = "a" * 2.5'),
    ("list*str", 'x = [0] * "a"'),
]:
    diags = codes(snippet)
    test(f"{name}: E225 fires", "E225" in diags, f"got {diags}")

print("Linter accuracy — numeric Mult stays clean")
test("3 * 4: no diagnostics", codes("x = 3 * 4") == [])

print("Linter accuracy — W005 type reassignment")
diags_type_change = codes('x = 1\nx = "text"')
test(
    "x=1 then x='text' warns W005",
    has(diags_type_change, "W005"),
    f"got {diags_type_change}",
)
diags_reassign = codes("from graphics import Circle\nball = Circle()\nball = ball.clone()")
test(
    "method-call reassignment does NOT warn W005",
    not has(diags_reassign, "W005"),
    f"got {diags_reassign}",
)

print("Linter accuracy — unrelated regressions")
diags_str_int = codes('x = 3 + "2"')
test(
    "str + int still errors (E225)",
    has(diags_str_int, "E225"),
    f"got {diags_str_int}",
)
test(
    "clean code has no diagnostics",
    codes("x = 1") == [],
    f"got {codes('x = 1')}",
)

if errors == 0:
    print("ALL TESTS PASSED")
    sys.exit(0)
else:
    print(f"{errors} TEST(S) FAILED")
    sys.exit(1)