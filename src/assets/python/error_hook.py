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

# Kid-friendly short labels per category.
_FRIENDLY_TITLES = {
    "naming": "Naming mistake",
    "types": "Type mix-up",
    "grammar": "Grammar problem",
    "missing": "Something missing",
    "logic": "Logic error",
    "api-misuse": "API mistake",
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


def _build_friendly_message(
    exc: Exception, category: str, token: Optional[str], suggestions: list
) -> str:
    """Build a kid-friendly plain-English explanation string."""
    exc_name = type(exc).__name__
    msg = str(exc)

    if category == "naming":
        if token:
            base = f"The name '{token}' isn't recognized."
            if suggestions and suggestions[0].get("candidates"):
                candidates = suggestions[0]["candidates"]
                if len(candidates) == 1:
                    base += f" Did you mean '{candidates[0]}'?"
                else:
                    names = "', '".join(candidates)
                    base += f" Did you mean one of: '{names}'?"
            else:
                base += " Check your spelling — Python is case-sensitive!"
            return base

    if category == "types":
        # Strip module paths for readability
        clean = re.sub(r"<class '(\w+)'>", r"\1", msg)

        # Common TypeError patterns — give actionable advice
        if "unsupported operand type" in clean and "+" in clean:
            m = re.search(r"unsupported operand type.*for\s+\+:\s*'(\w+)'\s+and\s+'(\w+)'", clean)
            if m:
                a, b = m.group(1), m.group(2)
                if a == "int" and b == "str":
                    return f"You tried to add a number and text together. Try converting one: str(N) + 'text' or N + int('5')."
                if a == "str" and b == "int":
                    return f"You tried to add text and a number together. Try converting: 'text' + str(N) or int('5') + N."
                return f"You can't add a {a} and a {b} together. Try converting one to the other type."
        if "object is not callable" in clean:
            return "You're using parentheses on something that isn't a function. Did you mean to access a property instead?"
        if "missing" in clean and "required positional argument" in clean:
            return f"Not enough information! {clean}"
        if "takes" in clean and "argument" in clean and "given" in clean:
            return f"Wrong number of arguments: {clean}"

        lines = clean.strip().split("\n")
        return lines[-1] if lines else clean

    if category == "grammar":
        if "expected ':'" in msg or "expected ':'" in str(exc):
            return "A ':' (colon) is missing at the end of a line."
        if "indentation" in msg.lower() or isinstance(exc, IndentationError):
            return "The spacing (indentation) isn't right. Make sure each line starts at the correct position."
        if "unexpected EOF" in msg:
            return "Python reached the end of your code but expected more. Check for missing closing brackets or parentheses."
        return "Python can't understand this line. Check for typos or missing symbols."

    if category == "missing":
        if isinstance(exc, ImportError) or isinstance(exc, ModuleNotFoundError):
            name = token or msg.split("'")[1] if "'" in msg else "that"
            base = f"Can't find '{name}'. Make sure you spelled it correctly."
            if suggestions and suggestions[0].get("candidates"):
                candidates = suggestions[0]["candidates"]
                if len(candidates) == 1:
                    base += f" Did you mean '{candidates[0]}'?"
                else:
                    names = "', '".join(candidates)
                    base += f" Did you mean one of: '{names}'?"
            return base
        if isinstance(exc, KeyError):
            return f"The key '{msg}' doesn't exist. Check your spelling."
        return msg.split("\n")[-1] if "\n" in msg else msg

    if category == "logic":
        if isinstance(exc, ZeroDivisionError):
            return "You tried to divide by zero — that's not possible!"
        if isinstance(exc, IndexError):
            pos = msg.split()[-1] if msg.split() else "?"
            return f"You tried to reach position {pos} but it doesn't exist. Remember: counting starts at 0, so a list with 3 items has positions 0, 1, and 2."
        if isinstance(exc, ValueError):
            return f"The value you used doesn't work here: {msg}"
        if isinstance(exc, MemoryError):
            return "Your program ran out of memory. Try using smaller lists or fewer sprites."
        if isinstance(exc, RecursionError):
            return "Your function called itself too many times — it went into an infinite loop!"
        if isinstance(exc, AssertionError):
            return f"An 'assert' check failed: {msg}"
        return msg.split("\n")[-1] if "\n" in msg else msg

    if category == "api-misuse":
        return msg.split("\n")[-1] if "\n" in msg else msg

    # Fallback
    return msg.split("\n")[-1] if "\n" in msg else msg


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
    exc: Exception, user_code: str, filename: str
) -> dict:
    """
    Classify a Python exception into a structured error dict matching the
    RuntimeError TypeScript type in WorkerInterface.ts.

    Returns a dict suitable for JSON serialization and posting as a
    'runtime_error' worker event.
    """
    # FriendlyError: key/args already computed by the library; pass straight through.
    if isinstance(exc, FriendlyError):
        raw_tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
        raw = "".join(raw_tb)
        key_parts = exc.message_key.split(".")
        # key format: friendlyError.<category>.<name>  →  extract category
        category = key_parts[1] if len(key_parts) >= 2 else "api-misuse"
        title_key = f"friendlyError.{category}.title"
        location = _parse_traceback_location(raw)
        return {
            "category": category,
            "title": _FRIENDLY_TITLES.get(category, "Error"),
            "titleKey": title_key,
            "message": exc.message_key,  # fallback; frontend prefers messageKey
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
    title = _FRIENDLY_TITLES.get(category, "Error")
    is_blocking = category in _BLOCKING_CATEGORIES

    # Full traceback for the "show details" expand/collapse
    raw_tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    raw = "".join(raw_tb)
    clean_raw = _clean_traceback(raw)

    # Extract the problematic token and compute suggestions
    token = _extract_name_from_error(exc)
    suggestions = []
    if token:
        # Merge KNOWN_SYMBOLS with user-defined names for a complete candidate pool
        user_names = _extract_user_names(user_code)
        all_candidates = KNOWN_SYMBOLS | user_names
        candidates = _compute_suggestions(token, all_candidates)
        if candidates:
            suggestions = [{"token": token, "candidates": candidates}]

    # Build kid-friendly message
    message = _build_friendly_message(exc, category, token, suggestions)

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
        "title": title,
        "message": message,
        "raw": raw,
        "cleanRaw": clean_raw,
        "suggestions": suggestions,
        "location": location,
        "isBlocking": is_blocking,
        "codeSnippet": code_snippet,
        "codeLine": code_line,
        "codeColumn": location["column"] if location else None,
    }
