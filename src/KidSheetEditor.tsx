// Kid-mode sprite editor — the pi³ "draw your sprite" experience.
// Single sprite, named animations with per-animation frames, 7 tools,
// color mixer, hotkeys, frame reordering, difference-outline onion skin.
// State lives in this component; it writes back to the project sheet via
// kidSheet.ts (packing frames into strips, preserving other sprites).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditor } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import {
  Pencil, Eraser, PaintBucket, Pipette, Undo2, Redo2, Trash2, Play, Pause,
  Grid2x2, Square, Circle, X, Plus, Copy, Check, ZoomIn, ZoomOut, Sparkles, PanelRight, ChevronRight,
} from "lucide-react";
import {
  kidStateFromSheet, kidStateToSheet, kidDefaultState, blankKidFrame,
  KID_SIZES, PALETTE_RGB, PALETTE_HEX, mixRgb, isPaletteRgb, maxFramesPerStrip,
  type KidAnimation, type KidFrame, type Rgb,
} from "./kidSheet";
import { blankSheet, paintBrush, floodFill, rgbToHex } from "./sheetPixels";
import { bresenhamLine, rectOutline, ellipseOutline } from "./sheetRaster";

type Tool = "pencil" | "eraser" | "fill" | "pick" | "line" | "rect" | "circle";
const SHAPES: Partial<Record<Tool, boolean>> = { line: true, rect: true, circle: true };
const TOOL_KEYS: Partial<Record<string, Tool>> = {
  b: "pencil", e: "eraser", g: "fill", i: "pick", l: "line", r: "rect", c: "circle",
};

function rgb2css(c: Rgb): string {
  return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
}
function sameRgb(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function frameCell(f: KidFrame, size: number, x: number, y: number): [number, number, number, number] {
  const i = (y * size + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
}
function setCell(f: KidFrame, size: number, x: number, y: number, c: Rgb, alpha = 255) {
  const i = (y * size + x) * 4;
  f[i] = c[0]; f[i + 1] = c[1]; f[i + 2] = c[2]; f[i + 3] = alpha;
}
function LineIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 19 19 5" />
    </svg>
  );
}

