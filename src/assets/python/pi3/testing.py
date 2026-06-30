"""
pi3.testing — deterministic test generation for competitive programming problems.

Usage:
    from pi3.testing import *

    def solution(test):
        return sum(test.arr)

    ex = Example()
    ex.add_line(Literal(5, name="n"))
    ex.add_line(Literal([1, 2, 3, 4, 5], name="arr"))
    ex.answer(15)

    easy = Easy()
    easy.add_line(Integer(1, 100, name="n"))
    easy.add_line(UniqueSample(range(1, 100), 5, name="arr"))

    medium = Medium()
    medium.add_line(Integer(1, 1000, name="n"))
    medium.add_lines(UniqueSample(range(1, 1000), 100, name="arr"))

    tests = (ex + easy*5 + medium*10).with_solution(solution)
    print(tests)
"""
import json
import sys
import inspect
import hashlib
import random as _random_module
import types as _types_module

__all__ = [
    'seed',
    'Literal', 'Compute', 'Integer', 'Float', 'Choice', 'String',
    'Permutation', 'Sample', 'UniqueSample',
    'Example', 'Easy', 'Medium', 'Hard',
]

# ── Module-level RNG ──────────────────────────────────────────────────────────

_rng: _random_module.Random = _random_module.Random()


def seed(slug: str) -> None:
    """Seed the generator RNG from a problem slug. Called by the runtime."""
    seed_bytes = hashlib.sha256(slug.encode()).digest()
    seed_int = int.from_bytes(seed_bytes[:8], 'big')
    _rng.seed(seed_int)


# ── Recipe base ───────────────────────────────────────────────────────────────

class _Recipe:
    """Base for deferred random values. Subclasses implement materialize()."""
    def __init__(self, *, name=None):
        self.name = name

    def materialize(self, rng: _random_module.Random):
        raise NotImplementedError


class Literal(_Recipe):
    """A fixed value (no randomness)."""
    def __init__(self, value, *, name=None):
        super().__init__(name=name)
        self._value = value

    def materialize(self, rng):
        return self._value


class Compute(_Recipe):
    """A recipe that derives a value from other recipes via a pure function.

    The function is called with the materialized values of its argument
    recipes, in order. The function must be pure (no side effects, no
    randomness of its own — use Integer/Float/etc. for randomness).

    Examples:
        n = Integer(1, 100, name="n")
        m = Integer(1, 100, name="m")
        # Common case with a lambda:
        p = Compute(lambda nv, mv: nv * mv, (n, m), name="p")
        # Named function:
        def total(a, b, c): return a + b + c
        s = Compute(total, (n, m, p), name="s")
        # Single-recipe shorthand:
        length = Compute(len, arr, name="length")

    Note: arguments must be declared in the tuple. A function that
    closes over a recipe from the enclosing scope and tries to use it
    as a value will fail at materialization with a TypeError — recipes
    are not values until they are materialized.

    The result must be JSON-serializable (int, float, str, list, dict,
    bool, None).
    """

    def __init__(self, fn, args, *, name=None):
        super().__init__(name=name)
        self._fn = fn
        # Allow a single recipe to skip the tuple
        if isinstance(args, _Recipe):
            args = (args,)
        # Validate before converting to tuple — better error message
        if not isinstance(args, (tuple, list)):
            raise TypeError(
                f"Compute() args must be a recipe or a tuple of recipes, "
                f"got {type(args).__name__}. Wrap raw values in Literal()."
            )
        self._args = tuple(args)
        # Validate that every arg is a recipe — better to fail fast
        for i, a in enumerate(self._args):
            if not isinstance(a, _Recipe):
                raise TypeError(
                    f"Compute() arg #{i} must be a recipe (Integer, Compute, etc.), "
                    f"got {type(a).__name__}. Wrap values in Literal()."
                )

    def materialize(self, rng):
        materialized = tuple(a.materialize(rng) for a in self._args)
        return self._fn(*materialized)


