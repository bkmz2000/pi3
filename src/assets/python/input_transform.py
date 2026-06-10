"""
AST-based rewriter: replace synchronous input() calls with awaited _async_input().

  input("name")          →  (await _async_input("name"))
  input("x").strip()     →  (await _async_input("x")).strip()
  s = "input(fake)"      →  unchanged  (string literal)
  # input("y")           →  unchanged  (comment)

Returns the source unchanged if a SyntaxError is raised so the runner can
surface the error to the student with the original line numbers intact.
"""
import ast


def _make_await(call_node: ast.Call) -> ast.Await:
    new_func = ast.copy_location(
        ast.Name(id="_async_input", ctx=ast.Load()),
        call_node.func,
    )
    new_call = ast.copy_location(
        ast.Call(func=new_func, args=call_node.args, keywords=call_node.keywords),
        call_node,
    )
    return ast.copy_location(ast.Await(value=new_call), call_node)


class _InputRewriter(ast.NodeTransformer):
    def visit_Call(self, node: ast.Call) -> ast.AST:  # noqa: N802
        self.generic_visit(node)
        if (
            isinstance(node.func, ast.Name)
            and node.func.id == "input"
        ):
            return _make_await(node)
        return node


def transform(source: str) -> str:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    new_tree = _InputRewriter().visit(tree)
    ast.fix_missing_locations(new_tree)
    return ast.unparse(new_tree)
