/**
 * Runner-layer coverage for the live-code canvas-persistence change and the
 * remaining WorkerEvent handler branches.
 *
 * The star is the `result.keepCanvas` branch introduced by the live-code
 * session feature: when a run ends but the session should keep showing the
 * last frame (a peer/teacher is still driving the canvas), the `result`
 * event carries `keepCanvas: true` and canvasActive must survive. The
 * pre-existing behavior (keepCanvas absent/false → canvas clears) must be
 * preserved.
 *
 * Follows the documented pattern (CLAUDE.md): drive useRunnerStore by posting
 * synthetic WorkerEvents to `_onMessage` — no real worker or Pyodide load.
 */

import type { RuntimeError } from "../../src/runner/WorkerInterface";

const mockChangeFile = jest.fn();

jest.mock("../../src/state/IdeState", () => ({
  useIde: { getState: () => ({ showHitboxes: false, showActorInfo: false }) },
  useEditor: {
    getState: () => ({
      currentProjectId: "proj-1",
      currentFile: "main.py",
      project: { files: { "main.py": "score = 1\nprint(score)" } },
      changeFile: mockChangeFile,
    }),
  },
  isExampleSessionId: () => false,
}));

import { useRunnerStore } from "../../src/runner/RunnerProvider";

beforeEach(() => {
  useRunnerStore.getState().clear();
  mockChangeFile.mockClear();
  // The error/runtime_error handlers fire-and-forget a log POST; give them a
  // resolvable fetch so the `.catch` chain has something to attach to.
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
});

// ── result.keepCanvas — the live-code canvas-persistence branch ────────────────

describe("result — keepCanvas (live-code session)", () => {
  it("keepCanvas: true preserves canvasActive when the run ends", () => {
    // Simulate a running graphics program with an active canvas.
    useRunnerStore.getState()._onMessage({ type: "start", canvasActive: true });
    expect(useRunnerStore.getState().canvasActive).toBe(true);

    useRunnerStore.getState()._onMessage({ type: "result", keepCanvas: true });

    const s = useRunnerStore.getState();
    expect(s.running).toBe(false);
    expect(s.inputPrompt).toBeNull();
    expect(s.canvasActive).toBe(true); // last frame stays up for the session
  });

  it("keepCanvas: false clears the canvas (default run-end behavior)", () => {
    useRunnerStore.getState()._onMessage({ type: "start", canvasActive: true });

    useRunnerStore.getState()._onMessage({ type: "result", keepCanvas: false });

    const s = useRunnerStore.getState();
    expect(s.running).toBe(false);
    expect(s.canvasActive).toBe(false);
  });

  it("keepCanvas absent clears the canvas (legacy result event)", () => {
    useRunnerStore.getState()._onMessage({ type: "start", canvasActive: true });

    useRunnerStore.getState()._onMessage({ type: "result" });

    expect(useRunnerStore.getState().canvasActive).toBe(false);
  });

  it("keepCanvas: true with no prior canvas leaves canvasActive false", () => {
    // canvasActive starts false (no start event) — keepCanvas must not fabricate one.
    useRunnerStore.getState()._onMessage({ type: "result", keepCanvas: true });
    expect(useRunnerStore.getState().canvasActive).toBe(false);
  });
});

// ── lifecycle / UI-state handler branches ──────────────────────────────────────

