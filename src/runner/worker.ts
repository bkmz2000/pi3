import type { PyodideInterface } from "pyodide";
import { WorkerCommand, WorkerEvent, LintDiagnostic } from "./WorkerInterface";

let pyodide: PyodideInterface | null = null;
let offscreen: OffscreenCanvas | null = null;
let activePaths: string[] = [];
let pendingInterruptBuffer: Uint8Array | null = null;
let pendingOffscreen: OffscreenCanvas | null = null;

interface RuffRawDiagnostic {
  code: string;
  message: string;
  start_location: { row: number; column: number };
  end_location: { row: number; column: number };
}

type RuffWorkspace = {
  check(code: string): RuffRawDiagnostic[];
};

let ruffWorkspace: RuffWorkspace | null = null;
let ruffInitPromise: Promise<void> | null = null;

async function initRuff(): Promise<void> {
  if (ruffWorkspace) return;
  if (ruffInitPromise) return ruffInitPromise;

  ruffInitPromise = (async () => {
    try {
      const CDN = "https://cdn.jsdelivr.net/npm/@astral-sh/ruff-wasm-web@0.15.8/";
      const { default: init, Workspace, PositionEncoding } = await import(/* @vite-ignore */ `${CDN}ruff_wasm.js`);
      await init();
      ruffWorkspace = new Workspace({
        "indent-width": 4,
        "line-length": 100,
        lint: {
          select: ["E", "F", "W"],
          ignore: ["W292", "F401", "F403", "F405"],
        },
      }, PositionEncoding.Utf16);
      console.log("Worker: Ruff initialized");
    } catch (err) {
      console.error("Worker: Failed to initialize Ruff:", err);
    }
  })();

  return ruffInitPromise;
}

function post(e: WorkerEvent) {
  self.postMessage(e);
}

self.addEventListener("error", (e) =>
  console.error("Worker uncaught error:", e),
);
self.addEventListener("unhandledrejection", (e) =>
  console.error("Worker unhandled rejection:", e.reason),
);

async function ensurePyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide;

  const CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const local = new URL(
    `${import.meta.env?.BASE_URL ?? "/"}pyodide/`,
    self.location.origin,
  ).toString();

  for (const base of [local, CDN]) {
    try {
      const { loadPyodide } = await import(
        /* @vite-ignore */ `${base}pyodide.mjs`
      );
      pyodide = await loadPyodide({ indexURL: base });
      return pyodide!;
    } catch {
      /* try next */
    }
  }
  throw new Error("Failed to load Pyodide");
}

async function initPyodide(
  p: PyodideInterface,
  shim: string,
  transform: string,
  actors: string,
  graphicsInit: string,
  graphicsActors: string,
  graphicsActorsConfig: string,
) {
  console.log("Worker: Writing modules to filesystem...");
  p.FS.writeFile("/_shim_p5.py", shim);
  p.FS.writeFile("/transform.py", transform);
  p.FS.writeFile("/actors.py", actors);
  
  // Write new graphics package
  try {
    p.FS.mkdir("/graphics");
  } catch {
    // Directory may already exist
  }
  try {
    p.FS.mkdir("/graphics/actors");
  } catch {
    // Directory may already exist
  }
  p.FS.writeFile("/graphics/__init__.py", graphicsInit);
  p.FS.writeFile("/graphics/actors/__init__.py", graphicsActors);
  p.FS.writeFile("/graphics/actors/config.py", graphicsActorsConfig);
  
  console.log("Worker: Files written, running Python initialization...");

  p.globals.set(
    "_ide_post_output",
    (kind: "stdout" | "stderr", text: string) => {
      post({ type: kind, text });
    },
  );
  p.globals.set("_ide_post_input_request", (prompt: string) => {
    post({ type: "input_request", prompt });
  });

  try {
    await p.runPythonAsync(`
import sys
sys.path.insert(0, "/")
import _shim_p5 as _shim
_shim._ide_init(_ide_post_output, _ide_post_input_request)
    `);
    console.log("Worker: Python initialization completed successfully");
  } catch (err: unknown) {
    console.error("Worker: Python initialization failed:", err);
    throw err;
  }

  if (pendingInterruptBuffer) {
    p.setInterruptBuffer(pendingInterruptBuffer);
    pendingInterruptBuffer = null;
  }
  if (pendingOffscreen) {
    offscreen = pendingOffscreen;
    p.globals.set("__ide_canvas", pendingOffscreen);
    pendingOffscreen = null;
  }
}

