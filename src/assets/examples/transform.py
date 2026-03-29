import ast
import copy
import linecache
from collections import defaultdict

# Load shim source once — written to FS by worker.ts before transform() is called
_SHIM_P5_SOURCE = open("/_shim_p5.py").read()

_ASYNC_PREAMBLE = ast.parse("""
import asyncio
import console

async def input(prompt=''):
    return await console.ainput(prompt)
""")

_STATE_PREAMBLE = ast.parse("""
from types import SimpleNamespace
State = SimpleNamespace
""")

_SETUP_PREAMBLE = ast.parse("""
def setup(f):
    # Passthrough decorator for Actor init methods. Removed by transformer.
    return f
""")

_P5_ENTRYPOINTS = {"setup", "draw"}
_P5_OPTIONAL = {"preload", "mousePressed", "mouseReleased", "keyPressed", "keyReleased"}


# --- Detection ---


def _is_p5_sketch(tree: ast.Module) -> bool:
    defined = {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    return bool(defined & _P5_ENTRYPOINTS)


def _has_input_call(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "input"
        ):
            return True
    return False


def _has_setup_decorator(tree: ast.Module) -> bool:
    """Check if any function has a @setup decorator."""
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for deco in node.decorator_list:
                if isinstance(deco, ast.Name) and deco.id == "setup":
                    return True
                if (
                    isinstance(deco, ast.Call)
                    and isinstance(deco.func, ast.Name)
                    and deco.func.id == "setup"
                ):
                    return True
                # Handle @g.setup
                if isinstance(deco, ast.Attribute) and deco.attr == "setup":
                    return True
                if (
                    isinstance(deco, ast.Call)
                    and isinstance(deco.func, ast.Attribute)
                    and deco.func.attr == "setup"
                ):
                    return True
    return False


# --- AST helpers ---


def _clone(node: ast.AST, location: ast.AST) -> ast.AST:
    return ast.fix_missing_locations(ast.copy_location(copy.deepcopy(node), location))


def _wrap_in_function(name: str, body: list, is_async: bool, anchor: ast.AST):
    cls = ast.AsyncFunctionDef if is_async else ast.FunctionDef
    node = cls(
        name=name,
        args=ast.arguments(
            posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]
        ),
        body=body,
        decorator_list=[],
        returns=None,
        type_comment=None,
    )
    return ast.fix_missing_locations(ast.copy_location(node, anchor))


# --- Transformers ---


class _InputRewriter(ast.NodeTransformer):
    """
    Rewrites input(...) -> await console.ainput(...)
    Must run before _build_plain so the async wrapper is warranted.
    """

    def visit_Call(self, node: ast.Call):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == "input":
            return ast.fix_missing_locations(
                ast.copy_location(
                    ast.Await(
                        value=ast.Call(
                            func=ast.Attribute(
                                value=ast.Name(id="console", ctx=ast.Load()),
                                attr="ainput",
                                ctx=ast.Load(),
                            ),
                            args=node.args,
                            keywords=node.keywords,
                        )
                    ),
                    node,
                )
            )
        return node


def _gather_state_definitions(tree: ast.Module) -> dict:
    """
    Returns a dictionary mapping state variable names to their attribute keys.
    Example: {"state": {"x", "y", "angle"}, "ship": {"angle", "x", "y"}}
    """
    state_defs = {}
    for stmt in tree.body:
        if not isinstance(stmt, ast.Assign):
            continue
        for target in stmt.targets:
            if not isinstance(target, ast.Name):
                continue
            var_name = target.id
            value = stmt.value

            # Check if this is a State/SimpleNamespace assignment
            is_state = False
            keys = set()

            if (
                isinstance(value, ast.Call)
                and isinstance(value.func, ast.Name)
                and value.func.id in {"SimpleNamespace", "State"}
            ):
                is_state = True
                keys.update(kw.arg for kw in value.keywords if kw.arg)
            elif isinstance(value, ast.Dict):
                # Check if it's a dict being passed to State() somewhere else
                # For now, we'll only handle direct State() calls
                pass

            if is_state:
                state_defs[var_name] = keys

    return state_defs


class _StateRewriter(ast.NodeTransformer):
    """Rewrites bare state key names to state_variable.key inside @use()-decorated functions."""

    def __init__(self, state_var_name: str, keys: set[str]):
        self.state_var_name = state_var_name
        self.keys = keys

    def visit_Name(self, node: ast.Name):
        if node.id in self.keys and node.id != self.state_var_name:
            return ast.copy_location(
                ast.Attribute(
                    ast.Name(id=self.state_var_name, ctx=ast.Load()),
                    node.id,
                    node.ctx,
                ),
                node,
            )
        return node


