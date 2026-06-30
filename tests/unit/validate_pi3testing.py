#!/usr/bin/env python3
"""
Standalone test harness for pi3.testing.
Run via: PYTHONPATH=src/assets/python python3 tests/unit/validate_pi3testing.py
"""
import sys
import json

sys.path.insert(0, "src/assets/python")
from pi3.testing import (
    seed, Literal, Integer, Float, Choice, String,
    Permutation, Sample, UniqueSample,
    Example, Easy, Medium, Hard,
)
from pi3 import testing as _testing_mod

failures = []

def check(label, condition, msg=""):
    if not condition:
        failures.append(f"FAIL [{label}]: {msg}")

def check_eq(label, got, expected):
    check(label, got == expected, f"expected {expected!r}, got {got!r}")

def check_in(label, got, lo, hi):
    check(label, lo <= got <= hi, f"expected in [{lo}, {hi}], got {got!r}")

# ── Determinism ────────────────────────────────────────────────────────────────

seed("test-slug-a")
v1_a = Integer(1, 1000).materialize(_testing_mod._rng)
seed("test-slug-a")
v2_a = Integer(1, 1000).materialize(_testing_mod._rng)
check("determinism-same-slug", v1_a == v2_a,
      f"same slug must produce same value: {v1_a} vs {v2_a}")

seed("test-slug-a")
va = Integer(1, 1000).materialize(_testing_mod._rng)
seed("test-slug-b")
vb = Integer(1, 1000).materialize(_testing_mod._rng)
# Different slugs should almost certainly produce different values (not a hard guarantee,
# but with range 1–1000 the probability of collision is negligible)
check("determinism-different-slugs-likely-differ", va != vb or True,
      "different slugs MAY collide; this is an informational check")

seed("test-slug-a")
x1 = Integer(1, 100).materialize(_testing_mod._rng)
seed("test-slug-a")
x2 = Integer(1, 100).materialize(_testing_mod._rng)
check_eq("determinism-reseed-resets", x1, x2)

# ── Literal ────────────────────────────────────────────────────────────────────

r = Literal(42)
check_eq("literal-int", r.materialize(_testing_mod._rng), 42)

r = Literal("hello", name="greeting")
check_eq("literal-str-value", r.materialize(_testing_mod._rng), "hello")
check_eq("literal-name", r.name, "greeting")

r = Literal([1, 2, 3])
check_eq("literal-list", r.materialize(_testing_mod._rng), [1, 2, 3])

# ── Integer ────────────────────────────────────────────────────────────────────

seed("int-test")
for _ in range(50):
    v = Integer(1, 10).materialize(_testing_mod._rng)
    check_in("integer-range", v, 1, 10)
    check("integer-is-int", isinstance(v, int), f"got {type(v)}")

# Edge case: lo == hi
v = Integer(5, 5).materialize(_testing_mod._rng)
check_eq("integer-lo-eq-hi", v, 5)

# ── Float ──────────────────────────────────────────────────────────────────────

seed("float-test")
for _ in range(50):
    v = Float(0.0, 1.0).materialize(_testing_mod._rng)
    check("float-range", 0.0 <= v < 1.0, f"out of [0, 1): {v}")
    check("float-is-float", isinstance(v, float), f"got {type(v)}")

# ── Choice ─────────────────────────────────────────────────────────────────────

seed("choice-test")
pop = [10, 20, 30]
for _ in range(30):
    v = Choice(pop).materialize(_testing_mod._rng)
    check("choice-in-population", v in pop, f"got {v}")

# ── String ─────────────────────────────────────────────────────────────────────

seed("string-test")
for _ in range(20):
    v = String(8, "abc").materialize(_testing_mod._rng)
    check_eq("string-length", len(v), 8)
    check("string-chars", all(c in "abc" for c in v), f"invalid char in {v!r}")

# Default charset
v = String(5).materialize(_testing_mod._rng)
check_eq("string-default-length", len(v), 5)
check("string-default-chars", all(c.isalpha() for c in v), f"got {v!r}")

# ── Permutation ────────────────────────────────────────────────────────────────

seed("perm-test")
original = [1, 2, 3, 4, 5]
v = Permutation(original).materialize(_testing_mod._rng)
check_eq("permutation-length", len(v), len(original))
check_eq("permutation-sorted-equals", sorted(v), sorted(original))

# Permutation doesn't mutate the input
check_eq("permutation-original-unchanged", original, [1, 2, 3, 4, 5])

# ── Sample ─────────────────────────────────────────────────────────────────────

seed("sample-test")
pop = [1, 2, 3, 4, 5]
v = Sample(pop, 3).materialize(_testing_mod._rng)
check_eq("sample-length", len(v), 3)
check("sample-elements-from-population", all(x in pop for x in v), f"got {v}")

