import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Stage,
  Layer,
  Rect as KRect,
  Ellipse as KEllipse,
  Line as KLine,
  Text as KText,
  Transformer,
  Circle as KCircle,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";

// ── Types ──────────────────────────────────
type ShapeBase = { id: string; fill: string; stroke: string; strokeWidth: number };
type RectData = ShapeBase & { kind: "rect"; x: number; y: number; width: number; height: number };
type EllipseData = ShapeBase & { kind: "ellipse"; x: number; y: number; radiusX: number; radiusY: number };
type LineData = ShapeBase & { kind: "line"; points: number[] };
type FreehandData = ShapeBase & { kind: "freehand"; points: number[]; closed: boolean };
type PolygonData = ShapeBase & { kind: "polygon"; points: number[]; closed: boolean };
type TextData = ShapeBase & { kind: "text"; x: number; y: number; text: string; fontSize: number };
type ShapeData = RectData | EllipseData | LineData | FreehandData | PolygonData | TextData;
type Tool = "select" | "rect" | "ellipse" | "line" | "freehand" | "polygon" | "text";

let _uid = 0;
const uid = () => `s${++_uid}`;

type SpriteEditorProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, dataUrl: string) => void;
  size?: 64 | 128;
  initialName?: string;
  initialDataUrl?: string;
};

