export type WorkerEventType =
  | "mousemove"
  | "mousedown"
  | "mouseup"
  | "keydown"
  | "keyup";

export type InputEventData = {
  x?: number;
  y?: number;
  button?: number;
  key?: string;
  keyCode?: number;
};

export type SheetRunPayload = {
  pixels: string;   // base64 RGBA
  width: number;
  height: number;
  sprites: Record<string, {
    animations: Record<string, {
      x: number; y: number;
      frameW: number; frameH: number;
      frameCount: number;
    }>;
  }>;
};

export type WorkerCommand =
  | { cmd: "init"; graphicsInit: string; graphicsActors: string; graphicsAnimation: string; graphicsManifest: string; graphicsErrors: string; graphicsState: string; graphicsStateInternal: string; graphicsColor: string; graphicsVec: string; graphicsShapes: string; graphicsSheet: string; graphicsUtils: string; graphicsLightingHelpers: string; graphicsSprites: string; turtle: string; linter: string; errorHook: string; inputTransform: string; watchTransform: string; syntaxHints: string; pi3Init: string; pi3Debug: string; debugTransform: string; pi3Testing: string }
  | { cmd: "runGenerator"; generatorPy: string; slug: string; reqId: number }
  | { cmd: "runReference"; referencePy: string; fieldsJson: string; reqId: number }
  | { cmd: "runChecker"; checkerPy: string; fieldsJson: string | null; studentOutput: string; expectedOutput: string; reqId: number }
  | {
      cmd: "run";
      files: Record<string, string>;
      assets: Record<string, ImageBitmap>;
      tilemaps?: Record<string, unknown>;
      soundNames?: string[];
      sheet?: SheetRunPayload;
      entry: string;
      showHitboxes?: boolean;
      showActorInfo?: boolean;
    }
  | { cmd: "interrupt" }
  | { cmd: "pause" }
  | { cmd: "resume" }
  | { cmd: "step" }
  | { cmd: "set_speed"; divisor: 1 | 2 | 4 }
  | { cmd: "set_interrupt_buffer"; buffer: SharedArrayBuffer }
  | { cmd: "attach_canvas"; canvas: OffscreenCanvas }
  | { cmd: "event"; kind: WorkerEventType; data: InputEventData }
  | { cmd: "input_response"; value: string }
  | { cmd: "lint"; code: string; filename: string; reqId: number }
  | { cmd: "complete"; code: string; line: number; col: number; reqId: number }
  | { cmd: "screenshot"; reqId: number };

// ── Friendly error types ──────────────────────────────────────────────────

export type ErrorCategory =
  | "naming"
  | "types"
  | "grammar"
  | "missing"
  | "logic"
  | "api-misuse"
  | "internal";

export type ErrorSuggestion = {
  token: string;         // the misspelled token, e.g. "bakcground"
  candidates: string[];  // nearest matches, e.g. ["background"]
};

// A single sub-error within a batch — used when the linter finds multiple
// errors before execution (any category, not just naming).
export type PerError = {
  code: string;            // e.g. "F821", "E225", "E999"
  category: ErrorCategory;
  label: string;           // human-readable short label (legacy; prefer messageKey)
  messageKey?: string;     // i18n key, e.g. "linter.F821"
  messageArgs?: Record<string, string | number>;
  token?: string;          // the problematic name (if applicable)
  line: number;            // 1-based line number
  snippet: string;         // the line of code
  suggestions: string[];   // nearest matches (if any)
};

