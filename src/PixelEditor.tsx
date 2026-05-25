import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { AnimationData } from "./state/IdeState";
import { useThemeStore, type Theme } from "./state/useTheme";

// ── Types ──────────────────────────────────
type Layer = { id: string; name: string; visible: boolean; opacity: number };
type Tool = "pencil" | "eraser" | "fill" | "eyedropper" | "darken" | "lighten";

// Must match graphics._SHADE_STEP — one editor brush stroke equals one
// `darker(c, 1)` / `lighter(c, 1)` in Python so kids see the same shading
// from both sides.
const SHADE_STEP = 0.13;
type PaletteName = "sweetie16" | "pico8";

const PALETTES: Record<PaletteName, string[]> = {
  sweetie16: [
    "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179",
    "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
  ],
  pico8: [
    "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
    "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa",
  ],
};

type PixelEditorProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, dataUrl: string) => void;
  onSaveAnimation?: (name: string, data: AnimationData) => void;
  size?: 16 | 32;
  initialName?: string;
  initialDataUrl?: string;
  initialAnimation?: AnimationData;
};

const emptyBuf = (size: number) => new Uint8ClampedArray(size * size * 4).fill(0);
const hexToRgb = (hex: string): [number, number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
};
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function PixelEditor({
  open,
  onClose,
  onSave,
  onSaveAnimation,
  size = 32,
  initialName,
  initialDataUrl,
  initialAnimation,
}: PixelEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const isAnimMode = !!(initialAnimation || onSaveAnimation);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  // Data model: frameData[frameIdx][layerIdx] = Uint8ClampedArray
  const [gridSize, setGridSize] = useState<16 | 32>(size);
  const [frameData, setFrameData] = useState<Uint8ClampedArray[][]>(() => [[emptyBuf(gridSize)]]);
  const [layers, setLayers] = useState<Layer[]>([{ id: "l0", name: "Layer 1", visible: true, opacity: 1 }]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [fps, setFps] = useState(initialAnimation?.fps ?? 8);

  const [history, setHistory] = useState<Uint8ClampedArray[][]>([]);
  const [future, setFuture] = useState<Uint8ClampedArray[][]>([]);

  const [spriteName, setSpriteName] = useState(initialName || "sprite");
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#f4f4f4");
  const [opacity, setOpacity] = useState(1);
  const [palette, setPalette] = useState<PaletteName>("sweetie16");
  const [showGridSize, setShowGridSize] = useState(!initialName);
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const [onionSkin, setOnionSkin] = useState(false);
  // Zoom: 1 = base 480px display; 2 = 960px; etc. Lives between 0.5 and 8.
  // Pan happens through the surrounding scroll container.
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIdx, setPlaybackIdx] = useState(0);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Composite visible layers for display
  const composite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Fill entire canvas with white first
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, gridSize, gridSize);

    // Create buffer starting with white background
    const buf = new Uint8ClampedArray(gridSize * gridSize * 4);
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 255;     // R: white
      buf[i + 1] = 255; // G
      buf[i + 2] = 255; // B
      buf[i + 3] = 255; // A: fully opaque
    }

    // Composite all visible layer pixels on top
    for (let li = 0; li < layers.length; li++) {
      if (!layers[li].visible) continue;
      const src = frameData[frameIdx][li];
      if (!src) continue;
      for (let i = 0; i < buf.length; i += 4) {
        if (src[i + 3] > 0) {
          buf[i] = src[i];
          buf[i + 1] = src[i + 1];
          buf[i + 2] = src[i + 2];
          buf[i + 3] = src[i + 3];
        }
      }
    }

    ctx.putImageData(new ImageData(buf, gridSize, gridSize), 0, 0);

    // Onion skin: previous frame at 30% opacity
    if (onionSkin && frameIdx > 0) {
      ctx.globalAlpha = 0.3;
      const prevBuf = new Uint8ClampedArray(gridSize * gridSize * 4);
      for (let li = 0; li < layers.length; li++) {
        if (!layers[li].visible) continue;
        const src = frameData[frameIdx - 1][li];
        if (!src) continue;
        for (let i = 0; i < prevBuf.length; i += 4) {
          prevBuf[i] = Math.max(prevBuf[i], src[i]);
          prevBuf[i + 1] = Math.max(prevBuf[i + 1], src[i + 1]);
          prevBuf[i + 2] = Math.max(prevBuf[i + 2], src[i + 2]);
          prevBuf[i + 3] = Math.max(prevBuf[i + 3], src[i + 3]);
        }
      }
      ctx.putImageData(new ImageData(prevBuf, gridSize, gridSize), 0, 0);
      ctx.globalAlpha = 1;
    }
  }, [frameIdx, layers, frameData, gridSize, onionSkin]);

  // Draw grid lines on overlay canvas (sharp, no blending)
  const drawGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Clear with transparent background
    ctx.clearRect(0, 0, gridSize, gridSize);

    // Calculate pixel size in canvas coordinates (grid is always at native resolution)
    // Canvas is displayed at a fixed 480x480 size via CSS, regardless of gridSize
    const pixelSize = 480 / gridSize;

    // Draw sharp grid lines at scaled coordinates
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;

    for (let i = 1; i < gridSize; i++) {
      const pos = i * pixelSize;

      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 480);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(480, pos);
      ctx.stroke();
    }
  }, [gridSize]);


  // Commit pixel change to undo stack
  const commitPixels = useCallback((newPixels: Uint8ClampedArray[]) => {
    const prev = frameData[frameIdx].slice();
    setHistory(h => [...h, prev]);
    setFuture([]);
    const newFrame = [...frameData];
    newFrame[frameIdx] = newPixels;
    setFrameData(newFrame);
  }, [frameData, frameIdx]);

  // Draw pixel (with opacity blend)
  const drawPixel = (buf: Uint8ClampedArray, x: number, y: number, [r, g, b, a]: ReturnType<typeof hexToRgb>) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    const [br, bg, bb, ba] = [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
    const out = opacity;
    buf[i] = Math.round(lerp(br, r, out));
    buf[i + 1] = Math.round(lerp(bg, g, out));
    buf[i + 2] = Math.round(lerp(bb, b, out));
    buf[i + 3] = Math.round(lerp(ba, a, out));
  };

  // Shade brush — lerp the existing pixel toward black (dir=-1) or white (dir=+1).
  // No-op on transparent pixels (keep the kid from "lightening" empty space).
  const shadePixel = (buf: Uint8ClampedArray, x: number, y: number, dir: 1 | -1) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    if (buf[i + 3] === 0) return;
    const target = dir === 1 ? 255 : 0;
    buf[i] = Math.round(lerp(buf[i], target, SHADE_STEP));
    buf[i + 1] = Math.round(lerp(buf[i + 1], target, SHADE_STEP));
    buf[i + 2] = Math.round(lerp(buf[i + 2], target, SHADE_STEP));
  };

  const erasePixel = (buf: Uint8ClampedArray, x: number, y: number) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
  };

  // Flood fill
  const floodFill = (buf: Uint8ClampedArray, x: number, y: number, newColor: ReturnType<typeof hexToRgb>) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    const [or, og, ob, oa] = [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
    if (or === newColor[0] && og === newColor[1] && ob === newColor[2] && oa === newColor[3]) return;

    const queue: [number, number][] = [[x, y]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (cx < 0 || cx >= gridSize || cy < 0 || cy >= gridSize) continue;
      const ci = (cy * gridSize + cx) * 4;
      if (buf[ci] !== or || buf[ci + 1] !== og || buf[ci + 2] !== ob || buf[ci + 3] !== oa) continue;

      drawPixel(buf, cx, cy, newColor);
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  };


  // Add/duplicate frame
  const addFrame = () => {
    const newFrame = layers.map(() => emptyBuf(gridSize));
    setFrameData(f => [...f, newFrame]);
    setFrameIdx(frameData.length);
  };

  const duplicateFrame = () => {
    const newFrame = frameData[frameIdx].map(buf => new Uint8ClampedArray(buf));
    setFrameData(f => [...f.slice(0, frameIdx + 1), newFrame, ...f.slice(frameIdx + 1)]);
  };

  // Layer ops
  const addLayer = () => {
    const newLayers = [...layers];
    newLayers.splice(activeLayer, 0, { id: `l${Date.now()}`, name: `Layer ${newLayers.length + 1}`, visible: true, opacity: 1 });
    setLayers(newLayers);
    const newFrame = frameData.map(f => {
      const arr = [...f];
      arr.splice(activeLayer, 0, emptyBuf(gridSize));
      return arr;
    });
    setFrameData(newFrame);
  };

  const deleteLayer = () => {
    if (layers.length === 1) return;
    const newLayers = layers.filter((_, i) => i !== activeLayer);
    setLayers(newLayers);
    const newFrame = frameData.map(f => f.filter((_, i) => i !== activeLayer));
    setFrameData(newFrame);
    setActiveLayer(Math.min(activeLayer, newLayers.length - 1));
  };

  // Undo/redo
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [...f, frameData[frameIdx]]);
    const newFrame = frameData.map((f, i) => (i === frameIdx ? prev : f));
    setFrameData(newFrame);
    setHistory(h => h.slice(0, -1));
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setHistory(h => [...h, frameData[frameIdx]]);
    const newFrame = frameData.map((f, i) => (i === frameIdx ? next : f));
    setFrameData(newFrame);
    setFuture(f => f.slice(0, -1));
  };

  // Export PNG
  const exportFrame = async (frameIdxToExport: number) => {
    const out = new OffscreenCanvas(128, 128);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Composite frame (layers overwrite, no blending)
    const buf = new Uint8ClampedArray(gridSize * gridSize * 4);
    for (let li = 0; li < layers.length; li++) {
      if (!layers[li].visible) continue;
      const src = frameData[frameIdxToExport][li];
      if (!src) continue;
      for (let i = 0; i < buf.length; i += 4) {
        buf[i] = src[i];
        buf[i + 1] = src[i + 1];
        buf[i + 2] = src[i + 2];
        buf[i + 3] = src[i + 3];
      }
    }
    const imgData = new ImageData(buf, gridSize, gridSize);

    // Create temp canvas at pixel size, then scale up to 128x128 with nearest-neighbor
    const tmp = new OffscreenCanvas(gridSize, gridSize);
    const tmpCtx = tmp.getContext("2d")!;
    tmpCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(tmp, 0, 0, gridSize, gridSize, 0, 0, 128, 128);

    const blob = await out.convertToBlob({ type: "image/png" });
    return new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const handleSave = async () => {
    if (isAnimMode && onSaveAnimation) {
      const frames = await Promise.all(frameData.map((_, i) => exportFrame(i)));
      onSaveAnimation(spriteName, { frames, fps });
    } else {
      const dataUrl = await exportFrame(0);
      onSave(spriteName, dataUrl);
    }
    onClose();
  };

  // Canvas mouse event listeners (native, not synthetic)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (tool === "eyedropper") return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / gridSize));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / gridSize));

      const newBuf = new Uint8ClampedArray(frameData[frameIdx][activeLayer]);
      const rgb = hexToRgb(color);

      if (tool === "pencil") {
        drawPixel(newBuf, x, y, rgb);
      } else if (tool === "eraser") {
        erasePixel(newBuf, x, y);
      } else if (tool === "fill") {
        floodFill(newBuf, x, y, rgb);
      } else if (tool === "darken") {
        shadePixel(newBuf, x, y, -1);
      } else if (tool === "lighten") {
        shadePixel(newBuf, x, y, 1);
      }

      commitPixels([...frameData[frameIdx].map((l, i) => (i === activeLayer ? newBuf : l))]);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if ((e.buttons & 1) === 0 || tool === "fill" || tool === "eyedropper") return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / gridSize));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / gridSize));

      const buf = new Uint8ClampedArray(frameData[frameIdx][activeLayer]);
      const rgb = hexToRgb(color);

      if (tool === "pencil") {
        drawPixel(buf, x, y, rgb);
      } else if (tool === "eraser") {
        erasePixel(buf, x, y);
      } else if (tool === "darken") {
        shadePixel(buf, x, y, -1);
      } else if (tool === "lighten") {
        shadePixel(buf, x, y, 1);
      }

      const newFrame = frameData[frameIdx].map((l, i) => (i === activeLayer ? buf : l));
      const newFrameData = frameData.map((f, i) => (i === frameIdx ? newFrame : f));
      setFrameData(newFrameData);
    };

    const handleClick = (e: MouseEvent) => {
      if (tool !== "eyedropper") return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / gridSize));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / gridSize));

      const buf = frameData[frameIdx][activeLayer];
      const i = (y * gridSize + x) * 4;
      const [r, g, b] = [buf[i], buf[i + 1], buf[i + 2]];
      setColor(rgbToHex(r, g, b));
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [tool, frameData, frameIdx, activeLayer, color, gridSize, commitPixels, drawPixel, erasePixel, floodFill, hexToRgb]);

  // Playback
  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      return;
    }
    playIntervalRef.current = setInterval(() => {
      setPlaybackIdx(i => (i + 1) % frameData.length);
    }, (1000 / fps));
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, fps, frameData.length]);

  // Composite on changes
  useEffect(() => {
    composite();
    drawGrid();
  }, [frameIdx, frameData, layers, composite, drawGrid]);

  if (!open) return null;

  const palColors = PALETTES[palette];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)",
    }} onClick={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16, background: theme.surfacePanel, borderRadius: 8, maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <input
            type="text"
            value={spriteName}
            onChange={(e) => setSpriteName(e.target.value)}
            style={{ background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 4, padding: "6px 8px", fontSize: 13, color: theme.panelTxt, fontFamily: theme.fontMono }}
            placeholder="sprite name"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${theme.panelBorder}`, borderRadius: 4, color: theme.panelTxt, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} style={{ padding: "6px 12px", background: theme.accent, border: "none", borderRadius: 4, color: theme.runTxt, cursor: "pointer", fontWeight: 500 }}>
              Save
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {/* Main canvas area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Grid size selector (on first open) */}
            {showGridSize && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5 }}>Grid Size:</label>
                <button
                  onClick={() => { setGridSize(16); setShowGridSize(false); }}
                  style={{ padding: "4px 8px", fontSize: 11, background: theme.accent, color: theme.runTxt, border: "none", borderRadius: 3, cursor: "pointer" }}>
                  16×16
                </button>
                <button
                  onClick={() => { setGridSize(32); setShowGridSize(false); }}
                  style={{ padding: "4px 8px", fontSize: 11, background: theme.accent, color: theme.runTxt, border: "none", borderRadius: 3, cursor: "pointer" }}>
                  32×32
                </button>
              </div>
            )}

            {/* Zoom toolbar */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: theme.panelTxtMute }}>
              <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Zoom:</span>
              {([0.5, 1, 2, 4] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 11,
                    background: zoom === z ? theme.accent : theme.surfacePanel,
                    color: zoom === z ? theme.runTxt : theme.panelTxt,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {z * 100}%
                </button>
              ))}
            </div>

            {/* Canvas container — scrolls when zoomed in. */}
            <div
              style={{
                position: "relative",
                width: 480,
                height: 480,
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: 4,
                background: "#ffffff",
                overflow: "auto",
              }}
            >
              <div style={{ position: "relative", width: 480 * zoom, height: 480 * zoom }}>
                <canvas
                  ref={canvasRef}
                  width={gridSize}
                  height={gridSize}
                  style={{ position: "absolute", width: "100%", height: "100%", cursor: tool === "eyedropper" ? "crosshair" : "default", imageRendering: "pixelated", backgroundColor: "#ffffff" }}
                />
                <canvas
                  ref={gridCanvasRef}
                  width={480}
                  height={480}
                  style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none", imageRendering: "pixelated" }}
                />
              </div>
            </div>

            {/* Frame strip (animation) */}
            {isAnimMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "4px", background: theme.surfacePanel, borderRadius: 4 }}>
                  {frameData.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFrameIdx(i)}
                      style={{
                        width: 48, height: 48, padding: 2, border: `2px solid ${frameIdx === i ? theme.accent : theme.panelBorder}`, borderRadius: 3,
                        background: theme.runTxt, cursor: "pointer", flexShrink: 0,
                      }}>
                      <canvas
                        width={gridSize}
                        height={gridSize}
                        ref={(c) => {
                          if (c && frameData[i]) {
                            const ctx = c.getContext("2d")!;
                            const buf = new Uint8ClampedArray(gridSize * gridSize * 4);
                            for (let li = 0; li < layers.length; li++) {
                              if (!layers[li].visible) continue;
                              const src = frameData[i][li];
                              if (!src) continue;
                              for (let j = 0; j < buf.length; j += 4) {
                                buf[j] = Math.max(buf[j], src[j]);
                                buf[j + 1] = Math.max(buf[j + 1], src[j + 1]);
                                buf[j + 2] = Math.max(buf[j + 2], src[j + 2]);
                                buf[j + 3] = Math.max(buf[j + 3], src[j + 3]);
                              }
                            }
                            ctx.putImageData(new ImageData(buf, gridSize, gridSize), 0, 0);
                          }
                        }}
                        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
                      />
                    </button>
                  ))}
                  <button onClick={addFrame} style={{ width: 48, height: 48, padding: 2, border: `2px solid ${theme.panelBorder}`, borderRadius: 3, background: theme.surfacePanel, cursor: "pointer", fontSize: 18, color: theme.panelTxt }}>
                    +
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: "4px 8px", background: isPlaying ? theme.accent : theme.surfacePanel, color: isPlaying ? theme.runTxt : theme.panelTxt, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: "pointer", fontSize: 11 }}>
                    {isPlaying ? "Stop" : "Play"}
                  </button>
                  <button onClick={() => setOnionSkin(!onionSkin)} style={{ padding: "4px 8px", background: onionSkin ? theme.accent : theme.surfacePanel, color: onionSkin ? theme.runTxt : theme.panelTxt, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: "pointer", fontSize: 11 }}>
                    Onion
                  </button>
                  <label style={{ fontSize: 11, color: theme.panelTxtMute }}>FPS: <input type="number" min={1} max={24} value={fps} onChange={(e) => setFps(parseInt(e.target.value) || 8)} style={{ width: 40, padding: "2px 4px", fontSize: 11, background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 3 }} /></label>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ width: 160, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Tools */}
            <div>
              <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Tools</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
                {(["pencil", "eraser", "fill", "eyedropper", "darken", "lighten"] as Tool[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    style={{
                      padding: "6px 8px", fontSize: 11, background: tool === t ? theme.accent : theme.surfacePanel,
                      color: tool === t ? theme.runTxt : theme.panelTxt, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: "pointer", textTransform: "capitalize",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Color & Opacity */}
            <div>
              <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Color</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, background: color, border: `2px solid ${theme.panelBorder}`, borderRadius: 4 }} />
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ flex: 1, height: 32, cursor: "pointer", border: `1px solid ${theme.panelBorder}`, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: theme.panelTxtMute, marginBottom: 4 }}>Opacity: {Math.round(opacity * 100)}%</div>
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} style={{ width: "100%", accentColor: theme.accent }} />
            </div>

            {/* Palette */}
            <div>
              <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Palette</div>
              <select value={palette} onChange={(e) => setPalette(e.target.value as PaletteName)} style={{ width: "100%", padding: "4px 6px", fontSize: 11, background: theme.surfacePanel, color: theme.panelTxt, border: `1px solid ${theme.panelBorder}`, borderRadius: 3 }}>
                <option value="sweetie16">Sweetie 16</option>
                <option value="pico8">PICO-8</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginTop: 6 }}>
                {palColors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setColor(c)}
                    style={{ width: "100%", aspectRatio: 1, background: c, border: color === c ? `2px solid ${theme.accent}` : "1px solid rgba(0,0,0,0.3)", borderRadius: 3, cursor: "pointer" }} />
                ))}
              </div>
            </div>

            {/* Layers */}
            <div>
              <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Layers</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 180, overflowY: "auto" }}>
                {layers.map((layer, i) => (
                  <div key={layer.id} onClick={() => setActiveLayer(i)} style={{ padding: "6px", background: activeLayer === i ? theme.accent : theme.surfacePanel, borderRadius: 3, cursor: "pointer", display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: activeLayer === i ? theme.runTxt : theme.panelTxt }}>
                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map((l, j) => j === i ? { ...l, visible: !l.visible } : l)); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontSize: 12 }}>
                      {layer.visible ? "👁" : "✕"}
                    </button>
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{layer.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                <button onClick={addLayer} style={{ flex: 1, padding: "4px", fontSize: 11, background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: "pointer", color: theme.panelTxt }}>
                  +
                </button>
                <button onClick={deleteLayer} disabled={layers.length === 1} style={{ flex: 1, padding: "4px", fontSize: 11, background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: layers.length === 1 ? "not-allowed" : "pointer", color: theme.panelTxt, opacity: layers.length === 1 ? 0.5 : 1 }}>
                  −
                </button>
              </div>
            </div>

            {/* Undo/Redo */}
            <div style={{ display: "flex", gap: 3 }}>
              <button onClick={undo} disabled={history.length === 0} style={{ flex: 1, padding: "4px", fontSize: 11, background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: history.length === 0 ? "not-allowed" : "pointer", color: theme.panelTxt, opacity: history.length === 0 ? 0.5 : 1 }}>
                Undo
              </button>
              <button onClick={redo} disabled={future.length === 0} style={{ flex: 1, padding: "4px", fontSize: 11, background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, cursor: future.length === 0 ? "not-allowed" : "pointer", color: theme.panelTxt, opacity: future.length === 0 ? 0.5 : 1 }}>
                Redo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