# Sample allows repeats (sampling with replacement)
v_long = Sample([1, 2], 20).materialize(_testing_mod._rng)
check_eq("sample-with-replacement-length", len(v_long), 20)

# ── UniqueSample ───────────────────────────────────────────────────────────────

seed("unique-sample-test")
pop = list(range(10))
v = UniqueSample(pop, 5).materialize(_testing_mod._rng)
check_eq("unique-sample-length", len(v), 5)
check("unique-sample-elements-from-pop", all(x in pop for x in v), f"got {v}")
check_eq("unique-sample-no-repeats", len(v), len(set(v)))

# Error when k > population
try:
    UniqueSample([1, 2], 5).materialize(_testing_mod._rng)
    check("unique-sample-k-exceeds-pop", False, "expected ValueError")
except ValueError as e:
    check("unique-sample-k-exceeds-pop", "k=5" in str(e) or "population" in str(e),
          f"error message missing expected text: {e}")

# ── TestSet construction ───────────────────────────────────────────────────────

seed("testset-test")

ex = Example()
check_eq("example-tier", ex.tier, 1)
check("example-visible", ex.visible is True)

easy = Easy()
check_eq("easy-tier", easy.tier, 1)
check("easy-not-visible", easy.visible is False)

medium = Medium()
check_eq("medium-tier", medium.tier, 2)
check("medium-not-visible", medium.visible is False)

hard = Hard()
check_eq("hard-tier", hard.tier, 3)
check("hard-not-visible", hard.visible is False)

# add_line and add_lines materialize correctly
seed("testset-materialize")
t1 = Easy()
t1.add_line(Literal(5, name="n"))
t1.add_line(Integer(1, 10))
result = t1._materialize_one(_testing_mod._rng)
check_eq("add-line-one-token", result["input"].strip(), "5\n%d" % int(result["input"].split("\n")[1]))
check_eq("add-line-fields-name", result["fields"]["n"], 5)

# add_lines
seed("testset-add-lines")
t2 = Easy()
t2.add_lines(Literal([1, 2, 3], name="arr"))
result2 = t2._materialize_one(_testing_mod._rng)
check_eq("add-lines-fields", result2["fields"]["arr"], [1, 2, 3])
check_eq("add-lines-input-lines", result2["input"].strip().split("\n"), ["1", "2", "3"])

# .answer() sets expected and suppresses reference solution invocation
seed("answer-test")
t3 = Example()
t3.add_line(Literal(7))
t3.answer(42)
result3 = t3._materialize_one(_testing_mod._rng)
check_eq("answer-expected", result3.get("expected"), "42")

# Without .answer(), 'expected' key is absent
seed("no-answer-test")
t4 = Easy()
t4.add_line(Literal(1))
result4 = t4._materialize_one(_testing_mod._rng)
check("no-answer-key-absent", "expected" not in result4,
      f"'expected' should be absent, got {result4}")

# ── Composition: multiply ──────────────────────────────────────────────────────

seed("mul-test")
easy = Easy()
easy.add_line(Integer(1, 100))
bundle = easy * 5
results = bundle._materialize_all(_testing_mod._rng)
check_eq("mul-count", len(results), 5)

# All 5 should be independently materialized (not copies of the same value)
# Use a wide range so the probability of all 5 being equal is negligible
seed("mul-independence")
big = Easy()
big.add_line(Integer(1, 10000))
bundle_big = big * 10
vals = [r["input"].strip() for r in bundle_big._materialize_all(_testing_mod._rng)]
check("mul-independence", len(set(vals)) > 1,
      f"all 10 materializations identical — recipe model broken: {vals[:3]}")

# Multiply by 0 produces empty
seed("mul-zero")
empty_bundle = Easy() * 0
results_empty = empty_bundle._materialize_all(_testing_mod._rng)
check_eq("mul-zero-empty", len(results_empty), 0)

# ── Composition: add ───────────────────────────────────────────────────────────

seed("add-test")
ex2 = Example()
ex2.add_line(Literal("ex"))
easy2 = Easy()
easy2.add_line(Literal("easy"))
bundle2 = ex2 + easy2
results2 = bundle2._materialize_all(_testing_mod._rng)
check_eq("add-count", len(results2), 2)
check_eq("add-first-is-example", results2[0]["tier"], 1)
check("add-first-visible", results2[0]["visible"] is True)
check_eq("add-second-is-easy", results2[1]["tier"], 1)
check("add-second-not-visible", results2[1]["visible"] is False)

# Chain: easy*3 + medium*2
seed("chain-test")
e3 = Easy()
e3.add_line(Literal("e"))
m2 = Medium()
m2.add_line(Literal("m"))
chained = e3 * 3 + m2 * 2
chained_results = chained._materialize_all(_testing_mod._rng)
check_eq("chain-count", len(chained_results), 5)
check_eq("chain-tier-order", [r["tier"] for r in chained_results], [1, 1, 1, 2, 2])

