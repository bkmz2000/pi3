import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { WorkerCommand, WorkerEvent, WorkerEventType, LintDiagnostic } from "./WorkerInterface";
import { useIde } from "../state/IdeState";
import Shim from "../assets/examples/shim.py?raw";
import Transform from "../assets/examples/transform.py?raw";
import Actors from "../assets/examples/actors.py?raw";
import GraphicsInit from "../assets/python/graphics/__init__.py?raw";
import GraphicsActors from "../assets/python/graphics/actors/__init__.py?raw";
import GraphicsActorsConfig from "../assets/python/graphics/actors/config.py?raw";

type OutputLine = {
  kind: "stdout" | "stderr";
  text: string;
};

type RunnerState = {
  ready: boolean;
  running: boolean;
  output: OutputLine[];
  inputPrompt: string | null;
  isP5: boolean;
  canvasActive: boolean;
  lintErrors: LintDiagnostic[];

  _onMessage: (msg: WorkerEvent) => void;
  _appendOutput: (kind: "stdout" | "stderr", text: string) => void;
  setRunning: (running: boolean) => void;
  clear: () => void;
  stop: () => void;
  respondToInput: (value: string) => void;
  setLintErrors: (errors: LintDiagnostic[]) => void;
};

export const useRunnerStore = create<RunnerState>((set) => ({
  ready: false,
  running: false,
  output: [],
  inputPrompt: null,
  isP5: false,
  canvasActive: false,
  lintErrors: [],

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
      case "start": {
        set({
          running: true,
          isP5: msg.isP5,
          canvasActive: msg.canvasActive,
        });
        break;
      }
      case "lint": {
        set({ lintErrors: msg.diagnostics });
        for (const d of msg.diagnostics) {
          set((s) => ({ output: [...s.output, { kind: "stderr", text: `[${d.code}] Line ${d.row + 1}: ${d.message}` }] }));
        }
        break;
      }
      default: {
        const missing: never = msg;
        throw new Error(`missing ${missing}`);
      }
    }
  },

  setRunning: (running) => set({ running }),
  clear: () =>
    set({ output: [], inputPrompt: null, isP5: false, running: false, canvasActive: false, lintErrors: [] }),
  stop: () =>
    set({ inputPrompt: null, isP5: false, running: false, canvasActive: false }),

  respondToInput: (value) => {
    set({ inputPrompt: null });
    getWorker().postMessage({
      cmd: "input_response",
      value,
    } satisfies WorkerCommand);
  },
}));

// --- Worker singleton ---

let worker: Worker | null = null;
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

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

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
    shim: Shim,
    transform: Transform,
    actors: Actors,
    graphicsInit: GraphicsInit,
    graphicsActors: GraphicsActors,
    graphicsActorsConfig: GraphicsActorsConfig,
  } satisfies WorkerCommand);
  return worker;
}

function wireEvents(canvas: HTMLCanvasElement): () => void {
  const w = getWorker();
  const send = (kind: WorkerEventType, data: object) =>
    w.postMessage({ cmd: "event", kind, data } satisfies WorkerCommand);

  const onMouseMove = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    send("mousemove", { x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onMouseDown = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    send("mousedown", {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
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
  const { ready, running, output, clear, inputPrompt, respondToInput, isP5, canvasActive, lintErrors, _appendOutput } =
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
      const { bitmaps, transferables } = await loadAssets(nameToUrl);
      const showHitboxes = useIde.getState().showHitboxes;
      getWorker().postMessage(
        {
          cmd: "run",
          files,
          entry,
          assets: bitmaps,
          showHitboxes,
        } satisfies WorkerCommand,
        transferables,
      );
    },
    [loadAssets],
  );

  const interrupt = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const worker = getWorker();
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "interrupt_ack") {
          worker.removeEventListener("message", handleMessage);
          resolve();
        }
      };
      
      worker.addEventListener("message", handleMessage);
      
      worker.postMessage({ cmd: "interrupt" } satisfies WorkerCommand);

      if (interruptBuffer) {
        interruptBuffer[0] = 2;
        setTimeout(() => {
          if (interruptBuffer) interruptBuffer[0] = 0;
        }, 100);
      }

      useRunnerStore.getState().stop();
      
      setTimeout(() => {
        worker.removeEventListener("message", handleMessage);
        resolve();
      }, 100);
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

  const lint = useCallback((code: string, filename: string) => {
    return new Promise<LintDiagnostic[]>((resolve) => {
      const handler = (e: MessageEvent<WorkerEvent>) => {
        if (e.data.type === "lint") {
          getWorker().removeEventListener("message", handler);
          const diagnostics = e.data.diagnostics;
          useRunnerStore.getState().setLintErrors(diagnostics);
          resolve(diagnostics);
        }
      };
      getWorker().addEventListener("message", handler);
      getWorker().postMessage({ cmd: "lint", code, filename } satisfies WorkerCommand);
    });
  }, []);

  return {
    ready,
    running,
    isP5,
    canvasActive,
    output,
    run,
    interrupt,
    clear,
    attachCanvas,
    inputPrompt,
    respondToInput,
    lint,
    lintErrors,
    _appendOutput,
  };
}
