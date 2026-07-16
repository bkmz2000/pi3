/**
 * Runs validate_turtle.py as a single Jest test. The Python script imports
 * the turtle shim + graphics via PYTHONPATH and asserts draw-command output
 * matches turtle semantics. No Pyodide/browser needed.
 */

import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(__dirname, "validate_turtle.py");

test("validate_turtle.py: all turtle shim assertions pass", () => {
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
    throw new Error(`validate_turtle.py failed:\n${combined}`);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