class Integer(_Recipe):
    """A random integer in [lo, hi] (inclusive)."""
    def __init__(self, lo: int, hi: int, *, name=None):
        super().__init__(name=name)
        self.lo = lo
        self.hi = hi

    def materialize(self, rng):
        return rng.randint(self.lo, self.hi)


class Float(_Recipe):
    """A random float in [lo, hi)."""
    def __init__(self, lo: float, hi: float, *, name=None):
        super().__init__(name=name)
        self.lo = lo
        self.hi = hi

    def materialize(self, rng):
        return rng.uniform(self.lo, self.hi)


class Choice(_Recipe):
    """A random choice from a sequence."""
    def __init__(self, population, *, name=None):
        super().__init__(name=name)
        self._population = list(population)

    def materialize(self, rng):
        return rng.choice(self._population)


class String(_Recipe):
    """A random string of given length from a character set."""
    def __init__(self, length: int, chars: str = 'abcdefghijklmnopqrstuvwxyz', *, name=None):
        super().__init__(name=name)
        self.length = length
        self.chars = chars

    def materialize(self, rng):
        return ''.join(rng.choice(self.chars) for _ in range(self.length))


class Permutation(_Recipe):
    """A random permutation of a sequence."""
    def __init__(self, population, *, name=None):
        super().__init__(name=name)
        self._population = list(population)

    def materialize(self, rng):
        result = list(self._population)
        rng.shuffle(result)
        return result


class Sample(_Recipe):
    """Random sample of k elements with replacement."""
    def __init__(self, population, k: int, *, name=None):
        super().__init__(name=name)
        self._population = list(population)
        self.k = k

    def materialize(self, rng):
        return [rng.choice(self._population) for _ in range(self.k)]


class UniqueSample(_Recipe):
    """Random sample of k unique elements (without replacement)."""
    def __init__(self, population, k: int, *, name=None):
        super().__init__(name=name)
        self._population = list(population)
        self.k = k

    def materialize(self, rng):
        pop = self._population
        if self.k > len(pop):
            raise ValueError(
                f"UniqueSample: k={self.k} exceeds population size {len(pop)}. "
                "Reduce k or expand the population range."
            )
        return rng.sample(pop, self.k)


# ── Rendering helpers ─────────────────────────────────────────────────────────

def _val_to_str(v) -> str:
    if isinstance(v, (list, tuple)):
        return ' '.join(str(x) for x in v)
    return str(v)


# ── TestSet ───────────────────────────────────────────────────────────────────

class _TestSet:
    tier: int = 1
    visible: bool = False

    def __init__(self):
        self._lines = []   # list of ("line", [recipes]) or ("lines", recipe)
        self._explicit_answer = None
        self._has_answer = False
        self._count = 1

    def add_line(self, *recipes) -> '_TestSet':
        """Add one input line: each recipe contributes a space-separated token."""
        self._lines.append(("line", list(recipes)))
        return self

    def add_lines(self, recipe) -> '_TestSet':
        """Add N lines: recipe must materialize to an iterable of per-line values."""
        self._lines.append(("lines", recipe))
        return self

    def answer(self, value) -> '_TestSet':
        """Set an explicit expected answer (skips reference solution for this test)."""
        self._explicit_answer = str(value)
        self._has_answer = True
        return self

    def _clone(self):
        clone = self.__class__.__new__(self.__class__)
        clone._lines = list(self._lines)
        clone._explicit_answer = self._explicit_answer
        clone._has_answer = self._has_answer
        clone._count = self._count
        return clone

    def __mul__(self, n: int):
        clone = self._clone()
        clone._count = self._count * n
        return clone

    def __add__(self, other):
        return _TestBundle([self, other])

    def _materialize_one(self, rng):
        input_lines = []
        fields = {}

        for kind, payload in self._lines:
            if kind == "line":
                parts = []
                for recipe in payload:
                    val = recipe.materialize(rng)
                    parts.append(_val_to_str(val))
                    if recipe.name:
                        fields[recipe.name] = list(val) if isinstance(val, (list, tuple)) else val
                input_lines.append(' '.join(parts))
            else:  # "lines"
                recipe = payload
                val = recipe.materialize(rng)
                items = list(val)
                for item in items:
                    input_lines.append(_val_to_str(item))
                if recipe.name:
                    fields[recipe.name] = items

        input_str = '\n'.join(input_lines) + ('\n' if input_lines else '')
        result = {
            'tier': self.tier,
            'visible': self.visible,
            'fields': fields if fields else None,
            'input': input_str,
        }
        if self._has_answer:
            result['expected'] = self._explicit_answer
        return result

    def _materialize_all(self, rng):
        return [self._materialize_one(rng) for _ in range(self._count)]

    def __str__(self) -> str:
        # Promote to a single-item bundle; each call re-materializes fresh (recipe semantic).
        return str(_TestBundle([self]))


