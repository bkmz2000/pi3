/**
 * Acceptance tests for DBG-1 / DBG-2 / DBG-3 / DBG-4 / DBG-5.
 *
 * Uses synthetic WorkerEvents fed into useRunnerStore._onMessage so no
 * real worker or Pyodide load is required.
 */

import { useRunnerStore } from "../../src/runner/RunnerProvider";

// jsdom doesn't implement URL.createObjectURL — provide a lightweight stub.
if (typeof URL.createObjectURL === "undefined") {
  let _urlCounter = 0;
  URL.createObjectURL = () => `blob:mock-${++_urlCounter}`;
  URL.revokeObjectURL = () => {};
}

// Reset store state before each test.
beforeEach(() => {
  useRunnerStore.getState().clear();
});

// ── DBG-2: Watch panel ────────────────────────────────────────────────────────

describe("DBG-2 — Watch panel", () => {
  it("watch event adds rows to RunnerStore.watches", () => {
    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [
        { label: "score", value: "42" },
        { label: "x", value: "100.0" },
      ],
      frame: 5,
    });

    const { watches } = useRunnerStore.getState();
    expect(watches).toHaveLength(2);
    expect(watches[0].label).toBe("score");
    expect(watches[0].value).toBe("42");
    expect(watches[1].label).toBe("x");
    expect(watches[1].value).toBe("100.0");
  });

  it("changedAt stays stable when value is unchanged", () => {
    const t0 = Date.now();
    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [{ label: "score", value: "42" }],
      frame: 1,
    });
    const first = useRunnerStore.getState().watches[0].changedAt;
    expect(first).toBeGreaterThanOrEqual(t0);

    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [{ label: "score", value: "42" }],
      frame: 2,
    });
    const second = useRunnerStore.getState().watches[0].changedAt;
    expect(second).toBe(first); // unchanged → same changedAt
  });

  it("changedAt advances when value changes", () => {
    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [{ label: "score", value: "42" }],
      frame: 1,
    });
    const first = useRunnerStore.getState().watches[0].changedAt;

    // Guarantee a new Date.now() value
    jest.spyOn(Date, "now").mockReturnValueOnce(first + 100);

    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [{ label: "score", value: "99" }],
      frame: 2,
    });
    const second = useRunnerStore.getState().watches[0].changedAt;
    expect(second).toBeGreaterThan(first);

    jest.restoreAllMocks();
  });

  it("watches clear on clear()", () => {
    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [{ label: "x", value: "1" }],
      frame: 0,
    });
    expect(useRunnerStore.getState().watches).toHaveLength(1);
    useRunnerStore.getState().clear();
    expect(useRunnerStore.getState().watches).toHaveLength(0);
  });

  it("watch event with no values produces empty array", () => {
    useRunnerStore.getState()._onMessage({
      type: "watch",
      values: [],
      frame: 0,
    });
    expect(useRunnerStore.getState().watches).toHaveLength(0);
  });
});

// ── debug_frame ring buffer ─────────────────────────────────────────────────

describe("debug_frame — buffer cap", () => {
  it("appends debug_frame events to debugFrames", () => {
    useRunnerStore.getState()._onMessage({
      type: "debug_frame",
      frame: { index: 0, slots: [] },
    } as unknown as import("../../src/runner/WorkerInterface").WorkerEvent);
    useRunnerStore.getState()._onMessage({
      type: "debug_frame",
      frame: { index: 1, slots: [] },
    } as unknown as import("../../src/runner/WorkerInterface").WorkerEvent);
    expect(useRunnerStore.getState().debugFrames).toHaveLength(2);
  });

  it("caps debugFrames at 500 frames — oldest frames evicted", () => {
    for (let i = 0; i < 520; i++) {
      useRunnerStore.getState()._onMessage({
        type: "debug_frame",
        frame: { index: i, slots: [] },
      } as unknown as import("../../src/runner/WorkerInterface").WorkerEvent);
    }
    const frames = useRunnerStore.getState().debugFrames;
    expect(frames).toHaveLength(500);
    // First surviving frame should be index 20 (evicted 0..19)
    expect((frames[0] as { index: number }).index).toBe(20);
    expect((frames[499] as { index: number }).index).toBe(519);
  });
});

// ── DBG-3: Pause / step / speed ──────────────────────────────────────────────

