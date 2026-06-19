/**
 * Runs validate_debug.py in the Jest pipeline using python3.
 * Tests the pi3.debug Python module in isolation (no Pyodide needed).
 */
import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(__dirname, "validate_debug.py");

test("pi3/debug.py: all capture/slot/normalization assertions pass", () => {
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
    throw new Error(`validate_debug.py failed:\n${combined}`);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