describe("handler — lifecycle events", () => {
  it("ready sets ready flag", () => {
    useRunnerStore.setState({ ready: false });
    useRunnerStore.getState()._onMessage({ type: "ready" });
    expect(useRunnerStore.getState().ready).toBe(true);
  });

  it("start sets running + canvasActive from payload", () => {
    useRunnerStore.getState()._onMessage({ type: "start", canvasActive: false });
    const s = useRunnerStore.getState();
    expect(s.running).toBe(true);
    expect(s.canvasActive).toBe(false);
  });

  it("canvas_resize records native dimensions at scale 1", () => {
    useRunnerStore.getState()._onMessage({ type: "canvas_resize", width: 640, height: 480 });
    const s = useRunnerStore.getState();
    expect(s.canvasWidth).toBe(640);
    expect(s.canvasHeight).toBe(480);
    expect(s.canvasScale).toBe(1);
  });

  it("input_request sets the inputPrompt", () => {
    useRunnerStore.getState()._onMessage({ type: "input_request", prompt: "Name? " });
    expect(useRunnerStore.getState().inputPrompt).toBe("Name? ");
  });

  it("interrupt_ack is a no-op that does not throw", () => {
    expect(() =>
      useRunnerStore.getState()._onMessage({ type: "interrupt_ack" }),
    ).not.toThrow();
  });

  it("stdout / stderr append output lines", () => {
    useRunnerStore.getState()._onMessage({ type: "stdout", text: "hello" });
    useRunnerStore.getState()._onMessage({ type: "stderr", text: "oops" });
    const out = useRunnerStore.getState().output;
    expect(out).toEqual([
      { kind: "stdout", text: "hello" },
      { kind: "stderr", text: "oops" },
    ]);
  });

  it("lint replaces lintErrors", () => {
    useRunnerStore.getState()._onMessage({ type: "lint", reqId: 1, diagnostics: [] });
    expect(useRunnerStore.getState().lintErrors).toEqual([]);
  });
});

// ── error channels ─────────────────────────────────────────────────────────────

