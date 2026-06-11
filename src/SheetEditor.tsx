import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useEditor } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import type { SheetData, SheetSprites } from "./state/IdeState";
import {
  Pencil, Eraser, PaintBucket, Undo2, Redo2, Grid2x2,
  Maximize, PanelRight, Square, Circle, Spline,
  MousePointer2, SunDim, Sun, LayoutGrid, Stamp, Library, Wand2,
} from "lucide-react";
import {
  ACTOR_RESERVED, connectedBounds, padBoundsToGrid,
  anyStripOverlaps, findOverlappingStrips, suggestSpriteName,
  validateSpriteName, snapRegion, hitTestSprites,
} from "./sheetGeometry";

// ── Constants ─────────────────────────────────────────────────────────────────

const BLANK_W = 512;
const BLANK_H = 512;
const SHADE_STEP = 0.13;

const BRUSH_SIZES = [
  { size: 1, dotPx: 3 },
  { size: 2, dotPx: 5 },
  { size: 4, dotPx: 9 },
  { size: 8, dotPx: 15 },
];

const GRID_SIZES = [1, 2, 4, 8, 16, 32, 64, 128];
function prevGridSize(s: number): number { const i = GRID_SIZES.indexOf(s); return i > 0 ? GRID_SIZES[i - 1] : GRID_SIZES[0]; }
function nextGridSize(s: number): number { const i = GRID_SIZES.indexOf(s); return i < GRID_SIZES.length - 1 ? GRID_SIZES[i + 1] : GRID_SIZES[GRID_SIZES.length - 1]; }

const PALETTE = [
  "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57",
  "#ffcd75", "#a7f070", "#38b764", "#257179",
  "#29366f", "#3b5dc9", "#41a6f6", "#73eff7",
  "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
];

export { PAL_NAMES } from './palette';

// ── Types ─────────────────────────────────────────────────────────────────────

type DrawTool = "pencil" | "eraser" | "darken" | "lighten";
type Tool = DrawTool | "fill" | "line" | "rect" | "ellipse" | "region" | "select" | "tile" | "wand";
type ShapeTool = "line" | "rect" | "ellipse";
const SHAPE_TOOLS: ReadonlySet<ShapeTool> = new Set(["line", "rect", "ellipse"]);
type SelectedFrame = { sprite: string; anim: string; idx: number };
type RegionDrag = { sx: number; sy: number; ex: number; ey: number };
type Clip = { x: number; y: number; w: number; h: number };
type SelectDrag = {
  sprite: string;
  origX: number; origY: number; origW: number; origH: number;
  pixels: Uint8ClampedArray;
  px0: number; py0: number;
  dx: number; dy: number;
  freeMove?: boolean;
} | null;
type ContextMenu = { x: number; y: number; type: "sprite" | "anim"; sprite: string; anim?: string } | null;
type MoveSpriteDrag = { sprite: string; origStrips: Record<string, { x: number; y: number; frameW: number; frameH: number; frameCount: number }>; px0: number; py0: number } | null;
type ResizeSpriteDrag = { sprite: string; anim: string; origFrameW: number; origFrameH: number; px0: number; py0: number } | null;
type InlineError = { sprite: string; anim: string; msg: string } | null;

// ── Encode / decode ───────────────────────────────────────────────────────────

function decodePixels(pixels: string): Uint8ClampedArray {
  const raw = atob(pixels);
  const buf = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

function encodePixels(buf: Uint8ClampedArray): string {
  // Chunk to avoid stack overflow from spread; much faster than per-char concatenation.
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < buf.length; i += CHUNK)
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(s);
}

function blankSheet(): SheetData {
  return { pixels: encodePixels(new Uint8ClampedArray(BLANK_W * BLANK_H * 4)), width: BLANK_W, height: BLANK_H, sprites: {} };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function lerpCh(a: number, b: number, t: number) {
  return Math.max(0, Math.min(255, Math.round(a + (b - a) * t)));
}

// ── Pixel operations ──────────────────────────────────────────────────────────

function inClip(px: number, py: number, clip: Clip | null): boolean {
  if (!clip) return true;
  return px >= clip.x && py >= clip.y && px < clip.x + clip.w && py < clip.y + clip.h;
}

function paintPixel(buf: Uint8ClampedArray, w: number, h: number, px: number, py: number, tool: DrawTool, color: string, clip: Clip | null) {
  if (px < 0 || py < 0 || px >= w || py >= h) return;
  if (!inClip(px, py, clip)) return;
  const idx = (py * w + px) * 4;
  if (tool === "eraser") {
    buf[idx] = buf[idx + 1] = buf[idx + 2] = buf[idx + 3] = 0;
  } else if (tool === "pencil") {
    const [r, g, b] = hexToRgb(color);
    buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
  } else if (tool === "darken") {
    if (buf[idx + 3] === 0) return;
    buf[idx] = lerpCh(buf[idx], 0x1a, SHADE_STEP);
    buf[idx + 1] = lerpCh(buf[idx + 1], 0x1c, SHADE_STEP);
    buf[idx + 2] = lerpCh(buf[idx + 2], 0x2c, SHADE_STEP);
  } else if (tool === "lighten") {
    if (buf[idx + 3] === 0) return;
    buf[idx] = lerpCh(buf[idx], 0xf4, SHADE_STEP);
    buf[idx + 1] = lerpCh(buf[idx + 1], 0xf4, SHADE_STEP);
    buf[idx + 2] = lerpCh(buf[idx + 2], 0xf4, SHADE_STEP);
  }
}

function paintBrush(buf: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, tool: DrawTool, color: string, size: number, clip: Clip | null) {
  if (size <= 1) { paintPixel(buf, w, h, cx, cy, tool, color, clip); return; }
  const r = Math.floor(size / 2);
  for (let dy = -r; dy < size - r; dy++)
    for (let dx = -r; dx < size - r; dx++)
      paintPixel(buf, w, h, cx + dx, cy + dy, tool, color, clip);
}

function stampTile(dst: Uint8ClampedArray, dstW: number, dstH: number, src: Uint8ClampedArray, srcW: number, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) {
  for (let row = 0; row < sh; row++) {
    const srcRow = (sy + row) * srcW * 4 + sx * 4;
    const dstRow = (dy + row) * dstW * 4 + dx * 4;
    for (let col = 0; col < sw; col++) {
      const si = srcRow + col * 4, di = dstRow + col * 4;
      if (dx + col < 0 || dx + col >= dstW || dy + row < 0 || dy + row >= dstH) continue;
      if (src[si + 3] === 0) continue;
      dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3];
    }
  }
}

function floodFill(buf: Uint8ClampedArray, w: number, h: number, px: number, py: number, color: string, clip: Clip | null) {
  if (px < 0 || py < 0 || px >= w || py >= h) return;
  const i0 = (py * w + px) * 4;
  const [tr, tg, tb, ta] = [buf[i0], buf[i0 + 1], buf[i0 + 2], buf[i0 + 3]];
  const [nr, ng, nb] = hexToRgb(color);
  if (tr === nr && tg === ng && tb === nb && ta === 255) return;
  const stack: [number, number][] = [[px, py]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (!inClip(cx, cy, clip)) continue;
    const ci = (cy * w + cx) * 4;
    if (buf[ci] !== tr || buf[ci + 1] !== tg || buf[ci + 2] !== tb || buf[ci + 3] !== ta) continue;
    buf[ci] = nr; buf[ci + 1] = ng; buf[ci + 2] = nb; buf[ci + 3] = 255;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

// ── Shape rasterizers ─────────────────────────────────────────────────────────

function bresenhamLine(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function rectOutline(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let x = xa; x <= xb; x++) { plot(x, ya); plot(x, yb); }
  for (let y = ya; y <= yb; y++) { plot(xa, y); plot(xb, y); }
}

function ellipseOutline(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
  const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
  const steps = Math.max(16, Math.round(2 * Math.PI * Math.max(rx, ry)));
  const seen = new Set<string>();
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(a) * rx);
    const py = Math.round(cy + Math.sin(a) * ry);
    const k = `${px},${py}`;
    if (seen.has(k)) continue;
    seen.add(k);
    plot(px, py);
  }
}

// ── Color picker popover ──────────────────────────────────────────────────────

function ColorPicker({ color, secondaryColor, onColor, onSecondary, onClose, theme }: {
  color: string; secondaryColor: string;
  onColor: (c: string) => void; onSecondary: (c: string) => void;
  onClose: () => void; theme: Record<string, string>;
}) {
  const { t } = useTranslation();
  const { surfacePanel, panelTxtMute, panelBorder, accent } = theme;
  const [editing, setEditing] = useState<"a" | "b">("a");
  const activeColor = editing === "b" ? secondaryColor : color;
  const lerpSteps = useMemo(() => {
    const [r1, g1, b1] = hexToRgb(color);
    const [r2, g2, b2] = hexToRgb(secondaryColor);
    return Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      return rgbToHex(lerpCh(r1, r2, t), lerpCh(g1, g2, t), lerpCh(b1, b2, t));
    });
  }, [color, secondaryColor]);

  return (
    <div style={{ position: "absolute", left: 0, top: "calc(100% + 4px)", zIndex: 50, background: surfacePanel, border: `1px solid ${panelBorder}`, borderRadius: 6, padding: 8, width: 168, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2, marginBottom: 8 }}>
        {PALETTE.map((c) => (
          <button key={c} onClick={() => { if (editing === "b") onSecondary(c); else { onColor(c); onClose(); } }}
            style={{ width: 18, height: 18, borderRadius: 2, padding: 0, cursor: "pointer", background: c, border: `2px solid ${activeColor === c ? "#fff" : "transparent"}`, outline: activeColor === c ? `1px solid ${accent}` : "none" }} />
        ))}
      </div>
      <div style={{ fontSize: 9, color: panelTxtMute, marginBottom: 4 }}>{t('sheetEditor.lerpLabel')}</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        <button title={t('sheetEditor.editColorA')} onClick={() => setEditing("a")} style={{ flex: 1, height: 20, borderRadius: 3, cursor: "pointer", padding: 0, background: color, border: `2px solid ${editing === "a" ? "#fff" : panelBorder}`, outline: editing === "a" ? `1px solid ${accent}` : "none" }} />
        <button title={t('sheetEditor.editColorB')} onClick={() => setEditing("b")} style={{ flex: 1, height: 20, borderRadius: 3, cursor: "pointer", padding: 0, background: secondaryColor, border: `2px solid ${editing === "b" ? "#fff" : panelBorder}`, outline: editing === "b" ? `1px solid ${accent}` : "none" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 2 }}>
        {lerpSteps.map((c, i) => (
          <button key={i} title={c} onClick={() => { onColor(c); onClose(); }} style={{ height: 14, borderRadius: 2, padding: 0, cursor: "pointer", background: c, border: `1px solid ${color === c ? "#fff" : "transparent"}` }} />
        ))}
      </div>
    </div>
  );
}

// ── Tool definitions ──────────────────────────────────────────────────────────

function isBrushTool(t: Tool): t is DrawTool {
  return t === "pencil" || t === "eraser" || t === "darken" || t === "lighten";
}

function toolCursor(t: Tool): string {
  if (t === "select") return "default";
  if (t === "wand") return "crosshair";
  if (t === "fill") return "cell";
  if (t === "tile") return "copy";
  return "crosshair";
}

