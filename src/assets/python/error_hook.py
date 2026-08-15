"""
Error classifier for student Python code.

Runs inside Pyodide. Catches exceptions, classifies them into kid-friendly
categories, generates plain-language explanations, and computes "did you mean?"
suggestions using Levenshtein distance against the known API surface and user
variables.

Used by worker.ts — called from a try/except wrapper around user code execution.
"""

import ast
import re
import traceback
from typing import Optional

from graphics._errors import FriendlyError, _levenshtein, _compute_suggestions

# Populated at runtime from worker.ts after graphics module init.
KNOWN_SYMBOLS: set[str] = set()

# ── Enrichment-failure log ──
# Optional enrichments (homoglyph lookup, Levenshtein) are wrapped so their
# failure degrades gracefully rather than surfacing to the student.
_enrichment_failures: list = []


def _safe(fn, *args, _enrichment_name: str = "unknown", **kwargs):
    """Call fn(*args, **kwargs); on exception log to _enrichment_failures and return None."""
    try:
        return fn(*args, **kwargs)
    except Exception as _e:
        _enrichment_failures.append({"name": _enrichment_name, "error": repr(_e)})
        try:
            import traceback as _tb
            from js import console
            console.error(f"[pi3 classifier] enrichment '{_enrichment_name}' crashed: {_e}\n{_tb.format_exc()}")
        except Exception:
            pass
        return None


def get_enrichment_failures() -> list:
    """Return logged enrichment failures (for diagnostics / testing)."""
    return list(_enrichment_failures)

# Category tags for Python exception types.
_ERROR_CATEGORIES = {
    "NameError": "naming",
    "AttributeError": "naming",
    "UnboundLocalError": "naming",
    "TypeError": "types",
    "SyntaxError": "grammar",
    "IndentationError": "grammar",
    "TabError": "grammar",
    "ImportError": "missing",
    "ModuleNotFoundError": "missing",
    "KeyError": "missing",
    "FileNotFoundError": "missing",
    "NotImplementedError": "missing",
    "OSError": "missing",
    "IndexError": "logic",
    "ValueError": "logic",
    "ZeroDivisionError": "logic",
    "RecursionError": "logic",
    "OverflowError": "logic",
    "RuntimeError": "logic",
    "StopIteration": "logic",
    "AssertionError": "logic",
    "MemoryError": "logic",
}

# Grammar/syntax errors block running; everything else allows it.
_BLOCKING_CATEGORIES = {"grammar"}


def register_known_symbols(symbols: list[str]) -> None:
    """Called from worker.ts after graphics module init to populate KNOWN_SYMBOLS."""
    KNOWN_SYMBOLS.clear()
    KNOWN_SYMBOLS.update(symbols)


def _extract_name_from_error(exc: Exception) -> Optional[str]:
    """Extract the problematic token from various exception messages."""
    msg = str(exc)

    # NameError: name 'foo' is not defined
    m = re.search(r"name '(\w+)' is not defined", msg)
    if m:
        return m.group(1)

    # UnboundLocalError: local variable 'foo' referenced before assignment
    m = re.search(r"local variable '(\w+)' referenced before assignment", msg)
    if m:
        return m.group(1)

    # AttributeError: ... has no attribute 'foo'
    m = re.search(r"has no attribute '(\w+)'", msg)
    if m:
        return m.group(1)

    # ImportError: cannot import name 'Foo' from 'module'
    m = re.search(r"cannot import name '(\w+)'", msg)
    if m:
        return m.group(1)

    # ModuleNotFoundError: No module named 'foo'
    m = re.search(r"No module named '(\w+)'", msg)
    if m:
        return m.group(1)

    return None




_SKIP_PATHS = ("graphics/", "error_hook.py", "/pyodide/", "<exec>")


def _is_library_frame(stripped: str) -> bool:
    return stripped.startswith("File ") and any(p in stripped for p in _SKIP_PATHS)


_FILE_LINE_RE = re.compile(r'(\s*File ")([^"]+)(", line )(\d+)(, in )(.*)')


