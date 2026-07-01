import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { WorkerCommand, WorkerEvent, WorkerEventType, LintDiagnostic, type RuntimeError, type JediCompletion, type DebugFrame } from "./WorkerInterface";
import { useIde, useEditor } from "../state/IdeState";
import GraphicsInit from "../assets/python/graphics/__init__.py?raw";
import GraphicsActors from "../assets/python/graphics/actors/__init__.py?raw";
import GraphicsAnimation from "../assets/python/graphics/animation.py?raw";
import GraphicsManifest from "../assets/python/graphics/_manifest.py?raw";
import GraphicsErrors from "../assets/python/graphics/_errors.py?raw";
import GraphicsState from "../assets/python/graphics/_state_ns.py?raw";
import GraphicsStateInternal from "../assets/python/graphics/_state.py?raw";
import GraphicsColor from "../assets/python/graphics/_color.py?raw";
import GraphicsVec from "../assets/python/graphics/_vec.py?raw";
import GraphicsSheet from "../assets/python/graphics/_sheet.py?raw";
import GraphicsUtils from "../assets/python/graphics/_utils.py?raw";
import GraphicsLightingHelpers from "../assets/python/graphics/_lighting_helpers.py?raw";
import GraphicsSprites from "../assets/python/graphics/_sprites.py?raw";
import Linter from "../assets/python/linter.py?raw";
import ErrorHook from "../assets/python/error_hook.py?raw";
import InputTransform from "../assets/python/input_transform.py?raw";
import WatchTransform from "../assets/python/watch_transform.py?raw";
import SyntaxHints from "../assets/python/syntax_hints.py?raw";
import Pi3Init from "../assets/python/pi3/__init__.py?raw";
import Pi3Debug from "../assets/python/pi3/debug.py?raw";
import Pi3Testing from "../assets/python/pi3/testing.py?raw";
import DebugTransform from "../assets/python/debug_transform.py?raw";
import { libraryUrlMap, librarySoundUrlMap } from "../state/assets";
import { createRunnerWorker } from "./workerFactory";

type OutputLine = {
  kind: "stdout" | "stderr";
  text: string;
} | {
  kind: "error_card";
  error: RuntimeError;
};

export type Screenshot = { id: number; url: string; blob: Blob };
export type WatchEntry = { label: string; value: string; changedAt: number };

