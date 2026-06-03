import type { PyodideInterface } from "pyodide";
import { WorkerCommand, WorkerEvent, LintDiagnostic, SheetRunPayload, RuntimeError } from "./WorkerInterface";
import { executeDrawCommands } from "./canvasRenderer";

let pyodide: PyodideInterface | null = null;
let offscreen: OffscreenCanvas | null = null;
let activePaths: string[] = [];
let pendingInterruptBuffer: Uint8Array | null = null;
let pendingOffscreen: OffscreenCanvas | null = null;

// JS-side asset stores — ImageBitmaps never enter Pyodide
let runAssets: Record<string, ImageBitmap> = {};

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
  errorHook: string,
) {
  console.log("Worker: Writing modules to filesystem...");

  try {
    p.FS.mkdir("/pi3");
  } catch {
    /* already exists */
  }
  try {
    p.FS.mkdir("/pi3/actors");
  } catch {
    /* already exists */
  }
  p.FS.writeFile("/pi3/__init__.py", graphicsInit);
  p.FS.writeFile("/pi3/actors/__init__.py", graphicsActors);
  p.FS.writeFile("/pi3/animation.py", graphicsAnimation);
  p.FS.writeFile("/linter.py", linter);
  p.FS.writeFile("/error_hook.py", errorHook);

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
    (action: "play" | "pause" | "loop" | "stop" | "volume", name: string, value?: number) => {
      post({ type: "sound", action, name, value });
    },
  );

  // _ide_resolve_input: called from JS when input_response arrives
  // Stores a reference so the Python future can be resolved
  p.globals.set("_ide_resolve_input", (value: string) => {
    // Will be replaced in Python with the actual future resolver each time input() is called
    const resolver = p.globals.get("_input_resolve");
    if (resolver) resolver(value);
  });

  // _ide_post_runtime_error: called from Python _tick when the game loop catches an exception
  p.globals.set("_ide_post_runtime_error", (errorJson: string) => {
    try {
      const error = JSON.parse(errorJson) as RuntimeError;
      post({ type: "runtime_error", error });
    } catch {
      post({ type: "stderr", text: String(errorJson) });
    }
  });

  // _ide_notify_loop_ended: called from _tick when the game loop exits normally (stop requested)
  p.globals.set("_ide_notify_loop_ended", () => {
    post({ type: "result" });
  });

  // _ide_flush_draw_commands: called from Python each tick with to_js(_draw_commands)
  p.globals.set("_ide_flush_draw_commands", (commands: unknown[]) => {
    if (!offscreen) return;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    executeDrawCommands(ctx, Array.from(commands as Iterable<unknown>), runAssets, offscreen.width, offscreen.height);
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
js._ide_post_runtime_error = _ide_post_runtime_error
js._ide_notify_loop_ended = _ide_notify_loop_ended

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

# Back-compat: pi3 is the primary module name; 'graphics' is an alias so older
# projects (and inline heredocs below) keep importing successfully. Submodules
# must be aliased explicitly so 'from graphics.actors import X' resolves to the
# same module object as 'from pi3.actors import X' (otherwise isinstance checks
# across the boundary fail).
import pi3 as _pi3
import pi3.actors as _pi3_actors
import pi3.animation as _pi3_anim
sys.modules['graphics'] = _pi3
sys.modules['graphics.actors'] = _pi3_actors
sys.modules['graphics.animation'] = _pi3_anim
  `);

  try {
    await p.runPythonAsync(`
import sys
sys.path.insert(0, "/")
import linter
import error_hook
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

  // Load Jedi for dot-completion (best-effort, non-fatal).
  // parso is on the Pyodide CDN; jedi is not, so load it directly from PyPI.
  // loadPackage accepts full URLs and skips lock-file integrity for them.
  try {
    const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
    const JEDI_PYPI = "https://files.pythonhosted.org/packages/c0/5a/9cac0c82afec3d09ccd97c8b6502d48f165f9124db81b4bcb90b4af974ee/jedi-0.19.2-py2.py3-none-any.whl";
    await p.loadPackage([
      `${PYODIDE_CDN}parso-0.8.4-py2.py3-none-any.whl`,
      JEDI_PYPI,
    ]);
    await p.runPythonAsync(`
import jedi as _jedi
_jedi_project = _jedi.Project('/', added_sys_path=['/'])
_jedi_available = True
    `);
    console.log("Worker: Jedi loaded");
  } catch (err) {
    console.warn("Worker: Jedi unavailable, dot completion disabled:", err);
    await p.runPythonAsync(`_jedi_available = False`).catch(() => {});
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
  return /^[^#'"]*\b(import (graphics|pi3)|from (graphics|pi3))\b/m.test(code);
}

// ── Error handling: attempt structured classification, fall back to raw ──

function handleExecutionError(err: unknown, p: PyodideInterface) {
  // First: check if the Python error hook already produced a structured result
  try {
    const structuredJs = p.globals.get("_last_structured_error");
    if (structuredJs) {
      const error: RuntimeError = structuredJs.toJs({ dict_converter: Object.fromEntries });
      p.globals.delete("_last_structured_error");
      post({ type: "runtime_error", error });
      return;
    }
  } catch {
    // hook didn't fire or failed — fall through to JS-side classification
  }

  // Fallback: flat error (infrastructure, or hook crashed)
  const raw = String(err);
  post({ type: "error", error: raw });
}

// ── Register known symbols for error_hook suggestion engine ──

async function registerKnownSymbols(p: PyodideInterface) {
  await p.runPythonAsync(`
import error_hook
import graphics
import builtins

_symbols = set()

# Graphics API surface
for name in dir(graphics):
    if not name.startswith("_"):
        _symbols.add(name)

# Colors.* names
for name in dir(graphics.Colors):
    if not name.startswith("_"):
        _symbols.add(name)

# Common Python builtins
_builtin_names = [
    "print", "input", "len", "range", "int", "str", "float", "bool",
    "list", "dict", "set", "tuple", "type", "abs", "min", "max",
    "sum", "round", "sorted", "reversed", "enumerate", "zip",
    "open", "help", "dir", "id", "isinstance", "issubclass",
    "True", "False", "None",
]
for name in _builtin_names:
    _symbols.add(name)

# Common stdlib modules for import-error suggestions
_module_names = [
    "random", "math", "json", "time", "os", "sys", "re",
    "collections", "itertools", "functools", "datetime",
    "statistics", "string", "copy",
]
for name in _module_names:
    _symbols.add(name)

error_hook.register_known_symbols(list(_symbols))
  `);
}

// ── Execution wrappers with structured error handling ──

async function runGraphicsScript(
  p: PyodideInterface,
  files: Record<string, string>,
  assets: Record<string, ImageBitmap>,
  tilemaps: Record<string, unknown> | undefined,
  soundNames: string[] | undefined,
  sheet: SheetRunPayload | undefined,
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

  // Pass only names/metadata into Python (include bitmap dimensions so Actor anchor points work without a collider)
  p.globals.set(
    "_asset_meta",
    Object.entries(assets).map(([name, bm]) => [name, bm.width, bm.height]),
  );
  // Decode each ImageBitmap to RGBA so `graphics.sheet[name]` returns a
  // read/write Sprite in Python. Decoding lives in the worker so the main
  // thread stays unblocked; failure (e.g. tainted bitmap) drops to a
  // transparent buffer rather than aborting the run.
  const assetPixels: Array<[string, number, number, Uint8ClampedArray]> = [];
  for (const [name, bm] of Object.entries(assets)) {
    const w = bm.width;
    const h = bm.height;
    let pixels: Uint8ClampedArray;
    try {
      const off = new OffscreenCanvas(w, h);
      const octx = off.getContext("2d")!;
      octx.drawImage(bm, 0, 0);
      pixels = octx.getImageData(0, 0, w, h).data;
    } catch {
      pixels = new Uint8ClampedArray(w * h * 4);
    }
    assetPixels.push([name, w, h, pixels]);
  }
  p.globals.set("_asset_pixels", assetPixels);
  p.globals.set("_tilemap_data", JSON.stringify(tilemaps ?? {}));
  p.globals.set("_sound_names", soundNames ?? []);

  // Sheet: decode base64 pixels and pass metadata as JSON
  if (sheet) {
    const raw = atob(sheet.pixels);
    const sheetPixels = new Uint8ClampedArray(raw.length);
    for (let i = 0; i < raw.length; i++) sheetPixels[i] = raw.charCodeAt(i);
    p.globals.set("_sheet_pixels", sheetPixels);
    p.globals.set("_sheet_width", sheet.width);
    p.globals.set("_sheet_height", sheet.height);
    p.globals.set("_sheet_meta", JSON.stringify(sheet.sprites));
  } else {
    p.globals.set("_sheet_pixels", null);
    p.globals.set("_sheet_width", 0);
    p.globals.set("_sheet_height", 0);
    p.globals.set("_sheet_meta", "{}");
  }

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

# Build graphics.sheet: a dict of name -> Sprite, with pixels copied from
# the editor-drawn raster (or rasterized SVG). Writes mutate the Python copy
# only; rendering via image(sheet["name"], x, y) uses the live bytes.
_sheet_dict = {}
for _row in _asset_pixels.to_py():
    _aname, _aw, _ah, _apx = _row
    _key = _aname.rsplit(".", 1)[0] if "." in _aname else _aname
    _sheet_dict[_key] = graphics.Sprite(_aw, _ah, _apx)
graphics.sheet = _sheet_dict

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
    sounds=SimpleNamespace(**_sounds_ns),
    **_lib_namespaces,
)
  `);

  // Build graphics.assets.sheet from the sheet payload (tasks 2.3 and 2.4)
  await p.runPythonAsync(`
import json as _json

if _sheet_pixels:
    _sheet_raw = bytearray(_sheet_pixels.to_py())
    _sheet_meta_parsed = _json.loads(_sheet_meta)
    _sheet_ns_dict = {}
    for _sname, _sentry in _sheet_meta_parsed.items():
        _anim_dict = {}
        for _aname, _astrip in _sentry.get("animations", {}).items():
            _sx = int(_astrip["x"])
            _sy = int(_astrip["y"])
            _fw = int(_astrip["frameW"])
            _fh = int(_astrip["frameH"])
            _fc = int(_astrip["frameCount"])
            _frames = []
            for _fi in range(_fc):
                _fx = _sx + _fi * _fw
                _sprite_buf = bytearray(_fw * _fh * 4)
                for _row in range(_fh):
                    _dst = _row * _fw * 4
                    _src = ((_sy + _row) * _sheet_width + _fx) * 4
                    _sprite_buf[_dst:_dst + _fw * 4] = _sheet_raw[_src:_src + _fw * 4]
                _frames.append(graphics.Sprite(_fw, _fh, _sprite_buf))
            _anim_dict[_aname] = graphics.SheetAnimation(_frames)
        _sheet_ns_dict[_sname] = graphics.SpriteEntry(_sname, _anim_dict)
    graphics.assets.sheet = graphics.SheetNamespace(_sheet_ns_dict)
else:
    graphics.assets.sheet = graphics.SheetNamespace({})
  `);

  // Register known symbols for the error hook's suggestion engine
  await registerKnownSymbols(p);

  await p.runPythonAsync(`
graphics._running = False
graphics._stop_requested = False
graphics._reset_run_state()
  `);

  const code = files[entry] ?? "";
  const filename = entry || "main.py";

  // Give _tick access to user code so runtime errors can be classified friendlily
  p.runPython(`import graphics as _g; _g._user_code = ${JSON.stringify(code)}; _g._user_filename = ${JSON.stringify(filename)}`);

  post({ type: "start", canvasActive: true });

  // ── Execute user code with structured error wrapping ──
  // Don't re-raise — let JS read _last_structured_error directly after
  // p.runPythonAsync() completes. The re-raise approach caused p.runPythonAsync()
  // to reject, and by the time the outer catch block called handleExecutionError,
  // p.globals access could fail silently.
  await p.runPythonAsync(`
import error_hook
import json as _json

_errored = False
try:
    exec(${JSON.stringify(code)}, globals())
except Exception as _err:
    _errored = True
    _structured = error_hook.classify_error(_err, ${JSON.stringify(code)}, ${JSON.stringify(filename)})
    _last_structured_error = _structured
    import sys
    sys.stderr.write("\\n" + _structured.get("raw", str(_err)))
  `);

  // Check for structured error first
  const structuredJs = p.globals.get("_last_structured_error");
  if (structuredJs) {
    try {
      const error: RuntimeError = structuredJs.toJs({ dict_converter: Object.fromEntries });
      p.globals.delete("_last_structured_error");
      p.globals.set("_using_graphics", false);
      post({ type: "runtime_error", error });
      post({ type: "result" });
      return;
    } catch {
      // fall through to raw error
    }
  }

  // Only post result if the game loop didn't start — if it's running,
  // _ide_notify_loop_ended will fire when the loop exits naturally.
  const isLoopRunning = p.runPython("import graphics; graphics._running") as boolean;
  if (!isLoopRunning) {
    post({ type: "result" });
  }
}

async function runScript(
  p: PyodideInterface,
  files: Record<string, string>,
  assets: Record<string, ImageBitmap>,
  tilemaps: Record<string, unknown> | undefined,
  soundNames: string[] | undefined,
  sheet: SheetRunPayload | undefined,
  entry: string,
  showHitboxes: boolean = false,
) {
  const code = files[entry] ?? "";

  p.globals.set("_using_graphics", false);

  if (usesNewGraphics(code)) {
    await runGraphicsScript(p, files, assets, tilemaps, soundNames, sheet, entry, showHitboxes);
    return;
  }

  // Register known symbols for the error hook
  await registerKnownSymbols(p);

  // Plain Python script — wrap in async def so input() suspends correctly.
  const transformed = rewriteInputCalls(code);
  const indented = transformed.split('\n').map((l) => '    ' + l).join('\n');
  const filename = entry || "main.py";

  // Build async wrapper with error_hook integration (no re-raise — JS reads _last_structured_error)
  const asyncCode = `
import error_hook
import json as _json

async def __run():
${indented}

_errored = False
try:
    await __run()
except Exception as _err:
    _errored = True
    _structured = error_hook.classify_error(_err, ${JSON.stringify(code)}, ${JSON.stringify(filename)})
    _last_structured_error = _structured
    import sys
    sys.stderr.write("\\n" + _structured.get("raw", str(_err)))
`;

  post({ type: "start", canvasActive: false });
  await p.runPythonAsync(asyncCode);

  // Check for structured error
  const structuredJs = p.globals.get("_last_structured_error");
  if (structuredJs) {
    try {
      const error: RuntimeError = structuredJs.toJs({ dict_converter: Object.fromEntries });
      p.globals.delete("_last_structured_error");
      p.globals.set("_using_graphics", false);
      post({ type: "runtime_error", error });
      post({ type: "result" });
      return;
    } catch {
      // fall through
    }
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
      const errorHookSrc = msg.errorHook;
      await initPyodide(p, msg.graphicsInit, msg.graphicsActors, msg.graphicsAnimation, msg.linter, errorHookSrc);
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
      await runScript(p, msg.files, msg.assets, msg.tilemaps, msg.soundNames, msg.sheet, msg.entry, msg.showHitboxes);
    } catch (err: unknown) {
      const p = pyodide;
      if (p) {
        handleExecutionError(err, p);
      } else {
        post({ type: "error", error: String(err) });
      }
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
  } else if (msg.cmd === "complete") {
    const { reqId, code, line, col } = msg;
    if (!pyodide) { post({ type: "complete", reqId, completions: [] }); return; }
    try {
      pyodide.globals.set("_cq_code", code);
      pyodide.globals.set("_cq_line", line);
      pyodide.globals.set("_cq_col", col);
      const result = await pyodide.runPythonAsync(`
_cq_result = []
if _jedi_available:
    try:
        _s = _jedi.Script(_cq_code, project=_jedi_project)
        for _c in _s.complete(_cq_line, _cq_col):
            if not _c.name.startswith('_'):
                _cq_result.append({'name': _c.name, 'type': _c.type, 'description': _c.description})
    except Exception:
        pass
_cq_result
      `);
      const completions = result.toJs({ dict_converter: Object.fromEntries }) as import("./WorkerInterface").JediCompletion[];
      pyodide.globals.delete("_cq_code");
      pyodide.globals.delete("_cq_line");
      pyodide.globals.delete("_cq_col");
      post({ type: "complete", reqId, completions: completions ?? [] });
    } catch (err) {
      console.warn("Worker: completion failed —", err);
      post({ type: "complete", reqId, completions: [] });
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
