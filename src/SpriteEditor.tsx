import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  MdClose,
  MdUndo,
  MdRedo,
  MdDelete,
  MdNorthWest,
  MdCropSquare,
  MdCircle,
  MdLineAxis,
  MdEdit,
  MdTextFields,
  MdPolyline,
} from "react-icons/md";
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

// --- Types ---

type ShapeBase = {
  id: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
};
type RectData = ShapeBase & {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};
type EllipseData = ShapeBase & {
  kind: "ellipse";
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
};
type LineData = ShapeBase & { kind: "line"; points: number[] };
type FreehandData = ShapeBase & {
  kind: "freehand";
  points: number[];
  closed: boolean;
};
type PolygonData = ShapeBase & {
  kind: "polygon";
  points: number[];
  closed: boolean;
};
type TextData = ShapeBase & {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
};
type ShapeData =
  | RectData
  | EllipseData
  | LineData
  | FreehandData
  | PolygonData
  | TextData;

type Tool =
  | "select"
  | "rect"
  | "ellipse"
  | "line"
  | "freehand"
  | "polygon"
  | "text";

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
  const [polygonVertices, setPolygonVertices] = useState<
    Array<{ x: number; y: number }>
  >([]);
  const [freehandStartPoint, setFreehandStartPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  // Load initial sprite data if provided
  const loadImageToShapes = useCallback(async () => {
    if (!initialDataUrl) {
      setShapes([]);
      setHistory([]);
      setFuture([]);
      return;
    }

    try {
      // Extract SVG content from data URL
      const svgContent = atob(initialDataUrl.split(',')[1]);
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      
      if (!svg) {
        setShapes([]);
        setHistory([]);
        setFuture([]);
        return;
      }

      const parsedShapes: ShapeData[] = [];
      let shapeId = 0;

      // Parse rect elements
      svg.querySelectorAll('rect').forEach((rect) => {
        const x = parseFloat(rect.getAttribute('x') || '0');
        const y = parseFloat(rect.getAttribute('y') || '0');
        const width = parseFloat(rect.getAttribute('width') || '0');
        const height = parseFloat(rect.getAttribute('height') || '0');
        const fill = rect.getAttribute('fill') || 'transparent';
        const stroke = rect.getAttribute('stroke') || '#000000';
        const strokeWidth = parseFloat(rect.getAttribute('stroke-width') || '1');
        
        parsedShapes.push({
          id: `s${++shapeId}`,
          kind: 'rect',
          x, y, width, height, fill, stroke, strokeWidth,
        });
      });

      // Parse ellipse elements
      svg.querySelectorAll('ellipse').forEach((ellipse) => {
        const cx = parseFloat(ellipse.getAttribute('cx') || '0');
        const cy = parseFloat(ellipse.getAttribute('cy') || '0');
        const rx = parseFloat(ellipse.getAttribute('rx') || '0');
        const ry = parseFloat(ellipse.getAttribute('ry') || '0');
        const fill = ellipse.getAttribute('fill') || 'transparent';
        const stroke = ellipse.getAttribute('stroke') || '#000000';
        const strokeWidth = parseFloat(ellipse.getAttribute('stroke-width') || '1');
        
        parsedShapes.push({
          id: `s${++shapeId}`,
          kind: 'ellipse',
          x: cx, y: cy, radiusX: rx, radiusY: ry, fill, stroke, strokeWidth,
        });
      });

      // Parse polygon elements
      svg.querySelectorAll('polygon').forEach((polygon) => {
        const pointsAttr = polygon.getAttribute('points') || '';
        const points: number[] = [];
        pointsAttr.trim().split(/[\s,]+/).forEach((n) => {
          const val = parseFloat(n);
          if (!isNaN(val)) points.push(val);
        });
        
        if (points.length >= 6) {
          const fill = polygon.getAttribute('fill') || 'transparent';
          const stroke = polygon.getAttribute('stroke') || '#000000';
          const strokeWidth = parseFloat(polygon.getAttribute('stroke-width') || '1');
          
          parsedShapes.push({
            id: `s${++shapeId}`,
            kind: 'polygon',
            points, closed: true, fill, stroke, strokeWidth,
          });
        }
      });

      // Parse path elements (used for freehand and lines)
      svg.querySelectorAll('path').forEach((path) => {
        const d = path.getAttribute('d') || '';
        const fill = path.getAttribute('fill') || 'none';
        const stroke = path.getAttribute('stroke') || '#000000';
        const strokeWidth = parseFloat(path.getAttribute('stroke-width') || '1');
        
        // Parse M, L commands to extract points
        const points: number[] = [];
        const commands = d.match(/[ML][^ML]*/g) || [];
        commands.forEach((cmd) => {
          const nums = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
          if (nums.length >= 2) {
            points.push(nums[0], nums[1]);
          }
        });

        if (points.length >= 4) {
          const isClosed = fill !== 'none';
          parsedShapes.push({
            id: `s${++shapeId}`,
            kind: isClosed ? 'freehand' : 'line',
            points, closed: isClosed, fill, stroke, strokeWidth,
          });
        }
      });

      // Set first shape's fill/stroke as current colors if no shape selected
      if (parsedShapes.length > 0) {
        setFill(parsedShapes[0].fill);
        setStroke(parsedShapes[0].stroke);
        setStrokeWidth(parsedShapes[0].strokeWidth);
      }

      setShapes(parsedShapes);
      setHistory([]);
      setFuture([]);
    } catch (e) {
      console.error('Failed to parse SVG:', e);
      setShapes([]);
      setHistory([]);
      setFuture([]);
    }
  }, []);

  useEffect(() => {
    if (initialDataUrl && open) {
      // Use setTimeout to avoid calling setState synchronously within effect
      setTimeout(() => {
        loadImageToShapes();
      }, 0);
    }
  }, [initialDataUrl, open, loadImageToShapes]);

  const commit = useCallback(
    (next: ShapeData[]) => {
      setHistory((h) => [...h, shapes]);
      setFuture([]);
      setShapes(next);
    },
    [shapes],
  );

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
      // Need at least 3 points to close a polygon (6 values: x1,y1,x2,y2,x3,y3)
      if (polyDraft.points.length < 6) {
        // Not enough points, cancel instead
        cancelPolygon();
        return;
      }
      // Close the polygon - only fill if fill color is not transparent
      // Check if fill is transparent (either "transparent" or rgba with alpha 0)
      const isTransparent =
        fill === "transparent" ||
        fill === "#00000000" ||
        fill.startsWith("rgba(0,0,0,0)") ||
        fill.startsWith("rgba(255,255,255,0)");
      const closedPolygon: PolygonData = {
        ...polyDraft,
        closed: true,
        fill: isTransparent ? "transparent" : fill,
      };
      setIsDrawing(false);
      commit([...shapes, closedPolygon]);
      setDraft(null);
      setPolygonVertices([]);
    }
  }, [tool, draft, fill, shapes, commit, cancelPolygon]);

  // Handle keyboard shortcuts for polygon tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || tool !== "polygon" || !draft) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closePolygon();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelPolygon();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, tool, draft, closePolygon, cancelPolygon]);

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

  const getPos = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()!.getPointerPosition()!;
    return { x: pos.x / SCALE, y: pos.y / SCALE };
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (tool === "select") {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    const { x, y } = getPos(e);
    const base: ShapeBase = { id: uid(), fill, stroke, strokeWidth };

    if (tool === "text") {
      const text = window.prompt(t('spriteEditor.enterText')) ?? "";
      if (text)
        commit([
          ...shapes,
          { ...base, kind: "text", x, y, text, fontSize: 10 },
        ]);
      return;
    }

    setIsDrawing(true);
    if (tool === "rect")
      setDraft({ ...base, kind: "rect", x, y, width: 0, height: 0 });
    else if (tool === "ellipse")
      setDraft({ ...base, kind: "ellipse", x, y, radiusX: 0, radiusY: 0 });
    else if (tool === "line")
      setDraft({ ...base, kind: "line", points: [x, y, x, y] });
    else if (tool === "freehand") {
      setDraft({ ...base, kind: "freehand", points: [x, y], closed: false });
      // Store the start point for freehand closing detection
      setFreehandStartPoint({ x, y });
    } else if (tool === "polygon") {
      if (!draft) {
        // First click: create new polygon with first point
        setDraft({ ...base, kind: "polygon", points: [x, y], closed: false });
        setPolygonVertices([{ x, y }]);
      } else {
        // Subsequent clicks: add vertex to existing polygon
        const polyDraft = draft as PolygonData;
        setDraft({
          ...polyDraft,
          points: [...polyDraft.points, x, y],
        });
        setPolygonVertices([...polygonVertices, { x, y }]);
      }
    }
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const { x, y } = getPos(e);
    setMousePos({ x: x * SCALE, y: y * SCALE });

    if (!isDrawing || !draft) return;

    if (draft.kind === "rect") {
      const d = draft as RectData;
      setDraft({ ...d, width: Math.abs(x - d.x), height: Math.abs(y - d.y) });
    } else if (draft.kind === "ellipse") {
      const d = draft as EllipseData;
      setDraft({
        ...d,
        radiusX: Math.abs(x - d.x),
        radiusY: Math.abs(y - d.y),
      });
    } else if (draft.kind === "line") {
      const pts = [...(draft as LineData).points];
      pts[2] = x;
      pts[3] = y;
      setDraft({ ...draft, points: pts } as LineData);
    } else if (draft.kind === "freehand") {
      setDraft({
        ...draft,
        points: [...(draft as FreehandData).points, x, y],
      } as FreehandData);
    }
    // Note: polygon doesn't update on mouse move - vertices are added on click only
    // The preview line is handled in renderShape for draft polygons
  };

  const onMouseUp = () => {
    if (!isDrawing || !draft) return;

    // For polygon, we don't finish on mouse up - we keep adding vertices
    // The shape is finished on double-click or Enter
    if (tool === "polygon") {
      return;
    }

    // For freehand, check if we should auto-close when releasing mouse
    if (tool === "freehand") {
      const freehandDraft = draft as FreehandData;

      // Check if we should close the freehand shape
      // Close if the end point is near the start point (within 15 pixels)
      let shouldClose = false;
      if (freehandStartPoint && freehandDraft.points.length >= 6) {
        const lastX = freehandDraft.points[freehandDraft.points.length - 2];
        const lastY = freehandDraft.points[freehandDraft.points.length - 1];
        const startX = freehandStartPoint.x;
        const startY = freehandStartPoint.y;
        const distance = Math.sqrt(
          (lastX - startX) ** 2 + (lastY - startY) ** 2,
        );
        shouldClose = distance < 15; // Close if within 15 pixels of start
      }

      // Check if we should fill (not transparent)
      const isTransparent =
        fill === "transparent" ||
        fill === "#00000000" ||
        fill.startsWith("rgba(0,0,0,0)") ||
        fill.startsWith("rgba(255,255,255,0)");

      const finishedFreehand: FreehandData = {
        ...freehandDraft,
        closed: shouldClose,
        fill: shouldClose && !isTransparent ? fill : "transparent",
      };

      setIsDrawing(false);
      commit([...shapes, finishedFreehand]);
      setDraft(null);
      setFreehandStartPoint(null);
      return;
    }

    setIsDrawing(false);
    commit([...shapes, draft]);
    setDraft(null);
  };

  const onDoubleClick = () => {
    if (tool === "polygon" && draft) {
      closePolygon();
    } else if (tool === "line" && draft) {
      // For line, finish on double-click
      setIsDrawing(false);
      commit([...shapes, draft]);
      setDraft(null);
    }
  };

  const renderShape = (s: ShapeData, isDraft = false): React.ReactNode => {
    const isSelected = s.id === selectedId;
    const draggable = tool === "select" && !isDraft;
    const common = {
      key: isDraft ? "draft" : s.id,
      id: isDraft ? undefined : s.id,
      stroke: isSelected ? "#22d3ee" : s.stroke,
      strokeWidth: s.strokeWidth * SCALE,
      draggable,
      onClick:
        tool === "select" && !isDraft ? () => setSelectedId(s.id) : undefined,
      onDragEnd: (e: KonvaEventObject<MouseEvent>) => {
        const node = e.target;
        if (
          s.kind === "line" ||
          s.kind === "freehand" ||
          s.kind === "polygon"
        ) {
          const dx = node.x() / SCALE;
          const dy = node.y() / SCALE;
          const pts = (s as LineData | FreehandData | PolygonData).points.map(
            (p, i) => (i % 2 === 0 ? p + dx : p + dy),
          );
          node.position({ x: 0, y: 0 });
          commit(
            shapes.map((sh) =>
              sh.id === s.id ? ({ ...sh, points: pts } as ShapeData) : sh,
            ),
          );
        } else {
          commit(
            shapes.map((sh) =>
              sh.id === s.id
                ? ({
                    ...sh,
                    x: node.x() / SCALE,
                    y: node.y() / SCALE,
                  } as ShapeData)
                : sh,
            ),
          );
        }
      },
    };

    switch (s.kind) {
      case "rect": {
        const r = s as RectData;
        return (
          <KRect
            {...common}
            fill={s.fill}
            x={r.x * SCALE}
            y={r.y * SCALE}
            width={r.width * SCALE}
            height={r.height * SCALE}
          />
        );
      }
      case "ellipse": {
        const el = s as EllipseData;
        return (
          <KEllipse
            {...common}
            fill={s.fill}
            x={el.x * SCALE}
            y={el.y * SCALE}
            radiusX={el.radiusX * SCALE}
            radiusY={el.radiusY * SCALE}
          />
        );
      }
      case "line":
      case "freehand": {
        const ln = s as LineData | FreehandData;
        // Need at least 2 points for a line (4 values: x1,y1,x2,y2)
        if (ln.points.length < 4) {
          return null;
        }
        const isFreehand = s.kind === "freehand";
        const freehandData = isFreehand ? (s as FreehandData) : null;
        const shouldFill = isFreehand && freehandData?.closed;
        return (
          <KLine
            {...common}
            fill={shouldFill ? s.fill : "transparent"}
            points={ln.points.map((p) => p * SCALE)}
            tension={isFreehand ? 0.4 : 0}
            lineCap="round"
            lineJoin="round"
            closed={isFreehand && freehandData?.closed}
          />
        );
      }
      case "polygon": {
        const p = s as PolygonData;
        // For draft polygons (still drawing), show preview line to mouse
        if (isDraft && tool === "polygon") {
          // Create points array including current mouse position for preview
          const previewPoints = [...p.points];
          if (mousePos.x > 0 && mousePos.y > 0) {
            // Add current mouse position for preview line
            previewPoints.push(mousePos.x / SCALE, mousePos.y / SCALE);
          }

          if (previewPoints.length >= 4) {
            // Need at least 2 points (start + mouse)
            return (
              <>
                {/* Preview line from last vertex to mouse */}
                <KLine
                  {...common}
                  points={previewPoints.map((pt) => pt * SCALE)}
                  closed={false}
                  tension={0}
                  lineCap="round"
                  lineJoin="round"
                  fill="transparent"
                  stroke={stroke}
                  strokeWidth={strokeWidth * SCALE}
                  dash={[5, 5]} // Dashed line for preview
                />
                {/* Vertex dots */}
                {polygonVertices.map((vertex, index) => (
                  <KCircle
                    key={`vertex-${index}`}
                    x={vertex.x * SCALE}
                    y={vertex.y * SCALE}
                    radius={4}
                    fill="#22d3ee"
                    stroke="#000"
                    strokeWidth={1}
                  />
                ))}
              </>
            );
          }
          return null;
        }

        // For completed polygons or non-draft display
        // Need at least 3 points to form a polygon (6 values: x1,y1,x2,y2,x3,y3)
        if (p.points.length < 6) {
          return null;
        }
        // For closed polygons, use fill. For open polygons (still drawing), no fill.
        const fillColor = p.closed ? s.fill : "transparent";
        return (
          <KLine
            {...common}
            points={p.points.map((pt) => pt * SCALE)}
            closed={p.closed}
            tension={0}
            lineCap="round"
            lineJoin="round"
            fill={fillColor}
          />
        );
      }
      case "text": {
        const t = s as TextData;
        return (
          <KText
            {...common}
            fill={s.fill}
            x={t.x * SCALE}
            y={t.y * SCALE}
            text={t.text}
            fontSize={t.fontSize * SCALE}
          />
        );
      }
      default:
        return null;
    }
  };

  const saveSVG = () => {
    const els = shapes
      .map((s) => {
        const f = s.fill,
          st = s.stroke,
          sw = s.strokeWidth;
        if (s.kind === "rect") {
          const r = s as RectData;
          return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${f}" stroke="${st}" stroke-width="${sw}"/>`;
        }
        if (s.kind === "ellipse") {
          const el = s as EllipseData;
          return `<ellipse cx="${el.x}" cy="${el.y}" rx="${el.radiusX}" ry="${el.radiusY}" fill="${f}" stroke="${st}" stroke-width="${sw}"/>`;
        }
        if (s.kind === "line" || s.kind === "freehand") {
          const pts = (s as LineData).points;
          const isFreehand = s.kind === "freehand";
          const freehandData = isFreehand ? (s as FreehandData) : null;
          const shouldFill = isFreehand && freehandData?.closed;
          const d = pts.reduce(
            (acc, p, i) =>
              i === 0
                ? `M ${p}`
                : i === 1
                  ? `${acc} ${p}`
                  : i % 2 === 0
                    ? `${acc} L ${p}`
                    : `${acc} ${p}`,
            "",
          );
          const closePath = shouldFill ? " Z" : "";
          const fillAttr = shouldFill ? `fill="${f}"` : 'fill="none"';
          return `<path d="${d}${closePath}" ${fillAttr} stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
        }
        if (s.kind === "polygon") {
          const p = s as PolygonData;
          if (p.points.length < 6) return ""; // Need at least 3 points (6 values)
          // Format points as "x1,y1 x2,y2 x3,y3 ..."
          const pointsStr = [];
          for (let i = 0; i < p.points.length; i += 2) {
            pointsStr.push(`${p.points[i]},${p.points[i + 1]}`);
          }
          return `<polygon points="${pointsStr.join(" ")}" fill="${f}" stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
        }
        if (s.kind === "text") {
          const t = s as TextData;
          return `<text x="${t.x}" y="${t.y + t.fontSize}" font-size="${t.fontSize}" fill="${f}">${t.text}</text>`;
        }
        return "";
      })
      .join("\n  ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${els}\n</svg>`;
    onSave(spriteName, `data:image/svg+xml;base64,${btoa(svg)}`);
  };

  if (!open) return null;

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MdNorthWest size={18} />, label: t('spriteEditor.select') },
    { id: "rect", icon: <MdCropSquare size={18} />, label: t('spriteEditor.rectangle') },
    { id: "ellipse", icon: <MdCircle size={18} />, label: t('spriteEditor.ellipse') },
    { id: "line", icon: <MdLineAxis size={18} />, label: t('spriteEditor.line') },
    { id: "freehand", icon: <MdEdit size={18} />, label: t('spriteEditor.pen') },
    { id: "polygon", icon: <MdPolyline size={18} />, label: t('spriteEditor.polygon') },
    { id: "text", icon: <MdTextFields size={18} />, label: t('spriteEditor.text') },
  ];

  // Named color palette
  const COLOR_PALETTE = [
    "#000000", "#ffffff", "#ff0000", "#00ff00",
    "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
    "#ff8800", "#88ff00", "#0088ff", "#ff0088",
    "#884400", "#448800", "#004488", "#880044",
  ];

  const handleFillChange = (newFill: string) => {
    setFill(newFill);
    if (selectedId) {
      commit(shapes.map(s => s.id === selectedId ? { ...s, fill: newFill } : s));
    }
  };

  const handleStrokeChange = (newStroke: string) => {
    setStroke(newStroke);
    if (selectedId) {
      commit(shapes.map(s => s.id === selectedId ? { ...s, stroke: newStroke } : s));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-label={t('spriteEditor.title')} data-testid="sprite-editor-modal">
      <div className="bg-cyan-800 border border-cyan-600 rounded-xl shadow-2xl p-4 w-[480px]" data-testid="sprite-editor-content">
        {/* Header row: Save button, name input, close button */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <button
            onClick={saveSVG}
            className="px-3 py-1.5 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
            data-testid="save-svg-button"
          >
            {t('spriteEditor.save')}
          </button>
          <input
            value={spriteName}
            onChange={(e) => setSpriteName(e.target.value)}
            className="bg-transparent text-white font-mono text-sm border-b border-white/20 outline-none w-32"
            placeholder={t('sideMenu.spriteNamePlaceholder')}
            data-testid="sprite-name-input"
          />
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label={t('spriteEditor.close')} data-testid="close-button">
            <MdClose size={20} />
          </button>
        </div>

        {/* Main content: tools on left, canvas on right */}
        <div className="flex gap-3">
          {/* Tools - vertical stack on left */}
          <div className="flex flex-col gap-1">
            {tools.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => {
                  setTool(t.id);
                  setSelectedId(null);
                }}
                className={`w-8 h-8 rounded text-base flex items-center justify-center transition-colors
                  ${tool === t.id ? "bg-cyan-600 text-white" : "bg-white/10 hover:bg-white/20 text-white/70"}`}
                data-testid={`tool-${t.id}`}
              >
                {t.icon}
              </button>
            ))}

            <div className="w-full h-px bg-white/20 my-1" />

            {/* Undo/Redo */}
            <button
              onClick={undo}
              disabled={!history.length}
              title={t('spriteEditor.undo')}
              className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white/70 disabled:opacity-30 flex items-center justify-center"
              data-testid="undo-button"
            >
              <MdUndo size={16} />
            </button>
            <button
              onClick={redo}
              disabled={!future.length}
              title={t('spriteEditor.redo')}
              className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white/70 disabled:opacity-30 flex items-center justify-center"
              data-testid="redo-button"
            >
              <MdRedo size={16} />
            </button>
            <button
              onClick={deleteSelected}
              disabled={!selectedId}
              title={t('spriteEditor.deleteSelected')}
              className="w-8 h-8 rounded bg-red-900/50 hover:bg-red-700/60 text-white/70 disabled:opacity-30 flex items-center justify-center"
              data-testid="delete-button"
            >
              <MdDelete size={16} />
            </button>
          </div>

          {/* Canvas - centered */}
          <div className="flex-1 flex justify-center">
            <div
              className="rounded overflow-hidden border border-white/20"
              style={{
                width: W,
                height: H,
                background: "#ffffff",
              }}
            >
              <Stage
                ref={stageRef}
                width={W}
                height={H}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onDblClick={onDoubleClick}
                style={{ cursor: tool === "select" ? "default" : "crosshair" }}
                tabIndex={0}
                onKeyDown={(e: KonvaEventObject<KeyboardEvent>) => {
                  if (tool === "polygon" && draft) {
                    if (e.evt.key === "Enter" || e.evt.key === " ") {
                      e.evt.preventDefault();
                      closePolygon();
                    } else if (e.evt.key === "Escape") {
                      e.evt.preventDefault();
                      cancelPolygon();
                    }
                  }
                }}
                data-testid="sprite-canvas"
              >
                <Layer>
                  {shapes.map((s) => renderShape(s))}
                  {draft && renderShape(draft, true)}
                  <Transformer
                    ref={trRef}
                    rotateEnabled={false}
                    boundBoxFunc={(_old, nw) => nw}
                  />
                  
                  {/* Center crosshair */}
                  <KLine points={[W/2 - 8, H/2, W/2 + 8, H/2]} stroke="#22d3ee" strokeWidth={1} />
                  <KLine points={[W/2, H/2 - 8, W/2, H/2 + 8]} stroke="#22d3ee" strokeWidth={1} />
                  <KCircle x={W/2} y={H/2} radius={3} stroke="#22d3ee" strokeWidth={1} fill="transparent" />

                  {/* Tool hint overlays */}
                  {tool === "polygon" && draft && (
                    <>
                      <KText
                        x={mousePos.x + 10}
                        y={mousePos.y - 20}
                        text={t('spriteEditor.polygonHint')}
                        fontSize={12}
                        fill="#22d3ee"
                        stroke="#000"
                        strokeWidth={1}
                      />
                      <KCircle
                        x={mousePos.x}
                        y={mousePos.y}
                        radius={3}
                        fill="#ff4444"
                        stroke="#000"
                        strokeWidth={1}
                      />
                    </>
                  )}
                  {tool === "freehand" && draft && (
                    <KText
                      x={mousePos.x + 10}
                      y={mousePos.y - 20}
                      text={t('spriteEditor.freehandHint')}
                      fontSize={12}
                      fill="#22d3ee"
                      stroke="#000"
                      strokeWidth={1}
                    />
                  )}
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        {/* Color and width controls below canvas */}
        <div className="flex items-center gap-3 mt-3">
          {/* Fill button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFillPicker(!showFillPicker);
                setShowStrokePicker(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-xs"
              data-testid="fill-color-button"
            >
              <span className="text-[10px]">{t('spriteEditor.fill')}</span>
              <span
                className="w-5 h-5 rounded border border-white/30"
                style={{ backgroundColor: fill === "transparent" ? "transparent" : fill }}
              />
            </button>
            {showFillPicker && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl p-3 z-10 w-[200px]" data-testid="fill-color-popover">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        handleFillChange(c);
                        setShowFillPicker(false);
                      }}
                      className="w-8 h-8 rounded border-2 border-transparent hover:border-cyan-500 transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs text-gray-700">
                    <span>{t('spriteEditor.customColor')}</span>
                    <input
                      type="color"
                      value={fill === "transparent" ? "#000000" : fill}
                      onChange={(e) => handleFillChange(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  <button
                    onClick={() => {
                      handleFillChange("transparent");
                      setShowFillPicker(false);
                    }}
                    className="px-2 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs text-gray-700"
                  >
                    ○
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stroke button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStrokePicker(!showStrokePicker);
                setShowFillPicker(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-xs"
              data-testid="stroke-color-button"
            >
              <span className="text-[10px]">{t('spriteEditor.stroke')}</span>
              <span
                className="w-5 h-5 rounded border border-white/30"
                style={{ backgroundColor: stroke }}
              />
            </button>
            {showStrokePicker && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl p-3 z-10 w-[200px]" data-testid="stroke-color-popover">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        handleStrokeChange(c);
                        setShowStrokePicker(false);
                      }}
                      className="w-8 h-8 rounded border-2 border-transparent hover:border-cyan-500 transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs text-gray-700">
                  <span>{t('spriteEditor.customColor')}</span>
                  <input
                    type="color"
                    value={stroke}
                    onChange={(e) => handleStrokeChange(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Stroke width */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white/60 mr-1">{t('spriteEditor.stroke')}</span>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={strokeWidth}
              onChange={(e) => {
                setStrokeWidth(Number(e.target.value));
                if (selectedId) {
                  commit(shapes.map(s => s.id === selectedId ? { ...s, strokeWidth: Number(e.target.value) } : s));
                }
              }}
              className="w-16 accent-cyan-500"
              data-testid="stroke-width-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
