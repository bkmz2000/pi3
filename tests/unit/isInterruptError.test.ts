/**
 * Regression tests for interrupt detection in the runner's `run` catch block.
 *
 * The bug: pressing Stop mid-run can reject with a PythonError whose message is
 * empty (Pyodide formats the traceback in Python, and the still-armed interrupt
 * byte interrupts that formatting too). `String(err)` is then just
 * "PythonError", the old substring check missed it, and the student got the
 * `friendlyError.internal.classifierFailed` card — "The error reporter crashed
 * while analyzing your code" — plus a bogus /api/log/client-error entry.
 */

import { isInterruptError } from "../../src/runner/isInterruptError";

/** Stand-in for pyodide's PythonError: `type` set from the exception class. */
function pythonError(type: string, message: string): Error & { type: string } {
  return Object.assign(new Error(message), { type });
}

describe("isInterruptError", () => {
  const cases: [label: string, input: unknown, expected: boolean][] = [
    ["PythonError with empty message (the bug)", pythonError("KeyboardInterrupt", ""), true],
    ["plain object with KeyboardInterrupt type", { type: "KeyboardInterrupt", message: "" }, true],
    ["PythonError with formatted traceback", pythonError("KeyboardInterrupt", "Traceback (most recent call last):\n  File \"main.py\", line 3\nKeyboardInterrupt"), true],
    ["Error carrying the name in its message", new Error("Traceback …\nKeyboardInterrupt"), true],
    ["bare string", "KeyboardInterrupt", true],
    ["real Python error", pythonError("ZeroDivisionError", "division by zero"), false],
    ["real Python error, plain object", { type: "ZeroDivisionError", message: "division by zero" }, false],
    ["infra Error", new Error("PythonError"), false],
    ["empty object", {}, false],
    ["null", null, false],
    ["undefined", undefined, false],
    ["number", 42, false],
    ["unrelated string", "worker terminated", false],
  ];

  // Title is the label only — printing an Error input dumps its whole stack.
  it.each(cases)("%s", (_label, input, expected) => {
    expect(isInterruptError(input)).toBe(expected);
  });

  it("catches the empty-message case that String(err) cannot", () => {
    const err = pythonError("KeyboardInterrupt", "");
    // With no message, String(err) is just the class name ("PythonError" for
    // the real pyodide class) — nothing for a substring check to match on.
    expect(String(err)).not.toContain("KeyboardInterrupt");
    expect(isInterruptError(err)).toBe(true);
  });

  it("does not swallow a genuine error raised while stopping", () => {
    expect(isInterruptError(pythonError("RuntimeError", "dictionary changed size during iteration"))).toBe(false);
  });
});
