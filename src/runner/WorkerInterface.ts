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

export type WorkerCommand =
  | { cmd: "init"; graphicsInit: string; graphicsActors: string; graphicsAnimation: string; linter: string }
  | {
      cmd: "run";
      files: Record<string, string>;
      assets: Record<string, ImageBitmap>;
      tilemaps?: Record<string, unknown>;
      animations?: Record<string, { frames: ImageBitmap[]; fps: number }>;
      soundNames?: string[];
      entry: string;
      showHitboxes?: boolean;
    }
  | { cmd: "interrupt" }
  | { cmd: "set_interrupt_buffer"; buffer: SharedArrayBuffer }
  | { cmd: "attach_canvas"; canvas: OffscreenCanvas }
  | { cmd: "event"; kind: WorkerEventType; data: InputEventData }
  | { cmd: "input_response"; value: string }
  | { cmd: "lint"; code: string; filename: string; reqId: number }
  | { cmd: "screenshot"; reqId: number };

export type LintDiagnostic = {
  code: string;
  messageKey: string;
  messageArgs: Record<string, string | number>;
  row: number;
  column: number;
  endRow: number;
  endColumn: number;
  severity: "error" | "warning";
};

export type WorkerEvent =
  | { type: "ready" }
  | { type: "start"; canvasActive: boolean }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "result" }
  | { type: "error"; error: string }
  | { type: "input_request"; prompt: string }
  | { type: "lint"; diagnostics: LintDiagnostic[]; reqId: number }
  | { type: "interrupt_ack" }
  | { type: "canvas_resize"; width: number; height: number }
  | { type: "sound"; action: "play" | "pause" | "loop" | "stop"; name: string }
  | { type: "screenshot"; reqId: number; blob: Blob | null };
