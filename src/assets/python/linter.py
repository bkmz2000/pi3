"""
Linter for student Python code.

Checks:
- Syntax errors (via ast.parse)
- Style: indentation (4 spaces), line length (100), blank lines between top-level defs
- Undefined names
- Unused imports
- Binary op type mismatches (e.g., 3 + "2")
- Literal type checking (e.g., Literal["up", "down"])

All diagnostics have severity "error".
Messages are templates that should be translated by the frontend.
"""

import ast
from typing import Any

INDENT_WIDTH = 4
LINE_LENGTH = 100

INT_LIKE = {"int"}
NUM_LIKE = {"int", "float"}
STR_LIKE = {"str"}
LIST_LIKE = {"list"}


def _get_line(code: str, lineno: int) -> str:
    lines = code.splitlines()
    if 1 <= lineno <= len(lines):
        return lines[lineno - 1]
    return ""


def _make_diagnostic(
    code: str,
    message_key: str,
    message_args: dict,
    lineno: int,
    col_offset: int = 0,
    end_col: int = None,
    severity: str = "error",
) -> dict:
    line = _get_line(code, lineno)
    if end_col is None:
        end_col = len(line) if line else col_offset + 1
    return {
        "code": code,
        "messageKey": message_key,
        "messageArgs": message_args,
        "row": lineno - 1,
        "column": col_offset,
        "endRow": lineno - 1,
        "endColumn": end_col,
        "severity": severity,
    }


