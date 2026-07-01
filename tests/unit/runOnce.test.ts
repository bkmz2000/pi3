/**
 * Unit tests for runOnce() in RunnerProvider.
 *
 * Uses the workerFactory mock to intercept worker.postMessage and
 * simulates worker messages to verify stdout collection, TLE, and RTE.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({ project: { files: {}, assets: {} }, currentFile: "main.py", currentProjectId: null })),
  isExampleSessionId: jest.fn(() => false),
}));

import { mockWorkerInstance } from "./__mocks__/workerFactory";
import { runOnce, useRunnerStore } from "../../src/runner/RunnerProvider";

type MessageHandler = (e: MessageEvent) => void;

let onMessageHandler: ((e: MessageEvent) => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  onMessageHandler = null;

  mockWorkerInstance.addEventListener.mockImplementation(
    (type: string, handler: MessageHandler) => {
      if (type === "message") onMessageHandler = handler;
    },
  );
  mockWorkerInstance.removeEventListener.mockImplementation(() => {});
  mockWorkerInstance.postMessage.mockImplementation(() => {});

  useRunnerStore.setState({
    ready: true,
    running: false,
    output: [],
    inputPrompt: null,
    canvasActive: false,
    debugFrames: [],
    debugScrubIndex: null,
  });

  // Trigger getWorker() so the onmessage + listener are set up
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../src/runner/RunnerProvider").getWorker();

  // Capture the onmessage set by getWorker
  if (mockWorkerInstance.onmessage) {
    const original = mockWorkerInstance.onmessage;
    mockWorkerInstance.onmessage = original;
  }
});

function sendMessage(data: object) {
  // Fire through both the onmessage handler and addEventListener handlers
  const event = { data } as MessageEvent;
  if (mockWorkerInstance.onmessage) {
    (mockWorkerInstance.onmessage as (e: MessageEvent) => void)(event);
  }
  if (onMessageHandler) {
    onMessageHandler(event);
  }
}

// ── runOnce basic ─────────────────────────────────────────────────────────────

describe("runOnce", () => {
  it("resolves with stdout from worker messages", async () => {
    const p = runOnce("print('hello')", "", 2000);

    // Simulate worker sending stdout then result
    sendMessage({ type: "stdout", text: "hello\n" });
    sendMessage({ type: "result" });

    const result = await p;
    expect(result.stdout).toBe("hello\n");
    expect(result.runtimeError).toBe(false);
    expect(result.tle).toBe(false);
  });

  it("accumulates multiple stdout messages", async () => {
    const p = runOnce("code", "", 2000);

    sendMessage({ type: "stdout", text: "line1\n" });
    sendMessage({ type: "stdout", text: "line2\n" });
    sendMessage({ type: "result" });

    const result = await p;
    expect(result.stdout).toBe("line1\nline2\n");
  });

  it("sets runtimeError=true on runtime_error then resolves on result", async () => {
    const p = runOnce("bad code", "", 2000);

    sendMessage({
      type: "runtime_error",
      error: {
        category: "nameerror",
        titleKey: "t",
        messageKey: "m",
        messageArgs: {},
        raw: "NameError",
        cleanRaw: "NameError",
        suggestions: [],
        isBlocking: true,
      },
    });
    sendMessage({ type: "result" });

    const result = await p;
    expect(result.runtimeError).toBe(true);
    expect(result.tle).toBe(false);
  });

  it("injects stdin override into the code sent to worker", async () => {
    const p = runOnce("a = int(input())\nprint(a)", "42\n", 2000);
    sendMessage({ type: "result" });
    await p;

    const posted = mockWorkerInstance.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { cmd?: string })?.cmd === "run",
    );
    expect(posted).toBeTruthy();
    const code = (posted![0] as { files: Record<string, string> }).files["solution.py"];
    expect(code).toContain("_async_input");
    expect(code).toContain('"42\\n"');
  });

  it("resolves with empty stdout on clean run", async () => {
    const p = runOnce("pass", "", 2000);
    sendMessage({ type: "result" });
    const result = await p;
    expect(result.stdout).toBe("");
    expect(result.tle).toBe(false);
    expect(result.runtimeError).toBe(false);
  });
});
