"""
Syntax error classifier for student Python code.

Extracted from linter.py's E999 branch and error_hook.py's grammar branch
into a single module so both callers produce the same structured keys.
Runs inside Pyodide.

Patterns are checked in precedence order (first match wins). Each pattern
receives the source line around the error and the SyntaxError exception,
and returns (messageKey, messageArgs) or falls through to the next pattern.
"""

from graphics._manifest import NAMESPACE_ATTRS, EXPORTED_NAMES
from graphics._errors import _levenshtein


# ── Cyrillic→Latin homoglyph table for wrong-layout detection ──
# Each pair: a Cyrillic letter visually identical to its Latin twin.
# Dict form makes misalignment structurally impossible — str.maketrans
# length mismatch can never occur.
_HOMOGLYPHS = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "к": "k", "в": "b", "н": "h", "т": "t", "м": "m",
    "А": "A", "Е": "E", "О": "O", "Р": "P", "С": "C", "Х": "X", "У": "Y",
    "К": "K", "В": "B", "Н": "H", "Т": "T", "М": "M",
}
_CYR_TO_LAT = str.maketrans({ord(c): lat for c, lat in _HOMOGLYPHS.items()})


def transliterate_homoglyphs(token: str) -> str:
    """If `token` contains Cyrillic homoglyph codepoints, return the Latin
    equivalent. Returns empty string if no mapped Cyrillic char found (caller should skip)."""
    if not any(ch in _HOMOGLYPHS for ch in token):
        return ""
    return token.translate(_CYR_TO_LAT)


def check_homoglyph(token: str, known_names: set) -> tuple:
    """If `token` is a Cyrillic homoglyph of a known name, return
    ('friendlyError.naming.wrongLayout', {'got': token, 'fixed': latin}).
    Otherwise return (None, {})."""
    if not token:
        return (None, {})
    latin = transliterate_homoglyphs(token)
    if not latin:
        return (None, {})
    # Check against known names (the manifest symbols + user names)
    if latin.lower() in {n.lower() for n in known_names}:
        # Find the actual casing
        for name in known_names:
            if name.lower() == latin.lower():
                return ("friendlyError.naming.wrongLayout", {"got": token, "fixed": name})
    return (None, {})


# ── Python keyword set for typo detection ──
_PYTHON_KEYWORDS = frozenset({
    "global", "from", "import", "return", "def", "class", "while", "for",
    "if", "elif", "else", "with", "lambda", "nonlocal", "assert", "break",
    "continue", "pass", "raise", "try", "except", "finally", "yield",
    "async", "await", "in", "is", "not", "and", "or", "del",
})


# ── Syntax pattern classifiers ──

def _get_line(source: str, lineno: int) -> str:
    lines = source.splitlines()
    if 1 <= lineno <= len(lines):
        return lines[lineno - 1]
    return ""


