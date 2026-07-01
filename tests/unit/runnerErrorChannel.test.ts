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

describe("syntax error regression — missing colon routes to grammar, not internal", () => {
  // Regression for: `if cond\nprint hello` was producing an `internal/classifierFailed`
  // card. Root cause: runScript embeds user code directly in the asyncCode Python string;
  // a SyntaxError causes Python to fail at compile time before the try/except block runs,
  // so classify_error was never called. Fixed by pre-compiling with compile() first.
  // The worker now posts a runtime_error with category="grammar"; these tests pin that shape.

  it("runtime_error with grammar/missingColon arrives as a grammar card — not downgraded to internal", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "runtime_error",
        error: {
          category: "grammar",
          titleKey: "friendlyError.grammar.title",
          messageKey: "friendlyError.grammar.missingColon",
          messageArgs: {},
          raw: "SyntaxError: expected ':' (<string>, line 1)",
          cleanRaw: "SyntaxError: expected ':' (<string>, line 1)",
          suggestions: [],
          isBlocking: true,
        },
      });
    });

    const output = useRunnerStore.getState().output;
    expect(output).toHaveLength(1);
    const card = output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    expect(card.error.category).toBe("grammar");
    expect(card.error.messageKey).toBe("friendlyError.grammar.missingColon");
    expect(card.error.isBlocking).toBe(true);
    // If the bug regresses, the worker posts `type:"error"` instead, and RunnerProvider
    // hardcodes this key. Asserting it's absent locks in the grammar classification.
    expect(card.error.messageKey).not.toBe("friendlyError.internal.classifierFailed");
  });

  it("grammar error card has isBlocking true (SyntaxError blocks execution)", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "runtime_error",
        error: {
          category: "grammar",
          titleKey: "friendlyError.grammar.title",
          messageKey: "friendlyError.grammar.syntaxError",
          messageArgs: {},
          raw: "SyntaxError: invalid syntax",
          suggestions: [],
          isBlocking: true,
        },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    expect(card.error.isBlocking).toBe(true);
    expect(card.error.category).toBe("grammar");
  });
});

describe("naming error — undefined key routing by candidate count", () => {
  // Regression for: naming.undefined always embedded {{candidate}} but messageArgs
  // only included it when suggestions existed. With no suggestions (e.g. an arbitrary
  // name like 'dfkjsfj'), {{candidate}} rendered as a raw placeholder.
  // Fixed by splitting into three keys: undefined / undefinedWithCandidate / undefinedWithCandidates.

  it("no candidates → naming.undefined (no {{candidate}} in args)", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "runtime_error",
        error: {
          category: "naming",
          titleKey: "friendlyError.naming.title",
          messageKey: "friendlyError.naming.undefined",
          messageArgs: { name: "dfkjsfj" },
          raw: "NameError: name 'dfkjsfj' is not defined",
          suggestions: [],
          isBlocking: false,
        },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    expect(card.error.messageKey).toBe("friendlyError.naming.undefined");
    expect(card.error.messageArgs).not.toHaveProperty("candidate");
    expect(card.error.messageArgs).not.toHaveProperty("candidates");
  });

  it("one candidate → naming.undefinedWithCandidate with candidate in args", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "runtime_error",
        error: {
          category: "naming",
          titleKey: "friendlyError.naming.title",
          messageKey: "friendlyError.naming.undefinedWithCandidate",
          messageArgs: { name: "backgrond", candidate: "background" },
          raw: "NameError: name 'backgrond' is not defined",
          suggestions: [{ token: "backgrond", candidates: ["background"] }],
          isBlocking: false,
        },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    expect(card.error.messageKey).toBe("friendlyError.naming.undefinedWithCandidate");
    expect(card.error.messageArgs).toHaveProperty("candidate", "background");
    expect(card.error.messageArgs).not.toHaveProperty("candidates");
  });

  it("multiple candidates → naming.undefinedWithCandidates with candidates in args", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "runtime_error",
        error: {
          category: "naming",
          titleKey: "friendlyError.naming.title",
          messageKey: "friendlyError.naming.undefinedWithCandidates",
          messageArgs: { name: "crcle", candidates: "circle, Circle" },
          raw: "NameError: name 'crcle' is not defined",
          suggestions: [{ token: "crcle", candidates: ["circle", "Circle"] }],
          isBlocking: false,
        },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    expect(card.error.messageKey).toBe("friendlyError.naming.undefinedWithCandidates");
    expect(card.error.messageArgs).toHaveProperty("candidates", "circle, Circle");
    expect(card.error.messageArgs).not.toHaveProperty("candidate");
  });
});

describe("naming error — no suggestions falls back to raw Python error", () => {
  // Regression for: `if prtn:` was producing "Имя 'prtn' не распознано. Ты имеешь в виду один из: print, run?"
  // because KNOWN_SYMBOLS contains "print" and "run" at Levenshtein distance 2 from "prtn".
  // Fix: short tokens (≤5 chars) use max_distance=1, and naming errors with no suggestions
  // show the raw Python error (messageKey=null, message="{ExcType}: {exc}") instead of a
  // friendly wrapper.

  it("NameError with no suggestions → messageKey falsy and message is raw Python error", () => {
    act(() => {
      useRunnerStore.getState()._onMessage({
        type: "runtime_error",
        error: {
          category: "naming",
          titleKey: "friendlyError.naming.title",
          messageKey: undefined,
          message: "NameError: name 'prtn' is not defined",
          messageArgs: {},
          raw: "Traceback (most recent call last):\n  File \"main.py\", line 1\nNameError: name 'prtn' is not defined",
          suggestions: [],
          isBlocking: false,
        },
      });
    });

    const card = useRunnerStore.getState().output[0];
    expect(card.kind).toBe("error_card");
    if (card.kind !== "error_card") return;
    // No friendly message key — ErrorCard falls back to error.message
    expect(card.error.messageKey).toBeFalsy();
    expect(card.error.message).toBe("NameError: name 'prtn' is not defined");
    // No suggestion chips should appear
    expect(card.error.suggestions).toHaveLength(0);
    // Must NOT carry any candidate interpolation args
    expect(card.error.messageArgs).not.toHaveProperty("candidate");
    expect(card.error.messageArgs).not.toHaveProperty("candidates");
  });
});