type RunnerState = {
  ready: boolean;
  running: boolean;
  output: OutputLine[];
  inputPrompt: string | null;
  canvasActive: boolean;
  canvasWidth: number;
  canvasHeight: number;
  canvasScale: number;
  lintErrors: LintDiagnostic[];
  screenshots: Screenshot[];
  workerEpoch: number;
  watches: WatchEntry[];
  paused: boolean;
  speed: 1 | 2 | 4;
  frameHistory: { frame: number; url: string; watches: { label: string; value: string }[] }[];
  scrubIndex: number | null;
  debugFrames: DebugFrame[];
  debugScrubIndex: number | null;

  _onMessage: (msg: WorkerEvent) => void;
  _appendOutput: (kind: "stdout" | "stderr", text: string) => void;
  _bumpEpoch: () => void;
  setRunning: (running: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  scrubTo: (index: number | null) => void;
  debugScrubTo: (index: number | null) => void;
  clear: () => void;
  stop: () => void;
  pushErrorCard: (error: RuntimeError) => void;
  respondToInput: (value: string) => void;
  setLintErrors: (errors: LintDiagnostic[]) => void;
  applySuggestion: (token: string, replacement: string) => void;
  addScreenshot: (snap: Screenshot) => void;
  clearScreenshots: () => void;
};

export const useRunnerStore = create<RunnerState>((set) => ({
  ready: false,
  running: false,
  output: [],
  inputPrompt: null,
  canvasActive: false,
  canvasWidth: 0,
  canvasHeight: 0,
  canvasScale: 1,
  lintErrors: [],
  screenshots: [],
  workerEpoch: 0,
  watches: [],
  paused: false,
  speed: 1,
  frameHistory: [],
  scrubIndex: null,
  debugFrames: [],
  debugScrubIndex: null,

  addScreenshot: (snap) => set((s) => {
    const next = [snap, ...s.screenshots].slice(0, 5);
    return { screenshots: next };
  }),
  clearScreenshots: () => {
    const cur = useRunnerStore.getState().screenshots;
    cur.forEach((s) => URL.revokeObjectURL(s.url));
    set({ screenshots: [] });
  },

  _appendOutput: (kind, text) =>
    set((s) => ({ output: [...s.output, { kind, text }] })),

  setLintErrors: (errors) => set({ lintErrors: errors }),

  _onMessage: (msg) => {
    switch (msg.type) {
      case "ready": {
        set({ ready: true });
        break;
      }
      case "stdout": {
        useRunnerStore.getState()._appendOutput("stdout", msg.text);
        break;
      }
      case "stderr": {
        useRunnerStore.getState()._appendOutput("stderr", msg.text);
        break;
      }
      case "result": {
        stopAllSounds();
        set({ running: false, inputPrompt: null, canvasActive: false });
        break;
      }
      case "interrupt_ack": {
        break;
      }
      case "input_request": {
        set({ inputPrompt: msg.prompt });
        break;
      }
      case "error": {
        const raw = msg.payload.message + (msg.payload.stack ? "\n" + msg.payload.stack : "");
        const internalError: RuntimeError = {
          category: "internal",
          titleKey: "friendlyError.internal.title",
          messageKey: "friendlyError.internal.classifierFailed",
          messageArgs: {},
          raw,
          cleanRaw: msg.payload.message,
          suggestions: [],
          isBlocking: false,
        };
        // Log infra crashes to the server the same way runtime_error does.
        try {
          const editor = useEditor.getState();
          fetch("/api/log/client-error", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              projectId: editor.currentProjectId ?? "",
              file: editor.currentFile ?? "",
              category: "internal",
              title: `pi3 infra error [${msg.payload.phase ?? "unknown"}]`,
              message: msg.payload.message,
              traceback: raw,
            }),
            keepalive: true,
          }).catch(() => {});
        } catch { /* swallow */ }
        set((s) => ({
          running: false,
          inputPrompt: null,
          output: [...s.output, { kind: "error_card", error: internalError }],
        }));
        break;
      }
      case "runtime_error": {
        // Mirror the error to the server log so we can analyze user-side
        // Python tracebacks from prod. Fire-and-forget; never surface failures.
        try {
          const editor = useEditor.getState();
          fetch("/api/log/client-error", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              projectId: editor.currentProjectId ?? "",
              file: editor.currentFile ?? "",
              category: msg.error.category,
              title: msg.error.title ?? msg.error.titleKey,
              message: msg.error.message ?? msg.error.messageKey ?? "",
              traceback: msg.error.cleanRaw ?? msg.error.raw,
            }),
            keepalive: true,
          }).catch(() => {});
        } catch { /* swallow */ }
        set((s) => ({
          running: false,
          inputPrompt: null,
          output: [...s.output, { kind: "error_card", error: msg.error }],
          // Also push to lintErrors for inline gutter display if location available
          lintErrors: msg.error.location
            ? [...s.lintErrors, {
                code: "RUNTIME",
                messageKey: `friendlyError.${msg.error.category}.title`,
                messageArgs: { name: msg.error.suggestions[0]?.token ?? "" },
                row: msg.error.location.row,
                column: msg.error.location.column,
                endRow: msg.error.location.endRow,
                endColumn: msg.error.location.endColumn,
                severity: "error" as const,
                category: msg.error.category,
                suggestions: msg.error.suggestions,
                isBlocking: msg.error.isBlocking,
              }]
            : s.lintErrors,
        }));
        break;
      }
      case "start": {
        set({
          running: true,
          canvasActive: msg.canvasActive,
        });
        break;
      }
      case "canvas_resize": {
        // Use native pixel dimensions — no scaling, no aliasing
        set({ canvasWidth: msg.width, canvasHeight: msg.height, canvasScale: 1 });
        break;
      }
      case "lint": {
        set({ lintErrors: msg.diagnostics });
        break;
      }
      case "sound": {
        handleSoundEvent(msg.action, msg.name, msg.value);
        break;
      }
      case "complete": {
        // Handled by per-request listener in requestCompletions()
        break;
      }
      case "screenshot": {
        // Handled by per-request listener in captureScreenshot()
        break;
      }
      case "watch": {
        const prev = useRunnerStore.getState().watches;
        const prevMap = new Map(prev.map((w) => [w.label, w]));
        const now = Date.now();
        const next: WatchEntry[] = msg.values.map((v) => {
          const old = prevMap.get(v.label);
          const changedAt = old && old.value === v.value ? old.changedAt : now;
          return { label: v.label, value: v.value, changedAt };
        });
        set({ watches: next });
        break;
      }
      case "frame_history": {
        const cur = useRunnerStore.getState().frameHistory;
        cur.forEach((f) => URL.revokeObjectURL(f.url));
        const next = msg.frames.map((f) => ({
          frame: f.frame,
          url: URL.createObjectURL(f.blob),
          watches: f.watches,
        }));
        set({ frameHistory: next, scrubIndex: next.length > 0 ? next.length - 1 : null });
        break;
      }
      case "debug_frame": {
        set((s) => ({ debugFrames: [...s.debugFrames, msg.frame] }));
        break;
      }
      // Handled by per-request listeners in runGenerator() / runReference() / runChecker()
      case "generator_result":
      case "generator_error":
      case "reference_result":
      case "reference_error":
      case "checker_result":
      case "checker_error":
        break;
      default: {
        const missing: never = msg;
        throw new Error(`missing ${missing}`);
      }
    }
  },

  _bumpEpoch: () => set((s) => ({ workerEpoch: s.workerEpoch + 1 })),
  setRunning: (running) => set({ running }),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  scrubTo: (index) => set({ scrubIndex: index }),
  debugScrubTo: (index) => set({ debugScrubIndex: index }),
  pushErrorCard: (error) => set((s) => ({
    output: [...s.output, { kind: "error_card", error }],
  })),
  clear: () => {
    stopAllSounds();
    useRunnerStore.getState().frameHistory.forEach((f) => URL.revokeObjectURL(f.url));
    set({ output: [], inputPrompt: null, running: false, canvasActive: false, lintErrors: [], canvasWidth: 0, canvasHeight: 0, canvasScale: 1, watches: [], paused: false, speed: 1, frameHistory: [], scrubIndex: null, debugFrames: [], debugScrubIndex: null });
  },
  stop: () => {
    stopAllSounds();
    useRunnerStore.getState().frameHistory.forEach((f) => URL.revokeObjectURL(f.url));
    set({ inputPrompt: null, running: false, canvasActive: false, paused: false, frameHistory: [], scrubIndex: null, debugFrames: [], debugScrubIndex: null });
  },

  respondToInput: (value) => {
    set({ inputPrompt: null });
    getWorker().postMessage({
      cmd: "input_response",
      value,
    } satisfies WorkerCommand);
  },

  applySuggestion: (token, replacement) => {
    const editor = useEditor.getState();
    const code = editor.project.files[editor.currentFile] ?? "";
    // Replace first occurrence — word-boundary-aware to avoid partial matches
    const wordBoundary = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const newCode = code.replace(wordBoundary, replacement);
    if (newCode !== code) {
      editor.changeFile(editor.currentFile, newCode);
    }
  },
}));

