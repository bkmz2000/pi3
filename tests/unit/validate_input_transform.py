#!/usr/bin/env python3
"""
Standalone test harness for input_transform.transform().
Run via: PYTHONPATH=src/assets/python python3 tests/unit/validate_input_transform.py
"""
import sys
import traceback

import input_transform

failures = []

def check(label: str, source: str, *, contains: str | None = None, not_contains: str | None = None, equals: str | None = None) -> None:
    try:
        result = input_transform.transform(source)
        if contains and contains not in result:
            failures.append(f"FAIL [{label}]: expected {contains!r} in output\n  source: {source!r}\n  result: {result!r}")
        if not_contains and not_contains in result:
            failures.append(f"FAIL [{label}]: did NOT expect {not_contains!r} in output\n  source: {source!r}\n  result: {result!r}")
        if equals is not None and result != equals:
            failures.append(f"FAIL [{label}]: expected {equals!r}\n  got: {result!r}")
    except Exception:
        failures.append(f"FAIL [{label}]: raised exception\n{traceback.format_exc()}")


# Basic transformation
check("bare input()", "name = input('Enter name')", contains="await _async_input")
# result must not contain bare `input(` (only `_async_input(` is OK)
bare_result = input_transform.transform("name = input('Enter name')")
import re
if re.search(r'(?<!_async_)input\(', bare_result):
    failures.append(f"FAIL [bare input() removes original]: bare input( still present\n  result: {bare_result!r}")

# Chained method call
check(
    "input().strip() chain",
    "x = input('x').strip()",
    contains="(await _async_input('x')).strip()",
)

# String literal — must NOT transform
check("input inside double-quoted string", 's = "input(fake)"', not_contains="_async_input")
check("input inside single-quoted string", "s = 'input()'", not_contains="_async_input")

# Triple-quoted string — must NOT transform
check("input inside triple-quoted string", 'msg = """input("user")"""', not_contains="_async_input")

# Comment line followed by real call
src_with_comment = "# don't forget input()\nname = input('y')"
check("comment + real input()", src_with_comment, contains="_async_input")

# SyntaxError → return source unchanged
bad = "def (broken syntax"
check("SyntaxError passthrough", bad, equals=bad)

# Multiple input() calls
multi = "a = input('a')\nb = input('b')"
result_multi = input_transform.transform(multi)
if result_multi.count("_async_input") != 2:
    failures.append(f"FAIL [multiple inputs]: expected 2 _async_input occurrences, got {result_multi.count('_async_input')}\n  result: {result_multi!r}")

# No input() at all — should return equivalent code (no change needed)
no_input = "x = 1 + 2\nprint(x)"
result_no = input_transform.transform(no_input)
if "_async_input" in result_no:
    failures.append(f"FAIL [no input]: spurious _async_input in output\n  result: {result_no!r}")

if failures:
    print("\n".join(failures))
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