function prepareFiles(p: PyodideInterface, files: Record<string, string>) {
  for (const path of activePaths) {
    try {
      p.FS.unlink(path);
    } catch {
      /* ignore */
    }
  }
  activePaths = [];
  for (const [name, content] of Object.entries(files)) {
    p.FS.writeFile(name, content);
    activePaths.push(name);
  }
}

function usesNewGraphics(code: string): boolean {
  return code.includes("import graphics") || code.includes("from graphics");
}

async function runGraphicsScript(
  p: PyodideInterface,
  files: Record<string, string>,
  assets: Record<string, ImageBitmap>,
  entry: string,
  showHitboxes: boolean = false,
) {
  prepareFiles(p, files);
  
  if (!offscreen) {
    post({
      type: "error",
      error: "No canvas attached. Call attachCanvas first.",
    });
    return;
  }

  // Assets are already ImageBitmaps created in the main thread
  const assetsEntries = Object.entries(assets);
  p.globals.set("_asset_bitmaps", assetsEntries);
  p.globals.set("_using_graphics", true);
  
  await p.runPythonAsync(`
def setup(f):
    return f

import graphics
graphics._init(__ide_canvas)

# Clear state from previous runs BEFORE user code runs
from graphics.actors import Actor
Actor._registry.clear()
Actor._id_counter = 0
graphics._loop_generation = graphics._loop_generation + 1
graphics._show_hitboxes = ${showHitboxes ? "True" : "False"}

from types import SimpleNamespace
_sprites = _shim._ide_build_assets(_asset_bitmaps).sprites
graphics.assets = SimpleNamespace(sprites=_sprites)
  `);

  // Now set proper initial state AFTER clear, but BEFORE user code
  // This ensures old ticks (if any) will see -999 and return
  await p.runPythonAsync(`
graphics._running = False
graphics._stop_requested = False
graphics._loop_generation = graphics._loop_generation + 1
graphics._every_handlers = {}
graphics._key_handlers = {}
graphics._mouse_handlers = []
graphics._collision_handlers = []
graphics._frame_count = 0
  `);

  const code = files[entry] ?? "";
  post({ type: "start", isP5: false, canvasActive: true });
  
  try {
    await p.runPythonAsync(code);
  } catch (err: unknown) {
    post({ type: "error", error: String(err) });
    p.globals.set("_using_graphics", false);
    post({ type: "result" });
  }
}