// --- Audio (main thread) ---
// URL map (sound name -> src) reset on each run. Each "play" allocates a fresh
// element so overlapping plays work; we also keep the latest element per name
// so pause/stop can target the most recent invocation.
let soundUrlMap: Record<string, string> = {};
const activeByName: Map<string, Set<HTMLAudioElement>> = new Map();
const volumeByName: Map<string, number> = new Map();

function handleSoundEvent(action: "play" | "pause" | "loop" | "stop" | "volume", name: string, value?: number) {
  if (action === "play" || action === "loop") {
    const url = soundUrlMap[name];
    if (!url) {
      console.warn(`[RunnerProvider] unknown sound: ${name}`);
      return;
    }
    const audio = new Audio(url);
    audio.loop = action === "loop";
    const vol = volumeByName.get(name);
    if (vol !== undefined) audio.volume = vol;
    let bucket = activeByName.get(name);
    if (!bucket) { bucket = new Set(); activeByName.set(name, bucket); }
    bucket.add(audio);
    audio.addEventListener("ended", () => bucket!.delete(audio));
    audio.play().catch((err) => console.warn(`[RunnerProvider] sound play failed:`, err));
    return;
  }
  if (action === "volume") {
    volumeByName.set(name, value ?? 1);
    return;
  }
  const bucket = activeByName.get(name);
  if (!bucket) return;
  for (const a of bucket) {
    a.pause();
    if (action === "stop") a.currentTime = 0;
  }
  if (action === "stop") bucket.clear();
}

