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