def classify_syntax_error(source: str, exc: SyntaxError) -> dict:
    """Classify a SyntaxError into (messageKey, messageArgs).

    Returns a dict with 'messageKey' and 'messageArgs' suitable for passing
    to _make_diagnostic in linter.py or the error_hook result dict.

    Callers should fall back to their own E999* mapping when this returns
    the default E999 key.
    """
    msg = getattr(exc, 'msg', '')
    lineno = getattr(exc, 'lineno', 1)
    offset = getattr(exc, 'offset', 0)
    line = _get_line(source, lineno)

    # 1 — Smart quotes
    smart_quotes = set('«»“”„‚‘’')
    for ch in line:
        if ch in smart_quotes:
            return {
                "messageKey": "linter.E999SmartQuotes",
                "messageArgs": {"char": ch},
            }

    # 2 — Empty import: `from graphics import ` or `from graphics import`
    if ("after 'import'" in msg) or ("after import" in msg):
        return {
            "messageKey": "linter.E999ImportEmpty",
            "messageArgs": {},
        }
    import re
    if re.match(r'^\s*from\s+\w+\s+import\s*$', line):
        return {
            "messageKey": "linter.E999ImportEmpty",
            "messageArgs": {},
        }

    # 3 — Missing dot: `circle(Mouse x, 10)` where Mouse.x is intended.
    # Tokenize looking for NAME NAME where first ∈ NAMESPACE_ATTRS and
    # second ∈ its attr list.
    tokens = re.findall(r'\b([A-Za-z_]\w*)\b', line)
    for i in range(len(tokens) - 1):
        obj = tokens[i]
        attr = tokens[i + 1]
        if obj in NAMESPACE_ATTRS:
            attrs = NAMESPACE_ATTRS[obj]
            if attr in attrs:
                return {
                    "messageKey": "linter.E999MissingDot",
                    "messageArgs": {"obj": obj, "attr": attr},
                }

    # 4 — Assignment in condition: `if x = 5:` (CPython >=3.10 detects)
    if "Maybe you meant '=='" in msg:
        return {
            "messageKey": "linter.E999AssignInCondition",
            "messageArgs": {},
        }

    # 5 — Missing call parentheses: `background` without `()` when it's a
    # known callable from the manifest.
    m = re.match(r'^\s*([A-Za-z_]\w*)\s', line)
    if m:
        name = m.group(1)
        # Check if name is a known callable (not a class or constant)
        # Simple heuristic: it's in __all__ and not a known class name
        _class_names = {"Actor", "Rect", "Circle", "Group", "Collider",
                        "Camera", "Light", "TilemapLayer", "TileMap", "TileRef",
                        "TileGroup", "Cell", "Bounds",
                        "Sprite", "PixelView", "Animation", "SheetAnimation",
                        "SpriteEntry", "SheetNamespace", "AnimationController",
                        "State", "Colors", "Mouse", "Keyboard", "Window",
                        "Vector2", "Point", "Polar", "AnchorPoint", "Timer"}
        if name in EXPORTED_NAMES and name not in _class_names and name[0].islower():
            # Also check there's no '(' after it on this line
            if '(' not in line or line.index(name) + len(name) < line.index('('):
                # Look ahead: if next non-whitespace after name is not '('
                rest = line[m.end():]
                if not rest.lstrip().startswith('('):
                    return {
                        "messageKey": "linter.E999MissingCallParens",
                        "messageArgs": {"func": name},
                    }

    # 6 — `def NAME:` without parentheses
    m = re.match(r'^\s*def\s+([A-Za-z_]\w*)\s*:', line)
    if m:
        return {
            "messageKey": "linter.E999DefParens",
            "messageArgs": {"name": m.group(1)},
        }

    # 7 — Keyword argument missing '=': Actor(x=1, y300, z=2)
    # CPython raises "positional argument follows keyword argument" for this case.
    if "positional argument follows keyword argument" in msg:
        # Find a bare NAME token that ends in digits (e.g. y300 → y=300)
        all_tokens = re.findall(r'\b([A-Za-z_]\w*)\b', line)
        arg = None
        for tok in all_tokens:
            if re.match(r'^[A-Za-z_]+\d+$', tok):
                arg = tok
                break
        if arg:
            return {
                "messageKey": "linter.E999KeywordMissingEq",
                "messageArgs": {"arg": arg},
            }
        return {
            "messageKey": "linter.E999KeywordMissingEq",
            "messageArgs": {},
        }

    # 8 — Misspelled keyword: `lobal x` / `rfom graphics import *`
    # Check if the first identifier on the error line is close to a Python keyword.
    first_id = re.match(r'^\s*([A-Za-z_]\w*)', line)
    if first_id:
        first_tok = first_id.group(1)
        if first_tok not in _PYTHON_KEYWORDS:
            # Among all keywords within distance ≤ 2, prefer:
            # 1. smaller edit distance, 2. smaller length difference, 3. alphabetical
            candidates = [
                (d, abs(len(first_tok) - len(kw)), kw)
                for kw in _PYTHON_KEYWORDS
                for d in [_levenshtein(first_tok, kw)]
                if 0 < d <= 2
            ]
            if candidates:
                best_kw = min(candidates)[2]
                return {
                    "messageKey": "linter.E999KeywordTypo",
                    "messageArgs": {"got": first_tok, "candidate": best_kw},
                }

    # Fallback: existing E999* mapping (caller applies)
    return {
        "messageKey": "linter.E999",
        "messageArgs": {},
    }