export default function SpriteEditor({
  open,
  onClose,
  onSave,
  size = 64,
  initialName,
  initialDataUrl,
}: SpriteEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const SCALE = size === 64 ? 5 : 3;
  const W = size * SCALE;
  const H = size * SCALE;

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [history, setHistory] = useState<ShapeData[][]>([]);
  const [future, setFuture] = useState<ShapeData[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [fill, setFill] = useState("#4ade80");
  const [stroke, setStroke] = useState("#1e293b");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [draft, setDraft] = useState<ShapeData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [spriteName, setSpriteName] = useState(initialName || "sprite");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [polygonVertices, setPolygonVertices] = useState<Array<{ x: number; y: number }>>([]);
  const [freehandStartPoint, setFreehandStartPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer()?.batchDraw();
      }
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, shapes]);

  const commit = useCallback((next: ShapeData[]) => {
    setHistory((h) => [...h, shapes]);
    setFuture([]);
    setShapes(next);
  }, [shapes]);

  const cancelPolygon = useCallback(() => {
    if (tool === "polygon" && draft) {
      setIsDrawing(false);
      setDraft(null);
      setPolygonVertices([]);
    }
  }, [tool, draft]);

  const closePolygon = useCallback(() => {
    if (tool === "polygon" && draft) {
      const polyDraft = draft as PolygonData;
      if (polyDraft.points.length < 6) { cancelPolygon(); return; }
      const isTransparent = fill === "transparent" || fill === "#00000000";
      const closedPolygon: PolygonData = { ...polyDraft, closed: true, fill: isTransparent ? "transparent" : fill };
      setIsDrawing(false);
      commit([...shapes, closedPolygon]);
      setDraft(null);
      setPolygonVertices([]);
    }
  }, [tool, draft, fill, shapes, commit, cancelPolygon]);

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

  // Handle keyboard shortcuts
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
      const svgContent = atob(dataUrl.split(',')[1]);
      const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) { setShapes([]); setHistory([]); setFuture([]); return; }
      const parsedShapes: ShapeData[] = [];
      let shapeId = 0;
      svg.querySelectorAll('rect').forEach((rect) => {
        parsedShapes.push({ id: `s${++shapeId}`, kind: 'rect',
          x: parseFloat(rect.getAttribute('x') || '0'),
          y: parseFloat(rect.getAttribute('y') || '0'),
          width: parseFloat(rect.getAttribute('width') || '0'),
          height: parseFloat(rect.getAttribute('height') || '0'),
          fill: rect.getAttribute('fill') || 'transparent',
          stroke: rect.getAttribute('stroke') || '#000000',
          strokeWidth: parseFloat(rect.getAttribute('stroke-width') || '1'),
        });
      });
      svg.querySelectorAll('ellipse').forEach((ellipse) => {
        parsedShapes.push({ id: `s${++shapeId}`, kind: 'ellipse',
          x: parseFloat(ellipse.getAttribute('cx') || '0'),
          y: parseFloat(ellipse.getAttribute('cy') || '0'),
          radiusX: parseFloat(ellipse.getAttribute('rx') || '0'),
          radiusY: parseFloat(ellipse.getAttribute('ry') || '0'),
          fill: ellipse.getAttribute('fill') || 'transparent',
          stroke: ellipse.getAttribute('stroke') || '#000000',
          strokeWidth: parseFloat(ellipse.getAttribute('stroke-width') || '1'),
        });
      });
      svg.querySelectorAll('polygon').forEach((polygon) => {
        const points: number[] = [];
        (polygon.getAttribute('points') || '').trim().split(/[\s,]+/).forEach((n) => { const v = parseFloat(n); if (!isNaN(v)) points.push(v); });
        if (points.length >= 6) parsedShapes.push({ id: `s${++shapeId}`, kind: 'polygon', points, closed: true,
          fill: polygon.getAttribute('fill') || 'transparent', stroke: polygon.getAttribute('stroke') || '#000000',
          strokeWidth: parseFloat(polygon.getAttribute('stroke-width') || '1'),
        });
      });
      if (parsedShapes.length > 0) { setFill(parsedShapes[0].fill); setStroke(parsedShapes[0].stroke); setStrokeWidth(parsedShapes[0].strokeWidth); }
      setShapes(parsedShapes); setHistory([]); setFuture([]);
    } catch (e) { console.error('Failed to parse SVG:', e); setShapes([]); setHistory([]); setFuture([]); }
  }, []);

  useEffect(() => {
    if (initialDataUrl && open) { setTimeout(() => loadImageToShapes(initialDataUrl), 0); }
  }, [initialDataUrl, open, loadImageToShapes]);

  const getPos = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()!.getPointerPosition()!;
    return { x: pos.x / SCALE, y: pos.y / SCALE };
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (tool === "select") { if (e.target === e.target.getStage()) setSelectedId(null); return; }
    const { x, y } = getPos(e);
    const base: ShapeBase = { id: uid(), fill, stroke, strokeWidth };
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
      if (!draft) { setDraft({ ...base, kind: "polygon", points: [x, y], closed: false }); setPolygonVertices([{ x, y }]); }
      else { const pd = draft as PolygonData; setDraft({ ...pd, points: [...pd.points, x, y] }); setPolygonVertices([...polygonVertices, { x, y }]); }
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
      const isTransparent = fill === "transparent" || fill === "#00000000";
      setIsDrawing(false);
      commit([...shapes, { ...fd, closed: shouldClose, fill: shouldClose && !isTransparent ? fill : "transparent" }]);
      setDraft(null); setFreehandStartPoint(null);
      return;
    }
    setIsDrawing(false);
    commit([...shapes, draft]);
    setDraft(null);
  };

  const onDoubleClick = () => {
    if (tool === "polygon" && draft) closePolygon();
    else if (tool === "line" && draft) { setIsDrawing(false); commit([...shapes, draft]); setDraft(null); }
  };

  const renderShape = (s: ShapeData, isDraft = false): React.ReactNode => {
    const draggable = tool === "select" && !isDraft;
    const common = {
      key: isDraft ? "draft" : s.id,
      id: isDraft ? undefined : s.id,
      stroke: s.stroke,
      strokeWidth: s.strokeWidth * SCALE,
      draggable,
      onClick: tool === "select" && !isDraft ? () => setSelectedId(s.id) : undefined,
      onDragEnd: (e: KonvaEventObject<MouseEvent>) => {
        const node = e.target;
        if (s.kind === "line" || s.kind === "freehand" || s.kind === "polygon") {
          const dx = node.x() / SCALE; const dy = node.y() / SCALE;
          const pts = (s as LineData).points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy));
          node.position({ x: 0, y: 0 });
          commit(shapes.map((sh) => sh.id === s.id ? { ...sh, points: pts } as ShapeData : sh));
        } else {
          commit(shapes.map((sh) => sh.id === s.id ? { ...sh, x: node.x() / SCALE, y: node.y() / SCALE } as ShapeData : sh));
        }
      },
    };
    switch (s.kind) {
      case "rect": { const r = s as RectData; return <KRect {...common} fill={s.fill} x={r.x * SCALE} y={r.y * SCALE} width={r.width * SCALE} height={r.height * SCALE} />; }
      case "ellipse": { const el = s as EllipseData; return <KEllipse {...common} fill={s.fill} x={el.x * SCALE} y={el.y * SCALE} radiusX={el.radiusX * SCALE} radiusY={el.radiusY * SCALE} />; }
      case "line": case "freehand": {
        const ln = s as LineData; if (ln.points.length < 4) return null;
        const fh = s.kind === "freehand" ? (s as FreehandData) : null;
        return <KLine {...common} fill={fh?.closed ? s.fill : "transparent"} points={ln.points.map(p => p * SCALE)} tension={fh ? 0.4 : 0} lineCap="round" lineJoin="round" closed={fh?.closed ?? false} />;
      }
      case "polygon": {
        const p = s as PolygonData;
        if (isDraft && tool === "polygon") {
          const previewPoints = [...p.points];
          if (mousePos.x > 0 && mousePos.y > 0) previewPoints.push(mousePos.x / SCALE, mousePos.y / SCALE);
          if (previewPoints.length < 4) return null;
          return (<><KLine points={previewPoints.map(pt => pt * SCALE)} closed={false} tension={0} lineCap="round" lineJoin="round" fill="transparent" stroke={stroke} strokeWidth={strokeWidth * SCALE} dash={[5, 5]} />
            {polygonVertices.map((v, i) => <KCircle key={`v${i}`} x={v.x * SCALE} y={v.y * SCALE} radius={4} fill="#22d3ee" stroke="#000" strokeWidth={1} />)}</>);
        }
        if (p.points.length < 6) return null;
        return <KLine {...common} points={p.points.map(pt => pt * SCALE)} closed={p.closed} tension={0} lineCap="round" lineJoin="round" fill={p.closed ? s.fill : "transparent"} />;
      }
      case "text": { const td = s as TextData; return <KText {...common} fill={s.fill} x={td.x * SCALE} y={td.y * SCALE} text={td.text} fontSize={td.fontSize * SCALE} />; }
      default: return null;
    }
  };

  const saveSVG = () => {
    const els = shapes.map(s => {
      const f = s.fill, st = s.stroke, sw = s.strokeWidth;
      if (s.kind === "rect") { const r = s as RectData; return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${f}" stroke="${st}" stroke-width="${sw}"/>`; }
      if (s.kind === "ellipse") { const el = s as EllipseData; return `<ellipse cx="${el.x}" cy="${el.y}" rx="${el.radiusX}" ry="${el.radiusY}" fill="${f}" stroke="${st}" stroke-width="${sw}"/>`; }
      if (s.kind === "line" || s.kind === "freehand") {
        const pts = (s as LineData).points;
        const fh = s.kind === "freehand" ? (s as FreehandData) : null;
        const d = pts.reduce((acc, p, i) => i === 0 ? `M ${p}` : i === 1 ? `${acc} ${p}` : i % 2 === 0 ? `${acc} L ${p}` : `${acc} ${p}`, "");
        const closePath = fh?.closed ? " Z" : "";
        const fillAttr = fh?.closed ? `fill="${f}"` : 'fill="none"';
        return `<path d="${d}${closePath}" ${fillAttr} stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      if (s.kind === "polygon") {
        const p = s as PolygonData;
        if (p.points.length < 6) return "";
        const pts = []; for (let i = 0; i < p.points.length; i += 2) pts.push(`${p.points[i]},${p.points[i + 1]}`);
        return `<polygon points="${pts.join(" ")}" fill="${f}" stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      if (s.kind === "text") { const td = s as TextData; return `<text x="${td.x}" y="${td.y + td.fontSize}" font-size="${td.fontSize}" fill="${f}">${td.text}</text>`; }
      return "";
    }).join("\n  ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${els}\n</svg>`;
    onSave(spriteName, `data:image/svg+xml;base64,${btoa(svg)}`);
  };

  const tools = [
    { id: "select" as Tool, icon: "cursor" as const, label: "Select" },
    { id: "rect" as Tool, icon: "square" as const, label: "Rectangle" },
    { id: "ellipse" as Tool, icon: "circle" as const, label: "Ellipse" },
    { id: "line" as Tool, icon: "line" as const, label: "Line" },
    { id: "freehand" as Tool, icon: "pencil" as const, label: "Pen" },
    { id: "polygon" as Tool, icon: "polygon" as const, label: "Polygon" },
    { id: "text" as Tool, icon: "text" as const, label: "Text" },
  ];

  // Matches COLOR_NAMES in src/assets/python/graphics/__init__.py (unique only)
  const COLORS: { name: string; hex: string }[] = [
    { name: "red", hex: "#ff0000" },
    { name: "green", hex: "#00ff00" },
    { name: "blue", hex: "#0000ff" },
    { name: "yellow", hex: "#ffff00" },
    { name: "cyan", hex: "#00ffff" },
    { name: "magenta", hex: "#ff00ff" },
    { name: "white", hex: "#ffffff" },
    { name: "black", hex: "#000000" },
    { name: "gray", hex: "#808080" },
    { name: "orange", hex: "#ffa500" },
    { name: "purple", hex: "#800080" },
    { name: "pink", hex: "#ffc0cb" },
    { name: "brown", hex: "#8b4513" },
    { name: "lime", hex: "#00ff00" },
    { name: "navy", hex: "#000080" },
    { name: "teal", hex: "#008080" },
    { name: "olive", hex: "#808000" },
    { name: "maroon", hex: "#800000" },
    { name: "silver", hex: "#c0c0c0" },
    { name: "aqua", hex: "#00ffff" },
    { name: "fuchsia", hex: "#ff00ff" },
    { name: "grey", hex: "#808080" },
  ];

  const isTransparent = (c: string) => c === "transparent";

  function Swatch({ color, name, active, onClick }: { color: string; name?: string; onClick: () => void; active: boolean }) {
    return (
      <button type="button" title={name || color} onClick={onClick} aria-label={name || color}
        style={{
          all: "unset", cursor: "pointer",
          width: 22, height: 22, borderRadius: 3,
          background: isTransparent(color)
            ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 8px 8px"
            : color,
          boxShadow: active ? `0 0 0 2px ${theme.accent}, inset 0 0 0 1px rgba(0,0,0,0.15)` : "inset 0 0 0 1px rgba(0,0,0,0.18)",
        }} />
    );
  }

  function ColorPopover({ open, value, onPick, anchor = "left", testId }: { open: boolean; value: string; onPick: (c: string) => void; anchor?: string; testId?: string }) {
    if (!open) return null;
    return (
      <div data-testid={testId} style={{
        position: "absolute", top: "100%", [anchor]: 0, marginTop: 6,
        background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
        borderRadius: theme.radiusCard, boxShadow: "0 10px 32px -10px rgba(0,0,0,0.30)",
        padding: 10, width: 224, zIndex: 30,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, marginBottom: 8 }}>
          {COLORS.map(c => <Swatch key={`${c.name}-${c.hex}`} color={c.hex} name={c.name} active={c.hex === value} onClick={() => onPick(c.hex)} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
          background: theme.chip, borderRadius: 2, fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute }}>
          <span style={{ flex: 1 }}>Custom</span>
          <span style={{ color: theme.panelTxt }}>{value}</span>
        </div>
      </div>
    );
  }

  if (!open) return null;

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
          width: Math.max(W + 320, 720),
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          fontFamily: theme.fontUI, color: theme.panelTxt,
        }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <div style={{ flex: 1, fontFamily: theme.fontUI, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>
            Sprite Editor
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" data-testid="close-button" onClick={onClose}
              style={{
                all: "unset", cursor: "pointer", width: 30, height: 30, borderRadius: 6,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: theme.panelTxtMute,
              }}>
              <Icon name="close" size={16} color="currentColor" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
          {/* Tool sidebar */}
          <div style={{
            width: 44, flex: "none",
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
              style={{
                all: "unset", cursor: history.length ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "transparent", color: theme.panelTxt, opacity: history.length ? 1 : 0.3,
              }}>
              <Icon name="undo" size={16} color="currentColor" />
            </button>
            <button type="button" data-testid="redo-button" title="Redo" onClick={redo} disabled={future.length === 0}
              style={{
                all: "unset", cursor: future.length ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "transparent", color: theme.panelTxt, opacity: future.length ? 1 : 0.3,
              }}>
              <Icon name="redo" size={16} color="currentColor" />
            </button>
            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            <button type="button" data-testid="delete-button" title="Delete selected" onClick={deleteSelected} disabled={!selectedId}
              style={{
                all: "unset", cursor: selectedId ? "pointer" : "default", width: 34, height: 34, borderRadius: 5,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: selectedId ? "rgba(196,69,28,0.15)" : "transparent",
                color: theme.stopBg, opacity: selectedId ? 1 : 0.3,
              }}>
              <Icon name="trash" size={16} color="currentColor" />
            </button>
          </div>

          {/* Canvas area */}
          <div data-testid="sprite-editor-content" style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24,
            gap: 10,
          }}>
            <div
              onMouseMove={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
              }}
            >
              <div style={{
                width: W, height: H, background: "#ffffff", borderRadius: 3,
                boxShadow: `0 0 0 1px ${theme.panelBorder}, 0 24px 50px -22px rgba(0,0,0,0.30)`,
                overflow: "hidden", cursor: tool === "select" ? "default" : "crosshair",
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
                    {shapes.map(s => renderShape(s))}
                    {draft && renderShape(draft, true)}
                    <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_old, nw) => nw} />
                    <KLine points={[W/2 - 8, H/2, W/2 + 8, H/2]} stroke="#22d3ee" strokeWidth={1} />
                    <KLine points={[W/2, H/2 - 8, W/2, H/2 + 8]} stroke="#22d3ee" strokeWidth={1} />
                    <KCircle x={W/2} y={H/2} radius={3} stroke="#22d3ee" strokeWidth={1} fill="transparent" />
                  </Layer>
                </Stage>
              </div>
            </div>
            {/* Status bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 16,
              fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute,
            }}>
              <span>tool: <span style={{ color: theme.panelTxt, fontWeight: 500 }}>{tool}</span></span>
              <span>x: <span style={{ color: theme.panelTxt }}>{Math.max(0, Math.round(mousePos.x / SCALE))}</span></span>
              <span>y: <span style={{ color: theme.panelTxt }}>{Math.max(0, Math.round(mousePos.y / SCALE))}</span></span>
              <span>scale: <span style={{ color: theme.panelTxt }}>{SCALE}×</span></span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 18px",
          background: theme.chip,
          borderTop: `1px solid ${theme.panelBorder}`,
        }}>
          <div style={{ position: "relative" }}>
            <button type="button" data-testid="fill-color-button" onClick={e => { e.stopPropagation(); setShowFillPicker(s => !s); setShowStrokePicker(false); }}
              style={{
                all: "unset", cursor: "pointer", height: 30, padding: "0 12px",
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "transparent",
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 5,
                fontSize: 12, fontWeight: 500,
                color: theme.panelTxt, textTransform: "uppercase", letterSpacing: 0.4,
              }}>
              <span>Fill</span>
              <span style={{
                width: 18, height: 18, borderRadius: 2,
                background: isTransparent(fill) ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 6px 6px" : fill,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
              }} />
            </button>
            <ColorPopover open={showFillPicker} value={fill} onPick={c => { setFill(c); setShowFillPicker(false); }} testId="fill-color-popover" />
          </div>
          <div style={{ position: "relative" }}>
            <button type="button" data-testid="stroke-color-button" onClick={e => { e.stopPropagation(); setShowStrokePicker(s => !s); setShowFillPicker(false); }}
              style={{
                all: "unset", cursor: "pointer", height: 30, padding: "0 12px",
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "transparent",
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 5,
                fontSize: 12, fontWeight: 500,
                color: theme.panelTxt, textTransform: "uppercase", letterSpacing: 0.4,
              }}>
              <span>Stroke</span>
              <span style={{
                width: 18, height: 18, borderRadius: 2,
                background: isTransparent(stroke) ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 6px 6px" : stroke,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
              }} />
            </button>
            <ColorPopover open={showStrokePicker} value={stroke} anchor="left" onPick={c => { setStroke(c); setShowStrokePicker(false); }} testId="stroke-color-popover" />
          </div>
          <div style={{ width: 1, height: 24, background: theme.panelBorder }} />
          <span style={{ fontSize: 11.5, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.6 }}>Width</span>
          <input type="range" data-testid="stroke-width-input" min="0" max="8" step="1" value={strokeWidth}
            onChange={e => setStrokeWidth(+e.target.value)}
            style={{ width: 100, accentColor: theme.accent }} />
          <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxt, minWidth: 24, textAlign: "right" }}>{strokeWidth}px</span>
          <div style={{ flex: 1 }} />
          {/* Name + Save */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "0 10px", height: 30,
            background: theme.surfacePanel, borderRadius: 5,
            border: `1px solid ${theme.panelBorder}`,
          }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>name</span>
            <input data-testid="sprite-name-input" value={spriteName} onChange={e => setSpriteName(e.target.value)}
              style={{ all: "unset", width: 80, fontFamily: theme.fontMono, fontSize: 12.5, color: theme.panelTxt }} />
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>.svg</span>
          </div>
          <button type="button" data-testid="save-svg-button" onClick={saveSVG}
            style={{
              all: "unset", cursor: "pointer", padding: "7px 16px",
              background: theme.runBg, color: theme.runTxt,
              borderRadius: 5,
              fontFamily: theme.fontUI, fontWeight: 600, fontSize: 12.5,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            <Icon name="check" size={14} color="currentColor" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