async function runScript(
  p: PyodideInterface,
  files: Record<string, string>,
  assets: Record<string, ImageBitmap>,
  entry: string,
  showHitboxes: boolean = false,
) {
  const code = files[entry] ?? "";
  
  p.globals.set("_using_graphics", false);

  if (usesNewGraphics(code)) {
    await runGraphicsScript(p, files, assets, entry, showHitboxes);
    return;
  }

  let transformed: string;
  let isP5: boolean;

  try {
    const result = p
      .runPython(`transform(${JSON.stringify(code)}, ${JSON.stringify(entry)})`)
      .toJs({ dict_converter: Object.fromEntries });
    transformed = result.code;
    isP5 = result.metadata.is_p5;
    post({ type: "start", isP5, canvasActive: isP5 });
  } catch (err: unknown) {
    post({ type: "error", error: `Transform failed: ${err}` });
    return;
  }

  if (isP5) {
    if (!offscreen) {
      post({
        type: "error",
        error: "No canvas attached. Call attachCanvas first.",
      });
      return;
    }
    // Assets are already ImageBitmaps created in the main thread
    const assetsEntries = Object.entries(assets);
    p.globals.set("_asset_bitmaps", assetsEntries);
    await p.runPythonAsync(
      `assets = _shim._ide_build_assets(_asset_bitmaps.to_py())`,
    );

    await p.runPythonAsync(
      `_shim._ide_run_p5(__ide_canvas, ${JSON.stringify(transformed)}, ${JSON.stringify(entry)}, assets)`,
    );
  } else {
    await p.runPythonAsync(transformed);
  }

  post({ type: "result" });
}

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const msg = e.data;

  if (msg.cmd === "init") {
    try {
      console.log("Worker: Initializing Pyodide...");
      const p = await ensurePyodide();
      console.log("Worker: Pyodide loaded, initializing modules...");
      await initPyodide(p, msg.shim, msg.transform, msg.actors, msg.graphicsInit, msg.graphicsActors, msg.graphicsActorsConfig);
      console.log("Worker: Initialization complete, posting ready");
      post({ type: "ready" });
    } catch (err: unknown) {
      console.error("Worker: Initialization failed:", err);
      post({ type: "error", error: String(err) });
    }
  } else if (msg.cmd === "attach_canvas") {
    offscreen = msg.canvas;
    if (pyodide) pyodide.globals.set("__ide_canvas", offscreen);
    else pendingOffscreen = msg.canvas;
  } else if (msg.cmd === "run") {
    try {
      const p = await ensurePyodide();
      await runScript(p, msg.files, msg.assets, msg.entry, msg.showHitboxes);
    } catch (err: unknown) {
      post({ type: "error", error: String(err) });
      post({ type: "result" });
    }
  } else if (msg.cmd === "event") {
    if (!pyodide) return;
    try {
      const usingGraphics = pyodide.globals.get("_using_graphics");
      if (usingGraphics) {
        pyodide.runPython(`graphics._inject_event("${msg.kind}", ${JSON.stringify(msg.data)})`);
      } else {
        const shim = pyodide.globals.get("_shim");
        shim?._inject_event(msg.kind, msg.data);
        shim?.destroy();
      }
    } catch {
      /* ignore */
    }
  } else if (msg.cmd === "interrupt") {
    if (!pyodide) return;
    const shim = pyodide.globals.get("_shim");
    try {
      shim?.noLoop();
    } catch {
      /* ignore */
    }
    try {
      const usingGraphics = pyodide.globals.get("_using_graphics");
      if (usingGraphics) {
        pyodide.runPython(`graphics.stop()`);
        pyodide.runPython(`graphics._clear()`);
      }
    } catch {
      /* ignore */
    }
    post({ type: "interrupt_ack" });
  } else if (msg.cmd === "input_response") {
    if (!pyodide) return;
    const shim = pyodide.globals.get("_shim");
    const console_ = shim?._ide_console;
    console_?.resolve(msg.value);
    shim?.destroy();
  } else if (msg.cmd === "set_interrupt_buffer") {
    if (pyodide) pyodide.setInterruptBuffer(new Uint8Array(msg.buffer));
    else pendingInterruptBuffer = new Uint8Array(msg.buffer);
  } else if (msg.cmd === "lint") {
    await initRuff();
    if (!ruffWorkspace) {
      post({ type: "lint", diagnostics: [] });
      return;
    }
    try {
      const rawDiagnostics = ruffWorkspace.check(msg.code);
      const diagnostics: LintDiagnostic[] = rawDiagnostics.map((d) => ({
        code: d.code || "",
        message: d.message,
        row: d.start_location.row - 1,
        column: d.start_location.column,
        endRow: d.end_location.row - 1,
        endColumn: d.end_location.column,
        severity: d.code?.startsWith("E") ? "error" : d.code?.startsWith("F") ? "error" : "warning",
      }));
      post({ type: "lint", diagnostics });
    } catch (err) {
      console.error("Worker: Lint error:", err);
      post({ type: "lint", diagnostics: [] });
    }
  }
};