function stopAllSounds() {
  for (const bucket of activeByName.values()) {
    for (const a of bucket) { a.pause(); a.currentTime = 0; }
  }
  activeByName.clear();
}

// --- Worker singleton ---

let worker: Worker | null = null;
let lintReqId = 0;
let cleanupEvents: (() => void) | null = null;
let canvasTransferred = false;
let interruptBuffer: Uint8Array | null = null;

// Output batching — accumulate lines and flush on animation frame
let outputQueue: { kind: "stdout" | "stderr"; text: string }[] = [];
let flushHandle: number | null = null;

function scheduleFlush() {
  if (flushHandle !== null) return;
  flushHandle = requestAnimationFrame(() => {
    flushHandle = null;
    if (!outputQueue.length) return;

    const stdoutLines = outputQueue
      .filter((l) => l.kind === "stdout")
      .map((l) => l.text);
    const stderrLines = outputQueue
      .filter((l) => l.kind === "stderr")
      .map((l) => l.text);
    outputQueue = [];

    const store = useRunnerStore.getState();
    if (stdoutLines.length)
      store._appendOutput("stdout", stdoutLines.join("\n"));
    if (stderrLines.length)
      store._appendOutput("stderr", stderrLines.join("\n"));
  });
}

function initInterruptBuffer(w: Worker) {
  if (typeof SharedArrayBuffer === "undefined") return;
  try {
    const buffer = new SharedArrayBuffer(1);
    interruptBuffer = new Uint8Array(buffer);
    w.postMessage({
      cmd: "set_interrupt_buffer",
      buffer,
    } satisfies WorkerCommand);
  } catch (err) {
    console.warn("SharedArrayBuffer unavailable:", err);
  }
}

function hardKillWorker() {
  worker?.terminate();
  worker = null;
  canvasTransferred = false;
  interruptBuffer = null;
  stopAllSounds();
  // reset UI state: stop() clears running/inputPrompt/canvasActive; also mark not ready
  useRunnerStore.getState().stop();
  useRunnerStore.setState({ ready: false });
  // bump epoch so CanvasWindow remounts a fresh <canvas> element for re-transfer
  useRunnerStore.getState()._bumpEpoch();
}

export function getWorker(): Worker {
  if (worker) return worker;

  worker = createRunnerWorker();

  worker.onmessage = (e: MessageEvent<WorkerEvent>) => {
    const msg = e.data;
    // Intercept output messages and batch them instead of dispatching immediately
    if (msg.type === "stdout" || msg.type === "stderr") {
      outputQueue.push({ kind: msg.type, text: msg.text });
      scheduleFlush();
      return;
    }
    useRunnerStore.getState()._onMessage(msg);
  };

  worker.onerror = (e) => {
    console.error("Worker error:", e);
    useRunnerStore.getState()._onMessage({
      type: "error",
      payload: { message: e.message ?? "Worker crashed", phase: "worker" },
    });
  };

  initInterruptBuffer(worker);
  worker.postMessage({
    cmd: "init",
    graphicsInit: GraphicsInit,
    graphicsActors: GraphicsActors,
    graphicsAnimation: GraphicsAnimation,
    graphicsManifest: GraphicsManifest,
    graphicsErrors: GraphicsErrors,
    graphicsState: GraphicsState,
    graphicsStateInternal: GraphicsStateInternal,
    graphicsColor: GraphicsColor,
    graphicsVec: GraphicsVec,
    graphicsSheet: GraphicsSheet,
    graphicsUtils: GraphicsUtils,
    graphicsLightingHelpers: GraphicsLightingHelpers,
    graphicsSprites: GraphicsSprites,
    linter: Linter,
    errorHook: ErrorHook,
    inputTransform: InputTransform,
    watchTransform: WatchTransform,
    syntaxHints: SyntaxHints,
    pi3Init: Pi3Init,
    pi3Debug: Pi3Debug,
    pi3Testing: Pi3Testing,
    debugTransform: DebugTransform,
  } satisfies WorkerCommand);
  return worker;
}

