import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { WorkerCommand, WorkerEvent, WorkerEventType, LintDiagnostic, type RuntimeError, type JediCompletion } from "./WorkerInterface";
import { useIde, useEditor } from "../state/IdeState";
import GraphicsInit from "../assets/python/graphics/__init__.py?raw";
import GraphicsActors from "../assets/python/graphics/actors/__init__.py?raw";
import GraphicsAnimation from "../assets/python/graphics/animation.py?raw";
import Linter from "../assets/python/linter.py?raw";
import ErrorHook from "../assets/python/error_hook.py?raw";
import InputTransform from "../assets/python/input_transform.py?raw";
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

  _onMessage: (msg: WorkerEvent) => void;
  _appendOutput: (kind: "stdout" | "stderr", text: string) => void;
  _bumpEpoch: () => void;
  setRunning: (running: boolean) => void;
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
        set((s) => ({
          running: false,
          inputPrompt: null,
          output: [...s.output, { kind: "stderr", text: msg.error }],
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
              title: msg.error.title,
              message: msg.error.message,
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
      default: {
        const missing: never = msg;
        throw new Error(`missing ${missing}`);
      }
    }
  },

  _bumpEpoch: () => set((s) => ({ workerEpoch: s.workerEpoch + 1 })),
  setRunning: (running) => set({ running }),
  pushErrorCard: (error) => set((s) => ({
    output: [...s.output, { kind: "error_card", error }],
  })),
  clear: () => {
    stopAllSounds();
    set({ output: [], inputPrompt: null, running: false, canvasActive: false, lintErrors: [], canvasWidth: 0, canvasHeight: 0, canvasScale: 1 });
  },
  stop: () => {
    stopAllSounds();
    set({ inputPrompt: null, running: false, canvasActive: false });
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

function getWorker(): Worker {
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
      error: e.message ?? "Worker crashed",
    });
  };

  initInterruptBuffer(worker);
  worker.postMessage({
    cmd: "init",
    graphicsInit: GraphicsInit,
    graphicsActors: GraphicsActors,
    graphicsAnimation: GraphicsAnimation,
    linter: Linter,
    errorHook: ErrorHook,
    inputTransform: InputTransform,
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

export function useRunner() {
  const { ready, running, output, clear, pushErrorCard, inputPrompt, respondToInput, canvasActive, canvasWidth, canvasHeight, canvasScale, lintErrors, _appendOutput, applySuggestion } =
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
  };
}