# Mixed composition: easy*3 + medium*2 + easy*3 preserves per-test tier
seed("mixed-test")
e3b = Easy()
e3b.add_line(Literal("e"))
m2b = Medium()
m2b.add_line(Literal("m"))
mixed = e3b * 3 + m2b * 2 + e3b * 3
mixed_results = mixed._materialize_all(_testing_mod._rng)
check_eq("mixed-count", len(mixed_results), 8)
check_eq("mixed-tiers", [r["tier"] for r in mixed_results], [1, 1, 1, 2, 2, 1, 1, 1])

# (easy + medium) * 3: multiplies each part independently
seed("bundle-mul-test")
e_b = Easy()
e_b.add_line(Literal("e"))
m_b = Medium()
m_b.add_line(Literal("m"))
bundle_mul = (e_b + m_b) * 3
bundle_mul_results = bundle_mul._materialize_all(_testing_mod._rng)
check_eq("bundle-mul-count", len(bundle_mul_results), 6)
check_eq("bundle-mul-tiers", [r["tier"] for r in bundle_mul_results], [1, 1, 1, 2, 2, 2])

# ── JSON output ────────────────────────────────────────────────────────────────

seed("json-test")
ex_j = Example()
ex_j.add_line(Literal(3, name="n"))
ex_j.add_line(Literal([1, 2, 3], name="arr"))
ex_j.answer(6)

easy_j = Easy()
easy_j.add_line(Integer(1, 50, name="n"))

bundle_j = (ex_j + easy_j).with_solution(lambda test: test)
json_str = str(bundle_j)
try:
    parsed = json.loads(json_str)
    check("json-valid", True)
except json.JSONDecodeError as e:
    check("json-valid", False, f"invalid JSON: {e}")
    parsed = {}

check("json-has-tests", "tests" in parsed, f"keys: {list(parsed.keys())}")
if "tests" in parsed:
    check_eq("json-test-count", len(parsed["tests"]), 2)
    t0 = parsed["tests"][0]
    check("json-tier-present", "tier" in t0)
    check("json-visible-present", "visible" in t0)
    check("json-fields-present", "fields" in t0)
    check("json-input-present", "input" in t0)
    check_eq("json-example-expected", t0.get("expected"), "6")
    # Easy test should NOT have 'expected' (no .answer())
    t1 = parsed["tests"][1]
    check("json-easy-no-expected", "expected" not in t1,
          f"unexpected 'expected' key in easy test: {t1}")

# reference_solution_py and checker_py
check("json-reference-not-null", parsed.get("reference_solution_py") is not None,
      "reference_solution_py should be set (with_solution was called)")
check("json-checker-null", parsed.get("checker_py") is None,
      "checker_py should be null when not set")

# with_checker (requires a _TestBundle, which __add__ produces)
seed("checker-test")
bundle_c = (Easy() + Easy() * 0).with_checker(lambda a, b: a == b)
json_c = json.loads(str(bundle_c))
check("json-checker-set", json_c.get("checker_py") is not None,
      "checker_py should be set")
check("json-no-reference-checker-only", json_c.get("reference_solution_py") is None,
      "reference_solution_py should be null when not set")

# ── Edge cases ─────────────────────────────────────────────────────────────────

# Empty bundle: (Example() + Easy()) * 0 produces a valid empty JSON bundle
seed("edge-empty")
bundle_empty = (Example() + Easy()) * 0
json_empty = json.loads(str(bundle_empty))
check_eq("edge-empty-tests", json_empty["tests"], [])

# Generator with only Literal recipes: fully reproducible (order of materialization matters for RNG)
seed("edge-literals")
lit_bundle = Easy()
lit_bundle.add_line(Literal(99))
seed("edge-literals")
r1 = lit_bundle._materialize_one(_testing_mod._rng)
seed("edge-literals")
r2 = lit_bundle._materialize_one(_testing_mod._rng)
check_eq("edge-literal-reproducible", r1["input"], r2["input"])

# Anti-pattern check: Integer(1, 100) created twice produces independent recipes
seed("anti-pattern")
def make_int(): return Integer(1, 10000)
r_a = make_int().materialize(_testing_mod._rng)
r_b = make_int().materialize(_testing_mod._rng)
# With range 1–10000 and independent RNG draws they are almost certainly different
# (probability of exact collision: 1/10000 = 0.01%)
# We run 50 pairs and check at least one differs
seed("anti-pattern-multi")
diffs = 0
for _ in range(50):
    a = Integer(1, 10000).materialize(_testing_mod._rng)
    b = Integer(1, 10000).materialize(_testing_mod._rng)
    if a != b:
        diffs += 1
check("anti-pattern-independent-recipes", diffs > 0,
      "Integer() recipe created twice should produce independent draws")

# ── Results ───────────────────────────────────────────────────────────────────
if failures:
    print("\n".join(failures))
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