function wireEvents(canvas: HTMLCanvasElement): () => void {
  const w = getWorker();
  const send = (kind: WorkerEventType, data: object) =>
    w.postMessage({ cmd: "event", kind, data } satisfies WorkerCommand);

  const onMouseMove = (e: MouseEvent) => {
    const s = useRunnerStore.getState().canvasScale || 1;
    const r = canvas.getBoundingClientRect();
    send("mousemove", { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s });
  };
  const onMouseDown = (e: MouseEvent) => {
    const s = useRunnerStore.getState().canvasScale || 1;
    const r = canvas.getBoundingClientRect();
    send("mousedown", {
      x: (e.clientX - r.left) * s,
      y: (e.clientY - r.top) * s,
      button: e.button,
    });
  };
  const onMouseUp = (e: MouseEvent) => send("mouseup", { button: e.button });
  const onKeyDown = (e: KeyboardEvent) =>
    send("keydown", { key: e.key, keyCode: e.keyCode });
  const onKeyUp = (e: KeyboardEvent) =>
    send("keyup", { key: e.key, keyCode: e.keyCode });

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return () => {
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

/**
 * Run code once with stdin injection. Returns stdout + error flags.
 * Used by the compete submit runner to judge individual test cases.
 * timeLimitMs: if the code runs longer, returns tle=true via interrupt buffer.
 */
export function runOnce(
  code: string,
  stdin: string,
  timeLimitMs: number = 2000,
): Promise<{ stdout: string; runtimeError: boolean; tle: boolean }> {
  return new Promise((resolve) => {
    const w = getWorker();
    const stdoutChunks: string[] = [];
    let settled = false;
    let tleFired = false;
    let runtimeError = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      w.removeEventListener("message", handler);
      clearTimeout(tleTimer);
      resolve({ stdout: stdoutChunks.join(""), runtimeError, tle: tleFired });
    };

    const handler = (e: MessageEvent<WorkerEvent>) => {
      const msg = e.data;
      if (msg.type === "stdout") {
        stdoutChunks.push(msg.text);
      } else if (msg.type === "runtime_error") {
        runtimeError = true;
        // result message follows — finish() there
      } else if (msg.type === "result") {
        finish();
      }
    };

    w.addEventListener("message", handler);

    const tleTimer = setTimeout(() => {
      tleFired = true;
      if (interruptBuffer) {
        interruptBuffer[0] = 2;
        w.postMessage({ cmd: "interrupt" } satisfies WorkerCommand);
        // result will arrive after worker handles interrupt
      } else {
        hardKillWorker();
        finish();
      }
    }, timeLimitMs);

    // Defensive: zero interrupt buffer before each test
    if (interruptBuffer) interruptBuffer[0] = 0;
    outputQueue = [];
    useRunnerStore.getState().clear();
    useRunnerStore.getState().setRunning(true);

    const injected =
      `import io as _pi3_io\n` +
      `_pi3_data = _pi3_io.StringIO(${JSON.stringify(stdin)})\n` +
      `async def _async_input(prompt=''):\n` +
      `    _line = _pi3_data.readline()\n` +
      `    return _line.rstrip('\\n') if _line else ''\n` +
      `del _pi3_io\n` +
      code;

    w.postMessage({
      cmd: "run",
      files: { "solution.py": injected },
      assets: {},
      entry: "solution.py",
    } satisfies WorkerCommand);
  });
}

let _reqCounter = 0;
function nextReqId() { return ++_reqCounter; }

/**
 * Run a teacher's generator source in the Pyodide worker.
 * Seeds the RNG from the problem slug and captures the generator's stdout.
 * Returns the raw JSON string from `print(tests)`, or an error string.
 */
export function runGenerator(
  generatorPy: string,
  slug: string,
): Promise<{ stdout: string; error?: string }> {
  return new Promise((resolve) => {
    const w = getWorker();
    const reqId = nextReqId();
    const handler = (e: MessageEvent<WorkerEvent>) => {
      const msg = e.data;
      if (msg.type === "generator_result" && msg.reqId === reqId) {
        w.removeEventListener("message", handler);
        resolve({ stdout: msg.stdout });
      } else if (msg.type === "generator_error" && msg.reqId === reqId) {
        w.removeEventListener("message", handler);
        resolve({ stdout: "", error: msg.error });
      }
    };
    w.addEventListener("message", handler);
    w.postMessage({ cmd: "runGenerator", generatorPy, slug, reqId } satisfies WorkerCommand);
  });
}

/**
 * Run the reference solution against a single test's fields.
 * The solution function receives a SimpleNamespace built from fieldsJson.
 * Returns the trimmed stdout (expected output), or an error string.
 */
export function runReference(
  referencePy: string,
  fieldsJson: string,
  timeLimitMs: number = 2000,
): Promise<{ expected: string; error?: string }> {
  const w = getWorker();
  const reqId = nextReqId();

  // Zero the interrupt buffer before starting
  if (interruptBuffer) interruptBuffer[0] = 0;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { expected: string; error?: string }) => {
      if (settled) return;
      settled = true;
      w.removeEventListener("message", handler);
      clearTimeout(tleTimer);
      resolve(result);
    };

    const handler = (e: MessageEvent<WorkerEvent>) => {
      const msg = e.data;
      if (msg.type === "reference_result" && msg.reqId === reqId) {
        finish({ expected: msg.expected });
      } else if (msg.type === "reference_error" && msg.reqId === reqId) {
        finish({ expected: "", error: msg.error });
      }
    };

    const tleTimer = setTimeout(() => {
      if (interruptBuffer) {
        interruptBuffer[0] = 2;
        w.postMessage({ cmd: "interrupt" } satisfies WorkerCommand);
      }
      // Give the interrupt 200ms to propagate, then force-resolve
      setTimeout(() => finish({
        expected: "",
        error: "Time limit exceeded (2s per test)",
      }), 200);
    }, timeLimitMs);

    w.addEventListener("message", handler);
    w.postMessage({ cmd: "runReference", referencePy, fieldsJson, reqId } satisfies WorkerCommand);
  });
}

