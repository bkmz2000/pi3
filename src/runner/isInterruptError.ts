// Pressing Stop (and the compete time-limit) arms Pyodide's interrupt buffer,
// so the run rejects with a `KeyboardInterrupt` PythonError. That is a clean
// stop, not a crash — but detecting it by message text alone misses.
//
// Pyodide builds `PythonError.message` by formatting the traceback *in Python*,
// and the interrupt byte is often still armed while that runs: the formatting
// itself gets interrupted and the message comes back empty, so `String(err)` is
// just "PythonError". `.type` is passed to the PythonError constructor straight
// from the exception class on the C side and survives that, which makes it the
// reliable signal. Check it first; keep the message check for well-formed
// tracebacks and for errors that never went through Pyodide.

/** True when `err` is the KeyboardInterrupt raised by a Stop / time-limit interrupt. */
export function isInterruptError(err: unknown): boolean {
  if (typeof err === "string") return err.includes("KeyboardInterrupt");
  if (!err || typeof err !== "object") return false;

  const { type, message } = err as { type?: unknown; message?: unknown };
  if (type === "KeyboardInterrupt") return true;
  return typeof message === "string" && message.includes("KeyboardInterrupt");
}
