/**
 * Tests the debug_transform.py AST rewriter.
 */
import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const PYTHONPATH = resolve(ROOT, "src/assets/python");

function transform(source: string): string {
  const escaped = JSON.stringify(source);
  return execSync(
    `python3 -c "import debug_transform; print(debug_transform.transform(${escaped}), end='')"`,
    { cwd: ROOT, env: { ...process.env, PYTHONPATH }, encoding: "utf8" },
  );
}

test("debug.array with bare Name → injects _labels", () => {
  const out = transform("debug.array(arr, red=left)");
  expect(out).toContain("_labels");
  expect(out).toContain("'red'");
  expect(out).toContain("'left'");
  expect(out).not.toContain("left, left");  // value evaluated exactly once
});

test("debug.array with non-Name value → no _labels injected", () => {
  const out = transform("debug.array(arr, red=arr[0])");
  expect(out).not.toContain("_labels");
});

test("already has _labels → unchanged", () => {
  const src = "debug.array(arr, red=x, _labels={'red': 'x'})";
  const out = transform(src);
  expect(out.match(/_labels/g)?.length).toBe(1);  // no duplicate
});

test("obj.debug.array → not transformed", () => {
  const out = transform("obj.debug.array(arr, red=x)");
  expect(out).not.toContain("_labels");
});

test("non-debug call → unchanged", () => {
  const src = "foo(arr, red=x)";
  const out = transform(src);
  expect(out).not.toContain("_labels");
});

test("SyntaxError → source returned unchanged", () => {
  const src = "def (broken";
  const out = transform(src);
  expect(out).toBe(src);
});

test("single-eval: counter called exactly once", () => {
  // _bump() side-effects a counter; after transform it must be called once
  const src = `
_cnt = 0
def _bump():
    global _cnt
    _cnt += 1
    return _cnt
debug.array([], red=_bump())
`.trim();
  // Not a bare Name → no label injection, _bump() stays as-is (called once)
  const out = transform(src);
  expect(out).not.toContain("_labels");
});

test("multiple color kwargs → all get labels", () => {
  const out = transform("debug.array(arr, red=lo, green=hi)");
  expect(out).toContain("'red': 'lo'");
  expect(out).toContain("'green': 'hi'");
});
