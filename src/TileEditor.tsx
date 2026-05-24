import { useState, useRef, useEffect, useCallback, useMemo, type JSX } from "react";
import { Stage, Layer, Rect as KRect, Image as KImage, Line as KLine } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useThemeStore } from "./state/useTheme";
import type { TilemapData, TilemapLayer, TilemapArea } from "./state/IdeState";
import { useEditor } from "./state/IdeState";
import { Icon } from "./components/Icons";

// ── Types ───────────────────────────────────────────────────────────────────

type Tool = "paint" | "erase" | "fill" | "hand";
type Mode = "tiles" | "areas";
type LayerVis = Record<number, boolean>;
// Internal area cell representation reuses the layer cell shape (placeholder
// value "1" means "in area") so the paint/erase/fill helpers work unchanged.
type AreaCells = Record<number, Record<number, string>>;

const AREA_NAME_RE = /^[a-z][a-z0-9_]*$/;

function areaCellsFromList(cells: Array<[number, number]>): AreaCells {
  const out: AreaCells = {};
  for (const [c, r] of cells) {
    if (!out[c]) out[c] = {};
    out[c][r] = "1";
  }
  return out;
}

function areaCellsToList(cells: AreaCells): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [colStr, rows] of Object.entries(cells)) {
    const col = Number(colStr);
    for (const rowStr of Object.keys(rows)) out.push([col, Number(rowStr)]);
  }
  return out;
}

// Deterministic HSL color from area name — distinct hues without a palette table.
function areaColor(name: string): { fill: string; stroke: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { fill: `hsla(${hue}, 75%, 55%, 0.35)`, stroke: `hsla(${hue}, 75%, 55%, 0.85)` };
}

// Encode/decode cell keys
const cellKey = (col: number, row: number) => `${col},${row}`;

function cellsGet(cells: Record<number, Record<number, string>>, col: number, row: number): string | undefined {
  return cells[col]?.[row];
}
function cellsSet(cells: Record<number, Record<number, string>>, col: number, row: number, name: string): Record<number, Record<number, string>> {
  const out = { ...cells, [col]: { ...cells[col], [row]: name } };
  return out;
}
function cellsDel(cells: Record<number, Record<number, string>>, col: number, row: number): Record<number, Record<number, string>> {
  if (!cells[col]?.[row]) return cells;
  const colClone = { ...cells[col] };
  delete colClone[row];
  if (Object.keys(colClone).length === 0) {
    const out = { ...cells };
    delete out[col];
    return out;
  }
  return { ...cells, [col]: colClone };
}

// BFS flood-fill on cells; works on empty or painted targets; cap at 50k
function floodFill(
  cells: Record<number, Record<number, string>>,
  startCol: number,
  startRow: number,
  fillWith: string,
): Record<number, Record<number, string>> | null {
  const target = cellsGet(cells, startCol, startRow);
  if (target === fillWith) return null;

  const visited = new Set<string>();
  const queue: [number, number][] = [[startCol, startRow]];
  const LIMIT = 50_000;

  while (queue.length > 0) {
    if (visited.size >= LIMIT) return null; // unbounded
    const [col, row] = queue.shift()!;
    const k = cellKey(col, row);
    if (visited.has(k)) continue;
    visited.add(k);
    const here = cellsGet(cells, col, row);
    if (here !== target) continue; // boundary
    for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nk = cellKey(col+dc, row+dr);
      if (!visited.has(nk)) queue.push([col+dc, row+dr]);
    }
  }

  let result = cells;
  for (const k of visited) {
    const [c, r] = k.split(",").map(Number);
    if (fillWith === "") {
      result = cellsDel(result, c, r);
    } else {
      result = cellsSet(result, c, r, fillWith);
    }
  }
  return result;
}

// Snap-paint along a horizontal or vertical line between two grid cells
function applyLine(
  cells: Record<number, Record<number, string>>,
  start: { col: number; row: number },
  end: { col: number; row: number },
  apply: (cells: Record<number, Record<number, string>>, col: number, row: number) => Record<number, Record<number, string>>,
): Record<number, Record<number, string>> {
  let result = cells;
  if (Math.abs(end.col - start.col) >= Math.abs(end.row - start.row)) {
    const r = start.row;
    const c0 = Math.min(start.col, end.col);
    const c1 = Math.max(start.col, end.col);
    for (let c = c0; c <= c1; c++) result = apply(result, c, r);
  } else {
    const col = start.col;
    const r0 = Math.min(start.row, end.row);
    const r1 = Math.max(start.row, end.row);
    for (let r = r0; r <= r1; r++) result = apply(result, col, r);
  }
  return result;
}

const TILE_SIZES = [8, 16, 32, 64, 128] as const;