class _ReactiveTransformer(ast.NodeTransformer):
    def __init__(self, state_defs: dict):
        # state_defs: {"state_var_name": {"key1", "key2", ...}}
        self.state_defs = state_defs
        # Track which functions use which state variables
        self.function_states = defaultdict(set)

    def _get_use_state_var(self, deco: ast.expr) -> str | None:
        """Returns the state variable name if this is a @use(state_var) decorator."""
        if (
            isinstance(deco, ast.Call)
            and isinstance(deco.func, ast.Name)
            and deco.func.id == "use"
            and len(deco.args) == 1
            and isinstance(deco.args[0], ast.Name)
        ):
            state_var = deco.args[0].id
            if state_var in self.state_defs:
                return state_var
        return None

    def _is_setup_decorator(self, deco: ast.expr) -> bool:
        """Returns True if this is a @setup or @g.setup decorator."""
        if isinstance(deco, ast.Name) and deco.id == "setup":
            return True
        if (
            isinstance(deco, ast.Call)
            and isinstance(deco.func, ast.Name)
            and deco.func.id == "setup"
        ):
            return True
        # Handle @g.setup (attribute access)
        if isinstance(deco, ast.Attribute) and deco.attr == "setup":
            return True
        if (
            isinstance(deco, ast.Call)
            and isinstance(deco.func, ast.Attribute)
            and deco.func.attr == "setup"
        ):
            return True
        return False

    def _process(self, node):
        # Collect all state variables used by this function
        used_states = set()
        for deco in node.decorator_list:
            state_var = self._get_use_state_var(deco)
            if state_var:
                used_states.add(state_var)

        # Remove @use and @setup decorators
        node.decorator_list = [
            d
            for d in node.decorator_list
            if self._get_use_state_var(d) is None and not self._is_setup_decorator(d)
        ]

        self.generic_visit(node)

        # Apply state rewriting for each used state variable
        for state_var in used_states:
            keys = self.state_defs[state_var]
            _StateRewriter(state_var, keys).visit(node)

        return node

    visit_FunctionDef = _process
    visit_AsyncFunctionDef = _process


def _build_plain(tree: ast.Module, needs_async: bool) -> ast.Module:
    anchor = tree.body[0] if tree.body else tree
    preamble = []

    if needs_async:
        preamble = [_clone(stmt, anchor) for stmt in _ASYNC_PREAMBLE.body]
        main = _wrap_in_function("MAIN", tree.body, is_async=True, anchor=anchor)
        call = ast.fix_missing_locations(
            ast.copy_location(
                ast.Expr(
                    ast.Call(
                        func=ast.Attribute(
                            value=ast.Call(
                                func=ast.Attribute(
                                    value=ast.Name(id="asyncio", ctx=ast.Load()),
                                    attr="get_event_loop",
                                    ctx=ast.Load(),
                                ),
                                args=[],
                                keywords=[],
                            ),
                            attr="run_until_complete",
                            ctx=ast.Load(),
                        ),
                        args=[
                            ast.Call(
                                func=ast.Name(id="MAIN", ctx=ast.Load()),
                                args=[],
                                keywords=[],
                            )
                        ],
                        keywords=[],
                    )
                ),
                anchor,
            )
        )
    else:
        main = _wrap_in_function("MAIN", tree.body, is_async=False, anchor=anchor)
        call = ast.fix_missing_locations(
            ast.copy_location(
                ast.Expr(
                    ast.Call(
                        func=ast.Name(id="MAIN", ctx=ast.Load()),
                        args=[],
                        keywords=[],
                    )
                ),
                anchor,
            )
        )

    tree.body = [*preamble, main, call]
    return ast.fix_missing_locations(tree)


def _build_p5(tree: ast.Module) -> ast.Module:
    anchor = tree.body[0] if tree.body else tree

    run_sketch_call = ast.fix_missing_locations(
        ast.copy_location(
            ast.Expr(
                ast.Call(
                    func=ast.Name(id="_run_sketch", ctx=ast.Load()),
                    args=[
                        ast.Call(
                            func=ast.Name(id="globals", ctx=ast.Load()),
                            args=[],
                            keywords=[],
                        )
                    ],
                    keywords=[],
                )
            ),
            anchor,
        )
    )

    tree.body = [*tree.body, run_sketch_call]
    return ast.fix_missing_locations(tree)


# --- Public API ---


def transform(code: str, filename: str = "main.py") -> dict:
    lines = code.splitlines(True)
    linecache.cache[filename] = (len(lines), None, lines, filename)

    tree = ast.parse(code, filename)

    # 1. State rewriting — runs first, independent of sketch type
    state_defs = _gather_state_definitions(tree)
    has_setup = _has_setup_decorator(tree)

    if state_defs or has_setup:
        tree = _ReactiveTransformer(state_defs).visit(tree)
        ast.fix_missing_locations(tree)
        # Inject preambles
        anchor = tree.body[0] if tree.body else tree
        preamble = []
        if state_defs:
            preamble.extend(
                [
                    ast.fix_missing_locations(
                        ast.copy_location(copy.deepcopy(stmt), anchor)
                    )
                    for stmt in _STATE_PREAMBLE.body
                ]
            )
        if has_setup:
            preamble.extend(
                [
                    ast.fix_missing_locations(
                        ast.copy_location(copy.deepcopy(stmt), anchor)
                    )
                    for stmt in _SETUP_PREAMBLE.body
                ]
            )
        tree.body = [*preamble, *tree.body]
        ast.fix_missing_locations(tree)

    # 2. Detect sketch type on original tree, before any rewriting
    is_p5 = _is_p5_sketch(tree)
    needs_async = not is_p5 and _has_input_call(tree)

    # 3. Rewrite input() call sites before wrapping in async function
    if needs_async:
        tree = _InputRewriter().visit(tree)
        ast.fix_missing_locations(tree)

    # 4. Wrap in appropriate entrypoint
    if is_p5:
        tree = _build_p5(tree)
    else:
        tree = _build_plain(tree, needs_async)

    return {
        "code": ast.unparse(tree),
        "shim": _SHIM_P5_SOURCE if is_p5 else None,
        "metadata": {
            "is_p5": is_p5,
            "needs_async": needs_async,
            "uses_canvas": is_p5,
        },
    }
