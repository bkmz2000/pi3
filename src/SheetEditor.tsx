import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useEditor } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import type { SheetData, SheetSprites } from "./state/IdeState";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHEET_W = 512;
const SHEET_H = 512;
const SHADE_STEP = 0.13;

const PALETTE = [
  "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57",
  "#ffcd75", "#a7f070", "#38b764", "#257179",
  "#29366f", "#3b5dc9", "#41a6f6", "#73eff7",
  "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
];

const ACTOR_RESERVED = new Set([
  "x","y","angle","vx","vy","pos","vel","visible","collidable","image",
  "scale","flip_x","flip_y","collider","center","top","bottom","left",
  "right","top_left","top_right","bottom_left","bottom_right",
  "update","draw","die","is_alive","collides_with","collides_any",
  "future_state","move","move_to","change_x_by","change_y_by",
  "point_towards","rotate","random_position","wrap","wrap_x","wrap_y","in_bounds",
]);

type Tool = "pencil" | "eraser" | "fill" | "darken" | "lighten" | "region";
type SelectedFrame = { sprite: string; anim: string; idx: number };
type RegionDrag = { sx: number; sy: number; ex: number; ey: number };

// ── Pixel helpers ─────────────────────────────────────────────────────────────

function decodePixels(pixels: string): Uint8ClampedArray {
  const raw = atob(pixels);
  const buf = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

function encodePixels(buf: Uint8ClampedArray): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function blankSheet(): SheetData {
  const buf = new Uint8ClampedArray(SHEET_W * SHEET_H * 4);
  return { pixels: encodePixels(buf), width: SHEET_W, height: SHEET_H, sprites: {} };
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), 255];
}

function lerpCh(a: number, b: number, t: number) {
  return Math.max(0, Math.min(255, Math.round(a + (b - a) * t)));
}

