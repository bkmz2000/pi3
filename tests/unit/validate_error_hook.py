#!/usr/bin/env python3
"""Friendly-error classifier regression tests (validate_error_hook.py).

Executes the real error_hook.classify_error against a matrix of student
exceptions and asserts the structured messageKey/messageArgs it produces.
Guards the gibberish regressions: operator parsing for all ops, not-iterable,
subscript/item-assign, index-out-of-range (no bogus "range" index), generic
TypeError/RuntimeError fallbacks that render real text instead of "Can't ?".

Wired into Jest via tests/unit/errorHook.test.ts.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
sys.path.insert(0, os.path.join(ROOT, "src", "assets", "python"))

import error_hook  # noqa: E402

errors = 0


def test(name, ok, detail=""):
    global errors
    if ok:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}  {detail}")
        errors += 1


def classify(name, fn, code="# user code"):
    try:
        fn()
    except Exception as e:
        return error_hook.classify_error(e, code, "main.py", 0)
    raise AssertionError(name + ": did not raise")


print("Friendly-error classifier — operator parsing (no ? gibberish)")
cases = [
    ("str+int", lambda: 'a' + 1, "+", "str", "int"),
    ("int-str", lambda: 5 - 'x', "-", "int", "str"),
    ("list*str", lambda: [0] * 'x', "*", "sequence", "str"),
    ("int/str", lambda: 5 / 'x', "/", "int", "str"),
    ("int%str", lambda: 5 % 'x', "%", "int", "str"),
    ("int**str", lambda: 2 ** 'x', "**", "int", "str"),
]
for name, fn, op, left, right in cases:
    res = classify(name, fn)
    test(f"{name}: badOperator", res["messageKey"] == "friendlyError.types.badOperator",
          f"got {res['messageKey']}")
    args = res.get("messageArgs", {})
    test(f"{name}: op={op}", args.get("op") == op, f"got {args}")
    test(f"{name}: left={left}", args.get("left") == left, f"got {args}")
    test(f"{name}: right={right}", args.get("right") == right, f"got {args}")
    test(f"{name}: no ? op", args.get("op") != "?", f"got {args}")

print("Friendly-error classifier — TypeError sub-kinds")
res = classify("sum(int)", lambda: sum(5))
test("sum(int) -> notIterable",
      res["messageKey"] == "friendlyError.types.notIterable" and
      res["messageArgs"].get("type") == "int",
      f"got {res.get('messageKey')} {res.get('messageArgs')}")
res = classify("int[0]", lambda: exec('x = 5; x[0]'))
test("int[0] -> notSubscriptable",
      res["messageKey"] == "friendlyError.types.notSubscriptable" and
      res["messageArgs"].get("type") == "int",
      f"got {res.get('messageKey')} {res.get('messageArgs')}")
res = classify("int[0]=1", lambda: exec('x = 5; x[0] = 1'))
test("int[0]=1 -> notItemAssignable",
      res["messageKey"] == "friendlyError.types.notItemAssignable" and
      res["messageArgs"].get("type") == "int",
      f"got {res.get('messageKey')} {res.get('messageArgs')}")
res = classify("5()", lambda: 5())
test("5() -> notCallable", res["messageKey"] == "friendlyError.types.notCallable")

print("Friendly-error classifier — arg-count")
res = classify("int(1,2)", lambda: int(1, 2))
test("int(1,2) -> genericError (not ?)",
      res["messageKey"] == "friendlyError.types.genericError" and
      bool(res.get("messageArgs", {}).get("details")),
      f"got {res.get('messageKey')} {res.get('messageArgs')}")
res = classify("missing arg", lambda: (lambda x: x)())
test("missing arg -> missingArg",
      res["messageKey"] == "friendlyError.types.missingArg",
      f"got {res.get('messageKey')}")

print("Friendly-error classifier — index errors (no 'range' gibberish)")
for name, fn in [("oob", lambda: [1, 2, 3][5]), ("neg", lambda: [1, 2, 3][-5])]:
    res = classify(name, fn)
    test(f"{name} -> indexOutOfRange",
          res["messageKey"] == "friendlyError.logic.indexOutOfRange" and
          not res.get("messageArgs"),
          f"got {res.get('messageKey')} {res.get('messageArgs')}")

print("Friendly-error classifier — generic logic fallback")
res = classify("runtime", lambda: (_ for _ in ()).throw(RuntimeError('boom')))
test("RuntimeError -> logic.genericError with details",
      res["messageKey"] == "friendlyError.logic.genericError" and
      res.get("messageArgs", {}).get("details") == "boom",
      f"got {res.get('messageKey')} {res.get('messageArgs')}")
res = classify("stopiteration", lambda: next(iter([])))
test("StopIteration -> logic.noMoreItems",
      res["messageKey"] == "friendlyError.logic.noMoreItems",
      f"got {res.get('messageKey')}")

print("Friendly-error classifier — unaffected categories")
res = classify("divzero", lambda: 1 / 0)
test("divzero -> zeroDivision", res["messageKey"] == "friendlyError.logic.zeroDivision")
res = classify("keyerr", lambda: {'a': 1}['b'])
test("keyerr -> keyError", res["messageKey"] == "friendlyError.missing.keyError")
res = classify("name", lambda: undefined_var, code='undefined_var')
test("name -> naming.undefined", res["messageKey"] == "friendlyError.naming.undefined")
res = classify("attr", lambda: [1, 2].foo)
test("attr -> naming.noAttribute", res["messageKey"] == "friendlyError.naming.noAttribute")

if errors == 0:
    print("ALL TESTS PASSED")
    sys.exit(0)
else:
    print(f"{errors} TEST(S) FAILED")
    sys.exit(1)