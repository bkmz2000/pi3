/**
 * Regression tests for the structured `error` channel (Fix 1d).
 *
 * Verifies that:
 * 1. A `{ type: "error", payload: { message, stack, phase } }` event produces
 *    an `error_card` (not a raw stderr line) with strings only — never
 *    `[object Object]`.
 * 2. The copy-console path extracts a readable string from the card; it does
 *    NOT contain `[object Object]`.
 * 3. The `category` of the generated card is "internal" and the keys are the
 *    correct i18n keys.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({})),
  isExampleSessionId: jest.fn(() => false),
}));

import { useRunnerStore } from "../../src/runner/RunnerProvider";
import { act } from "@testing-library/react";

beforeEach(() => {
  useRunnerStore.setState({
    ready: true,
    running: false,
    output: [],
    inputPrompt: null,
    canvasActive: false,
    workerEpoch: 0,
  });
});

describe("error channel — structured payload", () => {
  it("produces an error_card, not a stderr line", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "error",
        payload: { message: "Init failed: something broke", phase: "init" },
      });
    });

    const output = useRunnerStore.getState().output;
    expect(output).toHaveLength(1);
    expect(output[0].kind).toBe("error_card");
  });

  it("error_card fields are all strings — no [object Object]", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "error",
        payload: { message: "Worker crashed", stack: "Error: Worker crashed\n  at foo.ts:1", phase: "worker" },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;

    expect(typeof card.error.titleKey).toBe("string");
    expect(typeof card.error.messageKey).toBe("string");
    expect(typeof card.error.raw).toBe("string");
    expect(typeof card.error.cleanRaw).toBe("string");
    // The cardinal rule: nothing coerces to [object Object]
    expect(card.error.titleKey).not.toContain("[object Object]");
    expect(card.error.messageKey).not.toContain("[object Object]");
    expect(card.error.raw).not.toContain("[object Object]");
    expect(card.error.cleanRaw).not.toContain("[object Object]");
  });

  it("category is internal and keys are correct", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "error",
        payload: { message: "Pyodide init failed", phase: "init" },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    expect(card.error.category).toBe("internal");
    expect(card.error.titleKey).toBe("friendlyError.internal.title");
    expect(card.error.messageKey).toBe("friendlyError.internal.classifierFailed");
    expect(card.error.isBlocking).toBe(false);
    expect(card.error.suggestions).toEqual([]);
  });

  it("Fix 1e — pre-user-code infrastructure crash (e.g. dedent) renders generic card, not raw traceback", () => {
    // Simulates: runPythonAsync throws before exec(user_code) runs — e.g. the
    // dedent wrapper crashes, or Pyodide's eval_code_async fails to compile the
    // wrapper template. handleExecutionError falls back to the error channel when
    // _last_structured_error is not set.  The payload is always message+stack
    // strings — never a raw Pyodide object — so [object Object] is impossible.
    const syntheticInitCrash = {
      type: "error" as const,
      payload: { message: "dedent: source code string cannot contain null bytes", phase: "exec" as const },
    };
    act(() => {
      useRunnerStore.getState()._onMessage(syntheticInitCrash);
    });

    const output = useRunnerStore.getState().output;
    expect(output).toHaveLength(1);
    expect(output[0].kind).toBe("error_card");
    if (output[0].kind !== "error_card") return;
    // The raw traceback is a string, not [object Object]
    expect(output[0].error.raw).toContain("dedent");
    expect(output[0].error.raw).not.toContain("[object Object]");
    expect(output[0].error.category).toBe("internal");
  });

  it("copy-console path produces a string without [object Object]", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "error",
        payload: { message: "Something broke" },
      });
    });

    const output = useRunnerStore.getState().output;
    // Simulate handleCopyConsole's map logic (from ConsolePanel.tsx)
    const text = output
      .map((l) => {
        if (l.kind === "error_card")
          return `[${l.error.title ?? l.error.titleKey}] ${l.error.message ?? l.error.messageKey ?? ""}`;
        return (l as { text: string }).text;
      })
      .join("\n");

    expect(text).not.toContain("[object Object]");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});
