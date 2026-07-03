import type { PyodideInterface } from "pyodide";
import { WorkerCommand, WorkerEvent, LintDiagnostic, SheetRunPayload, RuntimeError } from "./WorkerInterface";
import { PYODIDE_CDN } from "./pyodideVersion";
import { executeDrawCommands } from "./canvasRenderer";

let pyodide: PyodideInterface | null = null;
let offscreen: OffscreenCanvas | null = null;
let activePaths: string[] = [];
let pendingInterruptBuffer: Uint8Array | null = null;
let pendingOffscreen: OffscreenCanvas | null = null;

// JS-side asset stores — ImageBitmaps never enter Pyodide
let runAssets: Record<string, ImageBitmap> = {};

// DBG-4: step-back ring buffer
const MAX_REWIND_FRAMES = 200;
const MAX_REWIND_BYTES = 16 * 1024 * 1024; // 16 MB
const REWIND_INTERVAL_MS = 50; // 20 fps throttle
let rewindArmed = false;
let rewindBuf: { frame: number; blob: Blob; bytes: number; watches: { label: string; value: string }[] }[] = [];
let rewindBytes = 0;
let lastWatchValues: { label: string; value: string }[] = [];
let rewindLastCapture = 0;
let stepBlobPending = false;

function maybeCaptureRewindFrame(frameNum: number) {
  if (!rewindArmed || !offscreen) return;
  const now = Date.now();
  if (now - rewindLastCapture < REWIND_INTERVAL_MS) return;
  rewindLastCapture = now;
  const capturedFrame = frameNum;
  offscreen.convertToBlob({ type: "image/webp", quality: 0.8 })
    .catch(() => offscreen!.convertToBlob({ type: "image/png" }))
    .then((blob) => {
      const bytes = blob.size;
      while (rewindBuf.length >= MAX_REWIND_FRAMES || (rewindBytes + bytes > MAX_REWIND_BYTES && rewindBuf.length > 0)) {
        const evicted = rewindBuf.shift();
        if (evicted) rewindBytes -= evicted.bytes;
      }
      rewindBuf.push({ frame: capturedFrame, blob, bytes, watches: lastWatchValues });
      rewindBytes += bytes;
      if (stepBlobPending) {
        stepBlobPending = false;
        post({ type: "frame_history", frames: rewindBuf.map(({ frame, blob: b, watches }) => ({ frame, blob: b, watches })) });
      }
    })
    .catch(() => {});
}

