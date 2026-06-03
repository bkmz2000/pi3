/**
 * Wires validate_graphics.py into the Jest pipeline.
 *
 * The Python tests exercise the graphics module runtime directly (no browser,
 * no Pyodide) using PYTHONPATH to import src/assets/python/pi3.  Jest
 * runs this as a single test so CI fails loudly when any Python assertion
 * breaks, with the full PASS/FAIL output captured as the failure message.
 */

import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(__dirname, "validate_graphics.py");

test("validate_graphics.py: all Python runtime assertions pass", () => {
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
    throw new Error(`validate_graphics.py failed:\n${combined}`);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