def _adjust_traceback(raw: str, filename: str, line_offset: int) -> str:
    """Correct frame line numbers for the plain-script runner's harness.

    worker.ts's runScript compiles the student's code as part of one larger
    unit — `import ...` / `async def __run(): <student code>` / a module-level
    `try: await __run() except ...` — under the student's own filename so real
    frames aren't mistaken for library noise. Two harness artifacts still need
    stripping out here:

    - The module-level frame (`in <module>`) is always the harness's own —
      every student statement lives inside `__run`, so a frame reporting
      `<module>` for our filename can only be an import line or the
      `await __run()` call, never anything the student wrote.
    - Every other frame for our filename has `line_offset` extra lines above
      it (the harness preamble) that don't exist in the student's file, so
      that constant gets subtracted back out.
    """
    if not line_offset:
        return raw
    lines = raw.split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = _FILE_LINE_RE.match(line)
        if m and m.group(2) == filename:
            func_name = m.group(6)
            if func_name == "<module>":
                i += 1
                if i < len(lines) and not lines[i].strip().startswith("File ") and lines[i].strip():
                    i += 1
                continue
            raw_lineno = int(m.group(4))
            corrected = max(1, raw_lineno - line_offset)
            out.append(f"{m.group(1)}{m.group(2)}{m.group(3)}{corrected}{m.group(5)}{func_name}")
            i += 1
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def _clean_traceback(raw: str) -> str:
    """Filter library/internal frames from traceback, keeping only user code lines.

    Each traceback frame is two lines: the File line and the source context
    line beneath it.  Both are dropped together when the path is a library path.
    """
    lines = raw.split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if _is_library_frame(stripped):
            i += 1
            # Drop the source-context line that follows the File line
            if i < len(lines) and not lines[i].strip().startswith("File ") and lines[i].strip():
                i += 1
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def _parse_traceback_location(tb_text: str) -> Optional[dict]:
    """Parse the last *user-code* frame from a traceback string.

    Walks frames in reverse and stops at the first frame whose path is not a
    library path (graphics/, error_hook.py, /pyodide/).  This ensures the
    location points to the student's line even when the error ultimately
    propagates up through library internals.
    """
    lines = tb_text.strip().split("\n")
    for line in reversed(lines):
        m = re.search(r'File "([^"]+)", line (\d+)', line)
        if m:
            filepath = m.group(1)
            lineno = int(m.group(2))
            # Skip library/internal frames — keep looking for user code
            if any(p in filepath for p in _SKIP_PATHS):
                continue
            return {
                "row": lineno - 1,
                "column": 0,
                "endRow": lineno - 1,
                "endColumn": 999,
            }
    return None