function applyTool(
  buf: Uint8ClampedArray, w: number, h: number,
  px: number, py: number,
  tool: Tool, color: string,
  clipRect: { x: number; y: number; w: number; h: number } | null,
) {
  const clip = clipRect;
  if (clip && (px < clip.x || py < clip.y || px >= clip.x + clip.w || py >= clip.y + clip.h)) return;
  if (px < 0 || py < 0 || px >= w || py >= h) return;

  if (tool === "fill") {
    // Flood fill
    const i0 = (py * w + px) * 4;
    const [tr, tg, tb, ta] = [buf[i0], buf[i0+1], buf[i0+2], buf[i0+3]];
    const [nr, ng, nb, na] = color === "eraser" ? [0,0,0,0] : hexToRgba(color);
    if (tr === nr && tg === ng && tb === nb && ta === na) return;
    const stack = [[px, py]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      if (clip && (cx < clip.x || cy < clip.y || cx >= clip.x + clip.w || cy >= clip.y + clip.h)) continue;
      const ci = (cy * w + cx) * 4;
      if (buf[ci] !== tr || buf[ci+1] !== tg || buf[ci+2] !== tb || buf[ci+3] !== ta) continue;
      buf[ci] = nr; buf[ci+1] = ng; buf[ci+2] = nb; buf[ci+3] = na;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
    return;
  }

  const idx = (py * w + px) * 4;
  if (tool === "eraser") {
    buf[idx] = buf[idx+1] = buf[idx+2] = buf[idx+3] = 0;
  } else if (tool === "pencil") {
    const [r,g,b,a] = hexToRgba(color);
    buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = a;
  } else if (tool === "darken") {
    if (buf[idx+3] === 0) return;
    buf[idx]   = lerpCh(buf[idx],   0x1a, SHADE_STEP);
    buf[idx+1] = lerpCh(buf[idx+1], 0x1c, SHADE_STEP);
    buf[idx+2] = lerpCh(buf[idx+2], 0x2c, SHADE_STEP);
  } else if (tool === "lighten") {
    if (buf[idx+3] === 0) return;
    buf[idx]   = lerpCh(buf[idx],   0xf4, SHADE_STEP);
    buf[idx+1] = lerpCh(buf[idx+1], 0xf4, SHADE_STEP);
    buf[idx+2] = lerpCh(buf[idx+2], 0xf4, SHADE_STEP);
  }
}

// ── Overlap detection ─────────────────────────────────────────────────────────

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function anyStripOverlaps(
  sprites: SheetSprites,
  x: number, y: number, w: number, h: number,
  excludeSprite?: string, excludeAnim?: string,
): boolean {
  for (const [sname, sentry] of Object.entries(sprites)) {
    for (const [aname, strip] of Object.entries(sentry.animations)) {
      if (sname === excludeSprite && aname === excludeAnim) continue;
      const sw = strip.frameW * strip.frameCount;
      if (rectsOverlap(x, y, w, h, strip.x, strip.y, sw, strip.frameH)) return true;
    }
  }
  return false;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SheetEditor({ onClose }: { onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const { project, setSheet } = useEditor((s) => ({ project: s.project, setSheet: s.setSheet }));

  // Initialize blank sheet if project has none
  useEffect(() => {
    if (!project.sheet) setSheet(blankSheet());
  }, [project.sheet, setSheet]);

  const sheet = project.sheet ?? blankSheet();

  // Local mutable pixel buffer — only encoded and saved on pointer-up
  const pixBuf = useRef<Uint8ClampedArray>(decodePixels(sheet.pixels));
  useEffect(() => {
    pixBuf.current = decodePixels(sheet.pixels);
  }, [sheet.pixels]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(2);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState(PALETTE[12]); // white default
  const [selectedFrame, setSelectedFrame] = useState<SelectedFrame | null>(null);
  const [painting, setPainting] = useState(false);
  const [regionDrag, setRegionDrag] = useState<RegionDrag | null>(null);
  const [pendingRegion, setPendingRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingNameError, setPendingNameError] = useState("");
  const [renamingSprite, setRenamingSprite] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [hoverTimer, setHoverTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [previewAnim, setPreviewAnim] = useState<{ sprite: string; anim: string; x: number; y: number } | null>(null);
  const [previewFrame, setPreviewFrame] = useState(0);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Canvas render ───────────────────────────────────────────────────────────

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Draw the sheet pixels via OffscreenCanvas for pixelated zoom
    const off = new OffscreenCanvas(SHEET_W, SHEET_H);
    const octx = off.getContext("2d")!;
    const copy = new Uint8ClampedArray(pixBuf.current.length);
    copy.set(pixBuf.current);
    const id = new ImageData(copy, SHEET_W, SHEET_H);
    octx.putImageData(id, 0, 0);
    ctx.drawImage(off, 0, 0, SHEET_W * zoom, SHEET_H * zoom);

    // Draw checkerboard background (show through transparency) — subtle
    // Actually skip: canvas bg color handles it

    // Draw selected frame highlight
    if (selectedFrame) {
      const sentry = sheet.sprites[selectedFrame.sprite];
      if (sentry) {
        const strip = sentry.animations[selectedFrame.anim];
        if (strip) {
          const fx = (strip.x + selectedFrame.idx * strip.frameW) * zoom;
          const fy = strip.y * zoom;
          const fw = strip.frameW * zoom;
          const fh = strip.frameH * zoom;
          ctx.strokeStyle = "#41a6f6";
          ctx.lineWidth = 2;
          ctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);
        }
      }
    }

    // Draw region drag preview
    if (regionDrag) {
      const x = Math.min(regionDrag.sx, regionDrag.ex) * zoom;
      const y = Math.min(regionDrag.sy, regionDrag.ey) * zoom;
      const w = Math.abs(regionDrag.ex - regionDrag.sx) * zoom;
      const h = Math.abs(regionDrag.ey - regionDrag.sy) * zoom;
      ctx.strokeStyle = "#ef7d57";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [zoom, sheet.sprites, selectedFrame, regionDrag]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ── Preview animation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!previewAnim) {
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
      return;
    }
    setPreviewFrame(0);
    previewIntervalRef.current = setInterval(() => {
      setPreviewFrame((f) => f + 1);
    }, 1000 / 8);
    return () => { if (previewIntervalRef.current) clearInterval(previewIntervalRef.current); };
  }, [previewAnim]);

  useEffect(() => {
    if (!previewAnim || !previewCanvasRef.current) return;
    const sentry = sheet.sprites[previewAnim.sprite];
    if (!sentry) return;
    const strip = sentry.animations[previewAnim.anim];
    if (!strip || strip.frameCount === 0) return;
    const fi = previewFrame % strip.frameCount;
    const fx = strip.x + fi * strip.frameW;
    const fy = strip.y;
    const { frameW: fw, frameH: fh } = strip;
    const canvas = previewCanvasRef.current;
    canvas.width = fw * 3;
    canvas.height = fh * 3;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const frameBuf = new Uint8ClampedArray(fw * fh * 4);
    for (let row = 0; row < fh; row++) {
      const dst = row * fw * 4;
      const src = ((fy + row) * SHEET_W + fx) * 4;
      frameBuf.set(pixBuf.current.subarray(src, src + fw * 4), dst);
    }
    const off = new OffscreenCanvas(fw, fh);
    const octx = off.getContext("2d")!;
    const previewCopy = new Uint8ClampedArray(frameBuf.length);
    previewCopy.set(frameBuf);
    octx.putImageData(new ImageData(previewCopy, fw, fh), 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, fw * 3, fh * 3);
  }, [previewAnim, previewFrame, sheet.sprites]);

  // ── Mouse → sheet coords ─────────────────────────────────────────────────────

  const canvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left) / zoom);
    const cy = Math.floor((e.clientY - rect.top) / zoom);
    return { x: Math.max(0, Math.min(SHEET_W - 1, cx)), y: Math.max(0, Math.min(SHEET_H - 1, cy)) };
  }, [zoom]);

  // ── Frame clip rect ──────────────────────────────────────────────────────────

  const clipRect = useMemo(() => {
    if (!selectedFrame) return null;
    const sentry = sheet.sprites[selectedFrame.sprite];
    if (!sentry) return null;
    const strip = sentry.animations[selectedFrame.anim];
    if (!strip) return null;
    return {
      x: strip.x + selectedFrame.idx * strip.frameW,
      y: strip.y,
      w: strip.frameW,
      h: strip.frameH,
    };
  }, [selectedFrame, sheet.sprites]);

  // ── Pointer event handlers ───────────────────────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const coords = canvasCoords(e as unknown as React.MouseEvent);
    if (!coords) return;

    if (tool === "region") {
      // Check if clicking on existing sprite header area (for renaming)
      // handled by sprite block overlays; here we start a drag
      setRegionDrag({ sx: coords.x, sy: coords.y, ex: coords.x, ey: coords.y });
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    setPainting(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    applyTool(pixBuf.current, SHEET_W, SHEET_H, coords.x, coords.y, tool, color, clipRect);
    renderCanvas();
  }, [tool, color, clipRect, canvasCoords, renderCanvas]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const coords = canvasCoords(e as unknown as React.MouseEvent);
    if (!coords) return;

    if (tool === "region" && regionDrag) {
      setRegionDrag((d) => d ? { ...d, ex: coords.x, ey: coords.y } : d);
      return;
    }

    if (!painting) return;
    if (tool === "fill") return; // fill only on click
    applyTool(pixBuf.current, SHEET_W, SHEET_H, coords.x, coords.y, tool, color, clipRect);
    renderCanvas();
  }, [painting, tool, color, clipRect, canvasCoords, regionDrag, renderCanvas]);

  const handleCanvasPointerUp = useCallback(() => {
    if (tool === "region" && regionDrag) {
      const x = Math.min(regionDrag.sx, regionDrag.ex);
      const y = Math.min(regionDrag.sy, regionDrag.ey);
      const w = Math.abs(regionDrag.ex - regionDrag.sx);
      const h = Math.abs(regionDrag.ey - regionDrag.sy);
      setRegionDrag(null);
      if (w >= 4 && h >= 4) {
        if (anyStripOverlaps(sheet.sprites, x, y, w, h)) {
          // Overlap — show tooltip via alert for now
          alert("Overlaps existing region");
        } else {
          setPendingRegion({ x, y, w, h });
          setPendingName("hero");
          setPendingNameError("");
        }
      }
      return;
    }

    if (painting) {
      setPainting(false);
      setSheet({ ...sheet, pixels: encodePixels(pixBuf.current) });
    }
  }, [painting, tool, regionDrag, sheet, setSheet]);

  // ── Confirm pending region ────────────────────────────────────────────────────

  const confirmRegion = useCallback(() => {
    if (!pendingRegion) return;
    const name = pendingName.trim();
    if (!name) { setPendingNameError("Name required"); return; }
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) { setPendingNameError("Use lowercase letters, digits, underscores"); return; }
    if (name in sheet.sprites) { setPendingNameError("Name already used"); return; }

    const newSprites: SheetSprites = {
      ...sheet.sprites,
      [name]: {
        animations: {
          idle: {
            x: pendingRegion.x,
            y: pendingRegion.y,
            frameW: pendingRegion.w,
            frameH: pendingRegion.h,
            frameCount: 1,
          },
        },
      },
    };
    setSheet({ ...sheet, sprites: newSprites });
    setSelectedFrame({ sprite: name, anim: "idle", idx: 0 });
    setPendingRegion(null);
    setPendingName("");
  }, [pendingRegion, pendingName, sheet, setSheet]);

  // ── Add frame ─────────────────────────────────────────────────────────────────

  const addFrame = useCallback((spriteName: string, animName: string) => {
    const sentry = sheet.sprites[spriteName];
    if (!sentry) return;
    const strip = sentry.animations[animName];
    if (!strip) return;
    // Copy last frame pixels into new frame area
    const lastFx = strip.x + (strip.frameCount - 1) * strip.frameW;
    const newFx = strip.x + strip.frameCount * strip.frameW;
    if (newFx + strip.frameW > SHEET_W) { alert("No space to add frame (sheet edge)"); return; }
    const buf = pixBuf.current;
    for (let row = 0; row < strip.frameH; row++) {
      const src = ((strip.y + row) * SHEET_W + lastFx) * 4;
      const dst = ((strip.y + row) * SHEET_W + newFx) * 4;
      buf.set(buf.subarray(src, src + strip.frameW * 4), dst);
    }
    const newSprites: SheetSprites = {
      ...sheet.sprites,
      [spriteName]: {
        ...sentry,
        animations: {
          ...sentry.animations,
          [animName]: { ...strip, frameCount: strip.frameCount + 1 },
        },
      },
    };
    setSheet({ ...sheet, sprites: newSprites, pixels: encodePixels(buf) });
    pixBuf.current = buf;
  }, [sheet, setSheet]);

  // ── Add animation ─────────────────────────────────────────────────────────────

  const addAnimation = useCallback((spriteName: string) => {
    const sentry = sheet.sprites[spriteName];
    if (!sentry) return;
    const anims = Object.values(sentry.animations);
    if (anims.length === 0) return;
    const first = anims[0];
    // Find a free y slot below all existing strips for this sprite
    let maxY = 0;
    for (const strip of anims) {
      maxY = Math.max(maxY, strip.y + strip.frameH);
    }
    if (maxY + first.frameH > SHEET_H) { alert("No space for new animation (sheet edge)"); return; }
    // Copy frame 0 of first animation into new slot
    const buf = pixBuf.current;
    for (let row = 0; row < first.frameH; row++) {
      const src = ((first.y + row) * SHEET_W + first.x) * 4;
      const dst = ((maxY + row) * SHEET_W + first.x) * 4;
      buf.set(buf.subarray(src, src + first.frameW * 4), dst);
    }
    // Pick a name that doesn't conflict
    const existingNames = new Set(Object.keys(sentry.animations));
    let newName = "walk";
    let counter = 2;
    while (existingNames.has(newName) || ACTOR_RESERVED.has(newName)) {
      newName = `anim_${counter++}`;
    }
    const newSprites: SheetSprites = {
      ...sheet.sprites,
      [spriteName]: {
        ...sentry,
        animations: {
          ...sentry.animations,
          [newName]: {
            x: first.x,
            y: maxY,
            frameW: first.frameW,
            frameH: first.frameH,
            frameCount: 1,
          },
        },
      },
    };
    setSheet({ ...sheet, sprites: newSprites, pixels: encodePixels(buf) });
    pixBuf.current = buf;
  }, [sheet, setSheet]);

  // ── Rename sprite ─────────────────────────────────────────────────────────────

  const confirmRename = useCallback((oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) { setRenamingSprite(null); return; }
    if (!/^[a-z_][a-z0-9_]*$/.test(newName)) { alert("Use lowercase letters, digits, underscores"); return; }
    if (newName in sheet.sprites) { alert("Name already used"); return; }
    const newSprites: SheetSprites = {};
    for (const [k, v] of Object.entries(sheet.sprites)) {
      newSprites[k === oldName ? newName : k] = v;
    }
    setSheet({ ...sheet, sprites: newSprites });
    setRenamingSprite(null);
    if (selectedFrame?.sprite === oldName) setSelectedFrame({ ...selectedFrame, sprite: newName });
  }, [renameValue, sheet, setSheet, selectedFrame]);

  // ── Hover preview ─────────────────────────────────────────────────────────────

  const startHoverTimer = useCallback((spriteName: string, animName: string, x: number, y: number) => {
    const t = setTimeout(() => {
      setPreviewAnim({ sprite: spriteName, anim: animName, x, y });
    }, 300);
    setHoverTimer(t);
  }, []);

  const clearHover = useCallback(() => {
    if (hoverTimer) clearTimeout(hoverTimer);
    setHoverTimer(null);
    setPreviewAnim(null);
    setPreviewFrame(0);
  }, [hoverTimer]);

  // ── Layout ────────────────────────────────────────────────────────────────────

  const canvasW = SHEET_W * zoom;
  const canvasH = SHEET_H * zoom;

  const bg = theme.surface;
  const fg = theme.panelTxt;
  const muted = theme.panelTxtMute;
  const border = theme.panelBorder;
  const acc = theme.accent;

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      background: bg, color: fg, fontFamily: theme.fontUI, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
        borderBottom: `1px solid ${border}`, background: theme.surfacePanel, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: acc }}>Sheet Editor</span>
        <span style={{ color: muted, fontSize: 11 }}>512 × 512</span>
        <div style={{ flex: 1 }} />
        {/* Zoom */}
        <span style={{ fontSize: 11, color: muted }}>Zoom</span>
        {[1, 2, 4, 8].map((z) => (
          <button key={z} onClick={() => setZoom(z)} style={{
            padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11,
            background: zoom === z ? acc : theme.chip,
            color: zoom === z ? "#fff" : fg,
            border: `1px solid ${zoom === z ? acc : border}`,
          }}>{z === 1 ? "50%" : z === 2 ? "100%" : z === 4 ? "200%" : "400%"}</button>
        ))}
        <div style={{ width: 1, background: border, height: 16, margin: "0 4px" }} />
        <button onClick={onClose} style={{
          padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11,
          background: "transparent", color: muted, border: `1px solid ${border}`,
        }}>Close</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{
          width: 44, flexShrink: 0, borderRight: `1px solid ${border}`,
          background: theme.surfacePanel, display: "flex", flexDirection: "column",
          alignItems: "center", padding: "8px 0", gap: 4,
        }}>
          {(["pencil","eraser","fill","darken","lighten","region"] as Tool[]).map((t) => (
            <button key={t} title={t} onClick={() => setTool(t)} style={{
              width: 32, height: 32, borderRadius: 4, border: `1px solid ${tool === t ? acc : border}`,
              background: tool === t ? acc : "transparent", cursor: "pointer",
              color: tool === t ? "#fff" : fg, fontSize: 10, textAlign: "center",
            }}>
              {t === "pencil" ? "✏" : t === "eraser" ? "⌫" : t === "fill" ? "⬡" :
               t === "darken" ? "◐" : t === "lighten" ? "◑" : "⬚"}
            </button>
          ))}
          <div style={{ width: 28, height: 1, background: border, margin: "4px 0" }} />
          {/* Palette */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 14px)", gap: 2 }}>
            {PALETTE.map((c) => (
              <button key={c} title={c} onClick={() => { setColor(c); if (tool === "eraser") setTool("pencil"); }}
                style={{
                  width: 14, height: 14, borderRadius: 2, border: `2px solid ${color === c ? "#fff" : "transparent"}`,
                  background: c, cursor: "pointer", padding: 0,
                  outline: color === c ? `1px solid ${acc}` : "none",
                }} />
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          <div style={{ position: "relative", width: canvasW, height: canvasH, minWidth: canvasW, minHeight: canvasH }}>
            {/* Background checkerboard for transparency */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "repeating-conic-gradient(#555 0% 25%, #444 0% 50%)",
              backgroundSize: "16px 16px",
            }} />
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{
                position: "absolute", inset: 0, cursor: tool === "region" ? "crosshair" : "crosshair",
                imageRendering: "pixelated",
              }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
            />

            {/* Sprite block overlays */}
            {Object.entries(sheet.sprites).map(([spriteName, sentry]) => {
              const animEntries = Object.entries(sentry.animations);
              if (animEntries.length === 0) return null;
              const [, firstStrip] = animEntries[0];

              const blockX = firstStrip.x * zoom;
              const blockY = firstStrip.y * zoom;
              const blockW = Math.max(...animEntries.map(([, s]) => s.frameW * s.frameCount)) * zoom;

              return (
                <div key={spriteName} style={{ position: "absolute", left: blockX, top: blockY }}>
                  {/* Sprite name header */}
                  <div
                    style={{
                      height: 18, lineHeight: "18px",
                      background: "rgba(0,0,0,0.65)", color: "#fff",
                      fontSize: 10, fontWeight: 700, paddingLeft: 6,
                      borderRadius: "4px 4px 0 0",
                      cursor: tool === "region" ? "pointer" : "default",
                      display: "flex", alignItems: "center", gap: 4,
                      minWidth: Math.max(blockW, 48),
                      transform: "translateY(-18px)",
                      userSelect: "none",
                    }}
                    onClick={() => {
                      if (tool === "region") {
                        setRenamingSprite(spriteName);
                        setRenameValue(spriteName);
                      }
                    }}
                  >
                    {renamingSprite === spriteName ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(spriteName);
                          if (e.key === "Escape") setRenamingSprite(null);
                          e.stopPropagation();
                        }}
                        onBlur={() => confirmRename(spriteName)}
                        style={{
                          background: "transparent", border: "none", outline: "none",
                          color: "#fff", fontSize: 10, fontWeight: 700, width: 80,
                        }}
                      />
                    ) : <span>{spriteName}</span>}
                  </div>

                  {/* Animation rows */}
                  {animEntries.map(([animName, strip]) => {
                    const rowY = (strip.y - firstStrip.y) * zoom;
                    const rowH = strip.frameH * zoom;
                    return (
                      <div
                        key={animName}
                        style={{
                          position: "absolute", left: 0, top: rowY,
                          display: "flex", alignItems: "flex-start",
                        }}
                        onMouseEnter={(e) => startHoverTimer(spriteName, animName, e.clientX, e.clientY)}
                        onMouseLeave={clearHover}
                      >
                        {/* Anim name label (left side, rotated) */}
                        <div style={{
                          width: 0, overflow: "visible",
                          transform: "translateX(-18px)",
                        }}>
                          <span style={{
                            display: "block",
                            transform: `rotate(-90deg) translateX(-${rowH / 2}px)`,
                            transformOrigin: "top left",
                            fontSize: 9, color: "rgba(255,255,255,0.7)",
                            whiteSpace: "nowrap", background: "rgba(0,0,0,0.5)",
                            padding: "1px 3px", borderRadius: 2,
                          }}>{animName}</span>
                        </div>

                        {/* Frame cells */}
                        {Array.from({ length: strip.frameCount }).map((_, fi) => (
                          <div
                            key={fi}
                            onClick={() => setSelectedFrame({ sprite: spriteName, anim: animName, idx: fi })}
                            style={{
                              width: strip.frameW * zoom, height: rowH,
                              border: `1px solid ${
                                selectedFrame?.sprite === spriteName &&
                                selectedFrame?.anim === animName &&
                                selectedFrame?.idx === fi
                                  ? "#41a6f6"
                                  : "rgba(255,255,255,0.2)"
                              }`,
                              boxSizing: "border-box", cursor: "pointer",
                              background: "transparent",
                            }}
                          />
                        ))}

                        {/* + frame button */}
                        <button
                          title="Add frame"
                          onClick={() => addFrame(spriteName, animName)}
                          style={{
                            width: 16, height: rowH, flexShrink: 0,
                            background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.6)",
                            border: "1px dashed rgba(255,255,255,0.2)", cursor: "pointer",
                            fontSize: 14, lineHeight: `${rowH}px`, textAlign: "center",
                            padding: 0,
                          }}
                        >+</button>
                      </div>
                    );
                  })}

                  {/* + animation button */}
                  <div style={{
                    position: "absolute",
                    top: Math.max(...animEntries.map(([, s]) => (s.y - firstStrip.y) * zoom + s.frameH * zoom)),
                    left: 0,
                  }}>
                    <button
                      title="Add animation"
                      onClick={() => addAnimation(spriteName)}
                      style={{
                        height: 16, padding: "0 8px",
                        background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.6)",
                        border: "1px dashed rgba(255,255,255,0.2)", cursor: "pointer",
                        fontSize: 10, borderRadius: "0 0 4px 4px",
                      }}
                    >+ animation</button>
                  </div>
                </div>
              );
            })}

            {/* Pending region name input */}
            {pendingRegion && (
              <div style={{
                position: "absolute",
                left: pendingRegion.x * zoom,
                top: pendingRegion.y * zoom - 36,
                background: theme.surfacePanel,
                border: `1px solid ${acc}`,
                borderRadius: 4, padding: "4px 6px",
                display: "flex", gap: 4, alignItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)", zIndex: 10,
              }}>
                <input
                  autoFocus
                  placeholder="sprite name"
                  value={pendingName}
                  onChange={(e) => { setPendingName(e.target.value); setPendingNameError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRegion();
                    if (e.key === "Escape") { setPendingRegion(null); setPendingName(""); }
                    e.stopPropagation();
                  }}
                  style={{
                    background: theme.surface, color: fg, border: `1px solid ${border}`,
                    borderRadius: 3, padding: "2px 6px", fontSize: 11, width: 100,
                    outline: pendingNameError ? `1px solid #b13e53` : "none",
                  }}
                />
                {pendingNameError && (
                  <span style={{ fontSize: 9, color: "#b13e53", maxWidth: 80 }}>{pendingNameError}</span>
                )}
                <button onClick={confirmRegion} style={{
                  padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 11,
                  background: acc, color: "#fff", border: "none",
                }}>OK</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover preview */}
      {previewAnim && (
        <div style={{
          position: "fixed", zIndex: 100, pointerEvents: "none",
          left: (sheet.sprites[previewAnim.sprite]?.animations[previewAnim.anim]?.x ?? 0) * zoom + 40,
          top: (sheet.sprites[previewAnim.sprite]?.animations[previewAnim.anim]?.y ?? 0) * zoom + 40,
          background: theme.surfacePanel, border: `1px solid ${border}`,
          borderRadius: 6, padding: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 9, color: muted, marginBottom: 3 }}>
            {previewAnim.sprite}.{previewAnim.anim}
          </div>
          <canvas
            ref={previewCanvasRef}
            style={{ imageRendering: "pixelated", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}
