/**
 * Runs validate_pi3testing.py in the Jest pipeline using python3.
 * Tests the pi3.testing Python module in isolation (no Pyodide needed).
 */
import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(__dirname, "validate_pi3testing.py");

test("pi3/testing.py: all determinism/primitive/composition/JSON assertions pass", () => {
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
    throw new Error(`validate_pi3testing.py failed:\n${combined}`);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