describe("handler — error channels", () => {
  it("error event produces an internal error_card and stops the run", () => {
    useRunnerStore.setState({ running: true });
    useRunnerStore.getState()._onMessage({
      type: "error",
      payload: { message: "Init failed", stack: "at foo.ts:1", phase: "init" },
    });
    const s = useRunnerStore.getState();
    expect(s.running).toBe(false);
    expect(s.output).toHaveLength(1);
    expect(s.output[0].kind).toBe("error_card");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("error event without stack/phase still logs and renders", () => {
    useRunnerStore.getState()._onMessage({
      type: "error",
      payload: { message: "bare error" },
    });
    expect(useRunnerStore.getState().output[0].kind).toBe("error_card");
  });

  it("runtime_error with location pushes a lint gutter marker", () => {
    const err: RuntimeError = {
      category: "naming",
      titleKey: "friendlyError.naming.title",
      messageKey: "friendlyError.naming.unknownKey",
      messageArgs: {},
      raw: "NameError: name 'scoer' is not defined",
      cleanRaw: "NameError: name 'scoer' is not defined",
      suggestions: [{ token: "scoer", replacement: "score" }],
      isBlocking: false,
      location: { row: 3, column: 4, endRow: 3, endColumn: 9 },
    };
    useRunnerStore.getState()._onMessage({ type: "runtime_error", error: err });
    const s = useRunnerStore.getState();
    expect(s.output[0].kind).toBe("error_card");
    expect(s.lintErrors).toHaveLength(1);
    expect(s.lintErrors[0].row).toBe(3);
    expect(s.lintErrors[0].messageArgs.name).toBe("scoer");
  });

  it("runtime_error without location leaves lintErrors untouched", () => {
    const err: RuntimeError = {
      category: "logic",
      titleKey: "friendlyError.logic.title",
      raw: "ZeroDivisionError",
      suggestions: [],
      isBlocking: false,
    };
    useRunnerStore.getState()._onMessage({ type: "runtime_error", error: err });
    const s = useRunnerStore.getState();
    expect(s.output[0].kind).toBe("error_card");
    expect(s.lintErrors).toHaveLength(0);
  });
});

// ── sound routing (main-thread audio) ──────────────────────────────────────────

describe("handler — sound events", () => {
  it("unknown sound name warns and does not throw", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      useRunnerStore.getState()._onMessage({ type: "sound", action: "play", name: "nope" }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("volume / pause / stop on an idle bucket are safe no-ops", () => {
    const g = useRunnerStore.getState();
    expect(() => {
      g._onMessage({ type: "sound", action: "volume", name: "s", value: 0.5 });
      g._onMessage({ type: "sound", action: "pause", name: "s" });
      g._onMessage({ type: "sound", action: "stop", name: "s" });
    }).not.toThrow();
  });
});

// ── request/response events that the shared handler ignores ─────────────────────

describe("handler — per-request events are no-ops on the shared handler", () => {
  it("does not throw for complete/screenshot/generator/reference/checker", () => {
    const g = useRunnerStore.getState();
    expect(() => {
      g._onMessage({ type: "complete", reqId: 1, completions: [] });
      g._onMessage({ type: "screenshot", reqId: 1, blob: null });
      g._onMessage({ type: "generator_result", reqId: 1, stdout: "[]" });
      g._onMessage({ type: "generator_error", reqId: 1, error: "boom" });
      g._onMessage({ type: "reference_result", reqId: 1, expected: "42" });
      g._onMessage({ type: "reference_error", reqId: 1, error: "boom" });
      g._onMessage({ type: "checker_result", reqId: 1, passed: true });
      g._onMessage({ type: "checker_error", reqId: 1, error: "boom" });
    }).not.toThrow();
    // None of these mutate the transcript.
    expect(useRunnerStore.getState().output).toHaveLength(0);
  });
});

// ── store actions ──────────────────────────────────────────────────────────────

describe("store actions", () => {
  it("pushErrorCard appends an error_card", () => {
    const err: RuntimeError = {
      category: "internal",
      titleKey: "friendlyError.internal.title",
      raw: "boom",
      suggestions: [],
      isBlocking: false,
    };
    useRunnerStore.getState().pushErrorCard(err);
    expect(useRunnerStore.getState().output[0].kind).toBe("error_card");
  });

  it("setLintErrors replaces the list", () => {
    useRunnerStore.getState().setLintErrors([]);
    expect(useRunnerStore.getState().lintErrors).toEqual([]);
  });

  it("_bumpEpoch increments workerEpoch", () => {
    const before = useRunnerStore.getState().workerEpoch;
    useRunnerStore.getState()._bumpEpoch();
    expect(useRunnerStore.getState().workerEpoch).toBe(before + 1);
  });

  it("scrubTo / debugScrubTo set their indices including null", () => {
    useRunnerStore.getState().scrubTo(3);
    expect(useRunnerStore.getState().scrubIndex).toBe(3);
    useRunnerStore.getState().scrubTo(null);
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
    useRunnerStore.getState().debugScrubTo(2);
    expect(useRunnerStore.getState().debugScrubIndex).toBe(2);
  });

  it("addScreenshot keeps at most 5, newest first; clearScreenshots empties", () => {
    // jsdom does not implement URL.revokeObjectURL — install a spyable stub.
    const revoke = jest.fn();
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revoke;
    for (let i = 0; i < 7; i++) {
      useRunnerStore.getState().addScreenshot({
        id: i,
        url: `blob:${i}`,
        blob: new Blob([], { type: "image/png" }),
      });
    }
    const shots = useRunnerStore.getState().screenshots;
    expect(shots).toHaveLength(5);
    expect(shots[0].id).toBe(6); // newest first

    useRunnerStore.getState().clearScreenshots();
    expect(useRunnerStore.getState().screenshots).toHaveLength(0);
    expect(revoke).toHaveBeenCalled();
  });

  it("applySuggestion rewrites the identifier when it differs", () => {
    useRunnerStore.getState().applySuggestion("score", "points");
    expect(mockChangeFile).toHaveBeenCalledWith("main.py", "points = 1\nprint(points)");
  });

  it("applySuggestion is a no-op when replacement equals the token", () => {
    useRunnerStore.getState().applySuggestion("score", "score");
    expect(mockChangeFile).not.toHaveBeenCalled();
  });

  it("stop resets run/canvas state", () => {
    useRunnerStore.setState({ running: true, canvasActive: true, paused: true });
    useRunnerStore.getState().stop();
    const s = useRunnerStore.getState();
    expect(s.running).toBe(false);
    expect(s.canvasActive).toBe(false);
    expect(s.paused).toBe(false);
  });
});
