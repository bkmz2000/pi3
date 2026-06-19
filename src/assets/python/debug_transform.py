"""
AST-based rewriter: inject _labels kwarg for debug.<kind>() color kwargs
that are bare Name nodes.

  debug.array(arr, red=left)        → debug.array(arr, red=left, _labels={'red': 'left'})
  debug.array(arr, red=arr[0])      → unchanged (not a bare Name)
  debug.array(arr, _labels={...})   → unchanged (already present)
  obj.debug.array(arr, red=x)       → unchanged (not bare 'debug' Name)

The value expression is evaluated exactly once — _labels contains string
constants of source text, never second evaluations.

Returns source unchanged on SyntaxError.
"""
import ast

_V1_KINDS = frozenset({"array", "grid", "text", "stack", "queue", "set"})
_COLORS = frozenset({"red", "green", "blue", "yellow", "cyan", "gray"})


class _DebugLabeler(ast.NodeTransformer):
    def visit_Call(self, node: ast.Call) -> ast.AST:  # noqa: N802
        self.generic_visit(node)
        if not (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "debug"
            and node.func.attr in _V1_KINDS
        ):
            return node
        if any(kw.arg == "_labels" for kw in node.keywords):
            return node
        labels = {
            kw.arg: kw.value.id
            for kw in node.keywords
            if kw.arg in _COLORS and isinstance(kw.value, ast.Name)
        }
        if not labels:
            return node
        dict_node = ast.copy_location(
            ast.Dict(
                keys=[ast.Constant(value=k) for k in labels],
                values=[ast.Constant(value=v) for v in labels.values()],
            ),
            node,
        )
        labels_kw = ast.copy_location(ast.keyword(arg="_labels", value=dict_node), node)
        node.keywords = node.keywords + [labels_kw]
        return node


def transform(source: str) -> str:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    new_tree = _DebugLabeler().visit(tree)
    ast.fix_missing_locations(new_tree)
    return ast.unparse(new_tree)