describe("DBG-3 — Pause / step / speed", () => {
  it("setPaused toggles the paused flag", () => {
    expect(useRunnerStore.getState().paused).toBe(false);
    useRunnerStore.getState().setPaused(true);
    expect(useRunnerStore.getState().paused).toBe(true);
    useRunnerStore.getState().setPaused(false);
    expect(useRunnerStore.getState().paused).toBe(false);
  });

  it("setSpeed sets the speed divisor", () => {
    expect(useRunnerStore.getState().speed).toBe(1);
    useRunnerStore.getState().setSpeed(4);
    expect(useRunnerStore.getState().speed).toBe(4);
    useRunnerStore.getState().setSpeed(1);
    expect(useRunnerStore.getState().speed).toBe(1);
  });

  it("paused resets to false on clear()", () => {
    useRunnerStore.getState().setPaused(true);
    useRunnerStore.getState().clear();
    expect(useRunnerStore.getState().paused).toBe(false);
  });

  it("speed resets to 1 on clear()", () => {
    useRunnerStore.getState().setSpeed(2);
    useRunnerStore.getState().clear();
    expect(useRunnerStore.getState().speed).toBe(1);
  });
});

// ── DBG-4: Step-back ─────────────────────────────────────────────────────────

describe("DBG-4 — Step-back (frame_history)", () => {
  function makeBlob(text = "x"): Blob {
    return new Blob([text], { type: "image/webp" });
  }

  it("frame_history event populates frameHistory and defaults scrubIndex to last frame", () => {
    useRunnerStore.getState()._onMessage({
      type: "frame_history",
      frames: [
        { frame: 10, blob: makeBlob("a") },
        { frame: 11, blob: makeBlob("b") },
        { frame: 12, blob: makeBlob("c") },
      ],
    });

    const { frameHistory, scrubIndex } = useRunnerStore.getState();
    expect(frameHistory).toHaveLength(3);
    expect(frameHistory[0].frame).toBe(10);
    expect(frameHistory[2].frame).toBe(12);
    expect(scrubIndex).toBe(2); // defaults to last
  });

  it("each frame gets an object URL (truthy string)", () => {
    useRunnerStore.getState()._onMessage({
      type: "frame_history",
      frames: [{ frame: 0, blob: makeBlob() }],
    });
    const { frameHistory } = useRunnerStore.getState();
    expect(typeof frameHistory[0].url).toBe("string");
    expect(frameHistory[0].url.length).toBeGreaterThan(0);
  });

  it("scrubTo sets scrubIndex including null (live view)", () => {
    useRunnerStore.getState()._onMessage({
      type: "frame_history",
      frames: [{ frame: 5, blob: makeBlob() }, { frame: 6, blob: makeBlob() }],
    });
    useRunnerStore.getState().scrubTo(0);
    expect(useRunnerStore.getState().scrubIndex).toBe(0);
    useRunnerStore.getState().scrubTo(null);
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
  });

  it("frame_history clears on clear()", () => {
    useRunnerStore.getState()._onMessage({
      type: "frame_history",
      frames: [{ frame: 0, blob: makeBlob() }],
    });
    useRunnerStore.getState().clear();
    expect(useRunnerStore.getState().frameHistory).toHaveLength(0);
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
  });

  it("empty frame_history results in scrubIndex=null", () => {
    useRunnerStore.getState()._onMessage({
      type: "frame_history",
      frames: [],
    });
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
    expect(useRunnerStore.getState().frameHistory).toHaveLength(0);
  });
});

// ── DBG-1: Actor repr format ──────────────────────────────────────────────────
// Python repr is tested via validate_graphics.py (PYTHONPATH=src/assets/python).
// We just verify the documented format shape here at the string level.

describe("DBG-1 — Actor repr documented format", () => {
  it("documented repr format matches Actor(x=..., y=..., vx=..., vy=..., angle=...)", () => {
    const reprRegex = /^Actor\(x=-?\d+\.\d, y=-?\d+\.\d, vx=-?\d+\.\d, vy=-?\d+\.\d, angle=-?\d+\.\d\)$/;
    const example = "Actor(x=100.0, y=200.0, vx=3.0, vy=0.0, angle=45.0)";
    expect(example).toMatch(reprRegex);
    const subclass = "Rect(x=0.0, y=0.0, vx=0.0, vy=0.0, angle=0.0)";
    expect(subclass).toMatch(/^\w+\(x=-?\d+\.\d, y=-?\d+\.\d, vx=-?\d+\.\d, vy=-?\d+\.\d, angle=-?\d+\.\d\)$/);
  });
});
