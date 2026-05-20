import { useRef, useState, useEffect, useCallback, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Stage, Layer,
  Rect as KRect, Ellipse as KEllipse, Line as KLine,
  Text as KText, Transformer, Circle as KCircle, Path as KPath,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { useThemeStore, type Theme } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { ThemedDialog } from "./components/ThemedDialog";

// ── Types ──────────────────────────────────
type ShapeBase = { id: string; fill: string; stroke: string; strokeWidth: number; rotation: number; opacity?: number; lineCap?: string; lineJoin?: string; dash?: number[] };
type RectData = ShapeBase & { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number };
type EllipseData = ShapeBase & { kind: "ellipse"; x: number; y: number; radiusX: number; radiusY: number };
type LineData = ShapeBase & { kind: "line"; points: number[] };
type FreehandData = ShapeBase & { kind: "freehand"; points: number[]; closed: boolean };
type PolygonData = ShapeBase & { kind: "polygon"; points: number[]; closed: boolean };
type TextData = ShapeBase & { kind: "text"; x: number; y: number; text: string; fontSize: number };
type PathData = ShapeBase & { kind: "path"; d: string; x: number; y: number; scaleX?: number; scaleY?: number };
type ShapeData = RectData | EllipseData | LineData | FreehandData | PolygonData | TextData | PathData;
type Tool = "select" | "fill" | "rect" | "ellipse" | "line" | "freehand" | "polygon" | "text" | "editpath";

let _uid = 0;
const uid = () => `s${++_uid}`;

// Extra pixels around the Stage so Transformer handles aren't clipped at sprite edges
const PAD = 20;

// Grid size constrained to powers of 2
const POW2 = [1, 2, 4, 8, 16, 32];
const prevPow2 = (v: number) => POW2[Math.max(0, POW2.indexOf(v) - 1)] ?? 1;
const nextPow2 = (v: number) => POW2[Math.min(POW2.length - 1, POW2.indexOf(v) + 1)] ?? 32;

const COLORS: { name: string; hex: string }[] = [
  { name: "red",       hex: "#ff0000" }, { name: "orange",   hex: "#ff8c00" }, { name: "yellow",  hex: "#ffff00" },
  { name: "gold",      hex: "#ffd700" }, { name: "lime",     hex: "#7cfc00" }, { name: "green",   hex: "#008000" },
  { name: "cyan",      hex: "#00ffff" }, { name: "teal",     hex: "#008080" }, { name: "sky",     hex: "#87ceeb" },
  { name: "blue",      hex: "#0000ff" }, { name: "navy",     hex: "#000080" }, { name: "indigo",  hex: "#4b0082" },
  { name: "magenta",   hex: "#ff00ff" }, { name: "pink",     hex: "#ff69b4" }, { name: "coral",   hex: "#ff7f50" },
  { name: "brown",     hex: "#8b4513" }, { name: "maroon",   hex: "#800000" }, { name: "olive",   hex: "#808000" },
  { name: "white",     hex: "#ffffff" }, { name: "silver",   hex: "#c0c0c0" }, { name: "gray",    hex: "#808080" },
  { name: "dark-gray", hex: "#404040" }, { name: "black",    hex: "#000000" }, { name: "purple",  hex: "#800080" },
];

const isTransparent = (c: string) => c === "transparent";

// ── Static sub-components ────────────────────────────────────────────────────────
function Swatch({ color, name, active, onClick, theme }: { color: string; name?: string; onClick: () => void; active: boolean; theme: Theme }) {
  return (
    <button type="button" title={name || color} onClick={onClick} aria-label={name || color}
      style={{
        all: "unset", cursor: "pointer", width: 22, height: 22, borderRadius: 3,
        background: isTransparent(color)
          ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 8px 8px" : color,
        boxShadow: active
          ? `0 0 0 2px ${theme.accent}, inset 0 0 0 1px rgba(0,0,0,0.15)`
          : "inset 0 0 0 1px rgba(0,0,0,0.18)",
      }} />
  );
}

function ColorPopover({ open: popOpen, value, onPick, anchor = "bottom-left", testId, theme,
  opacity, onOpacityChange }: {
  open: boolean; value: string; onPick: (c: string) => void; anchor?: string; testId?: string; theme: Theme;
  opacity?: number; onOpacityChange?: (o: number) => void;
}) {
  const [hexInput, setHexInput] = useState(() => value?.startsWith('#') ? value : '#ff0000');
  useEffect(() => { if (value?.startsWith('#') && /^#[0-9a-fA-F]{6}$/.test(value)) setHexInput(value); }, [value]);
  if (!popOpen) return null;
  const pos = anchor === "bottom-right" ? { top: "100%", right: 0 } : { top: "100%", left: 0 };
  const applyHex = (v: string) => { if (/^#[0-9a-fA-F]{6}$/.test(v)) onPick(v); };
  const inputSt: CSSProperties = {
    height: 22, fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxt,
    background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
    borderRadius: 3, padding: "0 5px", outline: "none", boxSizing: "border-box",
  };
  return (
    <div data-testid={testId} onClick={e => e.stopPropagation()} style={{
      position: "absolute", ...pos, marginTop: 6,
      background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
      borderRadius: theme.radiusCard, boxShadow: "0 10px 32px -10px rgba(0,0,0,0.30)",
      padding: 10, width: 184, zIndex: 30,
    }}>
      {/* 24 color swatches in 6×4 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 26px)", gap: 4 }}>
        {COLORS.map(c => <Swatch key={c.name} color={c.hex} name={c.name} active={c.hex === value} onClick={() => onPick(c.hex)} theme={theme} />)}
      </div>
      {/* None / transparent swatch */}
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color="transparent" name="none" active={value === "transparent"} onClick={() => onPick("transparent")} theme={theme} />
        <span style={{ fontSize: 10, color: theme.panelTxtMute }}>none / transparent</span>
      </div>
      {/* Custom hex input */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <input type="color" value={hexInput} onChange={e => { setHexInput(e.target.value); onPick(e.target.value); }}
          style={{ width: 26, height: 26, padding: 2, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: "pointer", background: theme.surfacePanel, flexShrink: 0 }} />
        <input type="text" value={hexInput} maxLength={7} placeholder="#rrggbb"
          onChange={e => { setHexInput(e.target.value); applyHex(e.target.value); }}
          onBlur={e => applyHex(e.target.value)}
          style={{ ...inputSt, width: 76 }} />
      </div>
      {/* Opacity slider (fill popover only) */}
      {onOpacityChange !== undefined && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>Opacity</span>
            <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.panelTxt }}>{Math.round((opacity ?? 1) * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={opacity ?? 1}
            onChange={e => onOpacityChange(parseFloat(e.target.value))}
            style={{ width: "100%", cursor: "pointer", accentColor: theme.accent }} />
        </div>
      )}
    </div>
  );
}

function Stepper({ value, min, max, step = 1, onChange, label, format, testId, theme }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; label?: string; format?: (v: number) => string;
  testId?: string; theme: Theme;
}) {
  const fmt = format ?? String;
  const dec = (v: number) => parseFloat(Math.max(min, v - step).toFixed(6));
  const inc = (v: number) => parseFloat(Math.min(max, v + step).toFixed(6));
  const btnStyle: CSSProperties = {
    all: "unset", cursor: "pointer", width: 14, height: 20,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: theme.panelTxt, fontSize: 14, lineHeight: "1",
    border: `1px solid ${theme.panelBorder}`,
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }} data-testid={testId}>
      {label && <span style={{ fontSize: 11, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>}
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <button type="button" onClick={() => onChange(dec(value))} style={{ ...btnStyle, borderRadius: "3px 0 0 3px" }}>−</button>
        <span style={{
          fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxt, minWidth: 22, textAlign: "center",
          border: `1px solid ${theme.panelBorder}`, borderLeft: "none", borderRight: "none",
          height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{fmt(value)}</span>
        <button type="button" onClick={() => onChange(inc(value))} style={{ ...btnStyle, borderRadius: "0 3px 3px 0" }}>+</button>
      </div>
    </div>
  );
}

type SpriteEditorProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, dataUrl: string) => void;
  size?: 64 | 128;
  initialName?: string;
  initialDataUrl?: string;
};

export default function SpriteEditor({ open, onClose, onSave, size = 64, initialName, initialDataUrl }: SpriteEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [scale, setScale] = useState(10);
  const SCALE = scale;
  const W = size * SCALE;
  const H = size * SCALE;
  const CENTER = size / 2;

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const vertexPreDragShapes = useRef<ShapeData[]>([]);

  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [history, setHistory] = useState<ShapeData[][]>([]);
  const [future, setFuture] = useState<ShapeData[][]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selRect, setSelRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [tool, setTool] = useState<Tool>("rect");
  const [fill, setFill] = useState("#4ade80");
  const [stroke, setStroke] = useState("#1e293b");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [draft, setDraft] = useState<ShapeData | null>(null);

  const draftRef = useRef<ShapeData | null>(null);
  const shapesRef = useRef<ShapeData[]>([]);
  const selectedIdsRef = useRef<string[]>([]);
  const fillRef = useRef(fill);
  const opacityRef = useRef(opacity);
  const toolRef = useRef<Tool>(tool);
  draftRef.current = draft;
  shapesRef.current = shapes;
  selectedIdsRef.current = selectedIds;
  fillRef.current = fill;
  opacityRef.current = opacity;
  toolRef.current = tool;

  const [isDrawing, setIsDrawing] = useState(false);
  const [spriteName, setSpriteName] = useState(initialName || "sprite");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [polygonVertices, setPolygonVertices] = useState<Array<{ x: number; y: number }>>([]);
  const [freehandStartPoint, setFreehandStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [gridOn, setGridOn] = useState(false);
  const [gridSize, setGridSize] = useState(8);
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number; base: ShapeBase } | null>(null);
  const [textInput, setTextInput] = useState('');

  const selectedId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const selectedShape = selectedId ? (shapes.find(s => s.id === selectedId) ?? null) : null;
  const canRotate = selectedIds.length > 1 || (selectedShape !== null && !("points" in selectedShape));

  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    let nodes: Konva.Node[] = [];
    if (tool === "select" && selectedIds.length > 0) {
      nodes = selectedIds.map(id => stageRef.current!.findOne(`#${id}`)).filter((n): n is Konva.Node => !!n);
    } else if (tool === "editpath" && selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) nodes = [node];
    }
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedIds, selectedId, shapes, tool]);

  // Sync fill/stroke/strokeWidth/opacity from selected shape (single selection only)
  useEffect(() => {
    if (selectedIds.length === 1) {
      const shape = shapes.find(s => s.id === selectedIds[0]);
      if (shape) {
        setFill(shape.fill);
        setStroke(shape.stroke);
        setStrokeWidth(shape.strokeWidth);
        setOpacity(shape.opacity ?? 1);
      }
    }
  }, [selectedIds, shapes]);

  const commit = useCallback((next: ShapeData[]) => {
    setHistory(h => [...h, shapesRef.current]);
    setFuture([]);
    setShapes(next);
  }, []);

  // Bakes the current Konva node transform (position/scale/rotation) back into shape data
  const bakeNodeTransform = (s: ShapeData, node: Konva.Node): ShapeData => {
    const sx = node.scaleX(), sy = node.scaleY(), rot = node.rotation();
    if (s.kind === "rect") {
      const r = s as RectData;
      const nw = r.width * sx, nh = r.height * sy;
      return { ...r, x: node.x() / SCALE - nw / 2, y: node.y() / SCALE - nh / 2,
        width: nw, height: nh, rx: r.rx ? r.rx * (sx + sy) / 2 : undefined, rotation: rot };
    }
    if (s.kind === "ellipse") {
      const el = s as EllipseData;
      return { ...el, x: node.x() / SCALE, y: node.y() / SCALE,
        radiusX: el.radiusX * sx, radiusY: el.radiusY * sy, rotation: rot };
    }
    if (s.kind === "line" || s.kind === "freehand" || s.kind === "polygon") {
      const ln = s as LineData;
      const tr = node.getTransform();
      const newPts: number[] = [];
      for (let i = 0; i < ln.points.length; i += 2) {
        const p = tr.point({ x: ln.points[i]! * SCALE, y: ln.points[i + 1]! * SCALE });
        newPts.push(p.x / SCALE, p.y / SCALE);
      }
      return { ...s, points: newPts } as ShapeData;
    }
    if (s.kind === "path") {
      const pd = s as PathData;
      return { ...pd, x: node.x() / SCALE, y: node.y() / SCALE,
        scaleX: node.scaleX() / SCALE, scaleY: node.scaleY() / SCALE, rotation: rot };
    }
    if (s.kind === "text") {
      const td = s as TextData;
      return { ...td, x: node.x() / SCALE, y: node.y() / SCALE,
        fontSize: td.fontSize * (sx + sy) / 2, rotation: rot };
    }
    return s;
  };

  // Bake all selected nodes' current Konva transforms back into React state.
  // Called by both onTransformEnd (resize/rotate) and onDragEnd (body move).
  const bakePendingTransform = () => {
    if (!stageRef.current) return;
    const nextShapes: ShapeData[] = [];
    const nodesToReset: Array<{ node: Konva.Node; isPointBased: boolean }> = [];
    for (const s of shapesRef.current) {
      if (!selectedIds.includes(s.id)) { nextShapes.push(s); continue; }
      const node = stageRef.current.findOne(`#${s.id}`);
      if (!node) { nextShapes.push(s); continue; }
      nextShapes.push(bakeNodeTransform(s, node));
      const isPointBased = s.kind === "line" || s.kind === "freehand" || s.kind === "polygon";
      nodesToReset.push({ node, isPointBased });
    }
    flushSync(() => commit(nextShapes));
    nodesToReset.forEach(({ node, isPointBased }) => {
      node.scaleX(1); node.scaleY(1);
      if (isPointBased) { node.position({ x: 0, y: 0 }); node.rotation(0); }
    });
    // Do NOT call trRef.current.nodes() here — doing so synchronously inside an
    // onTransformEnd / onDragEnd handler resets Konva's drag state mid-cleanup,
    // which corrupts the Transformer and prevents the next drag from starting.
    // The useEffect([..., shapes, ...]) already re-attaches nodes after every commit.
  };

  // Center shapes so their bounding box midpoint = canvas center.
  // If shapes are selected, only those are moved; otherwise all shapes are moved.
  const centerSprite = useCallback(() => {
    if (!stageRef.current || shapesRef.current.length === 0) return;
    const targets = selectedIdsRef.current.length > 0
      ? shapesRef.current.filter(s => selectedIdsRef.current.includes(s.id))
      : shapesRef.current;
    if (targets.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach(s => {
      const node = stageRef.current!.findOne(`#${s.id}`);
      if (!node) return;
      const r = node.getClientRect({ relativeTo: layerRef.current! });
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
    });
    if (!isFinite(minX)) return;
    const targetIds = new Set(targets.map(s => s.id));
    const dx = CENTER - (minX + maxX) / 2 / SCALE;
    const dy = CENTER - (minY + maxY) / 2 / SCALE;
    commit(shapesRef.current.map(s => {
      if (!targetIds.has(s.id)) return s;
      if (s.kind === "rect") { const r = s as RectData; return { ...r, x: r.x + dx, y: r.y + dy }; }
      if (s.kind === "ellipse") { const el = s as EllipseData; return { ...el, x: el.x + dx, y: el.y + dy }; }
      if (s.kind === "text") { const td = s as TextData; return { ...td, x: td.x + dx, y: td.y + dy }; }
      if (s.kind === "path") { const pd = s as PathData; return { ...pd, x: pd.x + dx, y: pd.y + dy }; }
      if ("points" in s) {
        const ln = s as LineData;
        return { ...s, points: ln.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy) } as ShapeData;
      }
      return s;
    }));
  }, [SCALE, CENTER, commit]);

  const cancelPolygon = useCallback(() => {
    if (tool === "polygon" && draftRef.current) {
      setIsDrawing(false); setDraft(null); setPolygonVertices([]);
    }
  }, [tool]);

  const closePolygon = useCallback(() => {
    if (tool !== "polygon") return;
    const d = draftRef.current as PolygonData | null;
    if (!d) return;
    let pts = d.points;
    while (pts.length >= 8) {
      const n = pts.length;
      const dx = pts[n - 2] - pts[n - 4];
      const dy = pts[n - 1] - pts[n - 3];
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) pts = pts.slice(0, -2);
      else break;
    }
    if (pts.length < 6) { cancelPolygon(); return; }
    const isTrans = fillRef.current === "transparent" || fillRef.current === "#00000000";
    const closed: PolygonData = { ...d, points: pts, closed: true, fill: isTrans ? "transparent" : fillRef.current };
    draftRef.current = null;
    setIsDrawing(false);
    const s = shapesRef.current;
    setHistory(h => [...h, s]);
    setFuture([]);
    setShapes([...s, closed]);
    setDraft(null); setPolygonVertices([]);
  }, [tool, cancelPolygon]);

  const undo = () => {
    if (!history.length) return;
    setFuture(f => [shapesRef.current, ...f]);
    setShapes(history[history.length - 1]!);
    setHistory(h => h.slice(0, -1));
    setSelectedIds([]);
  };

  const redo = () => {
    if (!future.length) return;
    setHistory(h => [...h, shapesRef.current]);
    setShapes(future[0]!);
    setFuture(f => f.slice(1));
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    commit(shapes.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  };

  const moveUp = () => {
    if (!selectedId) return;
    const idx = shapes.findIndex(s => s.id === selectedId);
    if (idx < shapes.length - 1) {
      const next = [...shapes];
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      commit(next);
    }
  };

  const moveDown = () => {
    if (!selectedId) return;
    const idx = shapes.findIndex(s => s.id === selectedId);
    if (idx > 0) {
      const next = [...shapes];
      [next[idx], next[idx - 1]] = [next[idx - 1]!, next[idx]!];
      commit(next);
    }
  };

  // Stable refs so the keyboard handler only re-attaches when `open` changes
  const undoRef = useRef(undo); undoRef.current = undo;
  const redoRef = useRef(redo); redoRef.current = redo;
  const deleteSelectedRef = useRef(deleteSelected); deleteSelectedRef.current = deleteSelected;
  const closePolygonRef = useRef(closePolygon); closePolygonRef.current = closePolygon;
  const cancelPolygonRef = useRef(cancelPolygon); cancelPolygonRef.current = cancelPolygon;
  const centerSpriteRef = useRef(centerSprite); centerSpriteRef.current = centerSprite;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.ctrlKey && !e.shiftKey && e.code === "KeyZ") { e.preventDefault(); undoRef.current(); return; }
      if (e.ctrlKey && (e.code === "KeyY" || (e.shiftKey && e.code === "KeyZ"))) { e.preventDefault(); redoRef.current(); return; }
      if (e.ctrlKey && !e.shiftKey && e.code === "KeyA") { e.preventDefault(); setSelectedIds(shapesRef.current.map(s => s.id)); return; }
      if (e.ctrlKey && e.shiftKey && e.code === "KeyC") { e.preventDefault(); centerSpriteRef.current(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey && !e.altKey) { e.preventDefault(); deleteSelectedRef.current(); return; }
      if (e.key === "Escape") { setSelectedIds([]); cancelPolygonRef.current(); return; }
      if (toolRef.current === "polygon" && draftRef.current) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); closePolygonRef.current(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const loadImageToShapes = useCallback(async (dataUrl: string | undefined) => {
    if (!dataUrl) { setShapes([]); setHistory([]); setFuture([]); return; }
    try {
      let svgContent: string;
      if (dataUrl.startsWith('data:image/svg+xml;base64,')) {
        svgContent = atob(dataUrl.split(',')[1]!);
      } else if (dataUrl.startsWith('data:image/svg+xml,')) {
        svgContent = decodeURIComponent(dataUrl.slice('data:image/svg+xml,'.length));
      } else {
        // Vite asset URL (premade sprite loaded with ?url)
        svgContent = await fetch(dataUrl).then(r => r.text());
      }
      const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) { setShapes([]); setHistory([]); setFuture([]); return; }
      const parseRotation = (el: Element) => {
        const m = (el.getAttribute('transform') ?? '').match(/rotate\(\s*(-?[\d.]+)/);
        return m ? parseFloat(m[1]) : 0;
      };
      const parsed: ShapeData[] = [];
      // querySelectorAll preserves document order, which is critical for correct z-layering.
      // uid() is used (not a local counter) so IDs never collide with newly drawn shapes.
      svg.querySelectorAll('rect, ellipse, circle, polygon, path, line').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const fill = el.getAttribute('fill') ?? 'transparent';
        const stroke = el.getAttribute('stroke') ?? 'none';
        const strokeWidth = parseFloat(el.getAttribute('stroke-width') || '0');
        const opacity = parseFloat(el.getAttribute('opacity') || '1');
        const lineCap = el.getAttribute('stroke-linecap') ?? undefined;
        const lineJoin = el.getAttribute('stroke-linejoin') ?? undefined;
        const dashRaw = el.getAttribute('stroke-dasharray');
        const dash = dashRaw ? dashRaw.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n)) : undefined;
        const base = { id: uid(), rotation: 0, fill, stroke, strokeWidth, opacity, lineCap, lineJoin, dash };
        if (tag === 'rect') {
          const rx = parseFloat(el.getAttribute('rx') ?? el.getAttribute('ry') ?? '0') || undefined;
          parsed.push({ ...base, kind: 'rect',
            x: parseFloat(el.getAttribute('x') || '0'), y: parseFloat(el.getAttribute('y') || '0'),
            width: parseFloat(el.getAttribute('width') || '0'), height: parseFloat(el.getAttribute('height') || '0'),
            rx,
          });
        } else if (tag === 'ellipse') {
          parsed.push({ ...base, kind: 'ellipse', rotation: parseRotation(el),
            x: parseFloat(el.getAttribute('cx') || '0'), y: parseFloat(el.getAttribute('cy') || '0'),
            radiusX: parseFloat(el.getAttribute('rx') || '0'), radiusY: parseFloat(el.getAttribute('ry') || '0'),
          });
        } else if (tag === 'circle') {
          const r = parseFloat(el.getAttribute('r') || '0');
          parsed.push({ ...base, kind: 'ellipse', rotation: parseRotation(el),
            x: parseFloat(el.getAttribute('cx') || '0'), y: parseFloat(el.getAttribute('cy') || '0'),
            radiusX: r, radiusY: r,
          });
        } else if (tag === 'polygon') {
          const pts: number[] = [];
          (el.getAttribute('points') || '').trim().split(/[\s,]+/).forEach((v) => { const f = parseFloat(v); if (!isNaN(f)) pts.push(f); });
          if (pts.length >= 6) parsed.push({ ...base, kind: 'polygon', points: pts, closed: true });
        } else if (tag === 'path') {
          const d = el.getAttribute('d') || '';
          if (d) parsed.push({ ...base, kind: 'path', d, x: 0, y: 0 });
        } else if (tag === 'line') {
          parsed.push({ ...base, kind: 'line', points: [
            parseFloat(el.getAttribute('x1') || '0'), parseFloat(el.getAttribute('y1') || '0'),
            parseFloat(el.getAttribute('x2') || '0'), parseFloat(el.getAttribute('y2') || '0'),
          ]});
        }
      });
      if (parsed.length > 0) { setFill(parsed[0].fill); setStroke(parsed[0].stroke); setStrokeWidth(parsed[0].strokeWidth); }
      setShapes(parsed); setHistory([]); setFuture([]);
    } catch (e) { console.error('Failed to parse SVG:', e); setShapes([]); setHistory([]); setFuture([]); }
  }, []);

  useEffect(() => {
    if (!initialDataUrl || !open) return;
    let isMounted = true;
    loadImageToShapes(initialDataUrl).then(() => {
      if (!isMounted) return;
    });
    return () => { isMounted = false; };
  }, [initialDataUrl, open, loadImageToShapes]);

  const snapGrid = (v: number) => gridOn ? Math.round(v / gridSize) * gridSize : v;

  const getPos = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()!.getPointerPosition()!;
    return { x: snapGrid((pos.x - PAD) / SCALE), y: snapGrid((pos.y - PAD) / SCALE) };
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (tool === "fill") return;
    if (tool === "editpath") {
      if (e.target === e.target.getStage()) setSelectedIds([]);
      return;
    }
    if (tool === "select") {
      if (e.target === e.target.getStage()) {
        const pos = e.target.getStage()!.getPointerPosition()!;
        const lx = pos.x - PAD, ly = pos.y - PAD;
        setSelRect({ x1: lx, y1: ly, x2: lx, y2: ly });
        setIsSelecting(true);
        setSelectedIds([]);
      }
      return;
    }
    const { x, y } = getPos(e);
    const base: ShapeBase = { id: uid(), fill, stroke, strokeWidth, rotation: 0, opacity };
    if (tool === "text") {
      setTextInput('');
      setTextPrompt({ x, y, base });
      return;
    }
    setIsDrawing(true);
    if (tool === "rect") setDraft({ ...base, kind: "rect", x, y, width: 0, height: 0 });
    else if (tool === "ellipse") setDraft({ ...base, kind: "ellipse", x, y, radiusX: 0, radiusY: 0 });
    else if (tool === "line") setDraft({ ...base, kind: "line", points: [x, y, x, y] });
    else if (tool === "freehand") { setDraft({ ...base, kind: "freehand", points: [x, y], closed: false }); setFreehandStartPoint({ x, y }); }
    else if (tool === "polygon") {
      const current = draftRef.current as PolygonData | null;
      if (!current) {
        const next: PolygonData = { ...base, kind: "polygon", points: [x, y], closed: false };
        draftRef.current = next; setDraft(next); setPolygonVertices([{ x, y }]);
      } else {
        const next: PolygonData = { ...current, points: [...current.points, x, y] };
        draftRef.current = next; setDraft(next); setPolygonVertices(prev => [...prev, { x, y }]);
      }
    }
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const { x, y } = getPos(e);
    setMousePos({ x: x * SCALE, y: y * SCALE });
    if (isSelecting) {
      const pos = e.target.getStage()!.getPointerPosition()!;
      setSelRect(r => r ? { ...r, x2: pos.x - PAD, y2: pos.y - PAD } : null);
      return;
    }
    if (!isDrawing || !draft) return;
    if (draft.kind === "rect") { const d = draft as RectData; setDraft({ ...d, width: Math.abs(x - d.x), height: Math.abs(y - d.y) }); }
    else if (draft.kind === "ellipse") { const d = draft as EllipseData; setDraft({ ...d, radiusX: Math.abs(x - d.x), radiusY: Math.abs(y - d.y) }); }
    else if (draft.kind === "line") { const pts = [...(draft as LineData).points]; pts[2] = x; pts[3] = y; setDraft({ ...draft, points: pts } as LineData); }
    else if (draft.kind === "freehand") { setDraft({ ...draft, points: [...(draft as FreehandData).points, x, y] } as FreehandData); }
  };

  const onMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
      if (selRect && stageRef.current) {
        const rx1 = Math.min(selRect.x1, selRect.x2);
        const ry1 = Math.min(selRect.y1, selRect.y2);
        const rx2 = Math.max(selRect.x1, selRect.x2);
        const ry2 = Math.max(selRect.y1, selRect.y2);
        if (rx2 - rx1 > 4 || ry2 - ry1 > 4) {
          const hits: string[] = [];
          shapes.forEach(s => {
            const node = stageRef.current!.findOne(`#${s.id}`);
            if (!node) return;
            const r = node.getClientRect({ relativeTo: layerRef.current! });
            if (r.x < rx2 && r.x + r.width > rx1 && r.y < ry2 && r.y + r.height > ry1) hits.push(s.id);
          });
          setSelectedIds(hits);
        }
      }
      setSelRect(null);
      return;
    }
    if (!isDrawing || !draft) return;
    if (tool === "polygon") return;
    if (tool === "freehand") {
      const fd = draft as FreehandData;
      let shouldClose = false;
      if (freehandStartPoint && fd.points.length >= 6) {
        const dx = fd.points[fd.points.length - 2] - freehandStartPoint.x;
        const dy = fd.points[fd.points.length - 1] - freehandStartPoint.y;
        shouldClose = Math.sqrt(dx * dx + dy * dy) < 15;
      }
      const isTrans = fill === "transparent" || fill === "#00000000";
      setIsDrawing(false);
      commit([...shapes, { ...fd, closed: shouldClose, fill: shouldClose && !isTrans ? fill : "transparent" }]);
      setDraft(null); setFreehandStartPoint(null);
      return;
    }
    setIsDrawing(false);
    commit([...shapes, draft]);
    setDraft(null);
  };

  const onDoubleClick = () => {
    const d = draftRef.current;
    const s = shapesRef.current;
    if (tool === "polygon" && d) {
      closePolygon();
    } else if (tool === "line" && d) {
      setIsDrawing(false);
      setHistory(h => [...h, s]);
      setFuture([]);
      setShapes([...s, d]);
      setDraft(null);
    }
  };

  const renderShape = (s: ShapeData, isDraft = false): React.ReactNode => {
    const selectable = (tool === "select" || tool === "editpath") && !isDraft;
    const clickable = selectable || (tool === "fill" && !isDraft);
    const shapeKey = isDraft ? "draft" : s.id;

    const common = {
      id: isDraft ? undefined : s.id,
      listening: !isDraft,
      stroke: s.stroke,
      strokeWidth: s.strokeWidth * SCALE,
      rotation: s.rotation,
      opacity: s.opacity ?? 1,
      draggable: !isDraft && tool === "select" && selectedIds.includes(s.id),
      onDragEnd: (!isDraft && tool === "select" && selectedIds.includes(s.id)) ? bakePendingTransform : undefined,
      onClick: clickable ? (e: KonvaEventObject<MouseEvent>) => {
        if (tool === "fill") {
          commit(shapesRef.current.map(sh => sh.id === s.id ? { ...sh, fill: fillRef.current } : sh));
        } else {
          if (e.evt.shiftKey) {
            setSelectedIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]);
          } else {
            setSelectedIds([s.id]);
          }
        }
      } : undefined,
    };

    switch (s.kind) {
      case "rect": {
        const r = s as RectData;
        const cx = r.x * SCALE + r.width * SCALE / 2;
        const cy = r.y * SCALE + r.height * SCALE / 2;
        return <KRect key={shapeKey} {...common} fill={s.fill}
          x={cx} y={cy}
          offsetX={r.width * SCALE / 2} offsetY={r.height * SCALE / 2}
          width={r.width * SCALE} height={r.height * SCALE}
          cornerRadius={(r.rx ?? 0) * SCALE} />;
      }
      case "ellipse": {
        const el = s as EllipseData;
        return <KEllipse key={shapeKey} {...common} fill={s.fill}
          x={el.x * SCALE} y={el.y * SCALE}
          radiusX={el.radiusX * SCALE} radiusY={el.radiusY * SCALE} />;
      }
      case "line": case "freehand": {
        const ln = s as LineData; if (ln.points.length < 4) return null;
        const fh = s.kind === "freehand" ? (s as FreehandData) : null;
        return <KLine key={shapeKey} {...common}
          fill={fh?.closed ? s.fill : "transparent"}
          points={ln.points.map(p => p * SCALE)}
          tension={fh ? 0.4 : 0}
          lineCap={(s.lineCap as 'butt'|'round'|'square') ?? "round"}
          lineJoin={(s.lineJoin as 'bevel'|'round'|'miter') ?? "round"}
          dash={s.dash?.map(d => d * SCALE)}
          closed={fh?.closed ?? false} />;
      }
      case "polygon": {
        const p = s as PolygonData;
        if (isDraft && tool === "polygon") {
          const preview = [...p.points];
          if (mousePos.x > 0 && mousePos.y > 0) preview.push(mousePos.x / SCALE, mousePos.y / SCALE);
          if (preview.length < 4) return null;
          return (<>
            <KLine key="draft-poly" listening={false} points={preview.map(pt => pt * SCALE)} closed={false}
              tension={0} lineCap="round" lineJoin="round" fill="transparent"
              stroke={stroke} strokeWidth={strokeWidth * SCALE} dash={[5 * SCALE, 5 * SCALE]} />
            {polygonVertices.map((v, i) => <KCircle key={`v${i}`} listening={false}
              x={v.x * SCALE} y={v.y * SCALE} radius={4} fill="#22d3ee" stroke="#000" strokeWidth={1} />)}
          </>);
        }
        if (p.points.length < 6) return null;
        return <KLine key={shapeKey} {...common}
          points={p.points.map(pt => pt * SCALE)} closed={p.closed}
          tension={0}
          lineCap={(s.lineCap as 'butt'|'round'|'square') ?? "round"}
          lineJoin={(s.lineJoin as 'bevel'|'round'|'miter') ?? "round"}
          dash={s.dash?.map(d => d * SCALE)}
          fill={p.closed ? s.fill : "transparent"} />;
      }
      case "text": {
        const td = s as TextData;
        return <KText key={shapeKey} {...common} fill={s.fill}
          x={td.x * SCALE} y={td.y * SCALE} text={td.text} fontSize={td.fontSize * SCALE} />;
      }
      case "path": {
        const pd = s as PathData;
        // scaleX/Y handles coordinate scaling; override pre-scaled strokeWidth so it doesn't get double-scaled
        return <KPath key={shapeKey} {...common} fill={s.fill}
          data={pd.d} x={pd.x * SCALE} y={pd.y * SCALE}
          scaleX={(pd.scaleX ?? 1) * SCALE} scaleY={(pd.scaleY ?? 1) * SCALE}
          strokeWidth={s.strokeWidth}
          lineCap={(s.lineCap as 'butt'|'round'|'square') ?? "butt"}
          lineJoin={(s.lineJoin as 'bevel'|'round'|'miter') ?? "miter"}
          dash={s.dash} />;
      }
      default: return null;
    }
  };

  const renderVertexHandles = (): React.ReactNode => {
    if (tool !== "editpath" || !selectedId) return null;
    const shape = shapes.find(s => s.id === selectedId);
    if (!shape || !("points" in shape)) return null;
    const pts = (shape as LineData | FreehandData | PolygonData).points;
    const handles: React.ReactNode[] = [];
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const vi = i;
      handles.push(
        <KCircle key={`ep${vi}`}
          x={pts[vi] * SCALE} y={pts[vi + 1] * SCALE}
          radius={5} fill="#22d3ee" stroke="#fff" strokeWidth={1.5}
          draggable
          onDragStart={() => { vertexPreDragShapes.current = shapes; }}
          onDragEnd={(e) => {
            const newX = snapGrid(e.target.x() / SCALE);
            const newY = snapGrid(e.target.y() / SCALE);
            const pre = vertexPreDragShapes.current;
            const next = pre.map(s => {
              if (s.id !== selectedId || !("points" in s)) return s;
              const np = [...(s as LineData).points];
              np[vi] = newX; np[vi + 1] = newY;
              return { ...s, points: np } as ShapeData;
            });
            setHistory(h => [...h, pre]);
            setFuture([]);
            setShapes(next);
            vertexPreDragShapes.current = [];
          }}
        />
      );
    }
    return handles;
  };

  const renderGrid = (): React.ReactNode[] => {
    if (!gridOn) return [];
    const lines: React.ReactNode[] = [];
    for (let gx = gridSize; gx < size; gx += gridSize)
      lines.push(<KLine key={`gv${gx}`} points={[gx * SCALE, 0, gx * SCALE, H]} stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} listening={false} />);
    for (let gy = gridSize; gy < size; gy += gridSize)
      lines.push(<KLine key={`gh${gy}`} points={[0, gy * SCALE, W, gy * SCALE]} stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} listening={false} />);
    return lines;
  };

  const saveSVG = () => {
    const rotAttr = (s: ShapeBase, cx: number, cy: number) =>
      s.rotation ? ` transform="rotate(${s.rotation.toFixed(2)},${cx},${cy})"` : "";
    const opAttr = (s: ShapeBase) =>
      (s.opacity !== undefined && s.opacity !== 1) ? ` opacity="${s.opacity}"` : '';
    const els = shapes.map(s => {
      const f = s.fill, st = s.stroke, sw = s.strokeWidth;
      if (s.kind === "rect") {
        const r = s as RectData;
        const rxAttr = r.rx ? ` rx="${r.rx}"` : '';
        return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"${rxAttr} fill="${f}" stroke="${st}" stroke-width="${sw}"${opAttr(s)}${rotAttr(s, r.x + r.width / 2, r.y + r.height / 2)}/>`;
      }
      if (s.kind === "ellipse") {
        const el = s as EllipseData;
        return `<ellipse cx="${el.x}" cy="${el.y}" rx="${el.radiusX}" ry="${el.radiusY}" fill="${f}" stroke="${st}" stroke-width="${sw}"${opAttr(s)}${rotAttr(s, el.x, el.y)}/>`;
      }
      if (s.kind === "line" || s.kind === "freehand") {
        const pts = (s as LineData).points;
        const fh = s.kind === "freehand" ? (s as FreehandData) : null;
        const d = pts.reduce((acc, p, i) => i === 0 ? `M ${p}` : i === 1 ? `${acc} ${p}` : i % 2 === 0 ? `${acc} L ${p}` : `${acc} ${p}`, "");
        const fillAttr = fh?.closed ? `fill="${f}"` : 'fill="none"';
        const capAttr = s.lineCap ? ` stroke-linecap="${s.lineCap}"` : ' stroke-linecap="round"';
        const joinAttr = s.lineJoin ? ` stroke-linejoin="${s.lineJoin}"` : '';
        const dashAttr = s.dash ? ` stroke-dasharray="${s.dash.join(' ')}"` : '';
        return `<path d="${d}${fh?.closed ? " Z" : ""}" ${fillAttr} stroke="${st}" stroke-width="${sw}"${opAttr(s)}${capAttr}${joinAttr}${dashAttr}/>`;
      }
      if (s.kind === "polygon") {
        const p = s as PolygonData; if (p.points.length < 6) return "";
        const pts: string[] = [];
        for (let i = 0; i < p.points.length; i += 2) pts.push(`${p.points[i]},${p.points[i + 1]}`);
        return `<polygon points="${pts.join(" ")}" fill="${f}" stroke="${st}" stroke-width="${sw}"${opAttr(s)} stroke-linecap="round"/>`;
      }
      if (s.kind === "text") {
        const td = s as TextData;
        return `<text x="${td.x}" y="${td.y + td.fontSize}" font-size="${td.fontSize}" fill="${f}"${opAttr(s)}${rotAttr(s, td.x, td.y)}>${td.text}</text>`;
      }
      if (s.kind === "path") {
        const pd = s as PathData;
        const opacityAttr = opAttr(pd);
        const psx = pd.scaleX ?? 1, psy = pd.scaleY ?? 1;
        const transforms: string[] = [];
        if (pd.x !== 0 || pd.y !== 0) transforms.push(`translate(${pd.x},${pd.y})`);
        if (psx !== 1 || psy !== 1) transforms.push(`scale(${psx},${psy})`);
        if (s.rotation) transforms.push(`rotate(${s.rotation})`);
        const transformAttr = transforms.length ? ` transform="${transforms.join(' ')}"` : '';
        const capAttr = pd.lineCap ? ` stroke-linecap="${pd.lineCap}"` : '';
        const joinAttr = pd.lineJoin ? ` stroke-linejoin="${pd.lineJoin}"` : '';
        const dashAttr = pd.dash ? ` stroke-dasharray="${pd.dash.join(' ')}"` : '';
        return `<path d="${pd.d}" fill="${f}" stroke="${st}" stroke-width="${sw}"${opacityAttr}${transformAttr}${capAttr}${joinAttr}${dashAttr}/>`;
      }
      return "";
    }).join("\n  ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${els}\n</svg>`;
    onSave(spriteName, `data:image/svg+xml;base64,${btoa(svg)}`);
  };

  const tools: { id: Tool; icon: Parameters<typeof Icon>[0]["name"]; label: string }[] = [
    { id: "select", icon: "cursor", label: t('spriteEditor.select') },
    { id: "fill", icon: "bucket", label: t('spriteEditor.fill') },
    { id: "rect", icon: "square", label: t('spriteEditor.rectangle') },
    { id: "ellipse", icon: "circle", label: t('spriteEditor.ellipse') },
    { id: "line", icon: "line", label: t('spriteEditor.line') },
    { id: "freehand", icon: "pencil", label: t('spriteEditor.pen') },
    { id: "polygon", icon: "polygon", label: t('spriteEditor.polygon') },
    { id: "text", icon: "text", label: t('spriteEditor.text') },
    { id: "editpath", icon: "nodes", label: t('spriteEditor.editPath') },
  ];

  const TOOL_HINTS: Record<Tool, string> = {
    select: t('spriteEditor.hintSelect'),
    fill: t('spriteEditor.hintFill'),
    rect: t('spriteEditor.hintRect'),
    ellipse: t('spriteEditor.hintEllipse'),
    line: t('spriteEditor.hintLine'),
    freehand: t('spriteEditor.freehandHint'),
    polygon: t('spriteEditor.polygonHint'),
    text: t('spriteEditor.hintText'),
    editpath: t('spriteEditor.hintEditpath'),
  };

  const onFillPick = (c: string) => {
    setFill(c);
    if (selectedIds.length > 0) commit(shapes.map(s => selectedIds.includes(s.id) ? { ...s, fill: c } : s));
    setShowFillPicker(false);
  };

  const onStrokePick = (c: string) => {
    setStroke(c);
    if (selectedIds.length > 0) commit(shapes.map(s => selectedIds.includes(s.id) ? { ...s, stroke: c } : s));
    setShowStrokePicker(false);
  };

  if (!open) return null;

  const centerColor = "rgba(0,0,0,0.4)";

  const selectedIdx = selectedId ? shapes.findIndex(s => s.id === selectedId) : -1;

  const handleTextCommit = () => {
    if (textPrompt && textInput.trim()) {
      commit([...shapes, { ...textPrompt.base, kind: 'text', x: textPrompt.x, y: textPrompt.y, text: textInput.trim(), fontSize: 10 }]);
    }
    setTextPrompt(null);
  };

  return (
    <>
    {textPrompt && (
      <ThemedDialog title={t('spriteEditor.enterText')} onClose={() => setTextPrompt(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            autoFocus
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleTextCommit(); else if (e.key === 'Escape') setTextPrompt(null); }}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: theme.surface, border: `1px solid ${theme.panelBorder}`,
              borderRadius: 6, padding: '8px 10px',
              color: theme.panelTxt, fontSize: 13, fontFamily: theme.fontUI, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setTextPrompt(null)} style={{ all: 'unset', cursor: 'pointer', padding: '7px 14px', borderRadius: 6, background: theme.railActiveBg, color: theme.panelTxt, fontSize: 13 }}>
              {t('teacher.cancel')}
            </button>
            <button type="button" onClick={handleTextCommit} style={{ all: 'unset', cursor: 'pointer', padding: '7px 16px', borderRadius: 6, background: theme.runBg, color: theme.runTxt, fontSize: 13, fontWeight: 600 }}>
              OK
            </button>
          </div>
        </div>
      </ThemedDialog>
    )}
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)",
    }}
    onClick={() => { setShowFillPicker(false); setShowStrokePicker(false); }}
    >
      <div data-testid="sprite-editor-modal" onClick={e => e.stopPropagation()}
        style={{
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 8,
          boxShadow: theme.shadowWindow,
          width: 960, maxWidth: "calc(100vw - 24px)",
          height: 780, maxHeight: "calc(100vh - 24px)",
          display: "flex", flexDirection: "column",
          fontFamily: theme.fontUI, color: theme.panelTxt,
        }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          padding: "8px 12px", borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.panelTxt, whiteSpace: "nowrap" }}>{t('spriteEditor.title')}</span>
          <div style={{ width: 1, height: 20, background: theme.panelBorder, margin: "0 2px" }} />

          {/* Fill */}
          <div style={{ position: "relative" }}>
            <button type="button" data-testid="fill-color-button"
              onClick={e => { e.stopPropagation(); setShowFillPicker(v => !v); setShowStrokePicker(false); }}
              style={{
                all: "unset", cursor: "pointer", height: 26, padding: "0 8px",
                display: "inline-flex", alignItems: "center", gap: 5,
                border: `1px solid ${theme.panelBorder}`, borderRadius: 4,
                fontSize: 11, fontWeight: 500, color: theme.panelTxt,
                textTransform: "uppercase", letterSpacing: 0.4,
              }}>
              <span>{t('spriteEditor.fill')}</span>
              <span style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                background: isTransparent(fill) ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 6px 6px" : fill,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)" }} />
            </button>
            <ColorPopover open={showFillPicker} value={fill} onPick={onFillPick} testId="fill-color-popover" theme={theme}
            opacity={opacity} onOpacityChange={o => {
              setOpacity(o);
              if (selectedIds.length > 0) commit(shapes.map(s => selectedIds.includes(s.id) ? { ...s, opacity: o } : s));
            }} />
          </div>

          {/* Stroke */}
          <div style={{ position: "relative" }}>
            <button type="button" data-testid="stroke-color-button"
              onClick={e => { e.stopPropagation(); setShowStrokePicker(v => !v); setShowFillPicker(false); }}
              style={{
                all: "unset", cursor: "pointer", height: 26, padding: "0 8px",
                display: "inline-flex", alignItems: "center", gap: 5,
                border: `1px solid ${theme.panelBorder}`, borderRadius: 4,
                fontSize: 11, fontWeight: 500, color: theme.panelTxt,
                textTransform: "uppercase", letterSpacing: 0.4,
              }}>
              <span>{t('spriteEditor.stroke')}</span>
              <span style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                background: isTransparent(stroke) ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 6px 6px" : stroke,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)" }} />
            </button>
            <ColorPopover open={showStrokePicker} value={stroke} onPick={onStrokePick} anchor="bottom-right" testId="stroke-color-popover" theme={theme} />
          </div>

          <div style={{ width: 1, height: 20, background: theme.panelBorder, margin: "0 2px" }} />
          <Stepper label="W" value={strokeWidth} min={0} max={20} step={0.5}
            testId="stroke-width-stepper" theme={theme}
            format={v => v % 1 === 0 ? String(v) : v.toFixed(1)}
            onChange={v => {
              setStrokeWidth(v);
              if (selectedIds.length > 0) commit(shapes.map(s => selectedIds.includes(s.id) ? { ...s, strokeWidth: v } : s));
            }} />
          <div style={{ width: 1, height: 20, background: theme.panelBorder, margin: "0 2px" }} />
          <Stepper label={t('spriteEditor.scale')} value={scale} min={1} max={10} onChange={setScale} format={v => `${v}×`} theme={theme} />

          <div style={{ flex: 1 }} />

          {/* Name */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "0 8px", height: 26,
            background: theme.surfacePanel, borderRadius: 4,
            border: `1px solid ${theme.panelBorder}`,
          }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>{t('spriteEditor.name')}</span>
            <input data-testid="sprite-name-input" value={spriteName} onChange={e => setSpriteName(e.target.value)}
              style={{ all: "unset", width: 90, fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxt }} />
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>.svg</span>
          </div>

          <button type="button" data-testid="save-svg-button" onClick={saveSVG}
            style={{
              all: "unset", cursor: "pointer", padding: "4px 10px",
              background: theme.runBg, color: theme.runTxt, borderRadius: 4,
              fontFamily: theme.fontUI, fontWeight: 600, fontSize: 12,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
            <Icon name="check" size={12} color="currentColor" />
            {t('spriteEditor.save')}
          </button>

          <button type="button" data-testid="close-button" onClick={onClose}
            style={{
              all: "unset", cursor: "pointer", width: 26, height: 26, borderRadius: 4,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: theme.panelTxtMute,
            }}>
            <Icon name="close" size={14} color="currentColor" />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Tool sidebar */}
          <div style={{
            width: 44, flexShrink: 0,
            padding: "8px 4px",
            background: theme.chip,
            borderRight: `1px solid ${theme.panelBorder}`,
            display: "flex", flexDirection: "column", gap: 1, alignItems: "center",
          }}>
            {tools.map(tt => (
              <button key={tt.id} type="button" title={tt.label}
                data-testid={`tool-${tt.id}`}
                onClick={() => { setTool(tt.id); setSelectedIds([]); }}
                style={{
                  all: "unset", cursor: "pointer", width: 34, height: 34, borderRadius: 5,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: tool === tt.id ? theme.accent : "transparent",
                  color: tool === tt.id ? "#fff" : theme.panelTxt,
                  transition: "background 0.1s",
                }}>
                <Icon name={tt.icon} size={17} color="currentColor" />
              </button>
            ))}

            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            <button type="button" data-testid="undo-button" title={t('spriteEditor.undo')} onClick={undo} disabled={history.length === 0}
              style={{ all: "unset", cursor: history.length ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: theme.panelTxt, opacity: history.length ? 1 : 0.3 }}>
              <Icon name="undo" size={16} color="currentColor" />
            </button>
            <button type="button" data-testid="redo-button" title={t('spriteEditor.redo')} onClick={redo} disabled={future.length === 0}
              style={{ all: "unset", cursor: future.length ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: theme.panelTxt, opacity: future.length ? 1 : 0.3 }}>
              <Icon name="redo" size={16} color="currentColor" />
            </button>

            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            {/* Move up / Move down — change z-order */}
            <button type="button" title={t('spriteEditor.bringForward')} onClick={moveUp} disabled={!selectedId || selectedIdx >= shapes.length - 1}
              style={{ all: "unset", cursor: selectedId && selectedIdx < shapes.length - 1 ? "pointer" : "default",
                width: 34, height: 28, borderRadius: "5px 5px 0 0",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${theme.panelBorder}`, borderBottom: "none",
                color: theme.panelTxt, fontSize: 14,
                opacity: selectedId && selectedIdx < shapes.length - 1 ? 1 : 0.3 }}>
              ↑
            </button>
            <button type="button" title={t('spriteEditor.sendBackward')} onClick={moveDown} disabled={!selectedId || selectedIdx <= 0}
              style={{ all: "unset", cursor: selectedId && selectedIdx > 0 ? "pointer" : "default",
                width: 34, height: 28, borderRadius: "0 0 5px 5px",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${theme.panelBorder}`,
                color: theme.panelTxt, fontSize: 14,
                opacity: selectedId && selectedIdx > 0 ? 1 : 0.3 }}>
              ↓
            </button>

            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            <button type="button" data-testid="delete-button" title={t('spriteEditor.deleteSelected')} onClick={deleteSelected} disabled={selectedIds.length === 0}
              style={{ all: "unset", cursor: selectedIds.length > 0 ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: selectedIds.length > 0 ? "rgba(196,69,28,0.15)" : "transparent",
                color: theme.stopBg, opacity: selectedIds.length > 0 ? 1 : 0.3 }}>
              <Icon name="trash" size={16} color="currentColor" />
            </button>
          </div>

          {/* Canvas area */}
          <div data-testid="sprite-editor-content" style={{
            flex: 1, overflow: "auto",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}>
            <div style={{
              width: W, height: H,
              position: "relative",
              boxShadow: `0 0 0 1px ${theme.panelBorder}, 0 24px 50px -22px rgba(0,0,0,0.30)`,
              borderRadius: 3,
              cursor: tool === "select" || tool === "editpath" ? "default" : tool === "fill" ? "cell" : "crosshair",
            }}>
              {/* checkerboard background — visual only, Transformer handles may overflow into PAD area */}
              <div style={{
                position: "absolute", inset: 0, borderRadius: 3, pointerEvents: "none", zIndex: 0,
                background: "repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 0 0 / 8px 8px",
              }} />
              <Stage ref={stageRef} data-testid="sprite-canvas" width={W + 2 * PAD} height={H + 2 * PAD}
                style={{ position: "absolute", top: -PAD, left: -PAD, zIndex: 1 }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onDblClick={onDoubleClick}
                onKeyDown={(e: KonvaEventObject<KeyboardEvent>) => {
                  if (tool === "polygon" && draft) {
                    if (e.evt.key === "Enter" || e.evt.key === " ") { e.evt.preventDefault(); closePolygon(); }
                    else if (e.evt.key === "Escape") { e.evt.preventDefault(); cancelPolygon(); }
                  }
                }}
                tabIndex={0}>
                <Layer ref={layerRef} x={PAD} y={PAD}>
                  {renderGrid()}
                  {shapes.map(s => renderShape(s))}
                  {draft && renderShape(draft, true)}
                  {renderVertexHandles()}
                  <Transformer ref={trRef}
                    rotateEnabled={canRotate}
                    onTransformEnd={bakePendingTransform}
                    onDragEnd={bakePendingTransform}
                  />
                  {selRect && (
                    <KRect
                      x={Math.min(selRect.x1, selRect.x2)} y={Math.min(selRect.y1, selRect.y2)}
                      width={Math.abs(selRect.x2 - selRect.x1)} height={Math.abs(selRect.y2 - selRect.y1)}
                      fill="rgba(60,120,255,0.07)" stroke="rgba(60,120,255,0.65)"
                      strokeWidth={1} dash={[4, 3]} listening={false}
                    />
                  )}
                  {/* Canvas center marker */}
                  <KLine points={[W / 2 - 8, H / 2, W / 2 + 8, H / 2]} stroke={centerColor} strokeWidth={1} listening={false} />
                  <KLine points={[W / 2, H / 2 - 8, W / 2, H / 2 + 8]} stroke={centerColor} strokeWidth={1} listening={false} />
                  <KCircle x={W / 2} y={H / 2} radius={3} stroke={centerColor} strokeWidth={1} fill="transparent" listening={false} />
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        {/* ── Footer — fixed height so grid controls don't cause layout shift ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          height: 38, padding: "0 18px",
          background: theme.chip, borderTop: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute, fontStyle: "italic" }}>
            {TOOL_HINTS[tool]}
          </span>
          <div style={{ flex: 1 }} />
          {/* Grid toggle */}
          <button type="button" onClick={() => setGridOn(v => !v)}
            style={{
              all: "unset", cursor: "pointer",
              padding: "2px 8px", borderRadius: 4,
              fontSize: 11, fontWeight: 500, letterSpacing: 0.4, textTransform: "uppercase",
              border: `1px solid ${gridOn ? theme.accent : theme.panelBorder}`,
              background: gridOn ? (theme.accent + "28") : "transparent",
              color: gridOn ? theme.accent : theme.panelTxtMute,
            }}>
            {t('spriteEditor.grid')}
          </button>
          {/* Grid size — always rendered, dimmed when grid is off for stable height */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: gridOn ? 1 : 0.3, pointerEvents: gridOn ? "auto" : "none" }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>{t('spriteEditor.gridSize')}</span>
            <div style={{ display: "inline-flex", alignItems: "center" }}>
              {(["−", "+"] as const).map((sym, si) => (
                <button key={sym} type="button"
                  onClick={() => setGridSize(si === 0 ? prevPow2(gridSize) : nextPow2(gridSize))}
                  style={{
                    all: "unset", cursor: "pointer", width: 14, height: 20,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: theme.panelTxt, fontSize: 14,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: si === 0 ? "3px 0 0 3px" : "0 3px 3px 0",
                    ...(si === 1 ? {} : {}),
                  }}>
                  {sym}
                </button>
              ))}
            </div>
            <span style={{
              fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxt, minWidth: 22, textAlign: "center",
              border: `1px solid ${theme.panelBorder}`, borderLeft: "none", borderRight: "none",
              height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{gridSize}</span>
          </div>
          <div style={{ width: 1, height: 16, background: theme.panelBorder }} />
          <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute }}>
            x: <span style={{ color: theme.panelTxt }}>{Math.max(0, Math.round(mousePos.x / SCALE))}</span>
          </span>
          <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute }}>
            y: <span style={{ color: theme.panelTxt }}>{Math.max(0, Math.round(mousePos.y / SCALE))}</span>
          </span>
        </div>
      </div>
    </div>
    </>
  );
}