class Example(_TestSet):
    tier = 1
    visible = True


class Easy(_TestSet):
    tier = 1
    visible = False


class Medium(_TestSet):
    tier = 2
    visible = False


class Hard(_TestSet):
    tier = 3
    visible = False


# ── TestBundle ────────────────────────────────────────────────────────────────

class _TestBundle:
    def __init__(self, parts):
        self._parts = list(parts)
        self._solution = None
        self._checker = None

    def __add__(self, other):
        clone = _TestBundle(self._parts + [other])
        clone._solution = self._solution
        clone._checker = self._checker
        return clone

    def __mul__(self, n: int):
        clone = _TestBundle([p * n for p in self._parts])
        clone._solution = self._solution
        clone._checker = self._checker
        return clone

    def with_solution(self, fn) -> '_TestBundle':
        clone = _TestBundle(list(self._parts))
        clone._solution = fn
        clone._checker = self._checker
        return clone

    def with_checker(self, fn) -> '_TestBundle':
        clone = _TestBundle(list(self._parts))
        clone._solution = self._solution
        clone._checker = fn
        return clone

    def _materialize_all(self, rng):
        result = []
        for part in self._parts:
            result.extend(part._materialize_all(rng))
        return result

    def __str__(self) -> str:
        tests = self._materialize_all(_rng)

        # If a reference solution is attached, run it against each test's
        # fields now and embed the expected answer directly in the test.
        # This way print(tests) produces a self-contained JSON bundle that
        # doesn't need the TS handler to re-run the reference.
        if self._solution is not None:
            import types, io as _io
            _old_stdout = sys.stdout
            for test in tests:
                # Don't override explicit .answer() values
                if 'expected' in test:
                    continue
                fields = test.get('fields')
                if not fields:
                    continue
                ns = types.SimpleNamespace(**fields)
                _buf = _io.StringIO()
                sys.stdout = _buf
                try:
                    result = self._solution(ns)
                    if result is not None:
                        print(result)
                finally:
                    sys.stdout = _old_stdout
                test['expected'] = _buf.getvalue().rstrip('\n')

            # Checker sanity check: if a checker is also attached, verify
            # it accepts the reference solution's output for every test.
            if self._checker is not None:
                for test in tests:
                    fields = test.get('fields')
                    if not fields:
                        continue
                    expected = test.get('expected')
                    if expected is None:
                        continue
                    ns = types.SimpleNamespace(**fields)
                    try:
                        ok = self._checker(ns, expected, expected)
                    except Exception as e:
                        raise RuntimeError(
                            f"Checker raised on test with fields {fields}: {e}"
                        ) from e
                    if not ok:
                        raise RuntimeError(
                            f"Checker rejected reference solution output "
                            f"({expected!r}) for test with fields {fields}. "
                            f"Fix the checker — it must accept the reference solution's answer."
                        )

        out = {
            'tests': tests,
            'reference_solution_py': _get_source(self._solution),
            'checker_py': _get_source(self._checker),
        }
        return json.dumps(out, ensure_ascii=False)


# ── Source extraction ─────────────────────────────────────────────────────────

def _get_source(fn) -> str | None:
    if fn is None:
        return None
    try:
        return inspect.getsource(fn)
    except (OSError, TypeError):
        return None