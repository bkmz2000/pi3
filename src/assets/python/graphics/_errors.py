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


# Registry of every i18n key the Python side can emit.
# Used by the Jest test to assert en.json and ru.json cover every key.
# When adding a new FriendlyError call site, add its key here.
ALL_MESSAGE_KEYS = [
    # Naming
    "friendlyError.naming.title",
    "friendlyError.naming.undefined",
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
]
