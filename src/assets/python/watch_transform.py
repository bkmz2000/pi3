"""
AST-based rewriter: auto-label single-arg watch() calls with their source text.

  watch(score)        →  watch('score', score)
  watch(player.x)     →  watch('player.x', player.x)
  watch("lbl", v)     →  unchanged  (2-arg form is already explicit)
  obj.watch(x)        →  unchanged  (not a bare Name call)

The expression is evaluated exactly once — the injected label is a string
literal of the source text, never a second evaluation.

Returns source unchanged on SyntaxError so callers degrade gracefully.
"""
import ast


class _WatchLabeler(ast.NodeTransformer):
    def visit_Call(self, node: ast.Call) -> ast.AST:  # noqa: N802
        self.generic_visit(node)
        if (
            isinstance(node.func, ast.Name)
            and node.func.id == "watch"
            and len(node.args) == 1
            and not node.keywords
            and not any(isinstance(a, ast.Starred) for a in node.args)
        ):
            label = ast.unparse(node.args[0])
            label_node = ast.copy_location(ast.Constant(value=label), node)
            node.args = [label_node, node.args[0]]
        return node


def transform(source: str) -> str:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    new_tree = _WatchLabeler().visit(tree)
    ast.fix_missing_locations(new_tree)
    return ast.unparse(new_tree)