function clearRewindBuf() {
  rewindBuf = [];
  rewindBytes = 0;
  rewindLastCapture = 0;
  stepBlobPending = false;
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

  const CDN = PYODIDE_CDN;
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
  graphicsInit: string,
  graphicsActors: string,
  graphicsAnimation: string,
  graphicsManifest: string,
  graphicsErrors: string,
  graphicsState: string,
  graphicsStateInternal: string,
  graphicsColor: string,
  graphicsVec: string,
  graphicsSheet: string,
  graphicsUtils: string,
  graphicsLightingHelpers: string,
  graphicsSprites: string,
  linter: string,
  errorHook: string,
  inputTransform: string,
  watchTransform: string,
  syntaxHints: string,
  pi3Init: string,
  pi3Debug: string,
  debugTransform: string,
  pi3Testing: string,
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
  p.FS.writeFile("/graphics/_manifest.py", graphicsManifest);
  p.FS.writeFile("/graphics/_errors.py", graphicsErrors);
  p.FS.writeFile("/graphics/_state_ns.py", graphicsState);
  p.FS.writeFile("/graphics/_state.py", graphicsStateInternal);
  p.FS.writeFile("/graphics/_color.py", graphicsColor);
  p.FS.writeFile("/graphics/_vec.py", graphicsVec);
  p.FS.writeFile("/graphics/_sheet.py", graphicsSheet);
  p.FS.writeFile("/graphics/_utils.py", graphicsUtils);
  p.FS.writeFile("/graphics/_lighting_helpers.py", graphicsLightingHelpers);
  p.FS.writeFile("/graphics/_sprites.py", graphicsSprites);
  p.FS.writeFile("/linter.py", linter);
  p.FS.writeFile("/error_hook.py", errorHook);
  p.FS.writeFile("/input_transform.py", inputTransform);
  p.FS.writeFile("/watch_transform.py", watchTransform);
  p.FS.writeFile("/syntax_hints.py", syntaxHints);
  try { p.FS.mkdir("/pi3"); } catch { /* already exists */ }
  p.FS.writeFile("/pi3/__init__.py", pi3Init);
  p.FS.writeFile("/pi3/debug.py", pi3Debug);
  p.FS.writeFile("/pi3/testing.py", pi3Testing);
  p.FS.writeFile("/debug_transform.py", debugTransform);

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
  // sync with RuntimeError in WorkerInterface.ts — fallback must never produce console text
  p.globals.set("_ide_post_runtime_error", (errorJson: string) => {
    try {
      const error = JSON.parse(errorJson) as RuntimeError;
      post({ type: "runtime_error", error });
    } catch {
      post({
        type: "error",
        payload: {
          message: "runtime error payload was not valid JSON",
          stack: String(errorJson).slice(0, 500),
          phase: "exec",
        },
      });
    }
  });

  // _ide_notify_loop_ended: called from _tick when the game loop exits normally (stop requested)
  p.globals.set("_ide_notify_loop_ended", () => {
    // A3: drain buffered stdout/stderr so a trailing `print("x", end="")` doesn't vanish.
    try { p.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()"); } catch { /* ignore */ }
    post({ type: "result" });
  });

  // _ide_post_watch_values: called from Python after each tick with JSON-encoded watch entries
  p.globals.set("_ide_post_watch_values", (json: string) => {
    const data = JSON.parse(json) as { values: { label: string; value: string }[]; frame: number };
    lastWatchValues = data.values;
    post({ type: "watch", values: data.values, frame: data.frame });
  });

  // _ide_post_debug_frame: called from Python pi3.debug.show() with a JSON-encoded frame
  p.globals.set("_ide_post_debug_frame", (frameJson: string) => {
    try {
      const frame = JSON.parse(frameJson);
      post({ type: "debug_frame", frame });
    } catch { /* ignore malformed debug frame */ }
  });

  // _ide_flush_draw_commands: called from Python each tick with to_js(_draw_commands).
  // frameNum >= 0 on the final (post-main) flush; -1 on the pre-main flush (not captured).
  p.globals.set("_ide_flush_draw_commands", (commands: unknown[], frameNum: number = -1) => {
    if (!offscreen) return;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    executeDrawCommands(ctx, Array.from(commands as Iterable<unknown>), runAssets, offscreen.width, offscreen.height);
    if (frameNum >= 0) maybeCaptureRewindFrame(frameNum);
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
js._ide_post_watch_values = _ide_post_watch_values
js._ide_post_debug_frame = _ide_post_debug_frame

class _Writer:
    def __init__(self, kind):
        self._kind = kind
        self._buf = ""
    def write(self, s):
        self._buf += s
        # A3: flush on newline OR at soft boundaries; also expose flush() so
        # _ide_notify_loop_ended / post-runScript teardown can drain the tail.
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
  return /^[^#'"]*\b(import graphics|from graphics)\b/m.test(code);
}

// ── Error handling: attempt structured classification, fall back to raw ──

function handleExecutionError(err: unknown, p: PyodideInterface) {
  // First: check if the Python error hook already produced a structured result
  try {
    const structuredJs = p.globals.get("_last_structured_error");
    if (structuredJs) {
      try {
        const error: RuntimeError = structuredJs.toJs({ dict_converter: Object.fromEntries });
        post({ type: "runtime_error", error });
        return;
      } finally {
        // A4: always clear so a toJs() failure doesn't leak the error into the next run.
        try { p.globals.delete("_last_structured_error"); } catch { /* ignore */ }
      }
    }
  } catch {
    // hook didn't fire or failed — fall through to JS-side classification
  }

  // Fallback: flat error (infrastructure, or hook crashed).
  // Never coerce an un-narrowed value with String() — plain objects yield [object Object].
  const e = err instanceof Error ? err : null;
  const msg = e?.message ?? (typeof err === "string" ? err : "Execution error");
  post({ type: "error", payload: { message: msg, stack: e?.stack, phase: "exec" } });
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
  showActorInfo: boolean = false,
) {
  prepareFiles(p, files);

  if (!offscreen) {
    post({ type: "error", payload: { message: "No canvas attached. Call attachCanvas first.", phase: "init" } });
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
# _loop_generation is bumped once inside graphics._run(); do not increment
# here or in _reset_run_state (A2).
graphics._state._show_hitboxes = ${showHitboxes ? "True" : "False"}
graphics._state._show_actor_info = ${showActorInfo ? "True" : "False"}

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
from graphics import _state as _gs
_gs._debug_slots.clear()
_gs._debug_frames.clear()
_gs._debug_fresh_slots.clear()
`);

  await p.runPythonAsync(`
graphics._state._running = False
graphics._state._stop_requested = False
graphics._reset_run_state()
  `);

  const code = files[entry] ?? "";
  const filename = entry || "main.py";

  // Give _tick access to user code so runtime errors can be classified friendlily
  p.runPython(`import graphics as _g; _g._state._user_code = ${JSON.stringify(code)}; _g._state._user_filename = ${JSON.stringify(filename)}`);

  // DBG-4: arm ring buffer for this run
  rewindArmed = true;
  clearRewindBuf();
  lastWatchValues = [];

  // Apply watch auto-label transform (watch(x) → watch('x', x))
  p.globals.set("_transform_source", code);
  const watchTransformed: string = await p.runPythonAsync(
    `import watch_transform; watch_transform.transform(_transform_source)`
  );
  p.globals.delete("_transform_source");

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
    exec(${JSON.stringify(watchTransformed)}, globals())
except KeyboardInterrupt:
    pass  # stop signal — no error output, no traceback
except BaseException as _err:
    _errored = True
    _structured = error_hook.classify_error(_err, ${JSON.stringify(code)}, ${JSON.stringify(filename)})
    _last_structured_error = _structured
  `);

  // Check for structured error first
  const structuredJs = p.globals.get("_last_structured_error");
  if (structuredJs) {
    try {
      try {
        const error: RuntimeError = structuredJs.toJs({ dict_converter: Object.fromEntries });
        p.globals.set("_using_graphics", false);
        post({ type: "runtime_error", error });
        post({ type: "result" });
        return;
      } catch {
        // fall through to raw error
      }
    } finally {
      // A4: always delete, even if toJs() throws — otherwise the stale error
      // resurfaces on the next run.
      try { p.globals.delete("_last_structured_error"); } catch { /* ignore */ }
    }
  }

  // Only post result if the game loop didn't start — if it's running,
  // _ide_notify_loop_ended will fire when the loop exits naturally.
  const isLoopRunning = p.runPython("import graphics; graphics._running") as boolean;
  if (!isLoopRunning) {
    try {
      await p.runPythonAsync(`
try:
    from graphics import _state as _gs
    if _gs._debug_fresh_slots:
        from pi3 import debug as _pi3d
        _pi3d.show()
except Exception:
    pass
`);
    } catch { /* never crash on debug cleanup */ }
    // A3: drain trailing stdout/stderr.
    try { p.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()"); } catch { /* ignore */ }
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
  showActorInfo: boolean = false,
) {
  const code = files[entry] ?? "";

  p.globals.set("_using_graphics", false);

  if (usesNewGraphics(code)) {
    await runGraphicsScript(p, files, assets, tilemaps, soundNames, sheet, entry, showHitboxes, showActorInfo);
    return;
  }

  // Register known symbols for the error hook
  await registerKnownSymbols(p);

  // Plain Python script — wrap in async def so input() suspends correctly.
  // Use AST-based transform so string literals and comments are never touched.
  p.globals.set("_transform_source", code);
  const transformed: string = await p.runPythonAsync(
    `import input_transform; input_transform.transform(_transform_source)`
  );
  p.globals.delete("_transform_source");
  const filename = entry || "main.py";

  // Pre-check: compile user code to catch SyntaxErrors before embedding in asyncCode.
  // When user code has a SyntaxError, Python compiles the whole asyncCode string at
  // compile time — before the try/except block executes — so the exception escapes to
  // JS without ever reaching classify_error. Running compile() here first catches it
  // and routes it through the friendly classifier (e.g. grammar.missingColon).
  await p.runPythonAsync(`import error_hook as _eh
try:
    compile(${JSON.stringify(transformed)}, ${JSON.stringify(filename)}, 'exec')
except SyntaxError as _se:
    _last_structured_error = _eh.classify_error(_se, ${JSON.stringify(code)}, ${JSON.stringify(filename)})`);
  {
    const preCheckErr = p.globals.get("_last_structured_error");
    if (preCheckErr) {
      try {
        try {
          const error: RuntimeError = preCheckErr.toJs({ dict_converter: Object.fromEntries });
          post({ type: "start", canvasActive: false });
          post({ type: "runtime_error", error });
          post({ type: "result" });
          return;
        } catch { /* fall through to asyncCode path */ }
      } finally {
        // A4: guarantee clear so a subsequent asyncCode path doesn't inherit it.
        try { p.globals.delete("_last_structured_error"); } catch { /* ignore */ }
      }
    }
  }

  const indented = transformed.split('\n').map((l) => '    ' + l).join('\n');

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
`;

  await p.runPythonAsync(`
from graphics import _state as _gs
_gs._debug_slots.clear()
_gs._debug_frames.clear()
_gs._debug_fresh_slots.clear()
`);

  post({ type: "start", canvasActive: false });
  await p.runPythonAsync(asyncCode);

  // Check for structured error
  const structuredJs = p.globals.get("_last_structured_error");
  if (structuredJs) {
    try {
      try {
        const error: RuntimeError = structuredJs.toJs({ dict_converter: Object.fromEntries });
        p.globals.set("_using_graphics", false);
        post({ type: "runtime_error", error });
        post({ type: "result" });
        return;
      } catch {
        // fall through
      }
    } finally {
      // A4: always delete so failure to convert doesn't poison the next run.
      try { p.globals.delete("_last_structured_error"); } catch { /* ignore */ }
    }
  }

  try {
    await p.runPythonAsync(`
try:
    from graphics import _state as _gs
    if _gs._debug_fresh_slots:
        from pi3 import debug as _pi3d
        _pi3d.show()
except Exception:
    pass
`);
  } catch { /* never crash on debug cleanup */ }

  // A3: drain trailing stdout/stderr.
  try { p.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()"); } catch { /* ignore */ }
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
      await initPyodide(p, msg.graphicsInit, msg.graphicsActors, msg.graphicsAnimation, msg.graphicsManifest, msg.graphicsErrors, msg.graphicsState, msg.graphicsStateInternal, msg.graphicsColor, msg.graphicsVec, msg.graphicsSheet, msg.graphicsUtils, msg.graphicsLightingHelpers, msg.graphicsSprites, msg.linter, errorHookSrc, msg.inputTransform, msg.watchTransform, msg.syntaxHints, msg.pi3Init, msg.pi3Debug, msg.debugTransform, msg.pi3Testing);
      console.log("Worker: Initialization complete, posting ready");
      post({ type: "ready" });
    } catch (err: unknown) {
      console.error("Worker: Initialization failed:", err);
      const e = err instanceof Error ? err : null;
      post({ type: "error", payload: { message: e?.message ?? "Initialization failed", stack: e?.stack, phase: "init" } });
    }
  } else if (msg.cmd === "attach_canvas") {
    offscreen = msg.canvas;
    if (!pyodide) pendingOffscreen = msg.canvas;
  } else if (msg.cmd === "run") {
    try {
      const p = await ensurePyodide();
      await runScript(p, msg.files, msg.assets, msg.tilemaps, msg.soundNames, msg.sheet, msg.entry, msg.showHitboxes, msg.showActorInfo);
    } catch (err: unknown) {
      const errStr = String(err);
      // KeyboardInterrupt (stop button) — not an error, just a clean stop
      if (errStr.includes("KeyboardInterrupt")) {
        post({ type: "stdout", text: "Program stopped." });
        post({ type: "result" });
      } else {
        const p = pyodide;
        if (p) {
          handleExecutionError(err, p);
        } else {
          const e = err instanceof Error ? err : null;
          post({ type: "error", payload: { message: e?.message ?? errStr, stack: e?.stack, phase: "exec" } });
        }
        post({ type: "result" });
      }
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
    rewindArmed = false;
    clearRewindBuf();
    // A3: drain trailing stdout/stderr so the last print before interrupt survives.
    try { pyodide.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()"); } catch { /* ignore */ }
    post({ type: "interrupt_ack" });
  } else if (msg.cmd === "pause") {
    if (!pyodide) return;
    try { pyodide.runPython("import graphics; graphics._pause()"); } catch { /* ignore */ }
    if (rewindBuf.length > 0) {
      post({ type: "frame_history", frames: rewindBuf.map(({ frame, blob, watches }) => ({ frame, blob, watches })) });
    }
  } else if (msg.cmd === "resume") {
    if (!pyodide) return;
    try { pyodide.runPython("import graphics; graphics._resume()"); } catch { /* ignore */ }
  } else if (msg.cmd === "step") {
    if (!pyodide) return;
    try { pyodide.runPython("import graphics; graphics._step()"); } catch { /* ignore */ }
    stepBlobPending = true;
  } else if (msg.cmd === "set_speed") {
    if (!pyodide) return;
    try { pyodide.runPython(`import graphics; graphics._set_speed(${msg.divisor})`); } catch { /* ignore */ }
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
  } else if (msg.cmd === "runGenerator") {
    const { generatorPy, slug, reqId } = msg;
    if (!pyodide) {
      post({ type: "generator_error", error: "Pyodide not ready", reqId });
      return;
    }
    try {
      pyodide.globals.set("_gen_src", generatorPy);
      pyodide.globals.set("_gen_slug", slug);
      const stdout = await pyodide.runPythonAsync(`
import sys, io, linecache
_gen_filename = '<pi3_generator>'
linecache.cache[_gen_filename] = (len(_gen_src), None, _gen_src.splitlines(keepends=True), _gen_filename)
import pi3.testing as _pi3t
_pi3t.seed(_gen_slug)
_old_stdout = sys.stdout
_gen_buf = io.StringIO()
sys.stdout = _gen_buf
try:
    exec(compile(_gen_src, _gen_filename, 'exec'), {})
finally:
    sys.stdout = _old_stdout
_gen_buf.getvalue()
      `);
      pyodide.globals.delete("_gen_src");
      pyodide.globals.delete("_gen_slug");
      post({ type: "generator_result", stdout: String(stdout), reqId });
    } catch (err) {
      pyodide.globals.delete("_gen_src");
      pyodide.globals.delete("_gen_slug");
      // Pyodide PythonError.message includes the formatted traceback; other errors fall back to String().
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
      post({ type: "generator_error", error: message, reqId });
    }
  } else if (msg.cmd === "runReference") {
    const { referencePy, fieldsJson, reqId } = msg;
    if (!pyodide) {
      post({ type: "reference_error", error: "Pyodide not ready", reqId });
      return;
    }
    try {
      pyodide.globals.set("_ref_src", referencePy);
      pyodide.globals.set("_ref_fields_json", fieldsJson);
      const expected = await pyodide.runPythonAsync(`
import sys, io, json, types, linecache
_ref_fields = json.loads(_ref_fields_json)
_ref_test = types.SimpleNamespace(**_ref_fields)
_ref_filename = '<pi3_reference>'
linecache.cache[_ref_filename] = (len(_ref_src), None, _ref_src.splitlines(keepends=True), _ref_filename)
_ref_ns = {}
exec(compile(_ref_src, _ref_filename, 'exec'), _ref_ns)
_old_stdout = sys.stdout
_ref_buf = io.StringIO()
sys.stdout = _ref_buf
try:
    _ref_result = _ref_ns['solution'](_ref_test)
    if _ref_result is not None:
        print(_ref_result)
finally:
    sys.stdout = _old_stdout
_ref_buf.getvalue().rstrip('\\n')
      `);
      pyodide.globals.delete("_ref_src");
      pyodide.globals.delete("_ref_fields_json");
      post({ type: "reference_result", expected: String(expected), reqId });
    } catch (err) {
      pyodide.globals.delete("_ref_src");
      pyodide.globals.delete("_ref_fields_json");
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
      post({ type: "reference_error", error: message, reqId });
    }
  } else if (msg.cmd === "runChecker") {
    const { checkerPy, fieldsJson, studentOutput, expectedOutput, reqId } = msg;
    if (!pyodide) {
      post({ type: "checker_error", error: "Pyodide not ready", reqId });
      return;
    }
    try {
      pyodide.globals.set("_chk_src", checkerPy);
      pyodide.globals.set("_chk_fields_json", fieldsJson);
      pyodide.globals.set("_chk_student_output", studentOutput);
      pyodide.globals.set("_chk_expected_output", expectedOutput);
      const passed = await pyodide.runPythonAsync(`
import json, types, linecache
_chk_fields = json.loads(_chk_fields_json) if _chk_fields_json else {}
_chk_test = types.SimpleNamespace(**_chk_fields)
_chk_filename = '<pi3_checker>'
linecache.cache[_chk_filename] = (len(_chk_src), None, _chk_src.splitlines(keepends=True), _chk_filename)
_chk_ns = {}
exec(compile(_chk_src, _chk_filename, 'exec'), _chk_ns)
bool(_chk_ns['check'](_chk_test, _chk_student_output, _chk_expected_output))
      `);
      pyodide.globals.delete("_chk_src");
      pyodide.globals.delete("_chk_fields_json");
      pyodide.globals.delete("_chk_student_output");
      pyodide.globals.delete("_chk_expected_output");
      post({ type: "checker_result", passed: Boolean(passed), reqId });
    } catch (err) {
      pyodide.globals.delete("_chk_src");
      pyodide.globals.delete("_chk_fields_json");
      pyodide.globals.delete("_chk_student_output");
      pyodide.globals.delete("_chk_expected_output");
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
      post({ type: "checker_error", error: message, reqId });
    }
  }
};
