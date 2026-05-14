import { useRef, useState, useEffect, useCallback, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  Stage, Layer,
  Rect as KRect, Ellipse as KEllipse, Line as KLine,
  Text as KText, Transformer, Circle as KCircle,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { useThemeStore, type Theme } from "./state/useTheme";
import { Icon } from "./components/Icons";

// ── Types ──────────────────────────────────
type ShapeBase = { id: string; fill: string; stroke: string; strokeWidth: number; rotation: number };
type RectData = ShapeBase & { kind: "rect"; x: number; y: number; width: number; height: number };
type EllipseData = ShapeBase & { kind: "ellipse"; x: number; y: number; radiusX: number; radiusY: number };
type LineData = ShapeBase & { kind: "line"; points: number[] };
type FreehandData = ShapeBase & { kind: "freehand"; points: number[]; closed: boolean };
type PolygonData = ShapeBase & { kind: "polygon"; points: number[]; closed: boolean };
type TextData = ShapeBase & { kind: "text"; x: number; y: number; text: string; fontSize: number };
type ShapeData = RectData | EllipseData | LineData | FreehandData | PolygonData | TextData;
type Tool = "select" | "rect" | "ellipse" | "line" | "freehand" | "polygon" | "text" | "editpath";

let _uid = 0;
const uid = () => `s${++_uid}`;

// Grid size constrained to powers of 2
const POW2 = [1, 2, 4, 8, 16, 32];
const prevPow2 = (v: number) => POW2[Math.max(0, POW2.indexOf(v) - 1)] ?? 1;
const nextPow2 = (v: number) => POW2[Math.min(POW2.length - 1, POW2.indexOf(v) + 1)] ?? 32;

const COLORS: { name: string; hex: string }[] = [
  { name: "red", hex: "#ff0000" }, { name: "green", hex: "#00ff00" }, { name: "blue", hex: "#0000ff" },
  { name: "yellow", hex: "#ffff00" }, { name: "cyan", hex: "#00ffff" }, { name: "magenta", hex: "#ff00ff" },
  { name: "white", hex: "#ffffff" }, { name: "black", hex: "#000000" }, { name: "gray", hex: "#808080" },
  { name: "orange", hex: "#ffa500" }, { name: "purple", hex: "#800080" }, { name: "pink", hex: "#ffc0cb" },
  { name: "brown", hex: "#8b4513" }, { name: "lime", hex: "#00ff00" }, { name: "navy", hex: "#000080" },
  { name: "teal", hex: "#008080" }, { name: "olive", hex: "#808000" }, { name: "maroon", hex: "#800000" },
  { name: "silver", hex: "#c0c0c0" }, { name: "aqua", hex: "#00ffff" }, { name: "fuchsia", hex: "#ff00ff" },
  { name: "grey", hex: "#808080" },
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

function ColorPopover({ open: popOpen, value, onPick, anchor = "bottom-left", testId, theme }: {
  open: boolean; value: string; onPick: (c: string) => void; anchor?: string; testId?: string; theme: Theme;
}) {
  if (!popOpen) return null;
  const pos = anchor === "bottom-right" ? { top: "100%", right: 0 } : { top: "100%", left: 0 };
  return (
    <div data-testid={testId} style={{
      position: "absolute", ...pos, marginTop: 6,
      background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
      borderRadius: theme.radiusCard, boxShadow: "0 10px 32px -10px rgba(0,0,0,0.30)",
      padding: 10, width: 224, zIndex: 30,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        {COLORS.map(c => <Swatch key={`${c.name}-${c.hex}`} color={c.hex} name={c.name} active={c.hex === value} onClick={() => onPick(c.hex)} theme={theme} />)}
      </div>
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
  const SNAP_THR = 6;
  const CENTER = size / 2;

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const vertexPreDragShapes = useRef<ShapeData[]>([]);

  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [history, setHistory] = useState<ShapeData[][]>([]);
  const [future, setFuture] = useState<ShapeData[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [fill, setFill] = useState("#4ade80");
  const [stroke, setStroke] = useState("#1e293b");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [draft, setDraft] = useState<ShapeData | null>(null);

  const draftRef = useRef<ShapeData | null>(null);
  const shapesRef = useRef<ShapeData[]>([]);
  const fillRef = useRef(fill);
  draftRef.current = draft;
  shapesRef.current = shapes;
  fillRef.current = fill;

  const [isDrawing, setIsDrawing] = useState(false);
  const [spriteName, setSpriteName] = useState(initialName || "sprite");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [polygonVertices, setPolygonVertices] = useState<Array<{ x: number; y: number }>>([]);
  const [freehandStartPoint, setFreehandStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [gridOn, setGridOn] = useState(false);
  const [gridSize, setGridSize] = useState(8);
  const [dragCenter, setDragCenter] = useState<{ x: number; y: number } | null>(null);

  const dragNearCenter = dragCenter !== null
    && Math.abs(dragCenter.x - CENTER) < SNAP_THR
    && Math.abs(dragCenter.y - CENTER) < SNAP_THR;

  const selectedShape = shapes.find(s => s.id === selectedId) ?? null;
  // Only position-based shapes support rotation via the transformer
  const canRotate = selectedShape !== null && !("points" in selectedShape);

  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedId && tool === "select") {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) { trRef.current.nodes([node]); trRef.current.getLayer()?.batchDraw(); }
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, shapes, tool]);

  const commit = useCallback((next: ShapeData[]) => {
    setHistory((h) => [...h, shapes]);
    setFuture([]);
    setShapes(next);
  }, [shapes]);

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
    setFuture((f) => [shapes, ...f]);
    setShapes(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
    setSelectedId(null);
  };

  const redo = () => {
    if (!future.length) return;
    setHistory((h) => [...h, shapes]);
    setShapes(future[0]!);
    setFuture((f) => f.slice(1));
    setSelectedId(null);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commit(shapes.filter((s) => s.id !== selectedId));
    setSelectedId(null);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (tool === "polygon" && draft) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); closePolygon(); }
        else if (e.key === "Escape") { e.preventDefault(); cancelPolygon(); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, tool, draft, closePolygon, cancelPolygon]);

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
      const parsed: ShapeData[] = [];
      let n = 0;
      svg.querySelectorAll('rect').forEach((el) => {
        parsed.push({ id: `s${++n}`, kind: 'rect', rotation: 0,
          x: parseFloat(el.getAttribute('x') || '0'), y: parseFloat(el.getAttribute('y') || '0'),
          width: parseFloat(el.getAttribute('width') || '0'), height: parseFloat(el.getAttribute('height') || '0'),
          fill: el.getAttribute('fill') || 'transparent', stroke: el.getAttribute('stroke') || '#000000',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '1'),
        });
      });
      svg.querySelectorAll('ellipse').forEach((el) => {
        parsed.push({ id: `s${++n}`, kind: 'ellipse', rotation: 0,
          x: parseFloat(el.getAttribute('cx') || '0'), y: parseFloat(el.getAttribute('cy') || '0'),
          radiusX: parseFloat(el.getAttribute('rx') || '0'), radiusY: parseFloat(el.getAttribute('ry') || '0'),
          fill: el.getAttribute('fill') || 'transparent', stroke: el.getAttribute('stroke') || '#000000',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '1'),
        });
      });
      svg.querySelectorAll('polygon').forEach((el) => {
        const pts: number[] = [];
        (el.getAttribute('points') || '').trim().split(/[\s,]+/).forEach((v) => { const f = parseFloat(v); if (!isNaN(f)) pts.push(f); });
        if (pts.length >= 6) parsed.push({ id: `s${++n}`, kind: 'polygon', points: pts, closed: true, rotation: 0,
          fill: el.getAttribute('fill') || 'transparent', stroke: el.getAttribute('stroke') || '#000000',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || '1'),
        });
      });
      if (parsed.length > 0) { setFill(parsed[0].fill); setStroke(parsed[0].stroke); setStrokeWidth(parsed[0].strokeWidth); }
      setShapes(parsed); setHistory([]); setFuture([]);
    } catch (e) { console.error('Failed to parse SVG:', e); setShapes([]); setHistory([]); setFuture([]); }
  }, []);

  useEffect(() => {
    if (initialDataUrl && open) setTimeout(() => loadImageToShapes(initialDataUrl), 0);
  }, [initialDataUrl, open, loadImageToShapes]);

  const snapGrid = (v: number) => gridOn ? Math.round(v / gridSize) * gridSize : v;

  const getPos = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()!.getPointerPosition()!;
    return { x: snapGrid(pos.x / SCALE), y: snapGrid(pos.y / SCALE) };
  };

  // Returns bounding-box center of a point-based shape, offset by dx/dy (drag delta in sprite coords)
  const pointsCenter = (pts: number[], dx = 0, dy = 0) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] < minX) minX = pts[i]; if (pts[i] > maxX) maxX = pts[i];
      if (pts[i + 1] < minY) minY = pts[i + 1]; if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
    return { x: (minX + maxX) / 2 + dx, y: (minY + maxY) / 2 + dy };
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (tool === "select" || tool === "editpath") {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    const { x, y } = getPos(e);
    const base: ShapeBase = { id: uid(), fill, stroke, strokeWidth, rotation: 0 };
    if (tool === "text") {
      const text = window.prompt(t('spriteEditor.enterText')) ?? "";
      if (text) commit([...shapes, { ...base, kind: "text", x, y, text, fontSize: 10 }]);
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
    if (!isDrawing || !draft) return;
    if (draft.kind === "rect") { const d = draft as RectData; setDraft({ ...d, width: Math.abs(x - d.x), height: Math.abs(y - d.y) }); }
    else if (draft.kind === "ellipse") { const d = draft as EllipseData; setDraft({ ...d, radiusX: Math.abs(x - d.x), radiusY: Math.abs(y - d.y) }); }
    else if (draft.kind === "line") { const pts = [...(draft as LineData).points]; pts[2] = x; pts[3] = y; setDraft({ ...draft, points: pts } as LineData); }
    else if (draft.kind === "freehand") { setDraft({ ...draft, points: [...(draft as FreehandData).points, x, y] } as FreehandData); }
  };

  const onMouseUp = () => {
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
    const draggable = tool === "select" && !isDraft;
    const shapeKey = isDraft ? "draft" : s.id;

    const onDragMove = draggable ? (e: KonvaEventObject<MouseEvent>) => {
      const node = e.target;
      let c: { x: number; y: number };
      if (s.kind === "rect") {
        // node.x/y is the center (we set offsetX/offsetY to half-size)
        c = { x: node.x() / SCALE, y: node.y() / SCALE };
      } else if (s.kind === "ellipse" || s.kind === "text") {
        c = { x: node.x() / SCALE, y: node.y() / SCALE };
      } else {
        c = pointsCenter((s as LineData).points, node.x() / SCALE, node.y() / SCALE);
      }
      setDragCenter(c);
    } : undefined;

    const onDragEnd = draggable ? (e: KonvaEventObject<MouseEvent>) => {
      const node = e.target;
      setDragCenter(null);
      if (s.kind === "line" || s.kind === "freehand" || s.kind === "polygon") {
        const dx = node.x() / SCALE, dy = node.y() / SCALE;
        let pts = (s as LineData).points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
        const bc = pointsCenter(pts);
        if (Math.abs(bc.x - CENTER) < SNAP_THR && Math.abs(bc.y - CENTER) < SNAP_THR) {
          const sdx = CENTER - bc.x, sdy = CENTER - bc.y;
          pts = pts.map((p, i) => i % 2 === 0 ? p + sdx : p + sdy);
        }
        node.position({ x: 0, y: 0 });
        commit(shapes.map(sh => sh.id === s.id ? { ...sh, points: pts } as ShapeData : sh));
      } else if (s.kind === "rect") {
        // node.x/y is center because of offsetX/offsetY
        let cx = node.x() / SCALE, cy = node.y() / SCALE;
        if (Math.abs(cx - CENTER) < SNAP_THR && Math.abs(cy - CENTER) < SNAP_THR) {
          cx = CENTER; cy = CENTER;
        }
        const r = s as RectData;
        commit(shapes.map(sh => sh.id === s.id ? { ...sh, x: cx - r.width / 2, y: cy - r.height / 2 } as ShapeData : sh));
      } else {
        // ellipse/text: node.x/y is position
        let nx = node.x() / SCALE, ny = node.y() / SCALE;
        if (Math.abs(nx - CENTER) < SNAP_THR && Math.abs(ny - CENTER) < SNAP_THR) {
          nx = CENTER; ny = CENTER;
        }
        commit(shapes.map(sh => sh.id === s.id ? { ...sh, x: nx, y: ny } as ShapeData : sh));
      }
    } : undefined;

    const common = {
      id: isDraft ? undefined : s.id,
      listening: !isDraft,
      stroke: s.stroke,
      strokeWidth: s.strokeWidth * SCALE,
      rotation: s.rotation,
      draggable,
      onClick: selectable ? () => setSelectedId(s.id) : undefined,
      onDragMove,
      onDragEnd,
    };

    switch (s.kind) {
      case "rect": {
        const r = s as RectData;
        const cx = r.x * SCALE + r.width * SCALE / 2;
        const cy = r.y * SCALE + r.height * SCALE / 2;
        return <KRect key={shapeKey} {...common} fill={s.fill}
          x={cx} y={cy}
          offsetX={r.width * SCALE / 2} offsetY={r.height * SCALE / 2}
          width={r.width * SCALE} height={r.height * SCALE} />;
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
          tension={fh ? 0.4 : 0} lineCap="round" lineJoin="round" closed={fh?.closed ?? false} />;
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
              stroke={stroke} strokeWidth={strokeWidth * SCALE} dash={[5, 5]} />
            {polygonVertices.map((v, i) => <KCircle key={`v${i}`} listening={false}
              x={v.x * SCALE} y={v.y * SCALE} radius={4} fill="#22d3ee" stroke="#000" strokeWidth={1} />)}
          </>);
        }
        if (p.points.length < 6) return null;
        return <KLine key={shapeKey} {...common}
          points={p.points.map(pt => pt * SCALE)} closed={p.closed}
          tension={0} lineCap="round" lineJoin="round" fill={p.closed ? s.fill : "transparent"} />;
      }
      case "text": {
        const td = s as TextData;
        return <KText key={shapeKey} {...common} fill={s.fill}
          x={td.x * SCALE} y={td.y * SCALE} text={td.text} fontSize={td.fontSize * SCALE} />;
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
    const els = shapes.map(s => {
      const f = s.fill, st = s.stroke, sw = s.strokeWidth;
      if (s.kind === "rect") {
        const r = s as RectData;
        return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${f}" stroke="${st}" stroke-width="${sw}"${rotAttr(s, r.x + r.width / 2, r.y + r.height / 2)}/>`;
      }
      if (s.kind === "ellipse") {
        const el = s as EllipseData;
        return `<ellipse cx="${el.x}" cy="${el.y}" rx="${el.radiusX}" ry="${el.radiusY}" fill="${f}" stroke="${st}" stroke-width="${sw}"${rotAttr(s, el.x, el.y)}/>`;
      }
      if (s.kind === "line" || s.kind === "freehand") {
        const pts = (s as LineData).points;
        const fh = s.kind === "freehand" ? (s as FreehandData) : null;
        const d = pts.reduce((acc, p, i) => i === 0 ? `M ${p}` : i === 1 ? `${acc} ${p}` : i % 2 === 0 ? `${acc} L ${p}` : `${acc} ${p}`, "");
        const fillAttr = fh?.closed ? `fill="${f}"` : 'fill="none"';
        return `<path d="${d}${fh?.closed ? " Z" : ""}" ${fillAttr} stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      if (s.kind === "polygon") {
        const p = s as PolygonData; if (p.points.length < 6) return "";
        const pts: string[] = [];
        for (let i = 0; i < p.points.length; i += 2) pts.push(`${p.points[i]},${p.points[i + 1]}`);
        return `<polygon points="${pts.join(" ")}" fill="${f}" stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      if (s.kind === "text") {
        const td = s as TextData;
        return `<text x="${td.x}" y="${td.y + td.fontSize}" font-size="${td.fontSize}" fill="${f}"${rotAttr(s, td.x, td.y)}>${td.text}</text>`;
      }
      return "";
    }).join("\n  ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${els}\n</svg>`;
    onSave(spriteName, `data:image/svg+xml;base64,${btoa(svg)}`);
  };

  const tools: { id: Tool; icon: Parameters<typeof Icon>[0]["name"]; label: string }[] = [
    { id: "select", icon: "cursor", label: "Select" },
    { id: "rect", icon: "square", label: "Rectangle" },
    { id: "ellipse", icon: "circle", label: "Ellipse" },
    { id: "line", icon: "line", label: "Line" },
    { id: "freehand", icon: "pencil", label: "Pen" },
    { id: "polygon", icon: "polygon", label: "Polygon" },
    { id: "text", icon: "text", label: "Text" },
    { id: "editpath", icon: "nodes", label: "Edit Path" },
  ];

  const TOOL_HINTS: Record<Tool, string> = {
    select: "Click to select · Drag to move · Delete to remove",
    rect: "Click and drag to draw a rectangle",
    ellipse: "Click and drag to draw an ellipse",
    line: "Click to start, drag to extend · Double-click to finish",
    freehand: "Drag to draw · Release near the start point to close and fill",
    polygon: "Click to add vertices · Double-click or Enter to close · Esc to cancel",
    text: "Click on the canvas to place text",
    editpath: "Click a path or polygon to select · Drag the handles to move vertices",
  };

  const onFillPick = (c: string) => {
    setFill(c);
    if (selectedId) commit(shapes.map(s => s.id === selectedId ? { ...s, fill: c } : s));
    setShowFillPicker(false);
  };

  const onStrokePick = (c: string) => {
    setStroke(c);
    if (selectedId) commit(shapes.map(s => s.id === selectedId ? { ...s, stroke: c } : s));
    setShowStrokePicker(false);
  };

  if (!open) return null;

  const centerColor = dragNearCenter ? "#22d3ee" : "rgba(0,0,0,0.4)";
  const dragColor = dragNearCenter ? "#22d3ee" : "rgba(80,100,220,0.65)";

  const selectedIdx = selectedId ? shapes.findIndex(s => s.id === selectedId) : -1;

  return (
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
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.panelTxt, whiteSpace: "nowrap" }}>Sprite Editor</span>
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
              <span>Fill</span>
              <span style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                background: isTransparent(fill) ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 6px 6px" : fill,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)" }} />
            </button>
            <ColorPopover open={showFillPicker} value={fill} onPick={onFillPick} testId="fill-color-popover" theme={theme} />
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
              <span>Stroke</span>
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
              if (selectedId) commit(shapes.map(s => s.id === selectedId ? { ...s, strokeWidth: v } : s));
            }} />
          <div style={{ width: 1, height: 20, background: theme.panelBorder, margin: "0 2px" }} />
          <Stepper label="Scale" value={scale} min={1} max={10} onChange={setScale} format={v => `${v}×`} theme={theme} />

          <div style={{ flex: 1 }} />

          {/* Name */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "0 8px", height: 26,
            background: theme.surfacePanel, borderRadius: 4,
            border: `1px solid ${theme.panelBorder}`,
          }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>name</span>
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
            Save
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
                onClick={() => { setTool(tt.id); setSelectedId(null); }}
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
            <button type="button" data-testid="undo-button" title="Undo" onClick={undo} disabled={history.length === 0}
              style={{ all: "unset", cursor: history.length ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: theme.panelTxt, opacity: history.length ? 1 : 0.3 }}>
              <Icon name="undo" size={16} color="currentColor" />
            </button>
            <button type="button" data-testid="redo-button" title="Redo" onClick={redo} disabled={future.length === 0}
              style={{ all: "unset", cursor: future.length ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: theme.panelTxt, opacity: future.length ? 1 : 0.3 }}>
              <Icon name="redo" size={16} color="currentColor" />
            </button>

            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            {/* Move up / Move down — change z-order */}
            <button type="button" title="Bring forward" onClick={moveUp} disabled={!selectedId || selectedIdx >= shapes.length - 1}
              style={{ all: "unset", cursor: selectedId && selectedIdx < shapes.length - 1 ? "pointer" : "default",
                width: 34, height: 28, borderRadius: "5px 5px 0 0",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${theme.panelBorder}`, borderBottom: "none",
                color: theme.panelTxt, fontSize: 14,
                opacity: selectedId && selectedIdx < shapes.length - 1 ? 1 : 0.3 }}>
              ↑
            </button>
            <button type="button" title="Send backward" onClick={moveDown} disabled={!selectedId || selectedIdx <= 0}
              style={{ all: "unset", cursor: selectedId && selectedIdx > 0 ? "pointer" : "default",
                width: 34, height: 28, borderRadius: "0 0 5px 5px",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${theme.panelBorder}`,
                color: theme.panelTxt, fontSize: 14,
                opacity: selectedId && selectedIdx > 0 ? 1 : 0.3 }}>
              ↓
            </button>

            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            <button type="button" data-testid="delete-button" title="Delete selected" onClick={deleteSelected} disabled={!selectedId}
              style={{ all: "unset", cursor: selectedId ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: selectedId ? "rgba(196,69,28,0.15)" : "transparent",
                color: theme.stopBg, opacity: selectedId ? 1 : 0.3 }}>
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
              background: "repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 0 0 / 8px 8px",
              borderRadius: 3,
              boxShadow: `0 0 0 1px ${theme.panelBorder}, 0 24px 50px -22px rgba(0,0,0,0.30)`,
              overflow: "hidden",
              cursor: tool === "select" || tool === "editpath" ? "default" : "crosshair",
            }}>
              <Stage ref={stageRef} data-testid="sprite-canvas" width={W} height={H}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onDblClick={onDoubleClick}
                onKeyDown={(e: KonvaEventObject<KeyboardEvent>) => {
                  if (tool === "polygon" && draft) {
                    if (e.evt.key === "Enter" || e.evt.key === " ") { e.evt.preventDefault(); closePolygon(); }
                    else if (e.evt.key === "Escape") { e.evt.preventDefault(); cancelPolygon(); }
                  }
                }}
                tabIndex={0}>
                <Layer>
                  {renderGrid()}
                  {shapes.map(s => renderShape(s))}
                  {draft && renderShape(draft, true)}
                  {renderVertexHandles()}
                  <Transformer ref={trRef}
                    rotateEnabled={canRotate}
                    enabledAnchors={[]}
                    onTransformEnd={() => {
                      if (!selectedId || !stageRef.current || !selectedShape) return;
                      const node = stageRef.current.findOne(`#${selectedId}`);
                      if (!node) return;
                      const rot = node.rotation();
                      if (selectedShape.kind === "rect") {
                        const r = selectedShape as RectData;
                        commit(shapes.map(s => s.id === selectedId
                          ? { ...s, x: node.x() / SCALE - r.width / 2, y: node.y() / SCALE - r.height / 2, rotation: rot } as ShapeData : s));
                      } else {
                        commit(shapes.map(s => s.id === selectedId
                          ? { ...s, x: node.x() / SCALE, y: node.y() / SCALE, rotation: rot } as ShapeData : s));
                      }
                    }}
                  />
                  {/* Canvas center marker — lights up cyan when dragged shape is nearby */}
                  <KLine points={[W / 2 - 8, H / 2, W / 2 + 8, H / 2]} stroke={centerColor} strokeWidth={1} listening={false} />
                  <KLine points={[W / 2, H / 2 - 8, W / 2, H / 2 + 8]} stroke={centerColor} strokeWidth={1} listening={false} />
                  <KCircle x={W / 2} y={H / 2} radius={3} stroke={centerColor} strokeWidth={1} fill="transparent" listening={false} />
                  {/* Dragged shape's center — shown while dragging, lights up cyan when near canvas center */}
                  {dragCenter && <>
                    <KLine points={[dragCenter.x * SCALE - 6, dragCenter.y * SCALE, dragCenter.x * SCALE + 6, dragCenter.y * SCALE]}
                      stroke={dragColor} strokeWidth={1} dash={[3, 2]} listening={false} />
                    <KLine points={[dragCenter.x * SCALE, dragCenter.y * SCALE - 6, dragCenter.x * SCALE, dragCenter.y * SCALE + 6]}
                      stroke={dragColor} strokeWidth={1} dash={[3, 2]} listening={false} />
                    <KCircle x={dragCenter.x * SCALE} y={dragCenter.y * SCALE} radius={2.5}
                      stroke={dragColor} strokeWidth={1} fill="transparent" listening={false} />
                  </>}
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
            Grid
          </button>
          {/* Grid size — always rendered, dimmed when grid is off for stable height */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: gridOn ? 1 : 0.3, pointerEvents: gridOn ? "auto" : "none" }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>Size</span>
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
  );
}