def _check_indentation(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.body:
                first_stmt = node.body[0]
                if hasattr(first_stmt, "lineno"):
                    line_idx = first_stmt.lineno - 1
                    if line_idx < len(code.splitlines()):
                        line = code.splitlines()[line_idx]
                        stripped = line.lstrip()
                        if (
                            stripped
                            and not line.startswith(" " * 4)
                            and not line.startswith("\t")
                        ):
                            indent = len(line) - len(stripped)
                            if indent > 0 and indent % 4 != 0:
                                diagnostics.append(
                                    _make_diagnostic(
                                        "E111",
                                        "linter.E111",
                                        {"found": indent},
                                        first_stmt.lineno,
                                        0,
                                    )
                                )
                        elif stripped and "\t" in line[: len(line) - len(stripped)]:
                            diagnostics.append(
                                _make_diagnostic(
                                    "E101",
                                    "linter.E101",
                                    {},
                                    first_stmt.lineno,
                                    0,
                                )
                            )
    return diagnostics


def _check_line_length(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []
    lines = code.splitlines()
    for i, line in enumerate(lines):
        if len(line) > LINE_LENGTH:
            diagnostics.append(
                _make_diagnostic(
                    "E501",
                    "linter.E501",
                    {"length": len(line), "limit": LINE_LENGTH},
                    i + 1,
                    LINE_LENGTH,
                )
            )
    return diagnostics


def _check_blank_lines(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []
    lines = code.splitlines()

    # Only check direct children of the module — not methods inside classes.
    top_level_defs = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start_lineno = node.lineno
            if node.decorator_list:
                start_lineno = node.decorator_list[0].lineno
            end_lineno = getattr(node, "end_lineno", node.lineno)
            top_level_defs.append((start_lineno, end_lineno))

    for i in range(len(top_level_defs) - 1):
        current_end = top_level_defs[i][1]
        next_start = top_level_defs[i + 1][0]

        blank_count = sum(
            1 for l in range(current_end, next_start - 1)
            if l < len(lines) and not lines[l].strip()
        )

        if blank_count > 4:
            for l in range(current_end, next_start - 1):
                if l < len(lines) and not lines[l].strip():
                    diagnostics.append(
                        _make_diagnostic("E303", "linter.E303", {"count": blank_count}, l + 1)
                    )
                    break

    return diagnostics


class ScopeTracker(ast.NodeVisitor):
    def __init__(self, tree: ast.Module, code: str):
        self.tree = tree
        self.code = code
        self.scopes = [set()]
        self.imports = [set()]
        self.defined_in_scope = [set()]
        self.used_names = set()
        self.star_imports = set()  # Track which modules used star imports
        # Known modules that support star imports in this project
        self.known_star_modules = {
            "graphics",
            "graphics.actors",
            "graphics.actors.config",
        }
        self.diagnostics = []

    def push_scope(self):
        self.scopes.append(set())
        self.imports.append(set())
        self.defined_in_scope.append(set())

    def pop_scope(self):
        self.scopes.pop()
        self.imports.pop()
        self.defined_in_scope.pop()

    def _get_upper_scope_names(self) -> set:
        result = set()
        for scope in self.scopes[:-1]:
            result.update(scope)
        return result

    def _get_import_lineno(self, name: str) -> int:
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.asname == name or alias.name.split(".")[0] == name:
                        if hasattr(node, "lineno"):
                            return node.lineno
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.asname == name or alias.name == name:
                        if hasattr(node, "lineno"):
                            return node.lineno
        return 1

    def visit_FunctionDef(self, node):
        self.push_scope()
        self.generic_visit(node)
        self.pop_scope()

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_Lambda = visit_FunctionDef

    def visit_ClassDef(self, node):
        self.push_scope()
        self.generic_visit(node)
        self.pop_scope()

    def visit_Import(self, node):
        for alias in node.names:
            name = alias.asname if alias.asname else alias.name.split(".")[0]
            self.imports[-1].add(name)
            self.scopes[-1].add(name)

    def visit_ImportFrom(self, node):
        for alias in node.names:
            name = alias.asname if alias.asname else alias.name
            # Check if this is a star import (module.*)
            if name == "*":
                # Star imports make all exported names available
                # We can't know what's exported without the actual module
                # So we just mark the module and skip individual tracking
                if node.module:
                    self.star_imports.add(node.module)
                    # Don't add * to imports
                continue
            self.imports[-1].add(name)
            self.scopes[-1].add(name)

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            found = False
            for scope in self.scopes:
                if node.id in scope:
                    found = True
                    break
            if not found:
                if node.id in {
                    "print",
                    "len",
                    "range",
                    "str",
                    "int",
                    "float",
                    "list",
                    "dict",
                    "set",
                    "tuple",
                    "input",
                    "open",
                    "abs",
                    "min",
                    "max",
                    "sum",
                    "sorted",
                    "reversed",
                    "enumerate",
                    "zip",
                    "map",
                    "filter",
                    "any",
                    "all",
                    "isinstance",
                    "type",
                    "True",
                    "False",
                    "None",
                    "math",
                    "random",
                }:
                    found = True
            if not found:
                # Check if this name is from a known star import module
                for mod in self.star_imports:
                    if mod in self.known_star_modules:
                        found = True
                        break
            if not found:
                self.diagnostics.append(
                    _make_diagnostic(
                        "F821",
                        "linter.F821",
                        {"name": node.id},
                        node.lineno,
                        node.col_offset,
                    )
                )
            else:
                self.used_names.add(node.id)
        elif isinstance(node.ctx, (ast.Store, ast.Del)):
            if len(self.scopes) > 0:
                self.scopes[-1].add(node.id)
                if len(self.defined_in_scope) > 0:
                    self.defined_in_scope[-1].add(node.id)

    def visit_AnnAssign(self, node):
        if isinstance(node.target, ast.Name):
            name = node.target.id
            if len(self.scopes) > 0:
                self.scopes[-1].add(name)
                if len(self.defined_in_scope) > 0:
                    self.defined_in_scope[-1].add(name)
            if node.value:
                self.visit(node.value)

    def visit_Module(self, node):
        self.generic_visit(node)
        # Check unused imports at global scope
        global_imports = self.imports[0]
        for name in global_imports:
            if name not in self.used_names:
                if name == "Literal":
                    continue
                lineno = self._get_import_lineno(name)
                self.diagnostics.append(
                    _make_diagnostic(
                        "F401",
                        "linter.F401",
                        {"name": name},
                        lineno if lineno else 1,
                    )
                )


def _check_binary_op_types(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []

    class TypeChecker(ast.NodeVisitor):
        def __init__(self):
            self.diagnostics = []

        def visit_BinOp(self, node: ast.BinOp):
            self.generic_visit(node)

            op_name = type(node.op).__name__
            left_type = self._get_type(node.left)
            right_type = self._get_type(node.right)

            if left_type is None or right_type is None:
                return

            op_symbols = {
                "Add": "+",
                "Sub": "-",
                "Mult": "*",
                "Div": "/",
                "FloorDiv": "//",
                "Mod": "%",
                "Pow": "**",
            }
            op_symbol = op_symbols.get(op_name, op_name.lower())

            if op_name in {"Add", "Sub", "Mult", "Div", "FloorDiv", "Mod", "Pow"}:
                if op_name == "Div" or op_name == "FloorDiv":
                    if not (left_type in NUM_LIKE and right_type in NUM_LIKE):
                        self.diagnostics.append(
                            _make_diagnostic(
                                "E225",
                                "linter.E225",
                                {
                                    "op": op_symbol,
                                    "left": left_type,
                                    "right": right_type,
                                },
                                node.lineno,
                                node.col_offset,
                            )
                        )
                elif op_name == "Add":
                    if left_type in NUM_LIKE and right_type in NUM_LIKE:
                        pass
                    elif left_type in STR_LIKE and right_type in STR_LIKE:
                        pass
                    elif not (
                        (left_type in STR_LIKE and right_type in NUM_LIKE)
                        or (right_type in STR_LIKE and left_type in NUM_LIKE)
                    ):
                        if not (left_type in NUM_LIKE and right_type in NUM_LIKE):
                            self.diagnostics.append(
                                _make_diagnostic(
                                    "E225",
                                    "linter.E225",
                                    {
                                        "op": op_symbol,
                                        "left": left_type,
                                        "right": right_type,
                                    },
                                    node.lineno,
                                    node.col_offset,
                                )
                            )
                    else:
                        self.diagnostics.append(
                            _make_diagnostic(
                                "E225",
                                "linter.E225",
                                {
                                    "op": op_symbol,
                                    "left": left_type,
                                    "right": right_type,
                                },
                                node.lineno,
                                node.col_offset,
                            )
                        )
                elif not (left_type in NUM_LIKE and right_type in NUM_LIKE):
                    self.diagnostics.append(
                        _make_diagnostic(
                            "E225",
                            "linter.E225",
                            {"op": op_symbol, "left": left_type, "right": right_type},
                            node.lineno,
                            node.col_offset,
                        )
                    )

            elif op_name == "Mult":
                if not (left_type in NUM_LIKE and right_type in NUM_LIKE):
                    if not (
                        (left_type in STR_LIKE and right_type in INT_LIKE)
                        or (left_type in INT_LIKE and right_type in STR_LIKE)
                        or (left_type in LIST_LIKE and right_type in INT_LIKE)
                        or (left_type in INT_LIKE and right_type in LIST_LIKE)
                    ):
                        self.diagnostics.append(
                            _make_diagnostic(
                                "E225",
                                "linter.E225",
                                {
                                    "op": op_symbol,
                                    "left": left_type,
                                    "right": right_type,
                                },
                                node.lineno,
                                node.col_offset,
                            )
                        )

            elif op_name in {"Eq", "NotEq", "Lt", "LtE", "Gt", "GtE"}:
                incompatible = (left_type in NUM_LIKE and right_type in STR_LIKE) or (
                    left_type in STR_LIKE and right_type in NUM_LIKE
                )
                if incompatible:
                    self.diagnostics.append(
                        _make_diagnostic(
                            "E225",
                            "linter.E225",
                            {"op": op_symbol, "left": left_type, "right": right_type},
                            node.lineno,
                            node.col_offset,
                        )
                    )

        def _get_type(self, node: ast.AST) -> str | None:
            if isinstance(node, ast.Constant):
                if isinstance(node.value, bool):
                    return "bool"
                elif isinstance(node.value, int):
                    return "int"
                elif isinstance(node.value, float):
                    return "float"
                elif isinstance(node.value, str):
                    return "str"
                elif isinstance(node.value, list):
                    return "list"
                elif isinstance(node.value, dict):
                    return "dict"
                elif isinstance(node.value, tuple):
                    return "tuple"
                elif node.value is None:
                    return "None"
            elif isinstance(node, ast.Name):
                return None
            elif isinstance(node, ast.BinOp):
                op_name = type(node.op).__name__
                if op_name == "Add":
                    left = self._get_type(node.left)
                    right = self._get_type(node.right)
                    if left == "str" or right == "str":
                        return "str"
                    elif left in NUM_LIKE and right in NUM_LIKE:
                        if op_name in {"Div", "FloorDiv"}:
                            return "float"
                        return "int"
                return None
            elif isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                if func_name == "len":
                    return "int"
                elif func_name in {
                    "str",
                    "int",
                    "float",
                    "bool",
                    "list",
                    "dict",
                    "set",
                    "tuple",
                    "range",
                }:
                    return func_name
                elif func_name == "input":
                    return "str"
                elif func_name == "print":
                    return "None"
                return None
            elif isinstance(node, ast.List):
                return "list"
            elif isinstance(node, ast.Dict):
                return "dict"
            elif isinstance(node, ast.Tuple):
                return "tuple"
            elif isinstance(node, ast.Subscript):
                return self._get_type(node.value)
            return None

    checker = TypeChecker()
    checker.visit(tree)
    diagnostics.extend(checker.diagnostics)
    return diagnostics


def _check_literal_types(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []
    literal_types: dict[str, set[str]] = {}

    class LiteralCollector(ast.NodeVisitor):
        def visit_AnnAssign(self, node):
            if isinstance(node.annotation, ast.Subscript):
                if (
                    isinstance(node.annotation.value, ast.Name)
                    and node.annotation.value.id == "Literal"
                ):
                    if isinstance(node.target, ast.Name):
                        var_name = node.target.id
                        values = set()
                        slice_node = node.annotation.slice
                        if isinstance(slice_node, ast.Tuple):
                            for elt in slice_node.elts:
                                if isinstance(elt, ast.Constant):
                                    values.add(str(elt.value))
                        elif isinstance(slice_node, ast.Constant):
                            values.add(str(slice_node.value))
                        literal_types[var_name] = values
            self.generic_visit(node)

    collector = LiteralCollector()
    collector.visit(tree)

    class LiteralChecker(ast.NodeVisitor):
        def visit_Assign(self, node: ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    var_name = target.id
                    if var_name in literal_types and isinstance(
                        node.value, ast.Constant
                    ):
                        value = str(node.value.value)
                        if value not in literal_types[var_name]:
                            literals = ", ".join(sorted(literal_types[var_name]))
                            diagnostics.append(
                                _make_diagnostic(
                                    "E225",
                                    "linter.E225",
                                    {
                                        "op": "=",
                                        "left": f"Literal[{literals}]",
                                        "right": f"'{value}'",
                                    },
                                    node.lineno,
                                    node.col_offset,
                                )
                            )
            self.generic_visit(node)

        def visit_AnnAssign(self, node: ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                var_name = node.target.id
                if var_name in literal_types and node.value:
                    if isinstance(node.value, ast.Constant):
                        value = str(node.value.value)
                        if value not in literal_types[var_name]:
                            literals = ", ".join(sorted(literal_types[var_name]))
                            diagnostics.append(
                                _make_diagnostic(
                                    "E225",
                                    "linter.E225",
                                    {
                                        "op": "=",
                                        "left": f"Literal[{literals}]",
                                        "right": f"'{value}'",
                                    },
                                    node.lineno,
                                    node.col_offset,
                                )
                            )
            self.generic_visit(node)

    checker = LiteralChecker()
    checker.visit(tree)

    return diagnostics


def _check_call_types(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []

    var_types: dict[str, str] = {}
    list_element_types: dict[str, str] = {}

    class TypeTracker(ast.NodeVisitor):
        def visit_Assign(self, node):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    var_name = target.id
                    value_type = self._get_type(node.value)
                    var_types[var_name] = value_type
                    if (
                        value_type == "list"
                        and node.value
                        and isinstance(node.value, ast.List)
                        and node.value.elts
                    ):
                        element_type = self._get_type(node.value.elts[0])
                        list_element_types[var_name] = element_type
                        for elt in node.value.elts:
                            self.visit(elt)
            self.generic_visit(node)

        def visit_AnnAssign(self, node):
            if isinstance(node.target, ast.Name):
                var_name = node.target.id
                if isinstance(node.annotation, ast.Name):
                    var_types[var_name] = node.annotation.id
            self.generic_visit(node)

        def _get_type(self, node: ast.AST) -> str | None:
            if isinstance(node, ast.Constant):
                if isinstance(node.value, bool):
                    return "bool"
                elif isinstance(node.value, int):
                    return "int"
                elif isinstance(node.value, float):
                    return "float"
                elif isinstance(node.value, str):
                    return "str"
                elif isinstance(node.value, list):
                    return "list"
                elif isinstance(node.value, dict):
                    return "dict"
                elif isinstance(node.value, tuple):
                    return "tuple"
            elif isinstance(node, ast.Name):
                return var_types.get(node.id)
            elif isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                if func_name in {
                    "str",
                    "int",
                    "float",
                    "bool",
                    "list",
                    "dict",
                    "set",
                    "tuple",
                    "range",
                }:
                    return func_name
                return None
            elif isinstance(node, ast.List):
                return "list"
            elif isinstance(node, ast.Dict):
                return "dict"
            elif isinstance(node, ast.Tuple):
                return "tuple"
            elif isinstance(node, ast.Subscript):
                return self._get_type(node.value)
            return None

    tracker = TypeTracker()
    tracker.visit(tree)

    class CallTypeChecker(ast.NodeVisitor):
        def visit_Call(self, node):
            func_name = ""
            obj_name = ""
            if isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
                if isinstance(node.func.value, ast.Name):
                    obj_name = node.func.value.id

            if obj_name in list_element_types:
                element_type = list_element_types[obj_name]
                if element_type and node.args:
                    arg_type = self._get_type(node.args[0])
                    if arg_type and arg_type != element_type:
                        diagnostics.append(
                            _make_diagnostic(
                                "E225",
                                "linter.E225Call",
                                {
                                    "method": func_name,
                                    "expected": element_type,
                                    "found": arg_type,
                                },
                                node.lineno,
                                node.col_offset,
                            )
                        )
            self.generic_visit(node)

        def _get_type(self, node: ast.AST) -> str | None:
            if isinstance(node, ast.Constant):
                if isinstance(node.value, bool):
                    return "bool"
                elif isinstance(node.value, int):
                    return "int"
                elif isinstance(node.value, float):
                    return "float"
                elif isinstance(node.value, str):
                    return "str"
                elif isinstance(node.value, list):
                    return "list"
            elif isinstance(node, ast.Name):
                return var_types.get(node.id)
            elif isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                if func_name in {
                    "str",
                    "int",
                    "float",
                    "bool",
                    "list",
                    "dict",
                    "set",
                    "tuple",
                    "range",
                }:
                    return func_name
            elif isinstance(node, ast.List):
                return "list"
            elif isinstance(node, ast.BinOp):
                return "int"  # Simplified
            return None

    checker = CallTypeChecker()
    checker.visit(tree)
    return diagnostics


_SHORT_NAME_EXEMPTION = 2
_BLOCKLIST = {"data", "value", "temp", "result", "thing", "stuff"}
_GRAPHICS_CONSTRUCTORS = {"Actor", "Rect", "Circle", "Group", "Window"}


def _vowel_ratio(name: str) -> float:
    vowels = sum(1 for c in name.lower() if c in "aeiou")
    return vowels / len(name) if name else 1.0


def _check_unused_variables(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []

    class UsageTracker(ast.NodeVisitor):
        """Tracks module-level assignments and all usages (any depth)."""
        def __init__(self):
            self.assigned: dict[str, ast.AST] = {}
            self.used: set[str] = set()
            self._scope_depth = 0

        def _track_target(self, target: ast.AST) -> None:
            if self._scope_depth > 0:
                return
            if isinstance(target, ast.Name):
                name = target.id
                if not name.startswith("_") and len(name) > _SHORT_NAME_EXEMPTION:
                    self.assigned[name] = target
            elif isinstance(target, (ast.Tuple, ast.List)):
                for elt in target.elts:
                    self._track_target(elt)

        def visit_Assign(self, node):
            for target in node.targets:
                self._track_target(target)
            self.generic_visit(node)

        def visit_AugAssign(self, node):
            if isinstance(node.target, ast.Name):
                self.used.add(node.target.id)
            self.generic_visit(node)

        def visit_For(self, node):
            self._track_target(node.target)
            self.generic_visit(node)

        def visit_With(self, node):
            for item in node.items:
                if item.optional_vars is not None:
                    self._track_target(item.optional_vars)
            self.generic_visit(node)

        def visit_Name(self, node):
            if isinstance(node.ctx, ast.Load):
                self.used.add(node.id)

        def visit_FunctionDef(self, node):
            self.used.add(node.name)
            self._scope_depth += 1
            self.generic_visit(node)
            self._scope_depth -= 1

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_ClassDef(self, node):
            self.used.add(node.name)
            self.generic_visit(node)

    tracker = UsageTracker()
    tracker.visit(tree)

    for name, node in tracker.assigned.items():
        if name not in tracker.used:
            diagnostics.append(_make_diagnostic(
                "W001", "linter.W001", {"name": name},
                node.lineno, node.col_offset, node.col_offset + len(name),
                severity="warning",
            ))
    return diagnostics


def _check_variable_names(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []

    class NameChecker(ast.NodeVisitor):
        def visit_Assign(self, node):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    name = target.id
                    if name.startswith("_"):
                        continue
                    if name in _BLOCKLIST:
                        diagnostics.append(_make_diagnostic(
                            "W002", "linter.W002", {"name": name},
                            target.lineno, target.col_offset,
                            target.col_offset + len(name), severity="warning",
                        ))
                    elif len(name) > 4 and _vowel_ratio(name) < 0.2:
                        diagnostics.append(_make_diagnostic(
                            "W003", "linter.W003", {"name": name},
                            target.lineno, target.col_offset,
                            target.col_offset + len(name), severity="warning",
                        ))
            self.generic_visit(node)

    NameChecker().visit(tree)
    return diagnostics


def _levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            old = dp[j]
            dp[j] = prev if a[i - 1] == b[j - 1] else 1 + min(prev, dp[j], dp[j - 1])
            prev = old
    return dp[n]


def _check_similar_names(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []
    seen: list[tuple[str, ast.AST]] = []

    class SimilarChecker(ast.NodeVisitor):
        def visit_Assign(self, node):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    name = target.id
                    if len(name) >= 3:
                        for prev_name, prev_node in seen:
                            if len(prev_name) >= 3 and _levenshtein(name, prev_name) == 1:
                                diagnostics.append(_make_diagnostic(
                                    "W004", "linter.W004", {"name": name, "other": prev_name},
                                    target.lineno, target.col_offset,
                                    target.col_offset + len(name), severity="warning",
                                ))
                                break
                        seen.append((name, target))
            self.generic_visit(node)

    SimilarChecker().visit(tree)
    return diagnostics


def _check_type_reassignment(code: str, tree: ast.Module) -> list[dict]:
    diagnostics = []
    var_types: dict[str, tuple[str, ast.AST]] = {}

    def infer_type(node: ast.AST) -> str | None:
        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool):
                return "bool"
            if isinstance(node.value, int):
                return "int"
            if isinstance(node.value, float):
                return "float"
            if isinstance(node.value, str):
                return "str"
        elif isinstance(node, ast.List):
            return "list"
        elif isinstance(node, ast.Dict):
            return "dict"
        elif isinstance(node, ast.Tuple):
            return "tuple"
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                fname = node.func.id
                if fname in {"str", "int", "float", "bool", "list", "dict", "set", "tuple"}:
                    return fname
                if fname in _GRAPHICS_CONSTRUCTORS:
                    return fname
            elif isinstance(node.func, ast.Attribute):
                attr_name = node.func.attr
                if attr_name in _GRAPHICS_CONSTRUCTORS:
                    return attr_name
                return None
        elif isinstance(node, ast.Name):
            return var_types.get(node.id, (None, None))[0]
        return None

    class TypeReassignChecker(ast.NodeVisitor):
        def visit_Assign(self, node):
            new_type = infer_type(node.value)
            for target in node.targets:
                if isinstance(target, ast.Name):
                    name = target.id
                    if name in var_types:
                        old_type, _ = var_types[name]
                        if old_type and new_type and old_type != new_type:
                            diagnostics.append(_make_diagnostic(
                                "W005", "linter.W005",
                                {"name": name, "fromType": old_type, "toType": new_type},
                                target.lineno, target.col_offset,
                                target.col_offset + len(name), severity="warning",
                            ))
                    if new_type:
                        var_types[name] = (new_type, target)
            self.generic_visit(node)

    TypeReassignChecker().visit(tree)
    return diagnostics


def _check_method_not_called(code: str, tree: ast.Module) -> list[dict]:
    """Warn when a method is used as a bare statement without calling it.

    Detects `apple.draw` as a statement (should be `apple.draw()`).
    Only fires for known Actor instance methods; ignores properties and static methods.
    Does NOT fire for `x = apple.draw` or `apple.draw` used as an argument.
    """
    from graphics._manifest import ACTOR_METHODS
    _actor_method_set = set(ACTOR_METHODS)
    diagnostics = []

    class MethodCallChecker(ast.NodeVisitor):
        def visit_Expr(self, node):
            if isinstance(node.value, ast.Attribute):
                attr = node.value.attr
                if attr in _actor_method_set:
                    diagnostics.append(_make_diagnostic(
                        "W_MethodNotCalled",
                        "linter.W_MethodNotCalled",
                        {"method": attr},
                        node.lineno,
                        node.col_offset,
                        severity="warning",
                    ))
            self.generic_visit(node)

    MethodCallChecker().visit(tree)
    return diagnostics


def lint(code: str, filename: str = "main.py") -> list[dict]:
    diagnostics = []

    try:
        tree = ast.parse(code, filename)
    except SyntaxError as e:
        # Use shared syntax classifier for better translation
        from syntax_hints import classify_syntax_error
        result = classify_syntax_error(code, e)
        msg_key = result["messageKey"]
        msg_args = result.get("messageArgs", {})

        # Fallback to legacy classification if the classifier returned default
        if msg_key == "linter.E999":
            msg = e.msg
            if "expected ':'" in msg:
                msg_key = "linter.E999Colon"
            elif "was never closed" in msg:
                msg_key = "linter.E999Unclosed"
            elif "unterminated string" in msg:
                msg_key = "linter.E999Unterminated"
            elif "invalid syntax" in msg:
                msg_key = "linter.E999Invalid"
            elif "EOL" in msg or "EOF" in msg:
                msg_key = "linter.E999EOL"
            elif "unmatched" in msg:
                msg_key = "linter.E999Unmatched"
            elif "can't assign to" in msg:
                msg_key = "linter.E999Assign"

        diagnostics.append(
            _make_diagnostic(
                "E999",
                msg_key,
                msg_args,
                e.lineno if e.lineno else 1,
                e.offset if e.offset else 0,
            )
        )
        _annotate_diagnostics(diagnostics, None, None)
        return diagnostics

    diagnostics.extend(_check_indentation(code, tree))
    diagnostics.extend(_check_line_length(code, tree))
    diagnostics.extend(_check_blank_lines(code, tree))

    scope_tracker = ScopeTracker(tree, code)
    scope_tracker.visit(tree)
    diagnostics.extend(scope_tracker.diagnostics)

    diagnostics.extend(_check_binary_op_types(code, tree))
    diagnostics.extend(_check_literal_types(code, tree))
    diagnostics.extend(_check_call_types(code, tree))
    diagnostics.extend(_check_unused_variables(code, tree))
    diagnostics.extend(_check_variable_names(code, tree))
    diagnostics.extend(_check_similar_names(code, tree))
    diagnostics.extend(_check_type_reassignment(code, tree))
    diagnostics.extend(_check_method_not_called(code, tree))

    diagnostics.sort(key=lambda d: (d["row"], d["column"]))

    # ── Post-processing: add category, isBlocking, and suggestions ──
    _annotate_diagnostics(diagnostics, tree, scope_tracker)

    return diagnostics


def _annotate_diagnostics(diagnostics, tree, scope_tracker):
    """Add category, isBlocking, and suggestions fields to each diagnostic."""
    # Determine what error codes map to what categories
    _CATEGORY_MAP = {
        "E101": "grammar",
        "E111": "grammar",
        "E303": "grammar",
        "E999": "grammar",
        "E225": "types",
        "E225Call": "types",
        "F401": "naming",
        "F821": "naming",
        "E501": "grammar",
        "W001": "naming",
        "W002": "naming",
        "W003": "naming",
        "W004": "naming",
        "W005": "types",
        "W_MethodNotCalled": "api-misuse",
    }
    _BLOCKING = {"grammar"}

    # Collect all defined/used names from the scope tracker for suggestions
    _known_names = set()
    if scope_tracker:
        for s in scope_tracker.scopes:
            _known_names.update(s)
        for s in scope_tracker.defined_in_scope:
            _known_names.update(s)
        _known_names.update(scope_tracker.used_names)
        for s in scope_tracker.imports:
            _known_names.update(s)
        # Also include star-imported module names
        _known_names.update(scope_tracker.star_imports)
        # Add known star modules
        _known_names.update(scope_tracker.known_star_modules)

    for diag in diagnostics:
        code = diag.get("code", "")
        category = _CATEGORY_MAP.get(code, "logic")
        diag["category"] = category
        diag["isBlocking"] = category in _BLOCKING

        # Add suggestions for F821 (undefined name) — check homoglyphs first, then Levenshtein
        if code == "F821" or (code == "E225Call" and "name" in diag.get("messageArgs", {})):
            name = diag.get("messageArgs", {}).get("name", "")
            if name and _known_names:
                # A7: an uncaught check_homoglyph exception used to kill annotation
                # for every remaining diagnostic in the batch. Isolate it.
                homo_key, homo_args = None, None
                try:
                    from syntax_hints import check_homoglyph
                    homo_key, homo_args = check_homoglyph(name, _known_names)
                except Exception:
                    homo_key, homo_args = None, None
                if homo_key:
                    diag["messageKey"] = homo_key
                    diag["messageArgs"] = homo_args
                    diag["suggestions"] = [{"token": name, "candidates": [homo_args["fixed"]]}]
                else:
                    try:
                        candidates = _compute_lint_suggestions(name, _known_names)
                    except Exception:
                        candidates = []
                    if candidates:
                        diag["suggestions"] = [{"token": name, "candidates": candidates}]


def _compute_lint_suggestions(token, candidates, max_distance=2):
    """Return Levenshtein-distance-based suggestions (reuses linter's _levenshtein)."""
    if not token or len(token) < 2:
        return []
    results = []
    for c in candidates:
        d = _levenshtein(token.lower(), c.lower())
        if d == 0:
            return []
        if d <= max_distance:
            results.append((d, c))
    # Sort by raw distance — a 1-char typo always ranks above a 2-char typo
    results.sort()
    return [c for _, c in results[:5]]