const TOOL_DEFS: { id: Tool; label: string; icon: React.ReactNode; group: number }[] = [
  { id: "select",  label: "Select / Move", icon: <MousePointer2 size={20} strokeWidth={1.5} />, group: 1 },
  { id: "wand",    label: "sheetEditor.toolWand",   icon: <Wand2 size={20} strokeWidth={1.5} />, group: 1 },
  { id: "pencil",  label: "Pencil",       icon: <Pencil size={20} strokeWidth={1.5} />, group: 1 },
  { id: "eraser",  label: "Eraser",       icon: <Eraser size={20} strokeWidth={1.5} />, group: 1 },
  { id: "fill",    label: "Fill",         icon: <PaintBucket size={20} strokeWidth={1.5} />, group: 1 },
  { id: "darken",  label: "Darken",       icon: <SunDim size={20} strokeWidth={1.5} />, group: 2 },
  { id: "lighten", label: "Lighten",      icon: <Sun size={20} strokeWidth={1.5} />, group: 2 },
  { id: "line",    label: "Line",         icon: <Spline size={20} strokeWidth={1.5} />, group: 3 },
  { id: "rect",    label: "Rect",         icon: <Square size={20} strokeWidth={1.5} />, group: 3 },
  { id: "ellipse", label: "Ellipse",      icon: <Circle size={20} strokeWidth={1.5} />, group: 3 },
  { id: "region",  label: "sheetEditor.toolRegion", icon: <LayoutGrid size={20} strokeWidth={1.5} />, group: 4 },
  { id: "tile",    label: "Tile",         icon: <Stamp size={20} strokeWidth={1.5} />, group: 4 },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function SheetEditor({ onClose, initialSprite }: { onClose: () => void; initialSprite?: string }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const project = useEditor((s) => s.project);
  const setSheet = useEditor((s) => s.setSheet);

  useEffect(() => { if (!project.sheet) setSheet(blankSheet()); }, [project.sheet, setSheet]);

  const sheet = project.sheet ?? blankSheet();
  const sheetW = sheet.width;
  const sheetH = sheet.height;
  const pixBuf = useRef<Uint8ClampedArray>(decodePixels(sheet.pixels));
  useEffect(() => { pixBuf.current = decodePixels(sheet.pixels); }, [sheet.pixels]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(2);
  const coordsBarRef = useRef<HTMLSpanElement>(null);
  const panelRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingScrollAdjust = useRef<{ left: number; top: number } | null>(null);

  type UndoEntry = { pixels: Uint8ClampedArray; sprites: SheetSprites };
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  const clipboardRef = useRef<{ pixels: Uint8ClampedArray; w: number; h: number } | null>(null);
  const renderCanvasRef = useRef<() => void>(() => {});
  const imageDataRef = useRef<ImageData | null>(null);

  const [zoom, setZoom] = useState(2);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState(PALETTE[12]);
  const [secondaryColor, setSecondaryColor] = useState(PALETTE[0]);
  const [lerpOverride, setLerpOverride] = useState<string | null>(null);
  useEffect(() => { setLerpOverride(null); }, [color]);
  const [brushSize, setBrushSize] = useState(1);
  const brushOverlayRef = useRef<HTMLDivElement>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(1);
  const [selectedFrame, setSelectedFrame] = useState<SelectedFrame | null>(null);
  const [painting, setPainting] = useState(false);
  // These four were React state and triggered a full re-render on every pointer-move.
  // They are now refs; canvas is painted imperatively so React never re-renders during a drag.
  const regionDragRef = useRef<RegionDrag | null>(null);
  const selectDragRef = useRef<SelectDrag>(null);
  const selectDragOffRef = useRef<OffscreenCanvas | null>(null); // cached float canvas
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragNowRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null); // cached getBoundingClientRect
  const [pendingRegion, setPendingRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingNameError, setPendingNameError] = useState("");

  useEffect(() => { dragStartRef.current = null; dragNowRef.current = null; if (wandHoverRef.current) wandHoverRef.current.style.display = 'none'; }, [tool]);

  useEffect(() => { pendingRegionRef.current = pendingRegion; }, [pendingRegion]);

  const [renamingSprite, setRenamingSprite] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingAnim, setRenamingAnim] = useState<{ sprite: string; anim: string } | null>(null);
  const [animRenameValue, setAnimRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [tileSprite, setTileSprite] = useState<string | null>(null);
  const tileSpacingRef = useRef<number>(1);
  const [frameError, setFrameError] = useState<InlineError>(null);
  const [animAddError, setAnimAddError] = useState<{ sprite: string; msg: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [expandedSprites, setExpandedSprites] = useState<Set<string>>(new Set());
  const [previewAnim, setPreviewAnim] = useState<{ sprite: string; anim: string } | null>(null);
  const [previewFrame, setPreviewFrame] = useState(0);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus on initialSprite when provided
  useEffect(() => {
    if (initialSprite && sheet.sprites[initialSprite]) {
      const firstAnim = Object.keys(sheet.sprites[initialSprite].animations)[0] ?? 'default';
      setSelectedFrame({ sprite: initialSprite, anim: firstAnim, idx: 0 });
      setExpandedSprites(new Set([initialSprite]));
    }
  }, [initialSprite, sheet.sprites]);

  const startHoverPreview = useCallback((sn: string, an: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setPreviewAnim({ sprite: sn, anim: an }), 2000);
  }, []);
  const clearHoverPreview = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setPreviewAnim(null); setPreviewFrame(0);
  }, []);
  const [moveSpriteDrag, setMoveSpriteDrag] = useState<MoveSpriteDrag>(null);
  const [resizeSpriteDrag, setResizeSpriteDrag] = useState<ResizeSpriteDrag>(null);
  const tileOverlayRef = useRef<HTMLDivElement>(null);
  const sizeChipRef = useRef<HTMLDivElement>(null);
  const wandHoverRef = useRef<HTMLDivElement>(null);
  const wandPendingRef = useRef<{ x: number; y: number; w: number; h: number; pixels: Uint8ClampedArray } | null>(null);
  const wandLastHoverPxRef = useRef<{x: number; y: number} | null>(null);
  const overlapFlashRef = useRef<{ rects: Array<{x:number;y:number;w:number;h:number}>; attempted: {x:number;y:number;w:number;h:number} } | null>(null);
  const overlapFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRegionRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const moveOffscreenRef = useRef<OffscreenCanvas | null>(null);
  const moveOrigBoundsRef = useRef<{x: number; y: number; w: number; h: number} | null>(null);
  const moveOffRef = useRef<{dx: number; dy: number}>({ dx: 0, dy: 0 });
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => { zoomRef.current = zoom; canvasRectRef.current = null; }, [zoom]);
  useEffect(() => {
    const adj = pendingScrollAdjust.current;
    if (adj && scrollRef.current) { scrollRef.current.scrollLeft = adj.left; scrollRef.current.scrollTop = adj.top; pendingScrollAdjust.current = null; }
  }, [zoom]);

  // Invalidate cached canvas rect on scroll or window resize
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const inv = () => { canvasRectRef.current = null; };
    el.addEventListener("scroll", inv, { passive: true });
    window.addEventListener("resize", inv, { passive: true });
    return () => { el.removeEventListener("scroll", inv); window.removeEventListener("resize", inv); };
  }, []);

  // Ctrl+wheel zoom, Shift+wheel horizontal scroll
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const cur = zoomRef.current;
        const next = Math.max(0.25, Math.min(16, e.deltaY < 0 ? cur * 2 : cur / 2));
        if (next === cur) return;
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const sheetX = (el.scrollLeft + mx) / cur, sheetY = (el.scrollTop + my) / cur;
        pendingScrollAdjust.current = { left: sheetX * next - mx, top: sheetY * next - my };
        setZoom(next);
      } else if (e.shiftKey) { e.preventDefault(); el.scrollLeft += e.deltaY; }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    const currentSprites = useEditor.getState().project.sheet?.sprites ?? {};
    undoStack.current.push({ pixels: new Uint8ClampedArray(pixBuf.current), sprites: structuredClone(currentSprites) });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const performUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const currentSprites = useEditor.getState().project.sheet?.sprites ?? {};
    redoStack.current.push({ pixels: new Uint8ClampedArray(pixBuf.current), sprites: structuredClone(currentSprites) });
    const snap = undoStack.current.pop()!;
    pixBuf.current.set(snap.pixels);
    setSheet({ ...sheet, pixels: encodePixels(snap.pixels), sprites: snap.sprites });
    renderCanvasRef.current();
  }, [sheet, setSheet]);

  const performRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const currentSprites = useEditor.getState().project.sheet?.sprites ?? {};
    undoStack.current.push({ pixels: new Uint8ClampedArray(pixBuf.current), sprites: structuredClone(currentSprites) });
    const snap = redoStack.current.pop()!;
    pixBuf.current.set(snap.pixels);
    setSheet({ ...sheet, pixels: encodePixels(snap.pixels), sprites: snap.sprites });
    renderCanvasRef.current();
  }, [sheet, setSheet]);

  const triggerOverlapFlash = useCallback((overlaps: ReturnType<typeof findOverlappingStrips>, attempted: {x:number;y:number;w:number;h:number}) => {
    overlapFlashRef.current = { rects: overlaps.map(o => o.rect), attempted };
    if (overlapFlashTimerRef.current) clearTimeout(overlapFlashTimerRef.current);
    overlapFlashTimerRef.current = setTimeout(() => { overlapFlashRef.current = null; renderCanvasRef.current(); }, 1200);
    renderCanvasRef.current();
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  // Keep volatile closure deps in a ref so the keydown listener registers exactly once.
  // Reading these from a ref avoids re-binding the global listener on every paint/state change,
  // which was the dominant source of editor freezes during heavy drawing.
  const kbRef = useRef({ color, secondaryColor, selectedFrame, sheet, sheetW, performUndo, performRedo, pushUndo, setSheet });
  kbRef.current = { color, secondaryColor, selectedFrame, sheet, sheetW, performUndo, performRedo, pushUndo, setSheet };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const { color, secondaryColor, selectedFrame, sheet, sheetW, performUndo, performRedo, pushUndo, setSheet } = kbRef.current;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "z" || e.key === "Z") { e.preventDefault(); if (e.shiftKey) performRedo(); else performUndo(); }
        else if (e.key === "y" || e.key === "Y") { e.preventDefault(); performRedo(); }
        else if ((e.key === "c" || e.key === "C") && !e.shiftKey) {
          if (selectedFrame) {
            const strip = sheet.sprites[selectedFrame.sprite]?.animations[selectedFrame.anim];
            if (strip) {
              e.preventDefault();
              const x = strip.x + selectedFrame.idx * strip.frameW, y = strip.y, w = strip.frameW, h = strip.frameH;
              const pixels = new Uint8ClampedArray(w * h * 4);
              for (let row = 0; row < h; row++) pixels.set(pixBuf.current.subarray(((y + row) * sheetW + x) * 4, ((y + row) * sheetW + x + w) * 4), row * w * 4);
              clipboardRef.current = { pixels, w, h };
            }
          }
        }
        else if ((e.key === "v" || e.key === "V") && !e.shiftKey) {
          if (clipboardRef.current && selectedFrame) {
            const strip = sheet.sprites[selectedFrame.sprite]?.animations[selectedFrame.anim];
            if (strip) {
              e.preventDefault();
              const { pixels, w, h } = clipboardRef.current;
              const cx = strip.x + selectedFrame.idx * strip.frameW, cy = strip.y, cw = strip.frameW, ch = strip.frameH;
              pushUndo();
              for (let row = 0; row < Math.min(h, ch); row++)
                for (let col = 0; col < Math.min(w, cw); col++) {
                  const si = (row * w + col) * 4;
                  if (pixels[si + 3] === 0) continue;
                  const di = ((cy + row) * sheetW + cx + col) * 4;
                  pixBuf.current[di] = pixels[si]; pixBuf.current[di+1] = pixels[si+1]; pixBuf.current[di+2] = pixels[si+2]; pixBuf.current[di+3] = pixels[si+3];
                }
              setSheet({ ...sheet, pixels: encodePixels(pixBuf.current) });
              renderCanvasRef.current();
            }
          }
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, Tool> = { v: "select", w: "wand", b: "pencil", e: "eraser", g: "fill", d: "darken", l: "lighten", n: "line", u: "rect", o: "ellipse", r: "region", t: "tile" };
      const k = e.key.toLowerCase();
      if (map[k]) setTool(map[k]);
      else if (k === "h") setPanelOpen((p) => !p);
      else if (k === "x") { setColor(secondaryColor); setSecondaryColor(color); setLerpOverride(null); }
      else if (e.key === "[" || e.key === "]") {
        if (!selectedFrame) return;
        const strip = sheet.sprites[selectedFrame.sprite]?.animations[selectedFrame.anim];
        if (!strip || strip.frameCount <= 1) return;
        const dir = e.key === "]" ? 1 : -1;
        const next = Math.max(0, Math.min(strip.frameCount - 1, selectedFrame.idx + dir));
        if (next !== selectedFrame.idx) setSelectedFrame({ ...selectedFrame, idx: next });
      }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Escape cancels drag ──────────────────────────────────────────────────────

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const sd = selectDragRef.current;
      if (!sd) return;
      e.preventDefault();
      // If pixels were lifted (selectDragOffRef exists), put them back at original position
      if (selectDragOffRef.current) {
        // Pop the undo frame that was pushed at lift
        undoStack.current.pop();
        // Restore original pixels
        for (let row = 0; row < sd.origH; row++)
          pixBuf.current.set(sd.pixels.subarray(row * sd.origW * 4, (row + 1) * sd.origW * 4), ((sd.origY + row) * sheetW + sd.origX) * 4);
      }
      selectDragRef.current = null;
      selectDragOffRef.current = null;
      wandPendingRef.current = null;
      renderCanvasRef.current();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [sheetW]);

  // ── Canvas render ────────────────────────────────────────────────────────────

  const clipRect = useMemo((): Clip | null => {
    if (!selectedFrame) return null;
    const strip = sheet.sprites[selectedFrame.sprite]?.animations[selectedFrame.anim];
    if (!strip) return null;
    return { x: strip.x + selectedFrame.idx * strip.frameW, y: strip.y, w: strip.frameW, h: strip.frameH };
  }, [selectedFrame, sheet.sprites]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    // Reuse a persistent ImageData to avoid per-frame allocations on the hot paint path.
    // Recreate only when dimensions change (rare); hot path is just data.set + putImageData.
    if (!imageDataRef.current || imageDataRef.current.width !== sheetW || imageDataRef.current.height !== sheetH) {
      imageDataRef.current = new ImageData(new Uint8ClampedArray(sheetW * sheetH * 4), sheetW, sheetH);
    }
    imageDataRef.current.data.set(pixBuf.current);
    ctx.putImageData(imageDataRef.current, 0, 0);
    if (clipRect) {
      ctx.strokeStyle = "#5fd4dc";
      ctx.lineWidth = 1 / zoomRef.current;
      ctx.strokeRect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    }
    const sd = selectDragRef.current;
    if (sd && selectDragOffRef.current) {
      const nx = Math.max(0, Math.min(sheetW - sd.origW, sd.origX + sd.dx));
      const ny = Math.max(0, Math.min(sheetH - sd.origH, sd.origY + sd.dy));
      ctx.globalAlpha = 0.9;
      ctx.drawImage(selectDragOffRef.current, nx, ny);
      ctx.globalAlpha = 1;
    }
    const rd = regionDragRef.current;
    if (rd) {
      const x = Math.min(rd.sx, rd.ex), y = Math.min(rd.sy, rd.ey);
      const w = Math.abs(rd.ex - rd.sx), h = Math.abs(rd.ey - rd.sy);
      ctx.strokeStyle = "#ef7d57"; ctx.lineWidth = 1 / zoomRef.current; ctx.setLineDash([4 / zoomRef.current, 4 / zoomRef.current]);
      ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    }
    const pr = pendingRegionRef.current;
    if (pr) {
      ctx.strokeStyle = "#41a6f6";
      ctx.lineWidth = 1 / zoomRef.current;
      ctx.strokeRect(pr.x, pr.y, pr.w, pr.h);
    }
    const flash = overlapFlashRef.current;
    if (flash) {
      ctx.strokeStyle = "#b13e53";
      ctx.lineWidth = 1 / zoomRef.current;
      ctx.setLineDash([4 / zoomRef.current, 4 / zoomRef.current]);
      for (const r of flash.rects) ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#ef7d57";
      ctx.strokeRect(flash.attempted.x, flash.attempted.y, flash.attempted.w, flash.attempted.h);
      ctx.setLineDash([]);
    }
    if (moveOffscreenRef.current && moveOrigBoundsRef.current) {
      const mb = moveOrigBoundsRef.current;
      const mo = moveOffRef.current;
      const fSh = useEditor.getState().project.sheet;
      const fSw2 = fSh?.width ?? BLANK_W, fSh2 = fSh?.height ?? BLANK_H;
      const nx = Math.max(0, Math.min(fSw2 - mb.w, mb.x + mo.dx));
      const ny = Math.max(0, Math.min(fSh2 - mb.h, mb.y + mo.dy));
      ctx.globalAlpha = 0.9;
      ctx.drawImage(moveOffscreenRef.current, nx, ny);
      ctx.globalAlpha = 1;
    }
    const ds = dragStartRef.current, dn = dragNowRef.current;
    if (ds && dn && SHAPE_TOOLS.has(tool as ShapeTool)) {
      const [r, g, b] = hexToRgb(lerpOverride ?? color);
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
      const stamp = (px: number, py: number) => {
        if (px < 0 || py < 0 || px >= sheetW || py >= sheetH) return;
        if (clipRect && !inClip(px, py, clipRect)) return;
        ctx.fillRect(px, py, 1, 1);
      };
      if (tool === "line") bresenhamLine(ds.x, ds.y, dn.x, dn.y, stamp);
      if (tool === "rect") rectOutline(ds.x, ds.y, dn.x, dn.y, stamp);
      if (tool === "ellipse") ellipseOutline(ds.x, ds.y, dn.x, dn.y, stamp);
    }
  }, [clipRect, tool, lerpOverride, color, sheetW, sheetH]);

  useEffect(() => { renderCanvasRef.current = renderCanvas; }, [renderCanvas]);
  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ── Preview animation ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!previewAnim) { if (previewIntervalRef.current) clearInterval(previewIntervalRef.current); return; }
    const strip = sheet.sprites[previewAnim.sprite]?.animations[previewAnim.anim];
    const fps = strip?.fps ?? 8; setPreviewFrame(0);
    previewIntervalRef.current = setInterval(() => setPreviewFrame((f) => f + 1), 1000 / fps);
    return () => { if (previewIntervalRef.current) clearInterval(previewIntervalRef.current); };
  }, [previewAnim, sheet.sprites]);

  useEffect(() => {
    if (!previewAnim || !previewCanvasRef.current) return;
    const strip = sheet.sprites[previewAnim.sprite]?.animations[previewAnim.anim];
    if (!strip || strip.frameCount === 0) return;
    const fi = previewFrame % strip.frameCount;
    const fx = strip.x + fi * strip.frameW, fy = strip.y;
    const { frameW: fw, frameH: fh } = strip;
    const canvas = previewCanvasRef.current;
    canvas.width = fw * 3; canvas.height = fh * 3;
    const ctx = canvas.getContext("2d")!; ctx.imageSmoothingEnabled = false;
    const frameBuf = new Uint8ClampedArray(fw * fh * 4);
    for (let row = 0; row < fh; row++)
      frameBuf.set(pixBuf.current.subarray(((fy + row) * sheetW + fx) * 4, ((fy + row) * sheetW + fx + fw) * 4), row * fw * 4);
    const poff = new OffscreenCanvas(fw, fh);
    const pc = new Uint8ClampedArray(frameBuf.length); pc.set(frameBuf);
    poff.getContext("2d")!.putImageData(new ImageData(pc, fw, fh), 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(poff, 0, 0, fw * 3, fh * 3);
  }, [previewAnim, previewFrame, sheet.sprites, sheetW]);

  useEffect(() => { if (!panelOpen || !selectedFrame) return; panelRowRefs.current.get(`${selectedFrame.sprite}::${selectedFrame.anim}`)?.scrollIntoView({ block: "nearest" }); }, [selectedFrame, panelOpen]);

  // ── Canvas ↔ sheet coordinate conversion ─────────────────────────────────────

  const canvasCoords = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    if (!canvasRectRef.current) canvasRectRef.current = canvas.getBoundingClientRect();
    const rect = canvasRectRef.current;
    const cx = Math.floor((e.clientX - rect.left) / zoom);
    const cy = Math.floor((e.clientY - rect.top) / zoom);
    return { x: Math.max(0, Math.min(sheetW - 1, cx)), y: Math.max(0, Math.min(sheetH - 1, cy)) };
  }, [zoom, sheetW, sheetH]);

  const fitToView = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    const vw = el.clientWidth, vh = el.clientHeight;
    const raw = Math.min(vw / (sheetW + 32), vh / (sheetH + 32));
    setZoom(Math.max(0.25, Math.min(16, [0.25, 0.5, 1, 2, 4, 8, 16].reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a))));
  }, [sheetW, sheetH]);

  // ── Pointer handlers ──────────────────────────────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) { const c = canvasCoords(e); if (c) { const idx = (c.y * sheetW + c.x) * 4; if (pixBuf.current[idx + 3] > 0) setColor(rgbToHex(pixBuf.current[idx], pixBuf.current[idx + 1], pixBuf.current[idx + 2])); } return; }
    if (e.button !== 0) return;
    const coords = canvasCoords(e); if (!coords) return;
    if (tool === "select") {
      if (clipRect && inClip(coords.x, coords.y, clipRect)) {
        pushUndo();
        const { x: cx, y: cy, w: cw, h: ch } = clipRect;
        const pixels = new Uint8ClampedArray(cw * ch * 4);
        for (let row = 0; row < ch; row++) { const src = ((cy + row) * sheetW + cx) * 4; pixels.set(pixBuf.current.subarray(src, src + cw * 4), row * cw * 4); pixBuf.current.fill(0, src, src + cw * 4); }
        const off = new OffscreenCanvas(cw, ch); off.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), cw, ch), 0, 0);
        selectDragOffRef.current = off;
        selectDragRef.current = { sprite: selectedFrame!.sprite, origX: cx, origY: cy, origW: cw, origH: ch, pixels, px0: coords.x, py0: coords.y, dx: 0, dy: 0, freeMove: true };
        renderCanvas(); (e.target as Element).setPointerCapture(e.pointerId); return;
      }
      // Hit-test sprites: first click selects a frame, second click (when it IS the selected frame) falls through to sprite-block lift
      const hit = hitTestSprites(sheet.sprites, coords.x, coords.y);
      if (hit && (!selectedFrame || hit.sprite !== selectedFrame.sprite || hit.anim !== selectedFrame.anim || hit.idx !== selectedFrame.idx)) {
        setSelectedFrame(hit);
        return;
      }
      for (const [sn, se] of Object.entries(sheet.sprites)) {
        const strips = Object.values(se.animations); if (strips.length === 0) continue;
        const ox = Math.min(...strips.map(s => s.x)), oy = Math.min(...strips.map(s => s.y));
        const ow = Math.max(...strips.map(s => s.x + s.frameW * s.frameCount)) - ox, oh = Math.max(...strips.map(s => s.y + s.frameH)) - oy;
        if (coords.x < ox || coords.x >= ox + ow || coords.y < oy || coords.y >= oy + oh) continue;
        pushUndo();
        const pixels = new Uint8ClampedArray(ow * oh * 4);
        for (let row = 0; row < oh; row++) { const src = ((oy + row) * sheetW + ox) * 4; pixels.set(pixBuf.current.subarray(src, src + ow * 4), row * ow * 4); pixBuf.current.fill(0, src, src + ow * 4); }
        const off = new OffscreenCanvas(ow, oh); off.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), ow, oh), 0, 0);
        selectDragOffRef.current = off;
        selectDragRef.current = { sprite: sn, origX: ox, origY: oy, origW: ow, origH: oh, pixels, px0: coords.x, py0: coords.y, dx: 0, dy: 0 };
        renderCanvas(); (e.target as Element).setPointerCapture(e.pointerId); return;
      }
      return;
    }
    if (tool === "wand") {
      const bounds = connectedBounds(pixBuf.current, sheetW, sheetH, coords.x, coords.y);
      if (!bounds) return;
      const padSize = showGrid && gridSize > 1 ? gridSize : 1;
      const { x: bx, y: by, w: bw, h: bh } = padBoundsToGrid(bounds.x, bounds.y, bounds.w, bounds.h, padSize);
      const clampedX = Math.max(0, bx), clampedY = Math.max(0, by);
      const clampedW = Math.min(bw, sheetW - clampedX), clampedH = Math.min(bh, sheetH - clampedY);
      if (clampedW < 1 || clampedH < 1) return;
      // Store as pending — don't cut pixels yet (deferred lift on first movement)
      const pixels = new Uint8ClampedArray(clampedW * clampedH * 4);
      for (let row = 0; row < clampedH; row++)
        for (let col = 0; col < clampedW; col++) {
          const si = ((clampedY + row) * sheetW + clampedX + col) * 4;
          const di = (row * clampedW + col) * 4;
          pixels[di] = pixBuf.current[si]; pixels[di+1] = pixBuf.current[si+1]; pixels[di+2] = pixBuf.current[si+2]; pixels[di+3] = pixBuf.current[si+3];
        }
      wandPendingRef.current = { x: clampedX, y: clampedY, w: clampedW, h: clampedH, pixels };
      selectDragRef.current = { sprite: selectedFrame?.sprite ?? "", origX: clampedX, origY: clampedY, origW: clampedW, origH: clampedH, pixels, px0: coords.x, py0: coords.y, dx: 0, dy: 0, freeMove: true };
      (e.target as Element).setPointerCapture(e.pointerId); return;
    }
    if (tool === "region") { regionDragRef.current = { sx: coords.x, sy: coords.y, ex: coords.x, ey: coords.y }; (e.target as Element).setPointerCapture(e.pointerId); return; }
    if (tool === "tile" && tileSprite && sheet.sprites[tileSprite]) {
      const strips = Object.values(sheet.sprites[tileSprite].animations); if (strips.length === 0) return;
      const strip = strips[0]; const tw = strip.frameW, th = strip.frameH;
      const spacing = tileSpacingRef.current >= 1 ? tileSpacingRef.current : tw;
      const tx = Math.round((coords.x + tw / 2) / spacing) * spacing - Math.floor(tw / 2);
      const ty = Math.round((coords.y + th / 2) / spacing) * spacing - Math.floor(th / 2);
      pushUndo(); stampTile(pixBuf.current, sheetW, sheetH, pixBuf.current, sheetW, strip.x, strip.y, tw, th, tx, ty);
      setPainting(true); (e.target as Element).setPointerCapture(e.pointerId); renderCanvas(); return;
    }
    if (SHAPE_TOOLS.has(tool as ShapeTool)) {
      dragStartRef.current = { x: coords.x, y: coords.y };
      dragNowRef.current = { x: coords.x, y: coords.y };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    pushUndo(); setPainting(true); (e.target as Element).setPointerCapture(e.pointerId);
    const paintColor = lerpOverride ?? color;
    if (tool === "fill") floodFill(pixBuf.current, sheetW, sheetH, coords.x, coords.y, paintColor, clipRect);
    else paintBrush(pixBuf.current, sheetW, sheetH, coords.x, coords.y, tool as DrawTool, paintColor, brushSize, clipRect);
    renderCanvas();
  }, [tool, color, lerpOverride, brushSize, clipRect, canvasCoords, sheet.sprites, selectedFrame, renderCanvas, pushUndo, tileSprite, showGrid, gridSize, sheetW, sheetH]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const coords = canvasCoords(e); if (!coords) return;
    if (coordsBarRef.current) coordsBarRef.current.textContent = `abs ${coords.x}, ${coords.y}`;
    // Update brush/tile overlays imperatively to avoid a React re-render on every pointermove
    if (isBrushTool(tool)) {
      const el = brushOverlayRef.current;
      if (el) {
        const r = Math.floor(brushSize / 2);
        const z = zoomRef.current;
        el.style.display = 'block';
        el.style.left = `${(coords.x - r) * z}px`;
        el.style.top = `${(coords.y - r) * z}px`;
        el.style.width = `${brushSize * z}px`;
        el.style.height = `${brushSize * z}px`;
      }
    } else {
      if (brushOverlayRef.current) brushOverlayRef.current.style.display = 'none';
    }
    if (tool === "tile" && tileSprite && sheet.sprites[tileSprite]) {
      const strip = Object.values(sheet.sprites[tileSprite].animations)[0];
      if (strip) {
        const spacing = tileSpacingRef.current >= 1 ? tileSpacingRef.current : strip.frameW;
        const cx = Math.round((coords.x + strip.frameW / 2) / spacing) * spacing - Math.floor(strip.frameW / 2);
        const cy = Math.round((coords.y + strip.frameH / 2) / spacing) * spacing - Math.floor(strip.frameH / 2);
        const el = tileOverlayRef.current;
        if (el) {
          const z = zoomRef.current;
          el.style.display = 'block';
          el.style.left = `${Math.max(0, cx) * z}px`;
          el.style.top = `${Math.max(0, cy) * z}px`;
          el.style.width = `${strip.frameW * z}px`;
          el.style.height = `${strip.frameH * z}px`;
        }
      }
    } else {
      if (tileOverlayRef.current) tileOverlayRef.current.style.display = 'none';
    }
    if (tool === "region" && regionDragRef.current) {
      const rd = regionDragRef.current;
      if (showGrid && gridSize > 1 && !e.altKey) {
        const snapped = snapRegion(rd.sx, rd.sy, coords.x, coords.y, gridSize);
        regionDragRef.current = { sx: rd.sx, sy: rd.sy, ex: coords.x, ey: coords.y };
        const el = sizeChipRef.current;
        if (el) {
          const z = zoomRef.current;
          el.style.display = 'block';
          el.style.left = `${Math.max(snapped.x, coords.x) * z}px`;
          el.style.top = `${(Math.min(rd.sy, coords.y) + snapped.h) * z + 4}px`;
          const cellsW = snapped.w / gridSize, cellsH = snapped.h / gridSize;
          const divides = Number.isInteger(cellsW) && Number.isInteger(cellsH);
          el.textContent = divides ? `${snapped.w}×${snapped.h} (${cellsW}×${cellsH})` : `${snapped.w}×${snapped.h}`;
        }
      } else {
        regionDragRef.current = { ...rd, ex: coords.x, ey: coords.y };
        const el = sizeChipRef.current;
        if (el) {
          const z = zoomRef.current;
          const x = Math.min(rd.sx, coords.x), y = Math.min(rd.sy, coords.y);
          const w = Math.abs(coords.x - rd.sx), h = Math.abs(coords.y - rd.sy);
          el.style.display = 'block';
          el.style.left = `${(x + w) * z}px`;
          el.style.top = `${(y + h) * z + 4}px`;
          el.textContent = `${w}×${h}`;
        }
      }
      renderCanvasRef.current(); return;
    }
    if (tool === "wand" && selectDragRef.current) {
      const sd = selectDragRef.current;
      const newDx = coords.x - sd.px0, newDy = coords.y - sd.py0;
      // Perform lift on first actual movement
      if (wandPendingRef.current && (newDx !== 0 || newDy !== 0)) {
        const wp = wandPendingRef.current;
        pushUndo();
        for (let row = 0; row < wp.h; row++)
          for (let col = 0; col < wp.w; col++) {
            const si = ((wp.y + row) * sheetW + wp.x + col) * 4;
            pixBuf.current[si] = 0; pixBuf.current[si+1] = 0; pixBuf.current[si+2] = 0; pixBuf.current[si+3] = 0;
          }
        const off = new OffscreenCanvas(wp.w, wp.h);
        off.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(wp.pixels), wp.w, wp.h), 0, 0);
        selectDragOffRef.current = off;
        wandPendingRef.current = null;
      }
      selectDragRef.current = { ...sd, dx: newDx, dy: newDy };
      renderCanvasRef.current(); return;
    }
    if (tool === "select" && selectDragRef.current) {
      const sd = selectDragRef.current;
      selectDragRef.current = { ...sd, dx: coords.x - sd.px0, dy: coords.y - sd.py0 };
      renderCanvasRef.current(); return;
    }
    if (tool === "select" && !selectDragRef.current && !moveSpriteDrag) {
      const canvas = canvasRef.current;
      const hit = hitTestSprites(sheet.sprites, coords.x, coords.y);
      if (canvas) canvas.style.cursor = (clipRect && inClip(coords.x, coords.y, clipRect)) ? "move" : hit ? "pointer" : "default";
    }
    if (tool === "wand" && !selectDragRef.current) {
      const lastPx = wandLastHoverPxRef.current;
      if (!lastPx || lastPx.x !== coords.x || lastPx.y !== coords.y) {
        wandLastHoverPxRef.current = { x: coords.x, y: coords.y };
        const el = wandHoverRef.current;
        if (el) {
          const bounds = connectedBounds(pixBuf.current, sheetW, sheetH, coords.x, coords.y);
          if (bounds) {
            const padSize = showGrid && gridSize > 1 ? gridSize : 1;
            const padded = padBoundsToGrid(bounds.x, bounds.y, bounds.w, bounds.h, padSize);
            const z = zoomRef.current;
            // eslint-disable-next-line react-hooks/immutability -- imperative overlay positioning, deliberately outside React render
            el.style.display = 'block';
            el.style.left = `${padded.x * z}px`;
            el.style.top = `${padded.y * z}px`;
            el.style.width = `${padded.w * z}px`;
            el.style.height = `${padded.h * z}px`;
          } else {
            el.style.display = 'none';
          }
        }
      }
    }
    if (SHAPE_TOOLS.has(tool as ShapeTool) && dragStartRef.current) {
      dragNowRef.current = { x: coords.x, y: coords.y };
      renderCanvasRef.current(); return;
    }
    if (!painting) {
      // Hover preview: if over a sprite region, start timer
      for (const [sn, se] of Object.entries(sheet.sprites)) {
        for (const [an, st] of Object.entries(se.animations)) {
          if (coords.y >= st.y && coords.y < st.y + st.frameH && coords.x >= st.x && coords.x < st.x + st.frameW * st.frameCount) {
            startHoverPreview(sn, an); return;
          }
        }
      }
      clearHoverPreview(); return;
    }
    if (tool === "tile" && tileSprite && sheet.sprites[tileSprite]) {
      const strip = Object.values(sheet.sprites[tileSprite].animations)[0]; if (!strip) return;
      const tw = strip.frameW, th = strip.frameH;
      const spacing = tileSpacingRef.current >= 1 ? tileSpacingRef.current : tw;
      const tx = Math.round((coords.x + tw / 2) / spacing) * spacing - Math.floor(tw / 2);
      const ty = Math.round((coords.y + th / 2) / spacing) * spacing - Math.floor(th / 2);
      stampTile(pixBuf.current, sheetW, sheetH, pixBuf.current, sheetW, strip.x, strip.y, tw, th, tx, ty); renderCanvas(); return;
    }
    paintBrush(pixBuf.current, sheetW, sheetH, coords.x, coords.y, tool as DrawTool, lerpOverride ?? color, brushSize, clipRect); renderCanvas();
  }, [painting, tool, color, lerpOverride, brushSize, clipRect, canvasCoords, renderCanvas, tileSprite, sheet.sprites, startHoverPreview, clearHoverPreview, moveSpriteDrag, sheetW, sheetH, showGrid, gridSize, pushUndo]);

  const handleCanvasPointerUp = useCallback(() => {
    // Wand: click without drag — discard cleanly, no undo push
    if (tool === "wand" && wandPendingRef.current) {
      wandPendingRef.current = null;
      selectDragRef.current = null;
      selectDragOffRef.current = null;
      return;
    }
    const sd = selectDragRef.current;
    if ((tool === "select" || tool === "wand") && sd) {
      const nx = Math.max(0, Math.min(sheetW - sd.origW, sd.origX + sd.dx));
      const ny = Math.max(0, Math.min(sheetH - sd.origH, sd.origY + sd.dy));
      for (let row = 0; row < sd.origH; row++) pixBuf.current.set(sd.pixels.subarray(row * sd.origW * 4, (row + 1) * sd.origW * 4), ((ny + row) * sheetW + nx) * 4);
      selectDragRef.current = null; selectDragOffRef.current = null;
      if (sd.freeMove) { setSheet({ ...sheet, pixels: encodePixels(pixBuf.current) }); }
      else {
        const ddx = nx - sd.origX, ddy = ny - sd.origY;
        const newSprites = { ...sheet.sprites }; const sentry = newSprites[sd.sprite];
        if (sentry && (ddx !== 0 || ddy !== 0)) {
          const newAnims: typeof sentry.animations = {};
          for (const [an, st] of Object.entries(sentry.animations)) newAnims[an] = { ...st, x: st.x + ddx, y: st.y + ddy };
          newSprites[sd.sprite] = { animations: newAnims };
        }
        setSheet({ ...sheet, pixels: encodePixels(pixBuf.current), sprites: newSprites });
      }
      renderCanvas(); return;
    }
    const rd = regionDragRef.current;
    if (tool === "region" && rd) {
      if (sizeChipRef.current) sizeChipRef.current.style.display = 'none';
      let x: number, y: number, w: number, h: number;
      if (showGrid && gridSize > 1) {
        const snapped = snapRegion(rd.sx, rd.sy, rd.ex, rd.ey, gridSize);
        x = snapped.x; y = snapped.y; w = snapped.w; h = snapped.h;
      } else {
        x = Math.min(rd.sx, rd.ex); y = Math.min(rd.sy, rd.ey);
        w = Math.abs(rd.ex - rd.sx); h = Math.abs(rd.ey - rd.sy);
      }
      regionDragRef.current = null;
      if (w >= 4 && h >= 4) {
        const overlaps = findOverlappingStrips(sheet.sprites, x, y, w, h);
        if (overlaps.length > 0) { triggerOverlapFlash(overlaps, { x, y, w, h }); return; }
        setPendingRegion({ x, y, w, h }); setPendingName(suggestSpriteName(new Set(Object.keys(sheet.sprites)))); setPendingNameError("");
      } else {
        // Single click: smart region — flood-fill connected pixels → padded bounding box
        const bounds = connectedBounds(pixBuf.current, sheetW, sheetH, rd.sx, rd.sy);
        if (bounds) {
          const padSize = showGrid && gridSize > 1 ? gridSize : 1;
          const padded = padBoundsToGrid(bounds.x, bounds.y, bounds.w, bounds.h, padSize);
          const cx = Math.max(0, padded.x), cy = Math.max(0, padded.y);
          const cw = Math.min(padded.w, sheetW - cx), ch = Math.min(padded.h, sheetH - cy);
          if (cw >= 2 && ch >= 2) {
            const overlaps2 = findOverlappingStrips(sheet.sprites, cx, cy, cw, ch);
            if (overlaps2.length > 0) { triggerOverlapFlash(overlaps2, { x: cx, y: cy, w: cw, h: ch }); return; }
            setPendingRegion({ x: cx, y: cy, w: cw, h: ch }); setPendingName(suggestSpriteName(new Set(Object.keys(sheet.sprites)))); setPendingNameError("");
          }
        }
      }
      return;
    }
    const ds = dragStartRef.current, dn = dragNowRef.current;
    if (SHAPE_TOOLS.has(tool as ShapeTool) && ds && dn) {
      pushUndo();
      const paintColor = lerpOverride ?? color;
      const plot = (px: number, py: number) => paintPixel(pixBuf.current, sheetW, sheetH, px, py, "pencil", paintColor, clipRect);
      if (tool === "line") bresenhamLine(ds.x, ds.y, dn.x, dn.y, plot);
      if (tool === "rect") rectOutline(ds.x, ds.y, dn.x, dn.y, plot);
      if (tool === "ellipse") ellipseOutline(ds.x, ds.y, dn.x, dn.y, plot);
      setSheet({ ...sheet, pixels: encodePixels(pixBuf.current) });
      dragStartRef.current = null;
      dragNowRef.current = null;
      renderCanvas();
      return;
    }
    if (painting) { setPainting(false); setSheet({ ...sheet, pixels: encodePixels(pixBuf.current) }); }
  }, [painting, tool, sheet, setSheet, renderCanvas, pushUndo, lerpOverride, color, clipRect, showGrid, gridSize, sheetW, sheetH, triggerOverlapFlash]);

  const handleCanvasPointerLeave = useCallback(() => {
    if (brushOverlayRef.current) brushOverlayRef.current.style.display = 'none';
    // eslint-disable-next-line react-hooks/immutability -- imperative overlay positioning, deliberately outside React render
    if (wandHoverRef.current) wandHoverRef.current.style.display = 'none';
  }, []);

  // ── Confirm pending region ────────────────────────────────────────────────────

  const confirmRegion = useCallback(() => {
    if (!pendingRegion) return;
    const name = pendingName.trim().toLowerCase();
    const result = validateSpriteName(name, new Set(Object.keys(sheet.sprites)));
    if (!result.ok) { setPendingNameError(t(result.key, result.args)); return; }
    const overlaps = findOverlappingStrips(sheet.sprites, pendingRegion.x, pendingRegion.y, pendingRegion.w, pendingRegion.h);
    if (overlaps.length > 0) { setPendingNameError(t('sheetEditor.regionOverlaps', { name: overlaps[0].name })); return; }
    pushUndo();
    const newSprites: SheetSprites = { ...sheet.sprites, [name]: { animations: { default: { x: pendingRegion.x, y: pendingRegion.y, frameW: pendingRegion.w, frameH: pendingRegion.h, frameCount: 1 } } } };
    setSheet({ ...sheet, sprites: newSprites });
    setSelectedFrame({ sprite: name, anim: "default", idx: 0 });
    setExpandedSprites((s) => new Set([...s, name]));
    setPendingRegion(null); setPendingName("");
  }, [pendingRegion, pendingName, sheet, setSheet, pushUndo, t]);

  // ── Add frame / animation ─────────────────────────────────────────────────────

  const addFrame = useCallback((spriteName: string, animName: string) => {
    const strip = sheet.sprites[spriteName]?.animations[animName]; if (!strip) return;
    const newFx = strip.x + strip.frameCount * strip.frameW;
    if (newFx + strip.frameW > sheetW) { setFrameError({ sprite: spriteName, anim: animName, msg: "No space (sheet edge)" }); setTimeout(() => setFrameError(null), 4000); return; }
    pushUndo(); const buf = pixBuf.current;
    const lastFx = strip.x + (strip.frameCount - 1) * strip.frameW;
    for (let row = 0; row < strip.frameH; row++) buf.set(buf.subarray(((strip.y + row) * sheetW + lastFx) * 4, ((strip.y + row) * sheetW + lastFx + strip.frameW) * 4), ((strip.y + row) * sheetW + newFx) * 4);
    setSheet({ ...sheet, sprites: { ...sheet.sprites, [spriteName]: { ...sheet.sprites[spriteName], animations: { ...sheet.sprites[spriteName].animations, [animName]: { ...strip, frameCount: strip.frameCount + 1 } } } }, pixels: encodePixels(buf) });
  }, [sheet, setSheet, pushUndo, sheetW]);  // addFrame

  const addAnimation = useCallback((spriteName: string) => {
    const sentry = sheet.sprites[spriteName]; if (!sentry) return;
    const anims = Object.values(sentry.animations); if (anims.length === 0) return;
    const first = anims[0]; const maxY = Math.max(...anims.map((s) => s.y + s.frameH));
    if (maxY + first.frameH > sheetH) { setAnimAddError({ sprite: spriteName, msg: "No space (sheet edge)" }); setTimeout(() => setAnimAddError(null), 4000); return; }
    pushUndo(); const buf = pixBuf.current;
    for (let row = 0; row < first.frameH; row++) buf.set(buf.subarray(((first.y + row) * sheetW + first.x) * 4, ((first.y + row) * sheetW + first.x + first.frameW) * 4), ((maxY + row) * sheetW + first.x) * 4);
    const existing = new Set(Object.keys(sentry.animations));
    let newName = !existing.has("idle") ? "idle" : !existing.has("walk") ? "walk" : "anim_2";
    let counter = 2;
    while (existing.has(newName) || ACTOR_RESERVED.has(newName)) newName = `anim_${counter++}`;
    setSheet({ ...sheet, sprites: { ...sheet.sprites, [spriteName]: { ...sentry, animations: { ...sentry.animations, [newName]: { x: first.x, y: maxY, frameW: first.frameW, frameH: first.frameH, frameCount: 1 } } } }, pixels: encodePixels(buf) });
  }, [sheet, setSheet, pushUndo, sheetW, sheetH]);

  // ── Rename / Delete ──────────────────────────────────────────────────────────

  const confirmRename = useCallback((oldName: string) => {
    const newName = renameValue.trim(); if (!newName || newName === oldName) { setRenamingSprite(null); return; }
    const newSprites: SheetSprites = {};
    for (const [k, v] of Object.entries(sheet.sprites)) newSprites[k === oldName ? newName : k] = v;
    setSheet({ ...sheet, sprites: newSprites }); setRenamingSprite(null);
    if (selectedFrame?.sprite === oldName) setSelectedFrame({ ...selectedFrame, sprite: newName });
  }, [renameValue, sheet, setSheet, selectedFrame]);

  const confirmAnimRename = useCallback((spriteName: string, oldAnimName: string) => {
    const newName = animRenameValue.trim(); if (!newName || newName === oldAnimName) { setRenamingAnim(null); return; }
    const sentry = sheet.sprites[spriteName]; if (!sentry) return;
    const newAnims: typeof sentry.animations = {};
    for (const [k, v] of Object.entries(sentry.animations)) newAnims[k === oldAnimName ? newName : k] = v;
    setSheet({ ...sheet, sprites: { ...sheet.sprites, [spriteName]: { ...sentry, animations: newAnims } } }); setRenamingAnim(null);
    if (selectedFrame?.sprite === spriteName && selectedFrame?.anim === oldAnimName) setSelectedFrame({ ...selectedFrame, anim: newName });
  }, [animRenameValue, sheet, setSheet, selectedFrame]);

  const deleteSprite = useCallback((spriteName: string) => {
    const sentry = sheet.sprites[spriteName]; if (!sentry) return;
    pushUndo();
    for (const strip of Object.values(sentry.animations))
      for (let row = 0; row < strip.frameH; row++) pixBuf.current.fill(0, ((strip.y + row) * sheetW + strip.x) * 4, ((strip.y + row) * sheetW + strip.x + strip.frameW * strip.frameCount) * 4);
    const newSprites = { ...sheet.sprites }; delete newSprites[spriteName];
    setSheet({ ...sheet, sprites: newSprites, pixels: encodePixels(pixBuf.current) });
    if (selectedFrame?.sprite === spriteName) setSelectedFrame(null); renderCanvasRef.current();
  }, [sheet, setSheet, selectedFrame, pushUndo, sheetW]);

  const deleteAnimation = useCallback((spriteName: string, animName: string) => {
    const sentry = sheet.sprites[spriteName]; if (!sentry || Object.keys(sentry.animations).length <= 1) return;
    const strip = sentry.animations[animName]; if (!strip) return;
    pushUndo();
    for (let row = 0; row < strip.frameH; row++) pixBuf.current.fill(0, ((strip.y + row) * sheetW + strip.x) * 4, ((strip.y + row) * sheetW + strip.x + strip.frameW * strip.frameCount) * 4);
    const newAnims = { ...sentry.animations }; delete newAnims[animName];
    setSheet({ ...sheet, sprites: { ...sheet.sprites, [spriteName]: { ...sentry, animations: newAnims } }, pixels: encodePixels(pixBuf.current) });
    if (selectedFrame?.sprite === spriteName && selectedFrame?.anim === animName) setSelectedFrame(null); renderCanvasRef.current();
  }, [sheet, setSheet, selectedFrame, pushUndo, sheetW]);

  // ── Move / Resize sprite drags ───────────────────────────────────────────────

  useEffect(() => {
    if (!moveSpriteDrag) return;
    // Lift pixels immediately
    pushUndo();
    const sh = useEditor.getState().project.sheet;
    if (!sh) return;
    const sprite = sh.sprites[moveSpriteDrag.sprite];
    if (!sprite) return;
    const strips = Object.values(moveSpriteDrag.origStrips);
    const ox = Math.min(...strips.map(s => s.x));
    const oy = Math.min(...strips.map(s => s.y));
    const ox2 = Math.max(...strips.map(s => s.x + s.frameW * s.frameCount));
    const oy2 = Math.max(...strips.map(s => s.y + s.frameH));
    const bw = ox2 - ox, bh = oy2 - oy;
    const savedPixels = new Uint8ClampedArray(bw * bh * 4);
    const buf = pixBuf.current;
    const sw = sh.width;
    for (let row = 0; row < bh; row++) {
      const src = ((oy + row) * sw + ox) * 4;
      savedPixels.set(buf.subarray(src, src + bw * 4), row * bw * 4);
      buf.fill(0, src, src + bw * 4);
    }
    const off = new OffscreenCanvas(bw, bh);
    off.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(savedPixels), bw, bh), 0, 0);
    moveOffscreenRef.current = off;
    moveOrigBoundsRef.current = { x: ox, y: oy, w: bw, h: bh };
    moveOffRef.current = { dx: 0, dy: 0 };
    renderCanvasRef.current();

    let lastDx = 0, lastDy = 0;
    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      lastDx = Math.round((e.clientX - rect.left) / zoomRef.current) - moveSpriteDrag.px0;
      lastDy = Math.round((e.clientY - rect.top) / zoomRef.current) - moveSpriteDrag.py0;
      moveOffRef.current = { dx: lastDx, dy: lastDy };
      renderCanvasRef.current();
    };
    const onUp = () => {
      const finalSh = useEditor.getState().project.sheet;
      if (!finalSh) { setMoveSpriteDrag(null); return; }
      const mb = moveOrigBoundsRef.current!;
      const fSw = finalSh.width, fSh = finalSh.height;
      const nx = Math.max(0, Math.min(fSw - mb.w, mb.x + lastDx));
      const ny = Math.max(0, Math.min(fSh - mb.h, mb.y + lastDy));
      const ddx = nx - mb.x, ddy = ny - mb.y;
      // Overlap check (against other sprites, excluding this one)
      const finalSprite = finalSh.sprites[moveSpriteDrag.sprite];
      let hasOverlap = false;
      if (finalSprite) {
        for (const [an] of Object.entries(finalSprite.animations)) {
          const orig = moveSpriteDrag.origStrips[an];
          if (!orig) continue;
          const ns = { x: orig.x + ddx, y: orig.y + ddy, w: orig.frameW * orig.frameCount, h: orig.frameH };
          if (anyStripOverlaps(finalSh.sprites, ns.x, ns.y, ns.w, ns.h, moveSpriteDrag.sprite, an)) {
            hasOverlap = true; break;
          }
        }
      }
      if (hasOverlap) {
        // Revert: put pixels back at original position
        for (let row = 0; row < mb.h; row++)
          pixBuf.current.set(savedPixels.subarray(row * mb.w * 4, (row + 1) * mb.w * 4), ((mb.y + row) * fSw + mb.x) * 4);
        undoStack.current.pop(); // remove the undo entry we pushed
        moveOffscreenRef.current = null; moveOrigBoundsRef.current = null;
        setMoveSpriteDrag(null); renderCanvasRef.current(); return;
      }
      // Paste pixels at new position
      for (let row = 0; row < mb.h; row++) {
        const nrow = ny + row; if (nrow < 0 || nrow >= fSh) continue;
        for (let col = 0; col < mb.w; col++) {
          const ncol = nx + col; if (ncol < 0 || ncol >= fSw) continue;
          const si = (row * mb.w + col) * 4;
          if (savedPixels[si + 3] === 0) continue;
          const di = (nrow * fSw + ncol) * 4;
          pixBuf.current[di] = savedPixels[si]; pixBuf.current[di+1] = savedPixels[si+1]; pixBuf.current[di+2] = savedPixels[si+2]; pixBuf.current[di+3] = savedPixels[si+3];
        }
      }
      // Update sprite metadata
      if (finalSprite) {
        const newAnims: Record<string, typeof finalSprite.animations[string]> = {};
        for (const [an, st] of Object.entries(finalSprite.animations)) {
          const orig = moveSpriteDrag.origStrips[an];
          if (orig) newAnims[an] = { ...st, x: orig.x + ddx, y: orig.y + ddy };
          else newAnims[an] = st;
        }
        setSheet({ ...finalSh, pixels: encodePixels(pixBuf.current), sprites: { ...finalSh.sprites, [moveSpriteDrag.sprite]: { animations: newAnims } } });
      }
      moveOffscreenRef.current = null; moveOrigBoundsRef.current = null;
      setMoveSpriteDrag(null); renderCanvasRef.current();
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [moveSpriteDrag, setSheet, pushUndo]);

  useEffect(() => {
    if (!resizeSpriteDrag) return;
    let nw = resizeSpriteDrag.origFrameW, nh = resizeSpriteDrag.origFrameH;
    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = Math.round((e.clientX - rect.left) / zoomRef.current), cy = Math.round((e.clientY - rect.top) / zoomRef.current);
      nw = Math.max(2, resizeSpriteDrag.origFrameW + cx - resizeSpriteDrag.px0);
      nh = Math.max(2, resizeSpriteDrag.origFrameH + cy - resizeSpriteDrag.py0);
      if (showGrid && gridSize > 1) {
        nw = Math.max(2, Math.round(nw / gridSize) * gridSize);
        nh = Math.max(2, Math.round(nh / gridSize) * gridSize);
      }
      const sh = useEditor.getState().project.sheet; if (!sh) return;
      const sprite = sh.sprites[resizeSpriteDrag.sprite]; if (!sprite) return;
      // Update ALL animations of the sprite with new frameW/frameH
      const newAnims: typeof sprite.animations = {};
      for (const [an, st] of Object.entries(sprite.animations))
        newAnims[an] = { ...st, frameW: nw, frameH: nh };
      setSheet({ ...sh, sprites: { ...sh.sprites, [resizeSpriteDrag.sprite]: { ...sprite, animations: newAnims } } });
    };
    const onUp = () => {
      const sh = useEditor.getState().project.sheet;
      if (sh) {
        const sprite = sh.sprites[resizeSpriteDrag.sprite];
        if (sprite) {
          // Overlap check: does any strip at the new size overlap another sprite?
          let hasOverlap = false;
          for (const [an, st] of Object.entries(sprite.animations)) {
            const tw = nw * st.frameCount;
            if (anyStripOverlaps(sh.sprites, st.x, st.y, tw, nh, resizeSpriteDrag.sprite, an)) { hasOverlap = true; break; }
          }
          if (hasOverlap) {
            // Revert to original frame sizes
            const revertAnims: typeof sprite.animations = {};
            for (const [an, st] of Object.entries(sprite.animations))
              revertAnims[an] = { ...st, frameW: resizeSpriteDrag.origFrameW, frameH: resizeSpriteDrag.origFrameH };
            setSheet({ ...sh, sprites: { ...sh.sprites, [resizeSpriteDrag.sprite]: { ...sprite, animations: revertAnims } } });
          }
        }
      }
      setResizeSpriteDrag(null); renderCanvasRef.current();
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [resizeSpriteDrag, setSheet, showGrid, gridSize]);

  // ── Dismiss context menu ──────────────────────────────────────────────────────

  useEffect(() => { if (!contextMenu) return; const h = () => setContextMenu(null); window.addEventListener("pointerdown", h); return () => window.removeEventListener("pointerdown", h); }, [contextMenu]);

  // ── Layout values ─────────────────────────────────────────────────────────────

  const canvasW = sheetW * zoom, canvasH = sheetH * zoom;
  const { surface, surfacePanel, panelHeader, panelTxt, panelTxtMute, panelBorder, accent, chip, fontUI, fontMono, canvasHud: teal } = theme;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: surface, color: panelTxt, fontFamily: fontUI, fontSize: 12 }}
      onClick={() => { setColorPickerOpen(false); setContextMenu(null); }}>

      {/* ── Header ── */}
      <header style={{ height: 44, display: "flex", alignItems: "center", gap: 2, padding: "0 10px", background: panelHeader, borderBottom: `1px solid ${panelBorder}`, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: "12.5px", color: accent, marginRight: 2, flexShrink: 0 }}>{t('sheetEditor.title')}</span>
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 5px", flexShrink: 0 }} />
        <button title={t('sheetEditor.library')} onClick={() => setShowLibrary(true)}
          style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "auto", padding: "0 8px", height: 28, borderRadius: 5, cursor: "pointer", color: panelTxtMute, flexShrink: 0, fontSize: 11, fontFamily: fontUI }}>
          <Library size={16} />{t('sheetEditor.library')}</button>
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 5px", flexShrink: 0 }} />
        <button title={t('sheetEditor.undoTitle')} onClick={performUndo} style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, cursor: "pointer", color: panelTxtMute, flexShrink: 0 }}>
          <Undo2 size={18} /></button>
        <button title={t('sheetEditor.redoTitle')} onClick={performRedo} style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, cursor: "pointer", color: panelTxtMute, flexShrink: 0 }}>
          <Redo2 size={18} /></button>
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 5px", flexShrink: 0 }} />
        <button onClick={() => setPanelOpen((p) => !p)} title={t('sheetEditor.togglePanel')} style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, borderRadius: 5, cursor: "pointer", color: panelOpen ? teal : panelTxtMute, background: panelOpen ? `${teal}11` : "transparent", flexShrink: 0 }}>
          <PanelRight size={18} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
          <button onClick={() => setShowGrid((g) => !g)} title={`Grid: ${showGrid ? "on" : "off"}`}
            style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, cursor: "pointer", color: showGrid ? teal : panelTxtMute, background: showGrid ? `${teal}11` : "transparent" }}>
            <Grid2x2 size={16} /></button>
          {showGrid && <>
            <button onClick={() => setGridSize((g) => prevGridSize(g))} title="Grid smaller"
              style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 24, cursor: "pointer", color: panelTxtMute, fontSize: 14, fontFamily: fontUI }}>−</button>
            <span style={{ fontSize: 10, color: teal, fontFamily: fontMono, minWidth: 30, textAlign: "center" }}>{gridSize}px</span>
            <button onClick={() => setGridSize((g) => nextGridSize(g))} title="Grid larger"
              style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 24, cursor: "pointer", color: panelTxtMute, fontSize: 14, fontFamily: fontUI }}>+</button>
          </>}
        </div>
        <button onClick={fitToView} title={t('sheetEditor.fitCanvas')} style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, borderRadius: 5, cursor: "pointer", color: panelTxtMute, flexShrink: 0 }}>
          <Maximize size={18} /></button>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ all: "unset", padding: "4px 12px", borderRadius: 4, border: `1px solid ${panelBorder}`, cursor: "pointer", color: panelTxtMute, fontSize: 11, fontFamily: fontUI, flexShrink: 0 }}>{t('sheetEditor.close')}</button>
      </header>

      {/* ── Main row ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* ── Left tool strip ── */}
        <aside style={{ width: 50, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 1, background: panelHeader, borderRight: `1px solid ${panelBorder}`, overflowY: "auto" }}>
          {[1, 2, 3, 4].map((gn) => {
            const gt = TOOL_DEFS.filter((t) => t.group === gn);
            return <React.Fragment key={gn}>
              {gn > 1 && <div style={{ width: 26, height: 1, background: "rgba(148,210,216,0.22)", margin: "5px 0" }} />}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, width: "100%" }}>
                {gt.map(({ id, label, icon }) => (
                  <button key={id} title={label.startsWith("sheetEditor.") ? t(label) : label} onClick={() => { setTool(id); setColorPickerOpen(false); }}
                    style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 34, borderRadius: 6, cursor: "pointer", color: tool === id ? "#1e0800" : panelTxtMute, background: tool === id ? accent : "transparent" }}>{icon}</button>
                ))}
              </div>
            </React.Fragment>;
          })}
        </aside>

        {/* ── Canvas area ── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflow: "auto", background: "#091d23" }}>
            <div style={{ padding: 80 }}>
              <div style={{ position: "relative", width: canvasW, height: canvasH }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-conic-gradient(#555 0% 25%, #444 0% 50%)", backgroundSize: "16px 16px" }} />
                <canvas ref={canvasRef} width={sheetW} height={sheetH}
                  style={{ position: "absolute", inset: 0, width: canvasW, height: canvasH, cursor: toolCursor(tool), imageRendering: "pixelated" }}
                  onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp} onPointerLeave={handleCanvasPointerLeave} onContextMenu={(e) => e.preventDefault()} />

                <div ref={tileOverlayRef} style={{ display: "none", position: "absolute", border: "1px dashed rgba(255,255,255,0.4)", background: "rgba(247,182,122,0.2)", pointerEvents: "none", zIndex: 2 }} />
                <div ref={wandHoverRef} style={{ display: "none", position: "absolute", border: "1px dashed rgba(95,212,220,0.7)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", pointerEvents: "none", zIndex: 3 }} />
                <div ref={sizeChipRef} style={{ display: "none", position: "absolute", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 9, fontFamily: fontMono, padding: "2px 5px", borderRadius: 3, pointerEvents: "none", zIndex: 4, whiteSpace: "nowrap" }} />

                {showGrid && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `repeating-linear-gradient(to right, rgba(255,255,255,0.22) 0 1px, transparent 1px ${gridSize * zoom}px), repeating-linear-gradient(to bottom, rgba(255,255,255,0.22) 0 1px, transparent 1px ${gridSize * zoom}px)`, backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px` }} />}

                <div ref={brushOverlayRef} style={{ display: "none", position: "absolute", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 0 0 1px rgba(0,0,0,0.6)", pointerEvents: "none", zIndex: 3 }} />

                {/* Sprite block overlays */}
                {Object.entries(sheet.sprites).map(([spriteName, sentry]) => {
                  const animEntries = Object.entries(sentry.animations);
                  if (animEntries.length === 0) return null;
                  const [, firstStrip] = animEntries[0];
                  const blockX = firstStrip.x * zoom, blockY = firstStrip.y * zoom;
                  const blockW = Math.max(...animEntries.map(([, s]) => s.frameW * s.frameCount)) * zoom;
                  return (
                    <div key={spriteName} style={{ position: "absolute", left: blockX, top: blockY, pointerEvents: "none" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, transform: "translateY(-100%)", display: "flex", alignItems: "center", gap: 6, height: 20, padding: "0 8px", background: "rgba(6,22,26,0.88)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: "4px 4px 0 0", whiteSpace: "nowrap", minWidth: Math.max(blockW, 48), maxWidth: Math.max(blockW, 140), overflow: "hidden", userSelect: "none", pointerEvents: "auto", cursor: tool === "select" ? "grab" : "pointer" }}
                        onClick={() => { if (tool !== "select") { setRenamingSprite(spriteName); setRenameValue(spriteName); } }}
                        onPointerDown={(e) => { if (tool === "select" && e.button === 0) { e.stopPropagation(); const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const cx = Math.round((e.clientX - rect.left) / zoom); const cy = Math.round((e.clientY - rect.top) / zoom); const sh = useEditor.getState().project.sheet; if (!sh) return; const sprite = sh.sprites[spriteName]; if (!sprite) return; const origStrips: NonNullable<MoveSpriteDrag>["origStrips"] = {}; for (const [an, st] of Object.entries(sprite.animations)) origStrips[an] = { x: st.x, y: st.y, frameW: st.frameW, frameH: st.frameH, frameCount: st.frameCount }; setMoveSpriteDrag({ sprite: spriteName, origStrips, px0: cx, py0: cy }); } }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: "sprite", sprite: spriteName }); }}>
                        {renamingSprite === spriteName ? (
                          <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") confirmRename(spriteName); if (e.key === "Escape") setRenamingSprite(null); e.stopPropagation(); }}
                            onBlur={() => confirmRename(spriteName)}
                            style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 10, fontWeight: 700, width: 80 }} />
                        ) : <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{spriteName}</span>}
                      </div>
                      {animEntries.map(([animName, strip]) => {
                        const rowY = (strip.y - firstStrip.y) * zoom, rowH = strip.frameH * zoom;
                        const frameSel = selectedFrame?.sprite === spriteName && selectedFrame?.anim === animName;
                        return (
                          <div key={animName} style={{ position: "absolute", left: 0, top: rowY, width: strip.frameW * strip.frameCount * zoom, height: rowH, display: "flex", alignItems: "flex-start" }}>
                            <div style={{ position: "absolute", right: "100%" }}>
                              {renamingAnim?.sprite === spriteName && renamingAnim?.anim === animName ? (
                                <input autoFocus value={animRenameValue} onChange={(e) => setAnimRenameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") confirmAnimRename(spriteName, animName); if (e.key === "Escape") setRenamingAnim(null); e.stopPropagation(); }}
                                  onBlur={() => confirmAnimRename(spriteName, animName)}
                                  style={{ background: surfacePanel, border: `1px solid ${accent}`, borderRadius: 2, color: panelTxt, fontSize: 9, width: 60, padding: "1px 3px", pointerEvents: "auto" }} />
                              ) : (
                                <span onDoubleClick={() => { setRenamingAnim({ sprite: spriteName, anim: animName }); setAnimRenameValue(animName); }}
                                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: "anim", sprite: spriteName, anim: animName }); }}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-lr", transform: "rotate(180deg)", fontSize: "8.5px", color: "rgba(255,255,255,0.5)", background: "rgba(6,22,26,0.7)", padding: "3px 2px", borderRadius: 2, whiteSpace: "nowrap", pointerEvents: "auto", cursor: "pointer", height: rowH }}>{animName}</span>
                              )}
                            </div>
                            {Array.from({ length: strip.frameCount }).map((_, fi) => (
                              <div key={fi}
                                style={{ width: strip.frameW * zoom, height: rowH, flexShrink: 0, boxSizing: "border-box", cursor: "pointer", background: "transparent", border: frameSel && selectedFrame?.idx === fi ? "2px solid #5fd4dc" : "1px solid rgba(95,212,220,0.22)", boxShadow: frameSel && selectedFrame?.idx === fi ? "inset 0 0 0 1px rgba(95,212,220,0.18), 0 0 12px rgba(95,212,220,0.12)" : "none" }} />
                            ))}
                            <div style={{ position: "relative", flexShrink: 0 }}>
                              <button title={t('sheetEditor.addFrame')} onClick={() => addFrame(spriteName, animName)}
                                style={{ width: 16, height: rowH, pointerEvents: "auto", background: "rgba(6,22,26,0.6)", color: "rgba(255,255,255,0.45)", border: "1px dashed rgba(148,210,216,0.25)", cursor: "pointer", fontSize: 15, fontWeight: 300, lineHeight: `${rowH}px`, textAlign: "center", padding: 0 }}>+</button>
                              {frameError?.sprite === spriteName && frameError?.anim === animName && <span onClick={(e) => { e.stopPropagation(); setFrameError(null); }} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#b13e53", background: "rgba(0,0,0,0.85)", padding: "2px 4px", borderRadius: 2, whiteSpace: "nowrap", pointerEvents: "auto", cursor: "pointer", zIndex: 10 }}>{frameError.msg}</span>}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ position: "absolute", top: Math.max(...animEntries.map(([, s]) => (s.y - firstStrip.y) * zoom + s.frameH * zoom)), left: 0, pointerEvents: "auto" }}>
                        <div style={{ position: "relative" }}>
                          <button title={t('sheetEditor.addAnimTitle')} onClick={() => addAnimation(spriteName)}
                            style={{ height: 17, padding: "0 10px", pointerEvents: "auto", background: "rgba(6,22,26,0.6)", color: "rgba(255,255,255,0.4)", border: "1px dashed rgba(148,210,216,0.22)", cursor: "pointer", fontSize: 10, fontWeight: 500, fontFamily: fontUI, borderRadius: "0 0 4px 4px", whiteSpace: "nowrap" }}>{t('sheetEditor.addAnim')}</button>
                          {animAddError?.sprite === spriteName && <span onClick={(e) => { e.stopPropagation(); setAnimAddError(null); }} style={{ position: "absolute", left: 0, top: 18, fontSize: 8, color: "#b13e53", background: "rgba(0,0,0,0.85)", padding: "2px 4px", borderRadius: 2, whiteSpace: "nowrap", pointerEvents: "auto", cursor: "pointer", zIndex: 10 }}>{animAddError.msg}</span>}
                        </div>
                      </div>
                      <div title={t('sheetEditor.resizeSprite')}
                        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); const strip = animEntries[0]?.[1]; if (!strip) return; const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); pushUndo(); setResizeSpriteDrag({ sprite: spriteName, anim: animEntries[0][0], origFrameW: strip.frameW, origFrameH: strip.frameH, px0: Math.round((e.clientX - rect.left) / zoom), py0: Math.round((e.clientY - rect.top) / zoom) }); }}
                        style={{ position: "absolute", right: -5, bottom: -5, width: 12, height: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.4)", borderRadius: 2, cursor: "nwse-resize", pointerEvents: "auto", zIndex: 5 }} />
                    </div>
                  );
                })}

                {pendingRegion && (
                  <div style={{ position: "absolute", left: pendingRegion.x * zoom, top: Math.max(4, pendingRegion.y * zoom - 36), background: surfacePanel, border: `1px solid ${accent}`, borderRadius: 4, padding: "4px 6px", display: "flex", gap: 4, alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5)", zIndex: 10, pointerEvents: "auto" }}>
                    <input autoFocus placeholder={t('sheetEditor.spriteName')} value={pendingName}
                      onChange={(e) => { setPendingName(e.target.value.toLowerCase()); setPendingNameError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmRegion(); if (e.key === "Escape") { setPendingRegion(null); setPendingName(""); } e.stopPropagation(); }}
                      style={{ background: surface, color: panelTxt, border: `1px solid ${panelBorder}`, borderRadius: 3, padding: "2px 6px", fontSize: 11, width: 100, outline: pendingNameError ? "1px solid #b13e53" : "none" }} />
                    {pendingNameError && <span style={{ fontSize: "10.5px", color: "#b13e53", maxWidth: 180, whiteSpace: "normal" }}>{pendingNameError}</span>}
                    <button onClick={confirmRegion} style={{ padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 11, background: accent, color: "#fff", border: "none" }}>OK</button>
                    <button onClick={() => { setPendingRegion(null); setPendingName(""); setPendingNameError(""); }} style={{ all: "unset", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: panelTxtMute, fontSize: 14, borderRadius: 3 }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* ── Zoom widget ── */}
          <div style={{ position: "absolute", bottom: 14, right: 14, display: "flex", gap: 2, alignItems: "center", background: surfacePanel, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: "3px 5px", boxShadow: "0 4px 20px rgba(0,0,0,0.45)", zIndex: 10 }}>
            <button onClick={() => setZoom((z) => Math.max(0.25, z / 2))} title={t('sheetEditor.zoomOut')} style={{ all: "unset", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: panelTxtMute, fontSize: 16, lineHeight: 1 }}>−</button>
            <span style={{ fontSize: "10.5px", color: panelTxtMute, minWidth: 30, textAlign: "center", fontFamily: fontMono }}>{zoom >= 1 ? `${Math.round(zoom)}\u00d7` : `1/${Math.round(1/zoom)}\u00d7`}</span>
            <button onClick={() => setZoom((z) => Math.min(16, z * 2))} title={t('sheetEditor.zoomIn')} style={{ all: "unset", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: panelTxtMute, fontSize: 16, lineHeight: 1 }}>+</button>
          </div>
        </div>

        {/* ── Right hierarchy panel ── */}
        {panelOpen && (
          <aside style={{ width: 206, flexShrink: 0, display: "flex", flexDirection: "column", background: surfacePanel, borderLeft: `1px solid ${panelBorder}`, overflow: "hidden" }}>
            <div style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", background: panelHeader, borderBottom: `1px solid ${panelBorder}`, flexShrink: 0 }}>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: panelTxtMute, letterSpacing: "0.07em", textTransform: "uppercase" }}>{t('sheetEditor.spritesPanel')}</span>
              <button title={t('sheetEditor.addRegion')} onClick={() => setTool("region")}
                style={{ all: "unset", width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: panelTxtMute }}>+</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {Object.entries(sheet.sprites).map(([spriteName, sentry]) => {
                const animEntries = Object.entries(sentry.animations);
                const isExpanded = expandedSprites.has(spriteName);
                const firstStrip = animEntries[0]?.[1];
                return (
                  <div key={spriteName}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", cursor: "pointer", userSelect: "none", background: selectedFrame?.sprite === spriteName ? `${accent}22` : "transparent" }}
                      onClick={() => { const fA = animEntries[0]?.[0]; if (fA) setSelectedFrame({ sprite: spriteName, anim: fA, idx: 0 }); setExpandedSprites((s) => { const n = new Set(s); if (n.has(spriteName)) n.delete(spriteName); else n.add(spriteName); return n; }); }}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: "sprite", sprite: spriteName }); }}>
                      <span style={{ fontSize: 8, color: panelTxtMute, width: 10, flexShrink: 0 }}>{isExpanded ? "\u25be" : "\u25b8"}</span>
                      <canvas ref={(el) => {
                        if (!el || !firstStrip) return; const ctx = el.getContext("2d"); if (!ctx) return;
                        const tw = 26, th = 20; el.width = tw; el.height = th;
                        for (let r = 0; r < th; r += 4) for (let c = 0; c < tw; c += 4) { ctx.fillStyle = (((r/4|0)+(c/4|0)) % 2 === 0) ? surface : surfacePanel; ctx.fillRect(c, r, 4, 4); }
                        ctx.imageSmoothingEnabled = false;
                        const off = new OffscreenCanvas(firstStrip.frameW, firstStrip.frameH);
                        const frm = new Uint8ClampedArray(firstStrip.frameW * firstStrip.frameH * 4);
                        for (let r2 = 0; r2 < firstStrip.frameH; r2++) frm.set(pixBuf.current.subarray(((firstStrip.y+r2)*sheetW + firstStrip.x)*4, ((firstStrip.y+r2)*sheetW + firstStrip.x + firstStrip.frameW)*4), r2*firstStrip.frameW*4);
                        off.getContext("2d")!.putImageData(new ImageData(frm, firstStrip.frameW, firstStrip.frameH), 0, 0);
                        const scl = Math.min(tw / firstStrip.frameW, th / firstStrip.frameH, 4); const dw = Math.round(firstStrip.frameW*scl), dh = Math.round(firstStrip.frameH*scl);
                        ctx.drawImage(off, Math.round((tw-dw)/2), Math.round((th-dh)/2), dw, dh);
                      }} style={{ width: 26, height: 20, borderRadius: 2, border: `1px solid ${panelBorder}`, flexShrink: 0, imageRendering: "pixelated" }} />
                      <span style={{ flex: 1, fontSize: "11.5px", fontWeight: 600, color: panelTxt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spriteName}</span>
                    </div>
                    {isExpanded && animEntries.map(([animName, strip]) => {
                      const isActive = selectedFrame?.sprite === spriteName && selectedFrame?.anim === animName;
                      const key = `${spriteName}::${animName}`;
                      return (
                        <div key={animName} ref={(el) => { if (el) panelRowRefs.current.set(key, el); else panelRowRefs.current.delete(key); }}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 26px", cursor: "pointer", userSelect: "none", background: isActive ? `${teal}11` : "transparent", transition: "background 0.1s" }}
                          onClick={() => setSelectedFrame({ sprite: spriteName, anim: animName, idx: 0 })}
                          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: "anim", sprite: spriteName, anim: animName }); }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? teal : panelBorder, flexShrink: 0, boxShadow: isActive ? `0 0 4px ${teal}` : "none" }} />
                          <span style={{ flex: 1, fontSize: 11, color: isActive ? teal : panelTxtMute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{animName}</span>
                          <div style={{ display: "flex", alignItems: "center", background: chip, border: `1px solid ${panelBorder}`, borderRadius: 3, flexShrink: 0 }}>
                            <input type="number" title="FPS" min={1} max={60} value={strip.fps ?? 8}
                              onChange={(e) => { const v = Math.max(1, Math.min(60, parseInt(e.target.value) || 8)); const s2 = sheet.sprites[spriteName]; if (!s2) return; setSheet({ ...sheet, sprites: { ...sheet.sprites, [spriteName]: { ...s2, animations: { ...s2.animations, [animName]: { ...strip, fps: v } } } } }); }}
                              onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
                              style={{ width: 22, fontSize: 9, color: panelTxtMute, background: "transparent", border: "none", padding: "1px 3px", textAlign: "right", outline: "none", appearance: "textfield", MozAppearance: "textfield" }} />
                            <span style={{ fontSize: 9, color: panelTxtMute, paddingRight: 3 }}>fps</span>
                          </div>
                          <span style={{ fontSize: 9, color: panelTxtMute, background: chip, border: `1px solid ${panelBorder}`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>{strip.frameCount}f</span>
                          <button title={t('sheetEditor.deleteAnim')} disabled={animEntries.length <= 1}
                            onClick={(e) => { e.stopPropagation(); deleteAnimation(spriteName, animName); }}
                            style={{ all: "unset", width: 16, height: 16, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", cursor: animEntries.length <= 1 ? "not-allowed" : "pointer", color: panelTxtMute, fontSize: 13, opacity: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {Object.keys(sheet.sprites).length === 0 && <div style={{ padding: "12px 8px", color: panelTxtMute, fontSize: 10 }}>{t('sheetEditor.noSprites')}</div>}
            </div>
          </aside>
        )}
      </div>

      {/* ── Status bar ── */}
      <footer style={{ height: 40, display: "flex", alignItems: "center", padding: "0 10px", background: panelHeader, borderTop: `1px solid ${panelBorder}`, flexShrink: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: 38, height: 28, flexShrink: 0, marginRight: 10 }}>
          <div title={t('sheetEditor.colorSecondary')} onClick={(e) => { e.stopPropagation(); const a = color, b = secondaryColor; setColor(b); setSecondaryColor(a); setLerpOverride(null); }}
            style={{ position: "absolute", right: 0, bottom: 0, width: 17, height: 13, borderRadius: 3, cursor: "pointer", background: secondaryColor, border: "1.5px solid rgba(255,255,255,0.14)" }} />
          <button title={t('sheetEditor.colorPrimary')} onClick={(e) => { e.stopPropagation(); setColorPickerOpen((o) => !o); }}
            style={{ position: "absolute", left: 0, top: 0, width: 22, height: 17, borderRadius: 3, cursor: "pointer", padding: 0, background: color, border: "2px solid rgba(255,255,255,0.26)", boxShadow: "0 2px 8px rgba(0,0,0,0.55)" }} />
          {colorPickerOpen && <ColorPicker color={color} secondaryColor={secondaryColor} onColor={setColor} onSecondary={setSecondaryColor} onClose={() => setColorPickerOpen(false)} theme={theme as unknown as Record<string, string>} />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 14px)", gap: 2, marginRight: 8, flexShrink: 0 }}>
          {PALETTE.map((c) => <button key={c} title={c} onClick={() => setColor(c)} style={{ width: 14, height: 11, borderRadius: 2, cursor: "pointer", padding: 0, background: c, border: `1.5px solid ${color === c ? "rgba(255,255,255,0.6)" : "transparent"}`, position: "relative", zIndex: 0 }} />)}
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 5px", flexShrink: 0 }} />
        {(() => { const [r1,g1,b1] = hexToRgb(color); const [r2,g2,b2] = hexToRgb(secondaryColor); const eP = lerpOverride ?? color;
          return <div style={{ display: "flex", gap: 2, marginRight: 8, flexShrink: 0 }}>{Array.from({ length: 10 }, (_, i) => { const t = i/9; const c = rgbToHex(lerpCh(r1,r2,t), lerpCh(g1,g2,t), lerpCh(b1,b2,t)); const isA = c === eP && (lerpOverride !== null || i === 0);
            return <button key={i} title={c} onClick={() => setLerpOverride(c)} style={{ width: 12, height: 20, borderRadius: 2, cursor: "pointer", padding: 0, background: c, border: `1.5px solid ${isA ? "rgba(255,255,255,0.55)" : "transparent"}`, position: "relative", zIndex: 0, flexShrink: 0 }} />;
          })}</div>; })()}
        <div style={{ width: 1, height: 18, background: "rgba(148,210,216,0.22)", margin: "0 5px", flexShrink: 0 }} />
        {tool === "tile" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 6, flexShrink: 0 }}>
            {Object.keys(sheet.sprites).map((sn) => { const sel = tileSprite === sn; return <button key={sn} title={sn} onClick={() => setTileSprite(sn)} style={{ height: 24, padding: "0 6px", borderRadius: 3, cursor: "pointer", border: `1px solid ${sel ? accent : panelBorder}`, background: sel ? `${accent}20` : chip, color: sel ? accent : panelTxtMute, fontSize: 9, fontFamily: fontUI, whiteSpace: "nowrap" }}>{sn}</button>; })}
            {Object.keys(sheet.sprites).length > 0 && <><div style={{ width: 1, height: 12, background: panelBorder, margin: "0 2px" }} />{[1,0,-1].map((sp) => { const lbl = sp === -1 ? "Auto" : `${sp}px`; return <button key={sp} onClick={() => { tileSpacingRef.current = sp; }} style={{ height: 20, padding: "0 4px", border: `1px solid ${tileSpacingRef.current === sp ? accent : panelBorder}`, borderRadius: 3, cursor: "pointer", fontSize: 9, background: tileSpacingRef.current === sp ? accent : "transparent", color: tileSpacingRef.current === sp ? "#fff" : panelTxtMute }}>{lbl}</button>; })}</>}
          </div>
        )}
        <div style={{ display: "flex", gap: 2, alignItems: "center", marginRight: 6, flexShrink: 0 }}>
          {BRUSH_SIZES.map(({ size: sz, dotPx }) => (
            <button key={sz} title={`Brush ${sz}px`} onClick={() => setBrushSize(sz)} style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, cursor: "pointer", border: `1.5px solid ${brushSize === sz ? accent : "transparent"}`, background: brushSize === sz ? `${accent}22` : "transparent" }}>
              <div style={{ width: dotPx, height: dotPx, borderRadius: 1, background: brushSize === sz ? accent : panelTxtMute }} /></button>
          ))}
        </div>
        <span ref={coordsBarRef} style={{ marginLeft: "auto", fontFamily: fontMono, fontSize: "10.5px", color: panelTxtMute, whiteSpace: "nowrap", flexShrink: 0 }}>—</span>
      </footer>

      {/* Context menu */}
      {contextMenu && (
        <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 200, background: surfacePanel, border: `1px solid ${panelBorder}`, borderRadius: 4, padding: "4px 0", boxShadow: "0 4px 16px rgba(0,0,0,0.5)", minWidth: 140, fontSize: 11 }}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {contextMenu.type === "sprite" && <button onClick={() => { deleteSprite(contextMenu.sprite); setContextMenu(null); }} style={{ display: "block", width: "100%", padding: "5px 12px", background: "transparent", border: "none", cursor: "pointer", color: "#b13e53", textAlign: "left" }}>Delete sprite "{contextMenu.sprite}"</button>}
          {contextMenu.type === "anim" && contextMenu.anim && (() => { const ac = Object.keys(sheet.sprites[contextMenu.sprite]?.animations ?? {}).length; const d = ac <= 1; return <button disabled={d} onClick={() => { if (!d && contextMenu.anim) deleteAnimation(contextMenu.sprite, contextMenu.anim); setContextMenu(null); }} style={{ display: "block", width: "100%", padding: "5px 12px", background: "transparent", border: "none", cursor: d ? "not-allowed" : "pointer", color: d ? panelTxtMute : "#b13e53", textAlign: "left" }}>{d ? "Cannot delete last animation" : `Delete animation "${contextMenu.anim}"`}</button>; })()}
        </div>
      )}

      {/* Hover preview */}
      {previewAnim && (() => { const strip = sheet.sprites[previewAnim.sprite]?.animations[previewAnim.anim]; if (!strip) return null;
        return <div style={{ position: "fixed", zIndex: 100, pointerEvents: "none", left: strip.x * zoom + 60, top: strip.y * zoom + 60, background: surfacePanel, border: `1px solid ${panelBorder}`, borderRadius: 6, padding: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: 9, color: panelTxtMute, marginBottom: 3 }}>{previewAnim.sprite}.{previewAnim.anim} · {strip.fps ?? 8}fps</div>
          <canvas ref={previewCanvasRef} style={{ imageRendering: "pixelated", display: "block" }} />
        </div>;
      })()}

      {/* ── Library picker modal ── */}
      {showLibrary && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setShowLibrary(false)} />
          <div style={{ position: "relative", width: 480, background: surfacePanel, border: `1px solid ${panelBorder}`, borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: panelHeader, borderBottom: `1px solid ${panelBorder}` }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: panelTxt }}>{t("comingSoon.title")}</span>
              <button onClick={() => setShowLibrary(false)} style={{ all: "unset", cursor: "pointer", color: panelTxtMute, fontSize: 18, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}>×</button>
            </div>
            <div style={{ padding: "48px 32px", textAlign: "center", color: panelTxtMute, fontSize: 13, fontFamily: fontUI, lineHeight: 1.5 }}>
              {t("comingSoon.sprites")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