def _build_error_keys(
    exc: Exception, category: str, token: Optional[str], suggestions: list
) -> tuple[Optional[str], dict]:
    """Build structured i18n messageKey and messageArgs from an exception."""
    msg = str(exc)

    if category == "naming":
        # AttributeError: use noAttribute key so the object is named explicitly
        # instead of falsely claiming the attribute is an undefined name.
        if isinstance(exc, AttributeError):
            m = re.search(r"'([^']+)' object has no attribute '([^']+)'", msg)
            if m:
                obj = m.group(1).lstrip("_")
                attr = m.group(2)
                nargs: dict = {"object": obj, "attr": attr}
                if suggestions and suggestions[0].get("candidates"):
                    cands = suggestions[0]["candidates"]
                    if len(cands) == 1:
                        nargs["candidate"] = cands[0]
                        return ("friendlyError.naming.noAttributeWithCandidate", nargs)
                return ("friendlyError.naming.noAttribute", nargs)
        # A5: fall back to raw name extraction when tokenization failed,
        # otherwise the error card renders empty (only a title).
        if not token:
            m = re.search(r"name '([^']+)' is not defined", msg)
            if m:
                return ("friendlyError.naming.undefined", {"name": m.group(1)})
            return (None, {})
        args: dict = {"name": token}
        if suggestions and suggestions[0].get("candidates"):
            candidates = suggestions[0]["candidates"]
            if len(candidates) == 1:
                args["candidate"] = candidates[0]
                return ("friendlyError.naming.undefinedWithCandidate", args)
            else:
                args["candidates"] = ", ".join(candidates[:3])
                return ("friendlyError.naming.undefinedWithCandidates", args)
        # Fall back to the plain "undefined" key so the card always has text.
        return ("friendlyError.naming.undefined", args)

    if category == "types":
        clean = re.sub(r"<class '(\w+)'>", r"\1", msg)
        if "unsupported operand type" in clean and "+" in clean:
            m = re.search(r"unsupported operand type.*for\s+\+:\s*'(\w+)'\s+and\s+'(\w+)'", clean)
            if m:
                return ("friendlyError.types.badOperator", {"op": "+", "left": m.group(1), "right": m.group(2)})
        if "can only concatenate" in clean:
            m = re.search(r"can only concatenate (\w+) \(not \"(\w+)\"\)", clean)
            if m:
                return ("friendlyError.types.badOperator", {"op": "+", "left": m.group(1), "right": m.group(2)})
        if "object is not callable" in clean:
            return ("friendlyError.types.notCallable", {})
        if "missing" in clean and "required positional argument" in clean:
            return ("friendlyError.types.missingArg", {"details": clean.strip().split('\n')[-1]})
        if "takes" in clean and "argument" in clean and "given" in clean:
            return ("friendlyError.types.wrongArgCount", {"details": clean.strip().split('\n')[-1]})
        return ("friendlyError.types.badOperator", {"op": "?", "left": "", "right": ""})

    if category == "grammar":
        if "expected ':'" in msg or "expected ':'" in str(exc):
            return ("friendlyError.grammar.missingColon", {})
        if "indentation" in msg.lower() or isinstance(exc, IndentationError):
            return ("friendlyError.grammar.indentation", {})
        if "unexpected EOF" in msg:
            return ("friendlyError.grammar.unexpectedEOF", {})
        return ("friendlyError.grammar.syntaxError", {})

    if category == "missing":
        if isinstance(exc, ImportError) or isinstance(exc, ModuleNotFoundError):
            name = token or (msg.split("'")[1] if "'" in msg else "that")
            args = {"module": name}
            if suggestions and suggestions[0].get("candidates"):
                candidates = suggestions[0]["candidates"]
                if len(candidates) == 1:
                    args["candidate"] = candidates[0]
                else:
                    args["candidates"] = ", ".join(candidates[:3])
            return ("friendlyError.missing.importError", args)
        if isinstance(exc, KeyError):
            return ("friendlyError.missing.keyError", {"key": msg})
        return ("friendlyError.missing.missingFallback", {})

    if category == "logic":
        if isinstance(exc, ZeroDivisionError):
            return ("friendlyError.logic.zeroDivision", {})
        if isinstance(exc, IndexError):
            pos = msg.split()[-1] if msg.split() else "?"
            return ("friendlyError.logic.indexError", {"index": pos})
        if isinstance(exc, ValueError):
            return ("friendlyError.logic.valueError", {})
        if isinstance(exc, MemoryError):
            return ("friendlyError.logic.memoryError", {})
        if isinstance(exc, RecursionError):
            return ("friendlyError.logic.recursionError", {})
        if isinstance(exc, AssertionError):
            return ("friendlyError.logic.assertionError", {"message": msg.split('\n')[-1]})
        return (None, {})

    if category == "api-misuse":
        return ("friendlyError.apiMisuse.fallback", {})

    return (None, {})


def _extract_user_names(code: str) -> set[str]:
    """Parse user code AST to extract all variable, function, and class names."""
    names: set[str] = set()
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return names

    class NameCollector(ast.NodeVisitor):
        def visit_Name(self, node):
            if isinstance(node.ctx, ast.Store):
                names.add(node.id)
            self.generic_visit(node)

        def visit_FunctionDef(self, node):
            names.add(node.name)
            self.generic_visit(node)

        def visit_AsyncFunctionDef(self, node):
            names.add(node.name)
            self.generic_visit(node)

        def visit_ClassDef(self, node):
            names.add(node.name)
            self.generic_visit(node)

        def visit_Import(self, node):
            for alias in node.names:
                name = alias.asname or alias.name.split(".")[0]
                names.add(name)
            self.generic_visit(node)

        def visit_ImportFrom(self, node):
            for alias in node.names:
                name = alias.asname or alias.name
                if name != "*":
                    names.add(name)
            self.generic_visit(node)

    NameCollector().visit(tree)
    return names


def classify_error(
    exc: Exception, user_code: str, filename: str, line_offset: int = 0
) -> dict:
    """
    Classify a Python exception into a structured error dict matching the
    RuntimeError TypeScript type in WorkerInterface.ts.

    Returns a dict suitable for JSON serialization and posting as a
    'runtime_error' worker event.

    `line_offset`: for the plain-script runner, how many harness-only lines
    precede the student's code in the compiled unit (see _adjust_traceback).
    Zero for every other caller — the graphics/canvas path compiles the
    student's code as its own unit with no such wrapper.

    Outer catch-all: if the classifier itself crashes (e.g. a broken enrichment
    escapes the inner _safe guards), returns the internal error card instead of
    propagating — so the student always gets a card, never a raw double-traceback.
    """
    try:
        return _classify_error_inner(exc, user_code, filename, line_offset)
    except Exception as _clf_err:
        import traceback as _tb
        _raw = _tb.format_exc()
        return {
            "category": "internal",
            "titleKey": "friendlyError.internal.title",
            "messageKey": "friendlyError.internal.classifierFailed",
            "messageArgs": {},
            "raw": _raw,
            "cleanRaw": _raw,
            "suggestions": [],
            "isBlocking": False,
            "classifierFailed": True,
        }