// Structured runtime error — replaces flat "error" events for user-code exceptions.
export type RuntimeError = {
  category: ErrorCategory;
  title?: string;         // legacy; prefer titleKey
  titleKey: string;       // i18n key for title, e.g. "friendlyError.naming.title"
  message?: string;       // legacy; prefer messageKey
  messageKey?: string;    // i18n key, e.g. "friendlyError.naming.unknownKey"
  messageArgs?: Record<string, string | number>; // interpolation args for messageKey
  raw: string;            // original traceback string (for expand/collapse)
  cleanRaw?: string;      // filtered traceback (Pyodide frames removed) for student view
  suggestions: ErrorSuggestion[];
  location?: {            // parsed from traceback when possible
    row: number;
    column: number;
    endRow: number;
    endColumn: number;
  };
  isBlocking: boolean;    // grammar/syntax errors block; naming/type/logic don't
  codeSnippet?: string;   // the actual line of code that caused the error
  codeLine?: number;      // 1-based line number
  codeColumn?: number;    // 0-based column of the problematic token
  perErrors?: PerError[]; // batch mode: multiple sub-errors from linter pre-scan
  frame?: number;         // frame_count at crash time (graphics mode only, DBG-5)
  watches?: { label: string; value: string }[]; // watch() values at crash (DBG-5)
};

// ── Lint diagnostic (extended) ────────────────────────────────────────────

export type LintDiagnostic = {
  code: string;
  messageKey: string;
  messageArgs: Record<string, string | number>;
  row: number;
  column: number;
  endRow: number;
  endColumn: number;
  severity: "error" | "warning";
  // Enhanced fields for friendly errors
  category?: ErrorCategory;
  suggestions?: ErrorSuggestion[];
  isBlocking?: boolean;
};

// ── Jedi completion item ──────────────────────────────────────────────────────

export type JediCompletion = {
  name: string;
  type: string;
  description: string;
};

// ── Debug panel types (pi3.debug) ─────────────────────────────────────────

export type DebugSelectionAtom =
  | [type: "index", i: number]
  | [type: "range", lo: number, hi: number]
  | [type: "cell", r: number, c: number]
  | [type: "row", r: number]
  | [type: "col", c: number]
  | [type: "region", r1: number, c1: number, r2: number, c2: number];

export type SlotSnapshot = {
  kind: "array" | "grid" | "text" | "stack" | "queue" | "set";
  data: unknown;
  highlights: Record<string, DebugSelectionAtom[]>;
  strokes?: Record<string, DebugSelectionAtom[]>;
  strokeWidth?: number;
  legend?: Record<string, string>;
  labels: Record<string, string>;
  filename: string;
  line: number;
  fresh: boolean;
};

export type DebugFrame = {
  index: number;
  watches?: { label: string; value: string }[];
  slots: SlotSnapshot[];
};

// ── Worker events ─────────────────────────────────────────────────────────

export type WorkerEvent =
  | { type: "ready" }
  | { type: "start"; canvasActive: boolean }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "result"; keepCanvas?: boolean }
  | { type: "error"; payload: { message: string; stack?: string; phase?: "init" | "exec" | "worker" } }
  | { type: "runtime_error"; error: RuntimeError }
  | { type: "input_request"; prompt: string }
  | { type: "lint"; diagnostics: LintDiagnostic[]; reqId: number }
  | { type: "complete"; completions: JediCompletion[]; reqId: number }
  | { type: "interrupt_ack" }
  | { type: "canvas_resize"; width: number; height: number }
  | { type: "sound"; action: "play" | "pause" | "loop" | "stop" | "volume"; name: string; value?: number }
  | { type: "screenshot"; reqId: number; blob: Blob | null }
  | { type: "watch"; values: { label: string; value: string }[]; frame: number }
  | { type: "frame_history"; frames: { frame: number; blob: Blob; watches: { label: string; value: string }[] }[] }
  | { type: "debug_frame"; frame: DebugFrame }
  | { type: "generator_result"; stdout: string; reqId: number }
  | { type: "generator_error"; error: string; reqId: number }
  | { type: "reference_result"; expected: string; reqId: number }
  | { type: "reference_error"; error: string; reqId: number }
  | { type: "checker_result"; passed: boolean; reqId: number }
  | { type: "checker_error"; error: string; reqId: number };
