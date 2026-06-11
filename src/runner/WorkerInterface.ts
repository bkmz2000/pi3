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
  | { cmd: "init"; graphicsInit: string; graphicsActors: string; graphicsAnimation: string; graphicsManifest: string; graphicsErrors: string; graphicsState: string; linter: string; errorHook: string; inputTransform: string; syntaxHints: string }
  | {
      cmd: "run";
      files: Record<string, string>;
      assets: Record<string, ImageBitmap>;
      tilemaps?: Record<string, unknown>;
      soundNames?: string[];
      sheet?: SheetRunPayload;
      entry: string;
      showHitboxes?: boolean;
    }
  | { cmd: "interrupt" }
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

// ── Worker events ─────────────────────────────────────────────────────────

export type WorkerEvent =
  | { type: "ready" }
  | { type: "start"; canvasActive: boolean }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "result" }
  | { type: "error"; payload: { message: string; stack?: string; phase?: "init" | "exec" | "worker" } }
  | { type: "runtime_error"; error: RuntimeError }
  | { type: "input_request"; prompt: string }
  | { type: "lint"; diagnostics: LintDiagnostic[]; reqId: number }
  | { type: "complete"; completions: JediCompletion[]; reqId: number }
  | { type: "interrupt_ack" }
  | { type: "canvas_resize"; width: number; height: number }
  | { type: "sound"; action: "play" | "pause" | "loop" | "stop" | "volume"; name: string; value?: number }
  | { type: "screenshot"; reqId: number; blob: Blob | null };
