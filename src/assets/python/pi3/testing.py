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
import inspect
import hashlib
import random as _random_module
import types as _types_module

__all__ = [
    'seed',
    'Literal', 'Integer', 'Float', 'Choice', 'String',
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