const PALETTE_CM_ORDER = [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
const PALETTE_CM = PALETTE_CM_ORDER.map((i) => PALETTE_RGB[i]);
const PALETTE_HEX_CM = PALETTE_CM_ORDER.map((i) => PALETTE_HEX[i]);

export default function KidSheetEditor({ onClose, initialSprite }: { onClose: () => void; initialSprite?: string }) {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const setSheet = useEditor((s) => s.setSheet);
  const theme = useThemeStore((s) => s.theme);
  const { surface, panelHeader, panelTxt, panelTxtMute, panelBorder, accent, fontUI, fontMono } = theme;

  const existingName = project.sheet && Object.keys(project.sheet.sprites).length > 0
    ? Object.keys(project.sheet.sprites)[0] : undefined;
  const [name, setName] = useState<string>(initialSprite ?? existingName ?? "sprite");
  const [size, setSize] = useState(64);
  const [anims, setAnims] = useState<KidAnimation[]>([]);
  const [active, setActive] = useState(0);
  const [fi, setFi] = useState(0);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const animsRef = useRef<KidAnimation[]>([]);
  animsRef.current = anims;

  useEffect(() => {
    if (loaded) return;
    const sheet = project.sheet;
    const spriteName = initialSprite ?? existingName;
    let st: { size: number; anims: KidAnimation[] } | null = null;
    if (sheet && spriteName) st = kidStateFromSheet(sheet, spriteName);
    const next = st ?? { size: 64, anims: kidDefaultState(64) };
    setSize(next.size);
    setAnims(next.anims);
    setActive(0);
    setFi(0);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitSheet = useCallback((): boolean => {
    const base = project.sheet ?? blankSheet();
    try {
      const next = kidStateToSheet(base, name, size, animsRef.current);
      setSheet(next);
      return true;
    } catch {
      return false;
    }
  }, [project.sheet, name, size, setSheet]);

  const [tool, setTool] = useState<Tool>("pencil");
  const [brush, setBrush] = useState(3);
  const [sel, setSel] = useState<Rgb>(PALETTE_RGB[3]);
  const [custom, setCustom] = useState<Rgb[]>([]);
  const [mixOpen, setMixOpen] = useState(false);
  const [mixA, setMixA] = useState<Rgb | null>(null);
  const [mixB, setMixB] = useState<Rgb | null>(null);
  const [pickSlot, setPickSlot] = useState<"A" | "B">("A");
  const [onion, setOnion] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [allSelected, setAllSelected] = useState(false);
  const [sizeModal, setSizeModal] = useState<number | null>(null);
  const [nameModal, setNameModal] = useState<{ mode: "add" | "rename"; value: string; error: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipboard = useRef<KidFrame | null>(null);
  const undoStack = useRef<{ a: number; f: number; data: Uint8ClampedArray }[]>([]);
  const redoStack = useRef<{ a: number; f: number; data: Uint8ClampedArray }[]>([]);
  const painting = useRef(false);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const shapeEnd = useRef<{ x: number; y: number } | null>(null);
  const shiftLine = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ from: number; over: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1300);
  }, []);

  const frames = useCallback((): KidFrame[] => (animsRef.current[active]?.frames ?? []), [active]);
  const curFrame = useCallback((): KidFrame => frames()[fi], [frames, fi]);

  const drawGhostOutline = useCallback((src: KidFrame, fill: Rgb, alpha: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cur = curFrame();
    const changed = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (src[i + 3] > 0 && (src[i] !== cur[i] || src[i + 1] !== cur[i + 1] || src[i + 2] !== cur[i + 2] || src[i + 3] !== cur[i + 3])) {
        changed[y * size + x] = 1;
      }
    }
    const off = document.createElement("canvas");
    off.width = size; off.height = size;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!changed[y * size + x]) continue;
      const boundary =
        (x === 0 || !changed[y * size + x - 1]) ||
        (x === size - 1 || !changed[y * size + x + 1]) ||
        (y === 0 || !changed[(y - 1) * size + x]) ||
        (y === size - 1 || !changed[(y + 1) * size + x]);
      if (boundary) {
        const i = (y * size + x) * 4;
        img.data[i] = fill[0]; img.data[i + 1] = fill[1]; img.data[i + 2] = fill[2];
        img.data[i + 3] = Math.round(alpha * 255);
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.drawImage(off, 0, 0);
  }, [size, curFrame]);

  const drawBase = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    const off = document.createElement("canvas");
    off.width = size; off.height = size;
    off.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(curFrame()), size, size), 0, 0);
    ctx.drawImage(off, 0, 0);
    if (onion) {
      const f = frames();
      if (fi > 0) drawGhostOutline(f[fi - 1], [65, 166, 246], 0.85);
      if (fi < f.length - 1) drawGhostOutline(f[fi + 1], [255, 127, 168], 0.85);
    }
  }, [size, fi, onion, frames, curFrame, drawGhostOutline]);

  const drawChips = useCallback(() => {
    const box = frameBoxRef.current;
    if (!box) return;
    const f = frames();
    box.querySelectorAll<HTMLCanvasElement>("canvas.kf-chip").forEach((c, i) => {
      if (i < f.length) {
        c.width = size; c.height = size;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(f[i]), size, size), 0, 0);
      }
    });
  }, [size, frames]);

  const drawAll = useCallback(() => {
    drawBase();
    const pv = previewRef.current;
    if (pv) pv.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(curFrame()), size, size), 0, 0);
    drawChips();
  }, [drawBase, curFrame, size, drawChips]);

  useEffect(() => { if (loaded) drawAll(); }, [loaded, version, size, active, fi, onion, drawAll]);

  const overlayOutline = useCallback((a: { x: number; y: number }, b: { x: number; y: number } | null, kind: string, color: Rgb, erasing: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const scratch = new Uint8ClampedArray(size * size * 4);
    const hex = rgbToHex(color[0], color[1], color[2]);
    const plot = (x: number, y: number) => paintBrush(scratch, size, size, x, y, erasing ? "eraser" : "pencil", hex, brush, null);
    if (kind === "line") bresenhamLine(a.x, a.y, b?.x ?? a.x, b?.y ?? a.y, plot);
    else if (kind === "rect") rectOutline(a.x, a.y, b?.x ?? a.x, b?.y ?? a.y, plot);
    else if (kind === "circle") ellipseOutline(a.x, a.y, b?.x ?? a.x, b?.y ?? a.y, plot);
    else plot(a.x, a.y);
    const cur = curFrame();
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.fillStyle = rgb2css(color);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (scratch[i] !== cur[i] || scratch[i + 1] !== cur[i + 1] || scratch[i + 2] !== cur[i + 2] || scratch[i + 3] !== cur[i + 3]) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }, [size, brush, curFrame]);

  const pushUndo = useCallback(() => {
    undoStack.current.push({ a: active, f: fi, data: new Uint8ClampedArray(curFrame()) });
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
  }, [active, fi, curFrame]);

  const cellOf = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / size));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / size));
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  }, [size]);

  const updateGhost = useCallback((e: React.PointerEvent) => {
    const g = ghostRef.current;
    if (!g) return;
    if (tool !== "pencil" && tool !== "eraser") { g.style.display = "none"; return; }
    const c = cellOf(e);
    const canvas = canvasRef.current;
    if (!c || !canvas) { g.style.display = "none"; return; }
    const sx = canvas.getBoundingClientRect().width / size;
    g.style.display = "block";
    g.style.left = (c.x * sx + 1) + "px";
    g.style.top = (c.y * sx + 1) + "px";
    g.style.width = (brush * sx) + "px";
    g.style.height = (brush * sx) + "px";
  }, [tool, brush, cellOf, size]);

  const strokeAt = useCallback((x: number, y: number) => {
    const buf = curFrame();
    const hex = rgbToHex(sel[0], sel[1], sel[2]);
    if (tool === "fill") {
      floodFill(buf, size, size, x, y, hex, null);
    } else if (tool === "pick") {
      const [r, g, b, a] = frameCell(buf, size, x, y);
      if (a > 0) setSel([r, g, b]);
      setTool("pencil");
    } else {
      paintBrush(buf, size, size, x, y, tool === "eraser" ? "eraser" : "pencil", hex, brush, null);
    }
  }, [tool, sel, brush, size, curFrame]);

  const renderPreviewShape = useCallback(() => {
    drawBase();
    if (shiftLine.current) {
      const a = shiftLine.current;
      overlayOutline(a, shapeEnd.current, "line", tool === "eraser" ? [0, 0, 0] : sel, tool === "eraser");
    } else if (shapeStart.current) {
      overlayOutline(shapeStart.current, shapeEnd.current, tool, sel, false);
    }
  }, [drawBase, overlayOutline, tool, sel]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const c = cellOf(e);
    if (!c) return;
    if (allSelected && tool !== "pick") setAllSelected(false);
    if ((tool === "pencil" || tool === "eraser") && e.shiftKey) {
      pushUndo();
      shiftLine.current = { x: c.x, y: c.y };
      shapeEnd.current = null;
      painting.current = true;
      renderPreviewShape();
      return;
    }
    if (SHAPES[tool]) {
      pushUndo();
      shapeStart.current = { x: c.x, y: c.y };
      shapeEnd.current = null;
      painting.current = true;
      renderPreviewShape();
      return;
    }
    if (tool !== "pick") pushUndo();
    strokeAt(c.x, c.y);
    painting.current = true;
    drawAll();
  }, [cellOf, allSelected, tool, pushUndo, renderPreviewShape, strokeAt, drawAll]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) { updateGhost(e); return; }
    const c = cellOf(e);
    if (!c) return;
    if (shiftLine.current || shapeStart.current) {
      shapeEnd.current = { x: c.x, y: c.y };
      renderPreviewShape();
      return;
    }
    strokeAt(c.x, c.y);
    drawAll();
  }, [updateGhost, cellOf, renderPreviewShape, strokeAt, drawAll]);

  const onPointerUp = useCallback(() => {
    if (shiftLine.current || shapeStart.current) {
      const kind = shiftLine.current ? "line" : tool;
      const color: Rgb = shiftLine.current ? (tool === "eraser" ? [0, 0, 0] : sel) : sel;
      const a = shiftLine.current ?? shapeStart.current;
      if (a) {
        const buf = curFrame();
        const hex = rgbToHex(color[0], color[1], color[2]);
        const plot = (x: number, y: number) => paintBrush(buf, size, size, x, y, tool === "eraser" ? "eraser" : "pencil", hex, brush, null);
        const b = shapeEnd.current;
        if (kind === "line") bresenhamLine(a.x, a.y, b?.x ?? a.x, b?.y ?? a.y, plot);
        else if (kind === "rect") rectOutline(a.x, a.y, b?.x ?? a.x, b?.y ?? a.y, plot);
        else if (kind === "circle") ellipseOutline(a.x, a.y, b?.x ?? a.x, b?.y ?? a.y, plot);
        else plot(a.x, a.y);
      }
      shapeStart.current = null; shiftLine.current = null; shapeEnd.current = null;
      painting.current = false;
      drawAll();
      return;
    }
    painting.current = false;
  }, [tool, sel, brush, size, curFrame, drawAll]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const addFrame = useCallback(() => {
    pushUndo();
    setAnims((a) => {
      const next = [...a];
      next[active] = { ...next[active], frames: [...next[active].frames, blankKidFrame(size)] };
      return next;
    });
    setFi(frames().length);
    bump();
  }, [active, size, pushUndo, bump, frames]);

  const dupFrame = useCallback(() => {
    pushUndo();
    setAnims((a) => {
      const next = [...a];
      const f = [...next[active].frames];
      f.splice(fi + 1, 0, new Uint8ClampedArray(curFrame()));
      next[active] = { ...next[active], frames: f };
      return next;
    });
    setFi(fi + 1);
    bump();
  }, [active, fi, pushUndo, bump, curFrame]);

  const delFrame = useCallback(() => {
    if (frames().length < 2) return;
    pushUndo();
    setAnims((a) => {
      const next = [...a];
      const f = next[active].frames.filter((_, i) => i !== fi);
      next[active] = { ...next[active], frames: f };
      return next;
    });
    setFi(Math.min(fi, frames().length - 2));
    bump();
  }, [frames, fi, active, pushUndo, bump]);

  const commitReorder = useCallback((from: number, to: number) => {
    if (from === to) return;
    pushUndo();
    setAnims((a) => {
      const next = [...a];
      const f = [...next[active].frames];
      const [item] = f.splice(from, 1);
      f.splice(to, 0, item);
      next[active] = { ...next[active], frames: f };
      return next;
    });
    setFi(to);
    bump();
  }, [active, pushUndo, bump]);

  const undo = useCallback(() => {
    const s = undoStack.current.pop();
    if (!s) return;
    const cur = animsRef.current[s.a]?.frames[s.f];
    if (cur) redoStack.current.push({ a: s.a, f: s.f, data: new Uint8ClampedArray(cur) });
    setAnims((prev) => prev.map((an, i) =>
      i === s.a ? { ...an, frames: an.frames.map((fr, j) => (j === s.f ? s.data : fr)) } : an
    ));
    bump();
  }, [bump]);

  const redo = useCallback(() => {
    const s = redoStack.current.pop();
    if (!s) return;
    const cur = animsRef.current[s.a]?.frames[s.f];
    if (cur) undoStack.current.push({ a: s.a, f: s.f, data: new Uint8ClampedArray(cur) });
    setAnims((prev) => prev.map((an, i) =>
      i === s.a ? { ...an, frames: an.frames.map((fr, j) => (j === s.f ? s.data : fr)) } : an
    ));
    bump();
  }, [bump]);

  const addAnim = useCallback(() => setNameModal({ mode: "add", value: "", error: "" }), []);
  const renameAnim = useCallback(() => setNameModal({ mode: "rename", value: anims[active]?.name ?? "", error: "" }), [anims, active]);
  const delAnim = useCallback(() => {
    if (anims.length < 2) return;
    setAnims((a) => a.filter((_, i) => i !== active));
    setActive(Math.max(0, active - 1));
    setFi(0);
    bump();
  }, [anims.length, active, bump]);

  const commitName = useCallback(() => {
    if (!nameModal) return;
    const val = nameModal.value.trim();
    if (!val) { setNameModal({ ...nameModal, error: t("kidSheet.nameRequired") }); return; }
    if (nameModal.mode === "add") {
      if (anims.some((a) => a.name === val)) { setNameModal({ ...nameModal, error: t("kidSheet.nameTaken") }); return; }
      setAnims((a) => [...a, { name: val, frames: [blankKidFrame(size)] }]);
      setActive(anims.length);
      setFi(0);
    } else {
      setAnims((a) => a.map((an, i) => (i === active ? { ...an, name: val } : an)));
    }
    setNameModal(null);
    bump();
  }, [nameModal, anims, active, size, t, bump]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && k === "y") { e.preventDefault(); redo(); }
      else if (mod && k === "s") { e.preventDefault(); if (commitSheet()) showToast(t("kidSheet.saved")); }
      else if (mod && k === "a") { e.preventDefault(); setAllSelected((s) => !s); }
      else if (mod && k === "c") { e.preventDefault(); clipboard.current = new Uint8ClampedArray(curFrame()); showToast(t("kidSheet.copied")); }
      else if (mod && k === "v") {
        e.preventDefault();
        if (clipboard.current) {
          pushUndo();
          const data = new Uint8ClampedArray(clipboard.current);
          setAnims((a) => a.map((an, i) =>
            i === active ? { ...an, frames: an.frames.map((fr, j) => (j === fi ? data : fr)) } : an
          ));
          setAllSelected(false); bump(); drawAll(); showToast(t("kidSheet.pasted"));
        }
      }
      else if (k === "escape") setAllSelected(false);
      else if (!mod && TOOL_KEYS[k]) setTool(TOOL_KEYS[k]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, commitSheet, showToast, t, curFrame, pushUndo, active, fi, bump, drawAll]);

  useEffect(() => {
    if (!playing) return;
    playRef.current = setInterval(() => {
      setFi((f) => (f + 1) % Math.max(1, frames().length));
    }, 250);
    return () => { if (playRef.current) clearInterval(playRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => () => { if (playRef.current) clearInterval(playRef.current); }, []);

  const saveAndClose = useCallback(() => {
    if (commitSheet()) onClose();
    else showToast(t("kidSheet.saveFailed"));
  }, [commitSheet, onClose, showToast, t]);

  const clearFrame = useCallback(() => {
    pushUndo();
    setAnims((a) => a.map((an, i) =>
      i === active ? { ...an, frames: an.frames.map((fr, j) => (j === fi ? blankKidFrame(size) : fr)) } : an
    ));
    bump();
  }, [active, fi, size, pushUndo, bump]);

  const askResize = useCallback((ns: number) => setSizeModal(ns), []);
  const doResize = useCallback((ns: number, scale: boolean) => {
    setSizeModal(null);
    if (ns === size) return;
    pushUndo();
    setAnims((a) => a.map((an) => ({
      ...an,
      frames: an.frames.map((f) => {
        if (scale) return scaleFrame(f, size, ns);
        const nb = blankKidFrame(ns);
        const mw = Math.min(size, ns), mh = Math.min(size, ns);
        for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
          const [r, g, b, al] = frameCell(f, size, x, y);
          setCell(nb, ns, x, y, [r, g, b], al);
        }
        return nb;
      }),
    })));
    setSize(ns);
    setFi(0);
    bump();
  }, [size, pushUndo, bump]);

  const addCustom = useCallback((c: Rgb) => {
    if (isPaletteRgb(c)) return;
    setCustom((prev) => {
      if (prev.some((p) => sameRgb(p, c))) return prev;
      const next = [...prev, c];
      return next.length > 12 ? next.slice(next.length - 12) : next;
    });
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) { setPlaying(false); return; }
    if (frames().length < 2) return;
    setPlaying(true);
  }, [playing, frames]);

  const cellPx = Math.min(size * 8 * zoom, 1280);
  const currentAnim = anims[active];
  const ramp = mixA && mixB ? Array.from({ length: 10 }, (_, i) => mixRgb(mixA, mixB, i / 9)) : [];
  const btnBase: React.CSSProperties = {
    all: "unset", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 6, cursor: "pointer", color: panelTxtMute, fontFamily: fontUI, flexShrink: 0,
  };
  const chipStyle: React.CSSProperties = {
    all: "unset", display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px",
    borderRadius: 7, cursor: "pointer", fontFamily: fontUI, fontSize: 12, border: "1px solid " + panelBorder,
    background: "transparent", color: panelTxt, flexShrink: 0,
  };

  return (
    <div id="kid-sheet-editor" data-testid="sheet-editor" style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", background: surface, color: panelTxt, fontFamily: fontUI, fontSize: 12 }}><style>{"#kid-sheet-editor .kd-rail::-webkit-scrollbar{display:none}"}</style>
      <header style={{ height: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", background: panelHeader, borderBottom: "1px solid " + panelBorder, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: "12.5px", color: panelTxt, flexShrink: 0 }}>{t("kidSheet.title")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} aria-label={t("kidSheet.spriteName")}
          style={{ height: 28, width: 110, padding: "0 8px", borderRadius: 6, border: "1px solid " + panelBorder, background: surface, color: panelTxt, fontFamily: fontUI, fontSize: 12, flexShrink: 0 }} />
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 2px", flexShrink: 0 }} />
        <button title={t("kidSheet.undo")} onClick={undo} style={{ ...btnBase, width: 28, height: 28 }}><Undo2 size={16} /></button>
        <button title={t("kidSheet.redo")} onClick={redo} style={{ ...btnBase, width: 28, height: 28 }}><Redo2 size={16} /></button>
        <button title={t("kidSheet.clear")} onClick={clearFrame} style={{ ...btnBase, width: 28, height: 28 }}><Trash2 size={16} /></button>
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 2px", flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: panelTxtMute, marginRight: 2 }}>{t("kidSheet.brush")}</span>
        {[1, 3, 5].map((b) => (
          <button key={b} onClick={() => setBrush(b)} title={t("kidSheet.brushSize", { n: b })}
            style={{ ...btnBase, width: 26, height: 26, borderRadius: 5, color: brush === b ? accent : panelTxtMute, background: brush === b ? accent + "18" : "transparent" }}>
            <span style={{ width: 2 + b * 2, height: 2 + b * 2, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 2px", flexShrink: 0 }} />
        <button title={t("kidSheet.grid")} onClick={() => setShowGrid((g) => !g)}
          style={{ ...btnBase, width: 28, height: 28, color: showGrid ? accent : panelTxtMute, background: showGrid ? accent + "11" : "transparent" }}>
          <Grid2x2 size={15} />
        </button>
        <button title={t("kidSheet.onion")} onClick={() => setOnion((o) => !o)}
          style={{ ...btnBase, width: 28, height: 28, color: onion ? accent : panelTxtMute, background: onion ? accent + "11" : "transparent" }}>
          <Sparkles size={15} />
        </button>
        <button title={t("kidSheet.animations")} onClick={() => setDrawerOpen((o) => !o)}
          style={{ ...btnBase, width: 28, height: 28, color: drawerOpen ? accent : panelTxtMute, background: drawerOpen ? accent + "11" : "transparent" }}>
          <PanelRight size={15} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} style={{ ...btnBase, width: 22, height: 24 }}><ZoomOut size={13} /></button>
          <span style={{ fontSize: 10, color: panelTxtMute, fontFamily: fontMono, minWidth: 34, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))} style={{ ...btnBase, width: 22, height: 24 }}><ZoomIn size={13} /></button>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={togglePlay} title={playing ? t("kidSheet.pause") : t("kidSheet.play")}
          style={{ ...btnBase, width: 30, height: 28, color: playing ? accent : panelTxtMute }}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={saveAndClose} title={t("kidSheet.done")}
          style={{ ...btnBase, height: 28, padding: "0 14px", background: accent, color: "#1e0800", fontWeight: 700, fontSize: 12 }}>
          <Check size={14} /> {t("kidSheet.done")}
        </button>
        <button title={t("kidSheet.close")} onClick={onClose} style={{ ...btnBase, width: 26, height: 26 }}><X size={14} /></button>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        <aside className="kd-rail" style={{ width: 80, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, padding: 8, background: panelHeader, borderRight: "1px solid " + panelBorder, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            {([["pencil", Pencil], ["eraser", Eraser], ["fill", PaintBucket], ["pick", Pipette], ["line", LineIcon], ["rect", Square], ["circle", Circle]] as [Tool, React.ComponentType<{ size?: number }>][]).map(([id, Icon]) => (
              <button key={id} title={t("kidSheet.tool." + id)} onClick={() => setTool(id)}
                style={{ ...btnBase, height: 34, color: tool === id ? "#1e0800" : panelTxtMute, background: tool === id ? accent : "transparent" }}>
                <Icon size={17} />
              </button>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(148,210,216,0.22)", margin: "2px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: panelTxtMute }}>{t("kidSheet.current")}</span>
            <span style={{ flex: 1, height: 18, borderRadius: 5, border: "2px solid " + accent, background: rgb2css(sel) }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 3 }}>
            {PALETTE_CM.map((c, i) => (
              <button key={i} title={PALETTE_HEX_CM[i]}
                onClick={() => {
                  setSel(c);
                  if (mixOpen) {
                    if (pickSlot === "A") { setMixA(c); setPickSlot("B"); }
                    else { setMixB(c); setPickSlot("A"); }
                  }
                }}
                style={{ height: 26, borderRadius: 5, border: sameRgb(c, sel) ? "2px solid " + accent : "2px solid transparent", background: rgb2css(c), cursor: "pointer", padding: 0 }} />
            ))}
          </div>
          <button onClick={() => { setMixA(null); setMixB(null); setPickSlot("A"); setMixOpen(true); }}
            style={{ ...chipStyle, width: "100%", justifyContent: "center", height: 28, borderColor: mixOpen ? accent : panelBorder, color: mixOpen ? accent : panelTxt }}>
            <Sparkles size={12} /> {t("kidSheet.mixToggle")}
          </button>

          {custom.length > 0 && (
            <>
              <span style={{ fontSize: 10, color: panelTxtMute }}>{t("kidSheet.myColors")}</span>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {custom.map((c, i) => (
                  <button key={i} onClick={() => setSel(c)} title={t("kidSheet.myColor")}
                    style={{ width: 26, height: 26, borderRadius: 5, border: sameRgb(c, sel) ? "2px solid " + accent : "2px solid transparent", background: rgb2css(c), cursor: "pointer", padding: 0 }} />
                ))}
              </div>
            </>
          )}
        </aside>

        <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#091d23" }}>
          <div style={{ position: "absolute", inset: 0, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <canvas ref={canvasRef} width={size} height={size}
                  style={{ width: cellPx, height: cellPx, imageRendering: "pixelated", cursor: "crosshair", touchAction: "none", border: "1px solid " + panelBorder, borderRadius: 6, backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.06) 0% 25%, transparent 0% 50%)", backgroundSize: "16px 16px" }}
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                  onPointerLeave={() => { if (ghostRef.current) ghostRef.current.style.display = "none"; }}
                  onContextMenu={(e) => e.preventDefault()} />
                {showGrid && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)", backgroundSize: "calc(100%/" + size + ") calc(100%/" + size + ")" }} />}
                <div ref={selRef} style={{ position: "absolute", inset: 0, border: "2px dashed " + accent, borderRadius: 6, pointerEvents: "none", display: allSelected ? "block" : "none" }} />
                <div ref={ghostRef} style={{ position: "absolute", display: "none", pointerEvents: "none", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 0 0 1px rgba(0,0,0,0.6)", borderRadius: 2 }} />
              </div>
              {onion && (
                <div style={{ display: "flex", gap: 10, fontSize: 10, color: panelTxtMute }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#41a6f6", display: "inline-block" }} />{t("kidSheet.onionPrev")}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#ff7fa8", display: "inline-block" }} />{t("kidSheet.onionNext")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

                          <aside style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, padding: 10, background: panelHeader, borderLeft: "1px solid " + panelBorder, overflowY: "auto" }}>
          <section style={{ background: surface, border: "1px solid " + panelBorder, borderRadius: 8, padding: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: panelTxtMute, margin: "0 0 6px" }}>{t("kidSheet.canvasSize")}</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {KID_SIZES.map((sz) => (
                <button key={sz} onClick={() => askResize(sz)}
                  style={{ ...chipStyle, minWidth: 40, justifyContent: "center", borderColor: sz === size ? accent : panelBorder, color: sz === size ? accent : panelTxt }}>
                  {sz}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Animation drawer — slides in from the right */}
      <div style={{ position: "absolute", top: 44, bottom: 0, right: 0, width: 300, background: panelHeader, borderLeft: "1px solid " + panelBorder, transform: drawerOpen ? "none" : "translateX(100%)", transition: "transform .18s ease", display: "flex", flexDirection: "column", gap: 10, padding: 10, overflowY: "auto", zIndex: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: panelTxtMute, flex: 1 }}>{t("kidSheet.animations")}</span>
          <button onClick={() => setDrawerOpen(false)} title={t("kidSheet.hideAnims")} style={{ ...btnBase, width: 24, height: 24 }}><ChevronRight size={15} /></button>
        </div>
        <section style={{ background: surface, border: "1px solid " + panelBorder, borderRadius: 8, padding: 8 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {anims.map((an, i) => (
              <button key={i} onClick={() => { setActive(i); setFi(0); }}
                style={{ ...chipStyle, borderColor: i === active ? accent : panelBorder, color: i === active ? accent : panelTxt }}>
                {an.name} ({an.frames.length})
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            <button onClick={addAnim} style={chipStyle}><Plus size={12} /> {t("kidSheet.newAnim")}</button>
            <button onClick={renameAnim} style={chipStyle}><Pencil size={12} /> {t("kidSheet.renameAnim")}</button>
            <button onClick={delAnim} style={chipStyle}><Trash2 size={12} /> {t("kidSheet.deleteAnim")}</button>
          </div>
        </section>
        <section style={{ background: surface, border: "1px solid " + panelBorder, borderRadius: 8, padding: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: panelTxtMute, margin: "0 0 6px" }}>
            {t("kidSheet.frames")} · {currentAnim?.name ?? ""} <span style={{ fontWeight: 400, textTransform: "none" }}>{t("kidSheet.reorderHint")}</span>
          </p>
          <div ref={frameBoxRef} style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {frames().map((_, i) => (
              <canvas key={version + "-" + i}
                ref={(c) => { if (c) { c.width = size; c.height = size; const ctx = c.getContext("2d")!; const f = frames()[i]; if (f) ctx.putImageData(new ImageData(new Uint8ClampedArray(f), size, size), 0, 0); } }}
                className="kf-chip"
                title={t("kidSheet.frame", { n: i + 1 })}
                onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setFi(i); }}
                onPointerDown={(e) => { drag.current = { from: i, over: -1, startX: e.clientX, startY: e.clientY, moved: false }; }}
                onPointerMove={(e) => { if (drag.current && Math.abs(e.clientX - drag.current.startX) + Math.abs(e.clientY - drag.current.startY) > 4) drag.current.moved = true; }}
                onPointerEnter={() => { if (drag.current && drag.current.from !== i) drag.current.over = i; }}
                onPointerUp={() => {
                  const d = drag.current;
                  if (d && d.moved && d.over >= 0 && d.over !== d.from) { suppressClick.current = true; commitReorder(d.from, d.over); }
                  drag.current = null;
                }}
                style={{ width: 44, height: 44, imageRendering: "pixelated", border: "2px solid " + (i === fi ? accent : panelBorder), borderRadius: 6, cursor: "pointer", backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.06) 0% 25%, transparent 0% 50%)", backgroundSize: "8px 8px" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            <button onClick={addFrame} style={chipStyle}><Plus size={12} /> {t("kidSheet.addFrame")}</button>
            <button onClick={dupFrame} style={chipStyle}><Copy size={12} /> {t("kidSheet.copyFrame")}</button>
            <button onClick={delFrame} style={chipStyle}><Trash2 size={12} /> {t("kidSheet.delFrame")}</button>
          </div>
          {frames().length >= maxFramesPerStrip(size) && (
            <p style={{ fontSize: 10, color: "#e08a3c", margin: "6px 0 0" }}>{t("kidSheet.frameLimit", { n: maxFramesPerStrip(size) })}</p>
          )}
        </section>
      </div>

      {sizeModal !== null && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, borderRadius: 8 }}>
          <div style={{ background: surface, border: "1px solid " + panelBorder, borderRadius: 10, padding: 14, width: 320 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>{t("kidSheet.resizeTitle", { n: sizeModal })}</p>
            <p style={{ fontSize: 11, color: panelTxtMute, margin: "0 0 12px" }}>{t("kidSheet.resizeBody")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => doResize(sizeModal, true)} style={{ ...chipStyle, borderColor: accent, color: accent }}>{t("kidSheet.scaleDrawing")}</button>
              <button onClick={() => doResize(sizeModal, false)} style={chipStyle}>{t("kidSheet.keepAsIs")}</button>
              <button onClick={() => setSizeModal(null)} style={chipStyle}>{t("kidSheet.cancel")}</button>
            </div>
          </div>
        </div>
      )}
      {nameModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, borderRadius: 8 }}>
          <div style={{ background: surface, border: "1px solid " + panelBorder, borderRadius: 10, padding: 14, width: 320 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>{nameModal.mode === "add" ? t("kidSheet.newAnim") : t("kidSheet.renameAnim")}</p>
            <input autoFocus value={nameModal.value} maxLength={24} onChange={(e) => setNameModal({ ...nameModal, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") commitName(); }}
              placeholder="walk"
              style={{ height: 32, width: "100%", boxSizing: "border-box", padding: "0 10px", borderRadius: 6, border: "1px solid " + panelBorder, background: surface, color: panelTxt, fontFamily: fontUI, fontSize: 13, marginBottom: 8 }} />
            <p style={{ fontSize: 11, color: "#e08a3c", margin: "0 0 8px", minHeight: 14 }}>{nameModal.error}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setNameModal(null)} style={chipStyle}>{t("kidSheet.cancel")}</button>
              <button onClick={commitName} style={{ ...chipStyle, borderColor: accent, color: accent }}>{t("kidSheet.ok")}</button>
            </div>
          </div>
        </div>
      )}
      {mixOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, borderRadius: 8 }} onClick={() => setMixOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: surface, border: "1px solid " + panelBorder, borderRadius: 10, padding: 14, width: 320 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>{t("kidSheet.mixToggle")}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: panelTxtMute }}>{t("kidSheet.mixFirst")}</span>
              <button onClick={() => setPickSlot("A")} style={{ width: 22, height: 22, borderRadius: 4, border: pickSlot === "A" ? "2px solid " + accent : "1px solid " + panelBorder, background: mixA ? rgb2css(mixA) : "transparent", cursor: "pointer", padding: 0 }} />
              <span style={{ fontSize: 10, color: panelTxtMute }}>{t("kidSheet.mixSecond")}</span>
              <button onClick={() => setPickSlot("B")} style={{ width: 22, height: 22, borderRadius: 4, border: pickSlot === "B" ? "2px solid " + accent : "1px solid " + panelBorder, background: mixB ? rgb2css(mixB) : "transparent", cursor: "pointer", padding: 0 }} />
            </div>
            {(!mixA || !mixB) && <p style={{ fontSize: 10, color: panelTxtMute, margin: "0 0 6px" }}>{pickSlot === "A" ? t("kidSheet.mixHintA") : t("kidSheet.mixHintB")}</p>}
            {ramp.length > 0 && (
              <div style={{ display: "flex", gap: 3 }}>
                {ramp.map((c, i) => (
                  <button key={i} onClick={() => { setSel(c); addCustom(c); }} title={t("kidSheet.mixed")}
                    style={{ flex: 1, height: 24, borderRadius: 4, border: "none", background: rgb2css(c), cursor: "pointer", padding: 0 }} />
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => setMixOpen(false)} style={chipStyle}>{t("kidSheet.ok")}</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", background: accent, color: "#1e0800", padding: "7px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700, zIndex: 30, pointerEvents: "none" }}>{toast}</div>
      )}
    </div>
  );
}

function scaleFrame(src: KidFrame, from: number, to: number): KidFrame {
  const out = blankKidFrame(to);
  for (let y = 0; y < to; y++) for (let x = 0; x < to; x++) {
    const sx = Math.floor((x * from) / to);
    const sy = Math.floor((y * from) / to);
    const si = (sy * from + sx) * 4;
    const di = (y * to + x) * 4;
    out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3];
  }
  return out;
}