// ── Sprite image cache ───────────────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Layer/area cells snapshot for undo ──────────────────────────────────────
type UndoEntry =
  | { kind: "layer"; layerIdx: number; cells: Record<number, Record<number, string>> }
  | { kind: "area"; areaName: string; cells: AreaCells };

// ── Main component ───────────────────────────────────────────────────────────
interface TileEditorProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string, data: TilemapData) => void;
  onNewSprite?: () => void;
}

export default function TileEditor({ open, initialName, onClose, onSave, onNewSprite }: TileEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  const projectAssets = useEditor((s) => s.project.assets);
  const projectTilemaps = useEditor((s) => s.project.tilemaps);

  // ── Tilemap state ──────────────────────────────────────────────────────────
  const [mapName, setMapName] = useState(initialName || "level1");
  const [layers, setLayers] = useState<TilemapLayer[]>(() => {
    const existing = initialName ? projectTilemaps[initialName] : null;
    return existing?.layers ?? [{ name: "ground", tileSize: 32, cells: {} }];
  });
  const [activeLayerIdx, setActiveLayerIdx] = useState(0);
  const [layerVis, setLayerVis] = useState<LayerVis>({});
  const [editingLayerName, setEditingLayerName] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Tool state ─────────────────────────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("paint");
  const [activeSprite, setActiveSprite] = useState<string | null>(null);

  // ── Areas state ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("tiles");
  const [areas, setAreas] = useState<Record<string, AreaCells>>(() => {
    const existing = initialName ? projectTilemaps[initialName] : null;
    const src = existing?.areas ?? {};
    const out: Record<string, AreaCells> = {};
    for (const [name, area] of Object.entries(src)) out[name] = areaCellsFromList(area.cells);
    return out;
  });
  const [activeAreaName, setActiveAreaName] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState<string | null>(null);
  const [renameAreaValue, setRenameAreaValue] = useState("");

  // When entering areas mode without an active area, auto-pick the first one
  // so paint/erase/fill have a target.
  useEffect(() => {
    if (mode !== "areas") return;
    if (activeAreaName && areas[activeAreaName]) return;
    const first = Object.keys(areas)[0];
    if (first) setActiveAreaName(first);
  }, [mode, activeAreaName, areas]);

  // ── Canvas pan ────────────────────────────────────────────────────────────
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  const [pan, setPan] = useState({ x: 400, y: 300 });
  const [isPanning, setIsPanning] = useState(false);
  const panningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);
  const lineStartCellRef = useRef<{ col: number; row: number } | null>(null);

  // ── Undo/redo ─────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<UndoEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // ── Sprite images ─────────────────────────────────────────────────────────
  const [spriteImages, setSpriteImages] = useState<Record<string, HTMLImageElement>>({});
  const [, forceRender] = useState(0);

  // ── All available sprites (project assets only) ───────────────────────────
  const allSprites = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [name, url] of Object.entries(projectAssets)) {
      const key = name.replace(/\.[^.]+$/, "");
      map[key] = url;
    }
    return map;
  }, [projectAssets]);

  // Load images
  useEffect(() => {
    let alive = true;
    Promise.all(
      Object.entries(allSprites).map(([name, url]) =>
        loadImage(url).then((img) => ({ name, img })).catch(() => null)
      )
    ).then((results) => {
      if (!alive) return;
      const map: Record<string, HTMLImageElement> = {};
      for (const r of results) if (r) map[r.name] = r.img;
      setSpriteImages(map);
      forceRender(n => n + 1);
    });
    return () => { alive = false; };
  }, [allSprites]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStageSize({ w: r.width, h: r.height });
      setPan({ x: r.width / 2, y: r.height / 2 });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [open]);

  // ── Undo/redo ─────────────────────────────────────────────────────────────
  const commitLayer = useCallback((layerIdx: number, newCells: Record<number, Record<number, string>>) => {
    setLayers(prev => prev.map((l, i) => i === layerIdx ? { ...l, cells: newCells } : l));
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const entry: UndoEntry = { kind: "layer", layerIdx, cells: newCells };
      return [...trimmed, entry].slice(-100);
    });
    setHistoryIdx(prev => Math.min(prev + 1, 99));
  }, [historyIdx]);

  const commitArea = useCallback((areaName: string, newCells: AreaCells) => {
    setAreas(prev => ({ ...prev, [areaName]: newCells }));
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const entry: UndoEntry = { kind: "area", areaName, cells: newCells };
      return [...trimmed, entry].slice(-100);
    });
    setHistoryIdx(prev => Math.min(prev + 1, 99));
  }, [historyIdx]);

  // Walk history backwards from a given index to find the prior state of the
  // same target — undo restores to the latest matching entry, or empty if none.
  const findPriorEntry = useCallback((idx: number, target: UndoEntry): UndoEntry | null => {
    for (let i = idx - 1; i >= 0; i--) {
      const e = history[i];
      if (target.kind === "layer" && e.kind === "layer" && e.layerIdx === target.layerIdx) return e;
      if (target.kind === "area" && e.kind === "area" && e.areaName === target.areaName) return e;
    }
    return null;
  }, [history]);

  const undo = useCallback(() => {
    if (historyIdx < 0) return;
    const entry = history[historyIdx];
    if (!entry) return;
    const prior = findPriorEntry(historyIdx, entry);
    if (entry.kind === "layer") {
      const prev = prior && prior.kind === "layer" ? prior.cells : {};
      setLayers(p => p.map((l, i) => i === entry.layerIdx ? { ...l, cells: prev } : l));
    } else {
      const prev = prior && prior.kind === "area" ? prior.cells : {};
      setAreas(p => ({ ...p, [entry.areaName]: prev }));
    }
    setHistoryIdx(hi => hi - 1);
  }, [history, historyIdx, findPriorEntry]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const entry = history[historyIdx + 1];
    if (!entry) return;
    if (entry.kind === "layer") {
      setLayers(p => p.map((l, i) => i === entry.layerIdx ? { ...l, cells: entry.cells } : l));
    } else {
      setAreas(p => ({ ...p, [entry.areaName]: entry.cells }));
    }
    setHistoryIdx(hi => hi + 1);
  }, [history, historyIdx]);

  // Use refs so the keyboard handler can call latest undo/redo without stale closure
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { spaceDownRef.current = true; e.preventDefault(); }
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undoRef.current(); }
      if ((e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === "y" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); redoRef.current(); }
      // Tool shortcuts (skip when typing in an input/textarea)
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "h" || e.key === "H") setTool("hand");
      if (e.key === "b" || e.key === "B") setTool("paint");
      if (e.key === "e" || e.key === "E") setTool("erase");
      if (e.key === "g" || e.key === "G") setTool("fill");
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") spaceDownRef.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  }, [open]);

  // ── Paint stroke tracking ─────────────────────────────────────────────────
  const strokeStartCells = useRef<Record<number, Record<number, string>> | null>(null);
  const paintingRef = useRef(false);
  const [ghostCell, setGhostCell] = useState<{ col: number; row: number } | null>(null);

  // Keep a ref for pan so getCell doesn't need pan in its dependency array
  const panRef = useRef(pan);
  panRef.current = pan;

  const getCell = useCallback((stageX: number, stageY: number): [number, number] => {
    const layer = layers[activeLayerIdx];
    const ts = layer.tileSize;
    const wx = stageX - panRef.current.x;
    const wy = stageY - panRef.current.y;
    const col = Math.floor(wx / ts);
    const row = Math.floor(wy / ts);
    return [col, row];
  }, [layers, activeLayerIdx]);

  const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;

    if (panningRef.current) {
      const dx = pos.x - lastPointerRef.current.x;
      const dy = pos.y - lastPointerRef.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastPointerRef.current = { x: pos.x, y: pos.y };
      return;
    }

    const [col, row] = getCell(pos.x, pos.y);

    // Shift+drag: snap stroke to horizontal or vertical line
    if (paintingRef.current && e.evt.shiftKey && lineStartCellRef.current) {
      const start = lineStartCellRef.current;
      const horizontal = Math.abs(col - start.col) >= Math.abs(row - start.row);
      const snappedCol = horizontal ? col : start.col;
      const snappedRow = horizontal ? start.row : row;
      setGhostCell({ col: snappedCol, row: snappedRow });

      if (mode === "areas" && activeAreaName) {
        const baseCells = strokeStartCells.current ?? areas[activeAreaName] ?? {};
        const setApply = (c: AreaCells, cl: number, rw: number) => cellsSet(c, cl, rw, "1");
        const apply = tool === "erase" ? cellsDel : tool === "paint" ? setApply : null;
        if (apply) {
          const newCells = applyLine(baseCells, start, { col: snappedCol, row: snappedRow }, apply);
          setAreas(prev => ({ ...prev, [activeAreaName]: newCells }));
        }
        return;
      }

      const baseCells = strokeStartCells.current ?? layers[activeLayerIdx].cells;
      if (tool === "paint" && activeSprite) {
        const newCells = applyLine(baseCells, start, { col: snappedCol, row: snappedRow },
          (c, cl, rw) => cellsSet(c, cl, rw, activeSprite));
        setLayers(prev => prev.map((l, i) => i === activeLayerIdx ? { ...l, cells: newCells } : l));
      } else if (tool === "erase") {
        const newCells = applyLine(baseCells, start, { col: snappedCol, row: snappedRow }, cellsDel);
        setLayers(prev => prev.map((l, i) => i === activeLayerIdx ? { ...l, cells: newCells } : l));
      }
      return;
    }

    setGhostCell({ col, row });

    if (!paintingRef.current) return;

    if (mode === "areas") {
      if (!activeAreaName) return;
      const cur = areas[activeAreaName] ?? {};
      if (tool === "paint") {
        if (cellsGet(cur, col, row) !== "1") {
          setAreas(prev => ({ ...prev, [activeAreaName]: cellsSet(cur, col, row, "1") }));
        }
      } else if (tool === "erase") {
        if (cellsGet(cur, col, row) !== undefined) {
          setAreas(prev => ({ ...prev, [activeAreaName]: cellsDel(cur, col, row) }));
        }
      }
      return;
    }

    const layer = layers[activeLayerIdx];
    if (tool === "paint" && activeSprite) {
      if (cellsGet(layer.cells, col, row) !== activeSprite) {
        setLayers(prev => prev.map((l, i) =>
          i === activeLayerIdx ? { ...l, cells: cellsSet(l.cells, col, row, activeSprite) } : l
        ));
      }
    } else if (tool === "erase") {
      if (cellsGet(layer.cells, col, row) !== undefined) {
        setLayers(prev => prev.map((l, i) =>
          i === activeLayerIdx ? { ...l, cells: cellsDel(l.cells, col, row) } : l
        ));
      }
    }
  }, [layers, activeLayerIdx, tool, activeSprite, getCell, mode, areas, activeAreaName]);

  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;

    // Middle mouse, space+left, or hand tool → pan
    if (e.evt.button === 1 || (e.evt.button === 0 && spaceDownRef.current) || (e.evt.button === 0 && tool === "hand")) {
      panningRef.current = true;
      setIsPanning(true);
      lastPointerRef.current = { x: pos.x, y: pos.y };
      return;
    }

    const [col, row] = getCell(pos.x, pos.y);
    lineStartCellRef.current = { col, row };

    if (mode === "areas") {
      if (!activeAreaName) return;
      const cur = areas[activeAreaName] ?? {};
      if (e.evt.button === 2 || tool === "erase") {
        strokeStartCells.current = cur;
        paintingRef.current = true;
        setAreas(prev => ({ ...prev, [activeAreaName]: cellsDel(cur, col, row) }));
        return;
      }
      if (tool === "fill") {
        const newCells = floodFill(cur, col, row, "1");
        if (newCells) commitArea(activeAreaName, newCells);
        return;
      }
      if (tool === "paint") {
        strokeStartCells.current = cur;
        paintingRef.current = true;
        setAreas(prev => ({ ...prev, [activeAreaName]: cellsSet(cur, col, row, "1") }));
      }
      return;
    }

    const layer = layers[activeLayerIdx];

    if (e.evt.button === 2 || tool === "erase") {
      strokeStartCells.current = layer.cells;
      paintingRef.current = true;
      setLayers(prev => prev.map((l, i) =>
        i === activeLayerIdx ? { ...l, cells: cellsDel(l.cells, col, row) } : l
      ));
      return;
    }

    if (tool === "fill") {
      const newCells = floodFill(layer.cells, col, row, activeSprite ?? "");
      if (newCells) commitLayer(activeLayerIdx, newCells);
      return;
    }

    if (tool === "paint" && activeSprite) {
      strokeStartCells.current = layer.cells;
      paintingRef.current = true;
      setLayers(prev => prev.map((l, i) =>
        i === activeLayerIdx ? { ...l, cells: cellsSet(l.cells, col, row, activeSprite) } : l
      ));
    }
  }, [layers, activeLayerIdx, tool, activeSprite, getCell, commitLayer, mode, areas, activeAreaName, commitArea]);

  const finishStroke = useCallback(() => {
    if (!paintingRef.current || strokeStartCells.current === null) return;
    if (mode === "areas" && activeAreaName) {
      const newCells = areas[activeAreaName];
      if (newCells && newCells !== strokeStartCells.current) commitArea(activeAreaName, newCells);
    } else {
      const newCells = layers[activeLayerIdx]?.cells;
      if (newCells && newCells !== strokeStartCells.current) commitLayer(activeLayerIdx, newCells);
    }
    strokeStartCells.current = null;
    paintingRef.current = false;
    lineStartCellRef.current = null;
  }, [layers, activeLayerIdx, commitLayer, mode, areas, activeAreaName, commitArea]);

  const handleStageMouseUp = useCallback(() => {
    if (panningRef.current) { panningRef.current = false; setIsPanning(false); return; }
    finishStroke();
  }, [finishStroke]);

  const handleStageMouseLeave = useCallback(() => {
    setGhostCell(null);
    finishStroke();
  }, [finishStroke]);

  const handleContextMenu = (e: KonvaEventObject<MouseEvent>) => e.evt.preventDefault();

  if (!open) return null;

  const activeLayer = layers[activeLayerIdx];
  const ts = activeLayer?.tileSize ?? 32;

  // Derive grid line range to cover the visible canvas
  const colMin = Math.floor((-pan.x) / ts) - 1;
  const colMax = Math.ceil((stageSize.w - pan.x) / ts) + 1;
  const rowMin = Math.floor((-pan.y) / ts) - 1;
  const rowMax = Math.ceil((stageSize.h - pan.y) / ts) + 1;

  const gridLines: JSX.Element[] = [];
  for (let c = colMin; c <= colMax; c++) {
    const x = pan.x + c * ts;
    gridLines.push(<KLine key={`v${c}`} points={[x, 0, x, stageSize.h]} stroke="rgba(128,128,128,0.25)" strokeWidth={1} listening={false} />);
  }
  for (let r = rowMin; r <= rowMax; r++) {
    const y = pan.y + r * ts;
    gridLines.push(<KLine key={`h${r}`} points={[0, y, stageSize.w, y]} stroke="rgba(128,128,128,0.25)" strokeWidth={1} listening={false} />);
  }

  // Origin cross
  gridLines.push(
    <KLine key="ox" points={[pan.x - 10, pan.y, pan.x + 10, pan.y]} stroke="rgba(255,100,100,0.6)" strokeWidth={2} listening={false} />,
    <KLine key="oy" points={[pan.x, pan.y - 10, pan.x, pan.y + 10]} stroke="rgba(255,100,100,0.6)" strokeWidth={2} listening={false} />,
  );

  const toolDefs = [
    { id: "hand" as Tool, icon: "hand" as const, label: "Pan (H) — also Space+drag or middle mouse" },
    { id: "paint" as Tool, icon: "pencil" as const, label: "Paint — Shift+drag for straight lines" },
    { id: "erase" as Tool, icon: "square" as const, label: "Erase — Shift+drag for straight lines" },
    { id: "fill" as Tool, icon: "bucket" as const, label: "Fill" },
  ];

  const cursor = isPanning ? "grabbing" : tool === "hand" ? "grab" : "crosshair";

  const sideBtn = (active = false, disabled = false) => ({
    all: "unset" as const,
    cursor: disabled ? "default" : "pointer",
    width: 34, height: 34, borderRadius: 5,
    display: "inline-flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    background: active ? theme.accent : "transparent",
    color: active ? "#fff" : theme.panelTxt,
    opacity: disabled ? 0.3 : 1,
    transition: "background 0.1s",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)",
    }}>
      <div style={{
        background: theme.surfacePanel,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 8,
        boxShadow: theme.shadowWindow,
        width: 1160, maxWidth: "calc(100vw - 24px)",
        height: 780, maxHeight: "calc(100vh - 24px)",
        display: "flex", flexDirection: "column",
        fontFamily: theme.fontUI, color: theme.panelTxt,
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          padding: "8px 12px", borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.panelTxt, whiteSpace: "nowrap" }}>Tilemap Editor</span>
          <div style={{ width: 1, height: 20, background: theme.panelBorder, margin: "0 2px" }} />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "0 8px", height: 26,
            borderRadius: 4, border: `1px solid ${theme.panelBorder}`,
          }}>
            <span style={{ fontSize: 11, color: theme.panelTxtMute }}>Name</span>
            <input
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              placeholder="level1"
              style={{ all: "unset", width: 100, fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxt }}
            />
          </div>
          {/* Mode toggle (Tiles / Areas) */}
          <div style={{
            display: "inline-flex", alignItems: "center", borderRadius: 4,
            border: `1px solid ${theme.panelBorder}`, height: 26, overflow: "hidden",
          }}>
            {(["tiles", "areas"] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  all: "unset", cursor: "pointer",
                  padding: "0 10px", height: 24, fontSize: 12, fontFamily: theme.fontUI,
                  background: mode === m ? theme.accent : "transparent",
                  color: mode === m ? "#fff" : theme.panelTxt,
                }}
              >
                {m === "tiles" ? "Tiles" : "Areas"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => {
              const serializedAreas: Record<string, TilemapArea> = {};
              for (const [name, cells] of Object.entries(areas)) {
                serializedAreas[name] = { cells: areaCellsToList(cells) };
              }
              onSave(mapName.trim() || "level1", { layers, areas: serializedAreas });
            }}
            style={{
              all: "unset", cursor: "pointer", padding: "4px 10px",
              background: theme.runBg, color: theme.runTxt, borderRadius: 4,
              fontWeight: 600, fontSize: 12,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <Icon name="check" size={12} color="currentColor" />
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: "unset", cursor: "pointer", width: 26, height: 26, borderRadius: 4,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: theme.panelTxtMute,
            }}
          >
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
            {toolDefs.map(td => (
              <button key={td.id} type="button" title={td.label}
                onClick={() => setTool(td.id)}
                style={sideBtn(tool === td.id)}>
                <Icon name={td.icon} size={17} color="currentColor" />
              </button>
            ))}
            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            <button type="button" title="Undo (Ctrl+Z)" onClick={undo} disabled={historyIdx < 0}
              style={sideBtn(false, historyIdx < 0)}>
              <Icon name="undo" size={16} color="currentColor" />
            </button>
            <button type="button" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={historyIdx >= history.length - 1}
              style={sideBtn(false, historyIdx >= history.length - 1)}>
              <Icon name="redo" size={16} color="currentColor" />
            </button>
            <div style={{ height: 1, background: theme.panelBorder, margin: "6px 0", width: 28 }} />
            <button type="button" title="Reset view"
              onClick={() => setPan({ x: stageSize.w / 2, y: stageSize.h / 2 })}
              style={sideBtn()}>
              <Icon name="frame" size={16} color="currentColor" />
            </button>
          </div>

          {/* Canvas */}
          <div
            ref={containerRef}
            style={{ flex: 1, overflow: "hidden", cursor }}
            onContextMenu={e => e.preventDefault()}
          >
            <Stage
              ref={stageRef}
              width={stageSize.w}
              height={stageSize.h}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onMouseLeave={handleStageMouseLeave}
              onContextMenu={handleContextMenu}
            >
              <Layer>
                <KRect x={0} y={0} width={stageSize.w} height={stageSize.h} fill={theme.surface} listening={false} />

                {layers.map((layer, li) => {
                  if (layerVis[li] === false) return null;
                  const isActive = li === activeLayerIdx;
                  const opacity = isActive ? 1 : 0.35;
                  const lts = layer.tileSize;
                  return Object.entries(layer.cells).flatMap(([colStr, rows]) => {
                    const col = Number(colStr);
                    const sx = pan.x + col * lts;
                    if (sx + lts < 0 || sx > stageSize.w) return [];
                    return Object.entries(rows).map(([rowStr, spriteName]) => {
                      const row = Number(rowStr);
                      const sy = pan.y + row * lts;
                      if (sy + lts < 0 || sy > stageSize.h) return null;
                      const img = spriteImages[spriteName];
                      if (img) {
                        return (
                          <KImage
                            key={`${li}-${col}-${row}`}
                            image={img}
                            x={sx} y={sy} width={lts} height={lts}
                            opacity={opacity}
                            listening={false}
                          />
                        );
                      }
                      return (
                        <KRect
                          key={`${li}-${col}-${row}`}
                          x={sx} y={sy} width={lts} height={lts}
                          fill="rgba(99,102,241,0.4)" stroke="rgba(99,102,241,0.7)" strokeWidth={1}
                          opacity={opacity}
                          listening={false}
                        />
                      );
                    }).filter(Boolean);
                  });
                })}

                {gridLines}

                {/* Area overlays — visible in both modes, more saturated for the active area */}
                {Object.entries(areas).flatMap(([name, cells]) => {
                  const active = mode === "areas" && name === activeAreaName;
                  const c = areaColor(name);
                  const baseOpacity = active ? 1 : mode === "areas" ? 0.4 : 0.5;
                  return Object.entries(cells).flatMap(([colStr, rows]) => {
                    const col = Number(colStr);
                    const sx = pan.x + col * ts;
                    if (sx + ts < 0 || sx > stageSize.w) return [];
                    return Object.keys(rows).map(rowStr => {
                      const row = Number(rowStr);
                      const sy = pan.y + row * ts;
                      if (sy + ts < 0 || sy > stageSize.h) return null;
                      return (
                        <KRect
                          key={`area-${name}-${col}-${row}`}
                          x={sx} y={sy} width={ts} height={ts}
                          fill={c.fill}
                          stroke={active ? c.stroke : undefined}
                          strokeWidth={active ? 1 : 0}
                          opacity={baseOpacity}
                          listening={false}
                        />
                      );
                    }).filter(Boolean);
                  });
                })}

                {ghostCell && mode === "areas" && activeAreaName && tool === "paint" && (() => {
                  const c = areaColor(activeAreaName);
                  return (
                    <KRect
                      x={pan.x + ghostCell.col * ts} y={pan.y + ghostCell.row * ts}
                      width={ts} height={ts}
                      fill={c.fill} stroke={c.stroke} strokeWidth={1}
                      opacity={0.6}
                      listening={false}
                    />
                  );
                })()}

                {ghostCell && mode === "tiles" && activeSprite && tool === "paint" && (() => {
                  const img = spriteImages[activeSprite];
                  const gx = pan.x + ghostCell.col * ts;
                  const gy = pan.y + ghostCell.row * ts;
                  if (img) return <KImage image={img} x={gx} y={gy} width={ts} height={ts} opacity={0.5} listening={false} />;
                  return <KRect x={gx} y={gy} width={ts} height={ts} fill="rgba(99,102,241,0.3)" listening={false} />;
                })()}
                {ghostCell && tool === "erase" && (
                  <KRect
                    x={pan.x + ghostCell.col * ts} y={pan.y + ghostCell.row * ts}
                    width={ts} height={ts}
                    fill="rgba(239,68,68,0.3)" stroke="rgba(239,68,68,0.7)" strokeWidth={1}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          </div>

          {/* Right panel — layers + sprites */}
          <div style={{
            width: 200, flexShrink: 0,
            borderLeft: `1px solid ${theme.panelBorder}`,
            background: theme.chip,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Layers */}
            <div style={{
              padding: "8px 10px 6px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: `1px solid ${theme.panelBorder}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>Layers</span>
              <button
                type="button"
                title="Add layer"
                onClick={() => {
                  const newLayer: TilemapLayer = { name: `layer${layers.length + 1}`, tileSize: 32, cells: {} };
                  setLayers(prev => [...prev, newLayer]);
                  setActiveLayerIdx(layers.length);
                }}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", color: theme.panelTxtMute }}
              >
                <Icon name="plus" size={13} color="currentColor" />
              </button>
            </div>
            <div style={{ flex: "0 0 auto", maxHeight: 210, overflowY: "auto" }}>
              {layers.map((layer, i) => {
                const isActive = i === activeLayerIdx;
                const visible = layerVis[i] !== false;
                return (
                  <div
                    key={i}
                    onClick={() => setActiveLayerIdx(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", cursor: "pointer",
                      background: isActive ? theme.railActiveBg : "transparent",
                      borderLeft: isActive ? `3px solid ${theme.accent}` : "3px solid transparent",
                    }}
                  >
                    <button
                      type="button"
                      style={{ all: "unset", cursor: "pointer", color: visible ? theme.panelTxt : theme.panelTxtMute, display: "flex" }}
                      onClick={e => { e.stopPropagation(); setLayerVis(v => ({ ...v, [i]: !visible })); }}
                    >
                      <Icon name="eye" size={13} color="currentColor" />
                    </button>
                    {editingLayerName === i ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => {
                          if (renameValue.trim()) setLayers(prev => prev.map((l, li) => li === i ? { ...l, name: renameValue.trim() } : l));
                          setEditingLayerName(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") { setEditingLayerName(null); }
                        }}
                        style={{ flex: 1, fontSize: 12, fontFamily: theme.fontUI, background: theme.surface, color: theme.panelTxt, border: "none", outline: "none", minWidth: 0 }}
                      />
                    ) : (
                      <span
                        style={{ flex: 1, fontSize: 12, fontFamily: theme.fontUI, color: theme.panelTxt, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onDoubleClick={() => { setEditingLayerName(i); setRenameValue(layer.name); }}
                      >
                        {layer.name}
                      </span>
                    )}
                    <select
                      value={layer.tileSize}
                      onChange={e => {
                        const sz = Number(e.target.value);
                        setLayers(prev => prev.map((l, li) => li === i ? { ...l, tileSize: sz } : l));
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 10, fontFamily: theme.fontUI, background: theme.surface, color: theme.panelTxtMute, border: "none", outline: "none", cursor: "pointer" }}
                    >
                      {TILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                    </select>
                    {layers.length > 1 && (
                      <button
                        type="button"
                        style={{ all: "unset", cursor: "pointer", color: "#ef4444", display: "flex" }}
                        onClick={e => {
                          e.stopPropagation();
                          setLayers(prev => prev.filter((_, li) => li !== i));
                          setActiveLayerIdx(a => Math.min(a, layers.length - 2));
                        }}
                      >
                        <Icon name="close" size={11} color="currentColor" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {mode === "tiles" ? (
              <>
                {/* Sprites */}
                <div style={{
                  padding: "8px 10px 6px",
                  borderTop: `1px solid ${theme.panelBorder}`,
                  borderBottom: `1px solid ${theme.panelBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>Sprites</span>
                  {onNewSprite && (
                    <button
                      type="button"
                      title="New sprite"
                      onClick={onNewSprite}
                      style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", color: theme.panelTxtMute }}
                    >
                      <Icon name="plus" size={13} color="currentColor" />
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px 8px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    {Object.entries(allSprites).map(([name, url]) => {
                      const img = spriteImages[name];
                      const isSelected = activeSprite === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          title={name}
                          onClick={() => { setActiveSprite(name); setTool("paint"); }}
                          style={{
                            all: "unset", cursor: "pointer", aspectRatio: "1/1",
                            borderRadius: 4, overflow: "hidden",
                            boxShadow: isSelected ? `0 0 0 2px ${theme.accent}` : `0 0 0 1px ${theme.panelBorder}`,
                            background: theme.surface,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {img
                            ? <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            : <span style={{ fontSize: 8, fontFamily: theme.fontUI, color: theme.panelTxtMute }}>{name.slice(0, 4)}</span>
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Areas */}
                <div style={{
                  padding: "8px 10px 6px",
                  borderTop: `1px solid ${theme.panelBorder}`,
                  borderBottom: `1px solid ${theme.panelBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>Areas</span>
                  <button
                    type="button"
                    title="Add area"
                    onClick={() => {
                      const raw = window.prompt("Area name (snake_case, e.g. floor, boss_arena):");
                      if (!raw) return;
                      const name = raw.trim();
                      if (!AREA_NAME_RE.test(name)) {
                        window.alert("Invalid name. Use lowercase letters, digits, and underscores; must start with a letter.");
                        return;
                      }
                      if (areas[name]) {
                        window.alert(`Area "${name}" already exists.`);
                        return;
                      }
                      setAreas(prev => ({ ...prev, [name]: {} }));
                      setActiveAreaName(name);
                    }}
                    style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", color: theme.panelTxtMute }}
                  >
                    <Icon name="plus" size={13} color="currentColor" />
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {Object.keys(areas).length === 0 && (
                    <div style={{ padding: "12px 10px", fontSize: 11, color: theme.panelTxtMute, lineHeight: 1.5 }}>
                      No areas yet. Click + to create one, then brush cells onto it. Access in Python as <code style={{ fontFamily: theme.fontMono }}>level.areas.&lt;name&gt;</code>.
                    </div>
                  )}
                  {Object.keys(areas).map(name => {
                    const isActive = name === activeAreaName;
                    const c = areaColor(name);
                    const count = Object.values(areas[name] ?? {}).reduce((acc, rows) => acc + Object.keys(rows).length, 0);
                    return (
                      <div
                        key={name}
                        onClick={() => setActiveAreaName(name)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", cursor: "pointer",
                          background: isActive ? theme.railActiveBg : "transparent",
                          borderLeft: isActive ? `3px solid ${theme.accent}` : "3px solid transparent",
                        }}
                      >
                        <div style={{
                          width: 12, height: 12, borderRadius: 3,
                          background: c.fill, border: `1px solid ${c.stroke}`, flexShrink: 0,
                        }} />
                        {editingAreaName === name ? (
                          <input
                            autoFocus
                            value={renameAreaValue}
                            onChange={e => setRenameAreaValue(e.target.value)}
                            onBlur={() => {
                              const next = renameAreaValue.trim();
                              if (!next || next === name) { setEditingAreaName(null); return; }
                              if (!AREA_NAME_RE.test(next)) { window.alert("Invalid name."); setEditingAreaName(null); return; }
                              if (areas[next]) { window.alert(`Area "${next}" already exists.`); setEditingAreaName(null); return; }
                              setAreas(prev => {
                                const out: Record<string, AreaCells> = {};
                                for (const [k, v] of Object.entries(prev)) out[k === name ? next : k] = v;
                                return out;
                              });
                              if (activeAreaName === name) setActiveAreaName(next);
                              setEditingAreaName(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingAreaName(null);
                            }}
                            style={{ flex: 1, fontSize: 12, fontFamily: theme.fontMono, background: theme.surface, color: theme.panelTxt, border: "none", outline: "none", minWidth: 0 }}
                          />
                        ) : (
                          <span
                            style={{ flex: 1, fontSize: 12, fontFamily: theme.fontMono, color: theme.panelTxt, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            onDoubleClick={() => { setEditingAreaName(name); setRenameAreaValue(name); }}
                          >
                            {name}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: theme.panelTxtMute, fontFamily: theme.fontMono }}>{count}</span>
                        <button
                          type="button"
                          title="Delete area"
                          style={{ all: "unset", cursor: "pointer", color: "#ef4444", display: "flex" }}
                          onClick={e => {
                            e.stopPropagation();
                            if (!window.confirm(`Delete area "${name}"?`)) return;
                            setAreas(prev => {
                              const out = { ...prev };
                              delete out[name];
                              return out;
                            });
                            if (activeAreaName === name) setActiveAreaName(null);
                          }}
                        >
                          <Icon name="close" size={11} color="currentColor" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