def _classify_error_inner(
    exc: Exception, user_code: str, filename: str, line_offset: int = 0
) -> dict:
    # FriendlyError: key/args already computed by the library; pass straight through.
    if isinstance(exc, FriendlyError):
        raw_tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
        raw = _adjust_traceback("".join(raw_tb), filename, line_offset)
        key_parts = exc.message_key.split(".")
        # key format: friendlyError.<category>.<name>  →  extract category
        category = key_parts[1] if len(key_parts) >= 2 else "api-misuse"
        title_key = f"friendlyError.{category}.title"
        location = _parse_traceback_location(raw)
        return {
            "category": category,
            "titleKey": title_key,
            "messageKey": exc.message_key,
            "messageArgs": exc.message_args,
            "raw": raw,
            "cleanRaw": _clean_traceback(raw),
            "suggestions": exc.suggestions,
            "location": location,
            "isBlocking": category in _BLOCKING_CATEGORIES,
            "codeSnippet": None,
            "codeLine": None,
            "codeColumn": None,
        }

    exc_name = type(exc).__name__
    category = _ERROR_CATEGORIES.get(exc_name, "logic")
    title_key = f"friendlyError.{category}.title"
    is_blocking = category in _BLOCKING_CATEGORIES

    # Full traceback for the "show details" expand/collapse
    raw_tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    raw = _adjust_traceback("".join(raw_tb), filename, line_offset)
    clean_raw = _clean_traceback(raw)

    # Extract the problematic token and compute suggestions
    token = _extract_name_from_error(exc)
    suggestions = []
    message_key_override = None
    message_args_override = {}
    if token:
        # Merge KNOWN_SYMBOLS with user-defined names for a complete candidate pool
        user_names = _extract_user_names(user_code)
        all_candidates = KNOWN_SYMBOLS | user_names
        # Check for Cyrillic homoglyphs first (wrong keyboard layout).
        # Wrapped in _safe so a broken homoglyph table still yields the naming card.
        try:
            from syntax_hints import check_homoglyph as _check_homo
            _homo = _safe(_check_homo, token, all_candidates, _enrichment_name="homoglyph")
        except Exception as _ie:
            _enrichment_failures.append({"name": "homoglyph_import", "error": repr(_ie)})
            _homo = None
        homo_key = _homo[0] if _homo is not None else None
        homo_args = _homo[1] if _homo is not None else {}
        if homo_key:
            message_key_override = homo_key
            message_args_override = homo_args
            suggestions = [{"token": token, "candidates": [homo_args["fixed"]]}]
        else:
            # Short tokens (≤5 chars) produce too many false positives at distance 2
            # (e.g. "prtn" matches "print" and "run" at dist=2 despite being unrelated).
            # Distance 1 — a single-character typo — is the only reliable signal for
            # short names.
            max_dist = 1 if len(token) <= 5 else 2
            _cands = _safe(_compute_suggestions, token, all_candidates, max_dist, _enrichment_name="suggestions")
            candidates = _cands if _cands is not None else []
            if candidates:
                suggestions = [{"token": token, "candidates": candidates}]

    # Build structured i18n keys
    message_key, message_args = _build_error_keys(exc, category, token, suggestions)
    if message_key_override:
        message_key = message_key_override
        message_args = message_args_override

    # Parse location from traceback
    location = _parse_traceback_location(raw)

    # Extract the actual line of code that caused the error
    code_snippet = None
    code_line = None
    if location is not None:
        row = location["row"]
        lines = user_code.split("\n")
        if 0 <= row < len(lines):
            code_snippet = lines[row].rstrip()
            code_line = row + 1  # 1-based for display

    return {
        "category": category,
        "titleKey": title_key,
        "messageKey": message_key,
        "message": f"{type(exc).__name__}: {exc}" if message_key is None else None,
        "messageArgs": message_args,
        "raw": raw,
        "cleanRaw": clean_raw,
        "suggestions": suggestions,
        "location": location,
        "isBlocking": is_blocking,
        "codeSnippet": code_snippet,
        "codeLine": code_line,
        "codeColumn": location["column"] if location else None,
    }
