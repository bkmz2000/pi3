"""
Source-preserving rewriter: replace input()/watch()/debug.<kind>() calls with
their instrumented equivalents via direct text splicing, not ast.unparse of
the whole tree.

  input("name")          →  (await _async_input("name"))
  input("x").strip()     →  (await _async_input("x")).strip()
  watch(score)            →  watch('score', score)
  debug.array(a, red=x)   →  debug.array(a, red=x, _labels={'red': 'x'})
  s = "input(fake)"       →  unchanged  (string literal)
  # input("y")            →  unchanged  (comment)

Each match is replaced in place at its exact source span, so every line
number outside the matched calls — and every line inside a single-line
call — is left byte-identical to what the student wrote. This matters
because the plain-script runner compiles the transformed source with the
student's real filename; ast.unparse()'ing the whole tree here would
reflow blank lines and shift every traceback location, exactly the
problem watch_transform.py's docstring documents for the graphics path.

Known limitation: a call nested inside another call's arguments on the
same matched form (e.g. input(input())) only has its outer occurrence
rewritten — pathological and not expected in student code.

Returns the source unchanged if a SyntaxError is raised so the runner can
surface the error to the student with the original line numbers intact.
"""
import ast

_COLORS = frozenset({"red", "green", "blue", "yellow", "cyan", "gray"})
_V1_KINDS = frozenset({"array", "grid", "text", "stack", "queue", "set"})


class _EditCollector(ast.NodeVisitor):
    def __init__(self):
        self.edits: list[tuple[int, int, int, int, str]] = []

    def _record(self, node: ast.AST, text: str) -> None:
        self.edits.append((node.lineno, node.col_offset, node.end_lineno, node.end_col_offset, text))

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802
        self.generic_visit(node)

        if isinstance(node.func, ast.Name) and node.func.id == "input":
            new_call = ast.Call(
                func=ast.Name(id="_async_input", ctx=ast.Load()),
                args=node.args,
                keywords=node.keywords,
            )
            self._record(node, f"(await {ast.unparse(new_call)})")
            return

        if (
            isinstance(node.func, ast.Name)
            and node.func.id == "watch"
            and len(node.args) == 1
            and not node.keywords
            and not any(isinstance(a, ast.Starred) for a in node.args)
        ):
            label = ast.unparse(node.args[0])
            new_call = ast.Call(
                func=node.func,
                args=[ast.Constant(value=label), node.args[0]],
                keywords=[],
            )
            self._record(node, ast.unparse(new_call))
            return

        if (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            # Alias-agnostic: matches `debug.array(...)` and the more common
            # `import pi3.debug as d; d.array(...)` convention alike — gated
            # by the color-kwarg check below to avoid false positives on
            # unrelated `.array`/`.grid`/etc. calls.
            and node.func.attr in _V1_KINDS
            and not any(kw.arg == "_labels" for kw in node.keywords)
        ):
            labels = {
                kw.arg: kw.value.id
                for kw in node.keywords
                if kw.arg in _COLORS and isinstance(kw.value, ast.Name)
            }
            if not labels:
                return
            dict_node = ast.Dict(
                keys=[ast.Constant(value=k) for k in labels],
                values=[ast.Constant(value=v) for v in labels.values()],
            )
            labels_kw = ast.keyword(arg="_labels", value=dict_node)
            new_call = ast.Call(func=node.func, args=node.args, keywords=node.keywords + [labels_kw])
            self._record(node, ast.unparse(new_call))


def _apply_edits(source: str, edits: list[tuple[int, int, int, int, str]]) -> str:
    if not edits:
        return source
    lines = source.splitlines(keepends=True)
    line_start = [0]
    for line in lines:
        line_start.append(line_start[-1] + len(line))

    def abs_pos(lineno: int, col: int) -> int:
        return line_start[lineno - 1] + col

    # Apply from the end of the file backwards so earlier offsets stay valid.
    ordered = sorted(edits, key=lambda e: (e[0], e[1]), reverse=True)
    for start_line, start_col, end_line, end_col, text in ordered:
        start = abs_pos(start_line, start_col)
        end = abs_pos(end_line, end_col)
        source = source[:start] + text + source[end:]
    return source


def transform(source: str) -> str:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    collector = _EditCollector()
    collector.visit(tree)
    return _apply_edits(source, collector.edits)