/**
 * Run the teacher's checker function for a single test case.
 * Returns `passed: true` if the checker returns truthy, false otherwise.
 */
export function runChecker(
  checkerPy: string,
  fieldsJson: string | null,
  studentOutput: string,
  expectedOutput: string,
): Promise<{ passed: boolean; error?: string }> {
  return new Promise((resolve) => {
    const w = getWorker();
    const reqId = nextReqId();
    const handler = (e: MessageEvent<WorkerEvent>) => {
      const msg = e.data;
      if (msg.type === "checker_result" && msg.reqId === reqId) {
        w.removeEventListener("message", handler);
        resolve({ passed: msg.passed });
      } else if (msg.type === "checker_error" && msg.reqId === reqId) {
        w.removeEventListener("message", handler);
        resolve({ passed: false, error: msg.error });
      }
    };
    w.addEventListener("message", handler);
    w.postMessage({ cmd: "runChecker", checkerPy, fieldsJson, studentOutput, expectedOutput, reqId } satisfies WorkerCommand);
  });
}

export function useRunner() {
  const { ready, running, output, clear, pushErrorCard, inputPrompt, respondToInput, canvasActive, canvasWidth, canvasHeight, canvasScale, lintErrors, _appendOutput, applySuggestion, watches, paused, speed, setPaused, setSpeed, frameHistory, scrubIndex, scrubTo } =
    useRunnerStore();

  useEffect(() => {
    getWorker();
  }, []);

  const loadAssets = useCallback(async (assets: Record<string, string>) => {
    const bitmaps: Record<string, ImageBitmap> = {};
    const transferables: ImageBitmap[] = [];

    await Promise.all(
      Object.entries(assets).map(async ([name, url]) => {
        try {
          if (url.startsWith("data:")) {
            // Use Image element to load the data URL directly - it handles SVG properly
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error(`Failed to load image ${name}`));
              img.src = url;
            });
            
            // Draw to canvas to get ImageBitmap
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            
            const bitmap = await createImageBitmap(canvas);
            bitmaps[name] = bitmap;
            transferables.push(bitmap);
          } else {
            // Regular URL - fetch it
            const res = await fetch(url);
            const blob = await res.blob();
            const bitmap = await createImageBitmap(blob);
            bitmaps[name] = bitmap;
            transferables.push(bitmap);
          }
        } catch (err) {
          console.warn(`[RunnerProvider] could not load asset ${name}:`, err);
        }
      }),
    );

    return { bitmaps, transferables };
  }, []);

  const run = useCallback(
    async (
      files: Record<string, string>,
      nameToUrl: Record<string, string>,
      entry: string,
    ) => {
      useRunnerStore.getState().clear();
      useRunnerStore.getState().setRunning(true);
      outputQueue = [];
      // Merge library packs into asset map (project names take precedence on conflict).
      const mergedUrls = { ...libraryUrlMap(), ...nameToUrl };
      const { bitmaps, transferables } = await loadAssets(mergedUrls);
      const showHitboxes = useIde.getState().showHitboxes;
      const showActorInfo = useIde.getState().showActorInfo;
      const { tilemaps, sounds: projectSounds, sheet } = useEditor.getState().project;
      // Reset audio state for this run and build the URL map
      // (library sounds + project sounds; project takes precedence).
      stopAllSounds();
      soundUrlMap = { ...librarySoundUrlMap(), ...(projectSounds ?? {}) };
      const soundNames = Object.keys(soundUrlMap);
      getWorker().postMessage(
        {
          cmd: "run",
          files,
          entry,
          assets: bitmaps,
          tilemaps,
          soundNames,
          sheet,
          showHitboxes,
          showActorInfo,
        } satisfies WorkerCommand,
        transferables,
      );
    },
    [loadAssets],
  );

  const interrupt = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      // No SAB → worker is stuck and can't receive messages → go straight to hard kill
      if (!interruptBuffer) {
        hardKillWorker();
        resolve();
        return;
      }

      const w = getWorker();
      let settled = false;

      // Object ref keeps clearTimeout safe even when finish() is called
      // synchronously inside postMessage (before the setTimeout assignment).
      const timerRef: { id: ReturnType<typeof setTimeout> | undefined } = { id: undefined };

      const finish = (hard: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerRef.id);
        w.removeEventListener("message", handleMessage);
        if (hard) {
          hardKillWorker();
        } else {
          interruptBuffer![0] = 0;
          useRunnerStore.getState().stop();
        }
        resolve();
      };

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "interrupt_ack") finish(false);
      };

      w.addEventListener("message", handleMessage);
      interruptBuffer[0] = 2;
      w.postMessage({ cmd: "interrupt" } satisfies WorkerCommand);

      // 500ms: if no ack (busy loop blocked the message handler), hard-kill
      timerRef.id = setTimeout(() => finish(true), 500);
    });
  }, []);

  const attachCanvas = useCallback((el: HTMLCanvasElement | null) => {
    cleanupEvents?.();
    cleanupEvents = null;
    if (!el) return;

    if (!canvasTransferred) {
      const offscreen = el.transferControlToOffscreen();
      getWorker().postMessage(
        { cmd: "attach_canvas", canvas: offscreen } satisfies WorkerCommand,
        [offscreen],
      );
      canvasTransferred = true;
    }

    cleanupEvents = wireEvents(el);
  }, []);

  const captureScreenshot = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const w = getWorker();
      const reqId = ++lintReqId;
      const handler = (e: MessageEvent<WorkerEvent>) => {
        if (e.data.type === "screenshot" && e.data.reqId === reqId) {
          w.removeEventListener("message", handler);
          clearTimeout(timer);
          resolve(e.data.blob);
        }
      };
      const timer = setTimeout(() => {
        w.removeEventListener("message", handler);
        resolve(null);
      }, 2000);
      w.addEventListener("message", handler);
      w.postMessage({ cmd: "screenshot", reqId } satisfies WorkerCommand);
    });
  }, []);

  const lint = useCallback((code: string, filename: string) => {
    return new Promise<LintDiagnostic[]>((resolve) => {
      const reqId = ++lintReqId;
      let settled = false;

      const finish = (diagnostics: LintDiagnostic[]) => {
        if (settled) return;
        settled = true;
        getWorker().removeEventListener("message", handler);
        clearTimeout(timer);
        useRunnerStore.getState().setLintErrors(diagnostics);
        resolve(diagnostics);
      };

      const handler = (e: MessageEvent<WorkerEvent>) => {
        if (e.data.type === "lint" && e.data.reqId === reqId) finish(e.data.diagnostics);
      };

      const timer = setTimeout(() => finish([]), 10_000);
      getWorker().addEventListener("message", handler);
      getWorker().postMessage({ cmd: "lint", code, filename, reqId } satisfies WorkerCommand);
    });
  }, []);

  const requestCompletions = useCallback((code: string, line: number, col: number): Promise<JediCompletion[]> => {
    return new Promise((resolve) => {
      const w = getWorker();
      const reqId = ++lintReqId;
      let settled = false;
      const finish = (items: JediCompletion[]) => {
        if (settled) return;
        settled = true;
        w.removeEventListener("message", handler);
        clearTimeout(timer);
        resolve(items);
      };
      const handler = (e: MessageEvent<WorkerEvent>) => {
        if (e.data.type === "complete" && e.data.reqId === reqId) finish(e.data.completions);
      };
      const timer = setTimeout(() => finish([]), 5000);
      w.addEventListener("message", handler);
      w.postMessage({ cmd: "complete", code, line, col, reqId } satisfies WorkerCommand);
    });
  }, []);

  const pause = useCallback(() => {
    if (useRunnerStore.getState().paused) return;
    setPaused(true);
    getWorker().postMessage({ cmd: "pause" } satisfies WorkerCommand);
  }, [setPaused]);

  const resume = useCallback(() => {
    if (!useRunnerStore.getState().paused) return;
    setPaused(false);
    getWorker().postMessage({ cmd: "resume" } satisfies WorkerCommand);
  }, [setPaused]);

  const step = useCallback(() => {
    getWorker().postMessage({ cmd: "step" } satisfies WorkerCommand);
  }, []);

  const setGameSpeed = useCallback((divisor: 1 | 2 | 4) => {
    setSpeed(divisor);
    getWorker().postMessage({ cmd: "set_speed", divisor } satisfies WorkerCommand);
  }, [setSpeed]);

  const stepBack = useCallback(() => {
    const { frameHistory: fh, scrubIndex: si } = useRunnerStore.getState();
    if (fh.length === 0) return;
    const cur = si === null ? fh.length - 1 : si;
    scrubTo(Math.max(0, cur - 1));
  }, [scrubTo]);

  const stepFwd = useCallback(() => {
    const { frameHistory: fh, scrubIndex: si } = useRunnerStore.getState();
    if (si === null) return;
    if (si >= fh.length - 1) {
      scrubTo(null);
    } else {
      scrubTo(si + 1);
    }
  }, [scrubTo]);

  return {
    ready,
    running,
    canvasActive,
    canvasWidth,
    canvasHeight,
    canvasScale,
    output,
    run,
    interrupt,
    clear,
    attachCanvas,
    inputPrompt,
    respondToInput,
    lint,
    lintErrors,
    captureScreenshot,
    requestCompletions,
    _appendOutput,
    applySuggestion,
    pushErrorCard,
    watches,
    paused,
    speed,
    pause,
    resume,
    step,
    setGameSpeed,
    frameHistory,
    scrubIndex,
    scrubTo,
    stepBack,
    stepFwd,
  };
}
