import type { PyodideInterface } from "pyodide";
import { WorkerCommand, WorkerEvent, LintDiagnostic } from "./WorkerInterface";
import { executeDrawCommands } from "./canvasRenderer";

let pyodide: PyodideInterface | null = null;
let offscreen: OffscreenCanvas | null = null;
let activePaths: string[] = [];
let pendingInterruptBuffer: Uint8Array | null = null;
let pendingOffscreen: OffscreenCanvas | null = null;

// JS-side asset stores — ImageBitmaps never enter Pyodide
let runAssets: Record<string, ImageBitmap> = {};
let runAnimations: Record<string, { frames: ImageBitmap[]; fps: number }> = {};

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

// Rewrite `input(...)` → `(await _async_input(...))` using paren matching so that
// chained calls like `input("x").strip()` become `(await _async_input("x")).strip()`.
// Skips occurrences inside string literals and comments (best-effort).
function rewriteInputCalls(code: string): string {
  const INPUT_RE = /\binput\s*\(/g;
  let result = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = INPUT_RE.exec(code)) !== null) {
    const start = m.index;
    // Skip if inside a string or comment (simple heuristic: count unescaped quotes before)
    const before = code.slice(0, start);
    const singles = (before.match(/(?<!\\)'/g) ?? []).length;
    const doubles = (before.match(/(?<!\\)"/g) ?? []).length;
    if (singles % 2 !== 0 || doubles % 2 !== 0) continue; // inside a string literal

    const parenStart = start + m[0].length - 1; // position of the '('
    // Find matching ')' by counting depth
    let depth = 1;
    let j = parenStart + 1;
    while (j < code.length && depth > 0) {
      const ch = code[j];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      j++;
    }
    // j is now one past the matching ')'
    const innerContent = code.slice(parenStart + 1, j - 1);
    result += code.slice(last, start);
    result += `(await _async_input(${innerContent}))`;
    last = j;
    INPUT_RE.lastIndex = j;
  }
  result += code.slice(last);
  return result;
}


async function initPyodide(
  p: PyodideInterface,
  graphicsInit: string,
  graphicsActors: string,
  graphicsAnimation: string,
  linter: string,
) {
  console.log("Worker: Writing modules to filesystem...");

  try {
    p.FS.mkdir("/graphics");
  } catch {
    /* already exists */
  }
  try {
    p.FS.mkdir("/graphics/actors");
  } catch {
    /* already exists */
  }
  p.FS.writeFile("/graphics/__init__.py", graphicsInit);
  p.FS.writeFile("/graphics/actors/__init__.py", graphicsActors);
  p.FS.writeFile("/graphics/animation.py", graphicsAnimation);
  p.FS.writeFile("/linter.py", linter);

  console.log("Worker: Files written, running Python initialization...");

  // Register JS callbacks as Pyodide globals
  p.globals.set(
    "_ide_post_output",
    (kind: "stdout" | "stderr", text: string) => {
      post({ type: kind, text });
    },
  );
  p.globals.set("_ide_post_input_request", (prompt: string) => {
    post({ type: "input_request", prompt });
  });
  p.globals.set("_ide_canvas_resize", (width: number, height: number) => {
    if (offscreen) {
      offscreen.width = width;
      offscreen.height = height;
    }
    post({ type: "canvas_resize", width, height });
  });
  p.globals.set(
    "_ide_post_sound",
    (action: "play" | "pause" | "loop" | "stop", name: string) => {
      post({ type: "sound", action, name });
    },
  );

  // _ide_resolve_input: called from JS when input_response arrives
  // Stores a reference so the Python future can be resolved
  p.globals.set("_ide_resolve_input", (value: string) => {
    // Will be replaced in Python with the actual future resolver each time input() is called
    const resolver = p.globals.get("_input_resolve");
    if (resolver) resolver(value);
  });

  // _ide_flush_draw_commands: called from Python each tick with to_js(_draw_commands)
  p.globals.set("_ide_flush_draw_commands", (commands: unknown[]) => {
    if (!offscreen) return;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    executeDrawCommands(ctx, Array.from(commands as Iterable<unknown>), runAssets, runAnimations, offscreen.width, offscreen.height);
  });

  // Expose all callbacks on the js module and inline stdout/input setup
  await p.runPythonAsync(`
import sys
import js
import asyncio
import builtins

js._ide_post_output = _ide_post_output
js._ide_post_input_request = _ide_post_input_request
js._ide_canvas_resize = _ide_canvas_resize
js._ide_resolve_input = _ide_resolve_input
js._ide_flush_draw_commands = _ide_flush_draw_commands
js._ide_post_sound = _ide_post_sound

class _Writer:
    def __init__(self, kind):
        self._kind = kind
        self._buf = ""
    def write(self, s):
        self._buf += s
        if "\\n" in s:
            _ide_post_output(self._kind, self._buf)
            self._buf = ""
    def flush(self):
        if self._buf:
            _ide_post_output(self._kind, self._buf)
            self._buf = ""

sys.stdout = _Writer("stdout")
sys.stderr = _Writer("stderr")

async def _async_input(prompt=""):
    _ide_post_input_request(prompt)
    loop = asyncio.get_event_loop()
    fut = loop.create_future()
    def _resolve(v):
        if not fut.done():
            loop.call_soon_threadsafe(fut.set_result, v)
    globals()["_input_resolve"] = _resolve
    return await fut

builtins.input = _async_input
  `);

  try {
    await p.runPythonAsync(`
import sys
sys.path.insert(0, "/")
import linter
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
  return /^[^#'"]*\b(import graphics|from graphics)\b/m.test(code);
}

async function runGraphicsScript(
  p: PyodideInterface,
  files: Record<string, string>,
  assets: Record<string, ImageBitmap>,
  tilemaps: Record<string, unknown> | undefined,
  animations: Record<string, { frames: ImageBitmap[]; fps: number }> | undefined,
  soundNames: string[] | undefined,
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

  // Store assets JS-side only — do NOT pass bitmaps into Pyodide
  runAssets = assets;
  runAnimations = animations ?? {};

  // Pass only names/metadata into Python (include bitmap dimensions so Actor anchor points work without a collider)
  p.globals.set(
    "_asset_meta",
    Object.entries(assets).map(([name, bm]) => [name, bm.width, bm.height]),
  );
  p.globals.set(
    "_anim_meta",
    Object.entries(animations ?? {}).map(([n, a]) => [n, a.frames.length, a.fps]),
  );
  p.globals.set("_tilemap_data", JSON.stringify(tilemaps ?? {}));
  p.globals.set("_sound_names", soundNames ?? []);
  p.globals.set("_using_graphics", true);

  await p.runPythonAsync(`
import graphics
from graphics.actors import Actor
from types import SimpleNamespace
import json

# Reset actor state from previous runs
Actor._registry.clear()
Actor._id_counter = 0
graphics._loop_generation = graphics._loop_generation + 1
graphics._show_hitboxes = ${showHitboxes ? "True" : "False"}

# Build sprites namespace from asset names + dimensions (no bitmaps).
# Names starting with lib_<pack>_ go into per-pack namespaces
# (assets.<pack>.<name>); other names go into the flat sprites
# namespace (assets.sprites.<name>) used by user project assets.
_sprites_dict = {}
_lib_packs = {}
for _name, _w, _h in _asset_meta.to_py():
    _key = _name.rsplit(".", 1)[0] if "." in _name else _name
    _entry = {"done": True, "name": _name, "width": int(_w), "height": int(_h)}
    if _key.startswith("lib_"):
        _rest = _key[4:]
        _us = _rest.find("_")
        if _us > 0:
            _pack = _rest[:_us]
            _aname = _rest[_us + 1:]
            _lib_packs.setdefault(_pack, {})[_aname] = _entry
            continue
    _sprites_dict[_key] = _entry
_sprites = SimpleNamespace(**_sprites_dict)
_lib_namespaces = {p: SimpleNamespace(**d) for p, d in _lib_packs.items()}

# Build animations namespace from metadata
_anim_ns = {}
for _aname, _fcount, _fps in _anim_meta.to_py():
    from graphics.animation import Animation
    _frames_list = [{"done": True, "anim_name": _aname, "frame_idx": _i} for _i in range(_fcount)]
    _anim_obj = Animation.__new__(Animation)
    _anim_obj.name = _aname
    _anim_obj.fps = _fps
    _anim_obj._frames = _frames_list
    _anim_obj._current_frame = 0
    _anim_obj._last_tick = 0
    _anim_ns[_aname] = _anim_obj

# Build tilemaps from JSON data
_tilemaps_dict = {}
_raw_tm = json.loads(_tilemap_data)
for _tm_name, _tm_data in _raw_tm.items():
    _layers = []
    _layer_by_name = {}
    _tile_size = _tm_data.get("tileSize", 32)
    for _layer_data in _tm_data.get("layers", []):
        _lname = _layer_data.get("name", "")
        _cells_raw = _layer_data.get("cells", {})
        _cells = {}
        for _col_str, _rows in _cells_raw.items():
            _col = int(_col_str)
            _cells[_col] = {}
            for _row_str, _cell_name in _rows.items():
                _cells[_col][int(_row_str)] = _cell_name
        _layer = graphics.TilemapLayer(_lname, _tile_size, _cells, {})
        _layers.append(_layer)
        _layer_by_name[_lname] = _layer
    _areas = _tm_data.get("areas", {}) or {}
    _tilemaps_dict[_tm_name] = graphics.TileMap(_layers, _layer_by_name, _areas)

# Build sounds namespace from name list (URLs live on main thread).
_sounds_ns = {}
for _sname in _sound_names.to_py():
    _sounds_ns[_sname] = graphics.Sound(_sname)

graphics.assets = SimpleNamespace(
    sprites=_sprites,
    tilemaps=SimpleNamespace(**_tilemaps_dict),
    animations=SimpleNamespace(**_anim_ns),
    sounds=SimpleNamespace(**_sounds_ns),
    **_lib_namespaces,
)
  `);

  await p.runPythonAsync(`
graphics._running = False
graphics._stop_requested = False
graphics._reset_run_state()
  `);

  const code = files[entry] ?? "";
  post({ type: "start", canvasActive: true });

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
  tilemaps: Record<string, unknown> | undefined,
  animations: Record<string, { frames: ImageBitmap[]; fps: number }> | undefined,
  soundNames: string[] | undefined,
  entry: string,
  showHitboxes: boolean = false,
) {
  const code = files[entry] ?? "";

  p.globals.set("_using_graphics", false);

  if (usesNewGraphics(code)) {
    await runGraphicsScript(p, files, assets, tilemaps, animations, soundNames, entry, showHitboxes);
    return;
  }

  // Plain Python script — wrap in async def so input() suspends correctly.
  // Pyodide's WebLoop can't re-enter run_until_complete, so we rewrite input(...)
  // as (await _async_input(...)) and wrap the script in an async def.
  // Paren-matching ensures nested calls like int(input("x")) work correctly.
  const transformed = rewriteInputCalls(code);
  const indented = transformed.split('\n').map((l) => '    ' + l).join('\n');
  const asyncCode = `async def __run():\n${indented}\nawait __run()\n`;

  post({ type: "start", canvasActive: false });
  try {
    await p.runPythonAsync(asyncCode);
  } catch (err: unknown) {
    post({ type: "error", error: String(err) });
    post({ type: "result" });
    return;
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
      await initPyodide(p, msg.graphicsInit, msg.graphicsActors, msg.graphicsAnimation, msg.linter);
      console.log("Worker: Initialization complete, posting ready");
      post({ type: "ready" });
    } catch (err: unknown) {
      console.error("Worker: Initialization failed:", err);
      post({ type: "error", error: String(err) });
    }
  } else if (msg.cmd === "attach_canvas") {
    offscreen = msg.canvas;
    if (!pyodide) pendingOffscreen = msg.canvas;
  } else if (msg.cmd === "run") {
    try {
      const p = await ensurePyodide();
      await runScript(p, msg.files, msg.assets, msg.tilemaps, msg.animations, msg.soundNames, msg.entry, msg.showHitboxes);
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
      }
    } catch {
      /* ignore */
    }
  } else if (msg.cmd === "interrupt") {
    if (!pyodide) return;
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
    pyodide.globals.get("_ide_resolve_input")?.(msg.value);
  } else if (msg.cmd === "set_interrupt_buffer") {
    if (pyodide) pyodide.setInterruptBuffer(new Uint8Array(msg.buffer));
    else pendingInterruptBuffer = new Uint8Array(msg.buffer);
  } else if (msg.cmd === "lint") {
    const { reqId } = msg;
    if (!pyodide) {
      post({ type: "lint", diagnostics: [], reqId });
      return;
    }
    try {
      const pyodideGlobals = pyodide.globals;
      pyodideGlobals.set("_lint_code", msg.code);
      pyodideGlobals.set("_lint_filename", msg.filename || "main.py");

      const result = await pyodide.runPythonAsync(
        `import linter; linter.lint(_lint_code, _lint_filename)`,
      );

      const diagnostics: LintDiagnostic[] = result.toJs({ dict_converter: Object.fromEntries });

      pyodideGlobals.delete("_lint_code");
      pyodideGlobals.delete("_lint_filename");

      post({ type: "lint", diagnostics, reqId });
    } catch (err) {
      console.warn("Worker: Lint skipped —", err);
      post({ type: "lint", diagnostics: [], reqId });
    }
  } else if (msg.cmd === "screenshot") {
    const { reqId } = msg;
    if (!offscreen) {
      post({ type: "screenshot", reqId, blob: null });
      return;
    }
    try {
      const blob = await offscreen.convertToBlob({ type: "image/png" });
      post({ type: "screenshot", reqId, blob });
    } catch (err) {
      console.warn("Worker: screenshot failed —", err);
      post({ type: "screenshot", reqId, blob: null });
    }
  }
};
