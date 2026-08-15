"""
FriendlyError and shared error utilities for the graphics library.

FriendlyError carries a structured messageKey/messageArgs pair instead of a prose
string; the frontend renders all text through i18next.

Levenshtein helpers live here (single implementation) so both the library and
error_hook can compute suggestions without duplicating code.
"""


class FriendlyError(Exception):
    """Structured library error for kid-facing mistakes.

    message_key:  i18n key, e.g. 'friendlyError.naming.unknownKey'
    message_args: interpolation dict, e.g. {'name': 'Keyboard.qq'}
    suggestions:  list of ErrorSuggestion-shaped dicts
    raw:          optional English context string (shown in raw traceback only)
    """

    def __init__(self, message_key, message_args=None, suggestions=None, raw=""):
        self.message_key = message_key
        self.message_args = message_args or {}
        self.suggestions = suggestions or []
        self.raw = raw
        super().__init__(message_key)


class FriendlyAttrError(FriendlyError, AttributeError):
    """FriendlyError for attribute access mistakes.

    Inherits from AttributeError so that hasattr() returns False instead of
    propagating the error when students write optional-attribute checks.
    """


def _levenshtein(a: str, b: str) -> int:
    """Levenshtein distance — O(n*m), fine for <200 symbols."""
    if len(a) < len(b):
        return _levenshtein(b, a)
    if len(b) == 0:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(
                prev[j + 1] + 1,
                curr[j] + 1,
                prev[j] + (ca != cb),
            ))
        prev = curr
    return prev[-1]


def _compute_suggestions(token: str, candidates, max_distance: int = 2) -> list:
    """Return candidates within Levenshtein distance, sorted nearest-first."""
    if not token or len(token) < 4:
        return []
    results = []
    for c in candidates:
        d = _levenshtein(token.lower(), c.lower())
        if d == 0:
            return []
        if d <= max_distance:
            results.append((d, c))
    results.sort()
    return [c for _, c in results[:5]]


# ---------------------------------------------------------------------------
# MIGRATION SHIM infrastructure — remove after sunset, alongside every call
# site tagged "# MIGRATION SHIM — remove after sunset".
#
# Every renamed/reshaped API member keeps a temporary shim under its old
# name/shape that raises a friendly, i18n'd error naming the new spelling
# instead of silently working or throwing a raw Python traceback.
# ---------------------------------------------------------------------------


def raise_migration_error(old_name: str, new_name: str):
    """Raise the generic 'this was renamed' migration error."""
    raise FriendlyError(
        "friendlyError.migration.renamed",
        {"old": old_name, "new": new_name},
    )


def migration_property_raises(old_name: str, new_name: str) -> property:
    """A `property` whose getter and setter both always raise — for
    straight renames where the old spelling has no valid continuation
    (e.g. `Animation.done` -> `is_done()`)."""

    def getter(self):
        raise_migration_error(old_name, new_name)

    def setter(self, value):
        raise_migration_error(old_name, new_name)

    return property(getter, setter)


def migration_setter_raises(old_name: str, new_name: str):
    """Setter function that always raises — for a property whose old read
    shape still partially works (via MigrationProxy) but whose old write
    shape (`.attr = value`) has no valid continuation."""

    def setter(self, value):
        raise_migration_error(old_name, new_name)

    return setter


class MigrationProxy:
    """Wraps a computed value for a property-that-became-a-method shim.

    Calling it (mirroring the new method spelling, e.g. `actor.vel()`)
    returns the real value. Any other use — arithmetic, attribute access,
    truthiness, iteration, printing — raises a FriendlyError pointing at
    the new `name()` spelling instead of silently operating on a stale
    snapshot.
    """

    __slots__ = ("_value", "_old", "_new")

    def __init__(self, value, old_name: str, new_name: str):
        object.__setattr__(self, "_value", value)
        object.__setattr__(self, "_old", old_name)
        object.__setattr__(self, "_new", new_name)

    def __call__(self, *args, **kwargs):
        return self._value

    def _raise(self, *_args, **_kwargs):
        raise_migration_error(self._old, self._new)

    __getattr__ = _raise
    __setattr__ = _raise
    __repr__ = _raise
    __str__ = _raise
    __eq__ = _raise
    __bool__ = _raise
    __iter__ = _raise
    __getitem__ = _raise
    __len__ = _raise
    __add__ = _raise
    __radd__ = _raise
    __sub__ = _raise
    __rsub__ = _raise
    __mul__ = _raise
    __rmul__ = _raise
    __truediv__ = _raise


