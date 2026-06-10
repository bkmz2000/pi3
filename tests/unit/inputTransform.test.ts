/**
 * Wires validate_input_transform.py into the Jest pipeline.
 * Runs the Python script directly via python3 so no Pyodide is needed.
 */

import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(__dirname, "validate_input_transform.py");

test("input_transform.py: all AST rewrite assertions pass", () => {
  let output = "";
  try {
    output = execSync(`python3 "${SCRIPT}"`, {
      cwd: ROOT,
      env: { ...process.env, PYTHONPATH: resolve(ROOT, "src/assets/python") },
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const combined = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    throw new Error(`validate_input_transform.py failed:\n${combined}`);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