def migration_proxy_property(compute_fn, old_name: str, new_name: str):
    """Property getter factory for a property->method shim: computes the
    real value fresh each access via `compute_fn(self)`, wraps it so the
    old call-shaped usage (`.attr()`) still works."""

    def getter(self):
        return MigrationProxy(compute_fn(self), old_name, new_name)

    return getter


def _migration_value_alike(base_cls):
    """Build a value-alike migration wrapper subclassing `base_cls` (float
    or str): reads exactly like the real value, but calling it (the old
    fluent-method spelling, e.g. `light.radius(5)`) raises a friendly error
    instead of Python's raw 'X object is not callable'."""

    class _MigrationValue(base_cls):
        _old_name = ""
        _new_name = ""

        def __call__(self, *args, **kwargs):
            raise_migration_error(self._old_name, self._new_name)

    return _MigrationValue


_MigrationFloat = _migration_value_alike(float)
_MigrationStr = _migration_value_alike(str)


def migration_value(value, old_name: str, new_name: str):
    """Wrap a float or str `value` so it reads normally but raises a
    friendly error if called like the old fluent-method spelling."""
    cls = _MigrationFloat if isinstance(value, (int, float)) else _MigrationStr
    inst = cls(value)
    inst._old_name = old_name
    inst._new_name = new_name
    return inst


class MigrationBool:
    """Bool-alike migration wrapper (bool itself can't be subclassed):
    reads truthy/falsy like the real value; calling it (the old
    fluent-method spelling) raises a friendly error."""

    __slots__ = ("_value", "_old", "_new")

    def __init__(self, value: bool, old_name: str, new_name: str):
        object.__setattr__(self, "_value", bool(value))
        object.__setattr__(self, "_old", old_name)
        object.__setattr__(self, "_new", new_name)

    def __call__(self, *args, **kwargs):
        raise_migration_error(self._old, self._new)

    def __bool__(self):
        return self._value

    def __eq__(self, other):
        return self._value == other

    def __repr__(self):
        return repr(self._value)

    def __hash__(self):
        return hash(self._value)


# Registry of every i18n key the Python side can emit.
# Used by the Jest test to assert en.json and ru.json cover every key.
# When adding a new FriendlyError call site, add its key here.
ALL_MESSAGE_KEYS = [
    # Naming
    "friendlyError.naming.title",
    "friendlyError.naming.undefined",
    "friendlyError.naming.undefinedWithCandidate",
    "friendlyError.naming.undefinedWithCandidates",
    "friendlyError.naming.noAttribute",
    "friendlyError.naming.noAttributeWithCandidate",
    "friendlyError.naming.unknownKey",
    "friendlyError.naming.badColor",
    "friendlyError.naming.noAnimation",
    "friendlyError.naming.noSprite",
    "friendlyError.naming.actorSealed",
    "friendlyError.naming.actorUnknown",
    "friendlyError.naming.actorKwargTypo",
    "friendlyError.naming.wrongLayout",
    # Types
    "friendlyError.types.title",
    "friendlyError.types.badOperator",
    "friendlyError.types.wrongArgType",
    "friendlyError.types.badColorType",
    "friendlyError.types.notCallable",
    "friendlyError.types.missingArg",
    "friendlyError.types.wrongArgCount",
    # Grammar
    "friendlyError.grammar.title",
    "friendlyError.grammar.syntaxError",
    "friendlyError.grammar.missingColon",
    "friendlyError.grammar.indentation",
    "friendlyError.grammar.unexpectedEOF",
    # Missing
    "friendlyError.missing.title",
    "friendlyError.missing.importError",
    "friendlyError.missing.keyError",
    "friendlyError.missing.missingFallback",
    # Logic
    "friendlyError.logic.title",
    "friendlyError.logic.indexError",
    "friendlyError.logic.valueError",
    "friendlyError.logic.zeroDivision",
    "friendlyError.logic.memoryError",
    "friendlyError.logic.recursionError",
    "friendlyError.logic.assertionError",
    "friendlyError.logic.emptySequence",
    "friendlyError.logic.spriteNoFrames",
    # API misuse
    "friendlyError.apiMisuse.title",
    "friendlyError.apiMisuse.fallback",
    "friendlyError.apiMisuse.polylineNotIterable",
    "friendlyError.apiMisuse.polylineBadPoint",
    "friendlyError.apiMisuse.pointOrCoords",
    "friendlyError.apiMisuse.shapeRandomFailed",
    # Internal (classifier crashed)
    "friendlyError.internal.title",
    "friendlyError.internal.classifierFailed",
    # Migration (temporary shims for renamed/reshaped API members)
    "friendlyError.migration.title",
    "friendlyError.migration.renamed",
    "friendlyError.migration.removed",
]
