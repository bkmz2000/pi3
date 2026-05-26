import { useRef, useState, useEffect, useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import type { AnimationData } from "./state/IdeState";
import { useThemeStore, type Theme } from "./state/useTheme";

// ── Editor palette derived from the IDE theme ───────────────────────────────
// Mapping is named once here so every sub-component reads the same shape.
type EditorPalette = {
  bg: string; panel: string; surface: string; surface2: string;
  border: string; borderMid: string; borderStrong: string;
  accent: string; accentSoft: string; accentLine: string; orange: string;
  txt: string; txtMute: string; txtFaint: string;
  canvasBg: string;
  font: string; mono: string;
};

function hexToRgba(hex: string, alpha: number): string {
  // Accept #rgb, #rrggbb, or rgba(...). For non-hex inputs return as-is.
  if (!hex || !hex.startsWith('#')) return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function paletteFor(theme: Theme): EditorPalette {
  return {
    bg:           theme.surface,
    panel:        theme.surfacePanel,
    surface:      theme.panelHeader,
    surface2:     theme.chip,
    border:       theme.panelBorder,
    borderMid:    theme.panelBorder,
    borderStrong: theme.canvasBorder,
    accent:       theme.accent,
    accentSoft:   hexToRgba(theme.accent, 0.15),
    accentLine:   hexToRgba(theme.accent, 0.38),
    orange:       theme.tabDirty,
    txt:          theme.panelTxt,
    txtMute:      theme.panelTxtMute,
    txtFaint:     hexToRgba(theme.panelTxtMute, 0.55),
    canvasBg:     theme.canvasBg,
    font:         theme.fontUI,
    mono:         theme.fontMono,
  };
}

function useEditorPalette(): EditorPalette {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => paletteFor(theme), [theme]);
}

type Tool = "pencil" | "eraser" | "line" | "rect" | "circle" | "fill" | "eyedrop" | "darken" | "lighten";

// Must match graphics._SHADE_STEP — one editor brush stroke equals one
// `darker(c, 1)` / `lighter(c, 1)` in Python.
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

// Sweetie-16 Python name aliases (used by Colors.lerp() hint)
// eslint-disable-next-line react-refresh/only-export-components
export const PAL_NAMES: Record<string, string> = {
  '#1a1c2c':'black','#5d275d':'wine','#b13e53':'red','#ef7d57':'orange',
  '#ffcd75':'yellow','#a7f070':'lime','#38b764':'green','#257179':'teal',
  '#29366f':'navy','#3b5dc9':'blue','#41a6f6':'sky','#73eff7':'cyan',
  '#f4f4f4':'white','#94b0c2':'silver','#566c86':'gray','#333c57':'slate',
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
  /** When true, render the dark editor panel inline without its own backdrop.
   *  AssetEditor uses this to host the editor inside its unified modal frame. */
  embedded?: boolean;
};

const emptyBuf = (size: number) => new Uint8ClampedArray(size * size * 4).fill(0);

type RGBA = [number, number, number, number];
const hexToRgb = (hex: string): RGBA => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hexLerp(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}

// ── Tool icons (SVG) ───────────────────────────────────────────────────────
const TOOL_ICONS: Record<Tool | 'mirror' | 'region', ReactNode> = {
  pencil:  <><path d="M2.5 11.5l.8 2.5 2.4-.8L13 6.5l-3-3z" fill="currentColor" opacity=".85"/><path d="M10.5 3.5l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>,
  eraser:  <><path d="M4 12L2 10l7-7 2 2-7 7z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/><path d="M3.5 13.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></>,
  line:    <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>,
  rect:    <rect x="2.5" y="3.5" width="11" height="9" stroke="currentColor" strokeWidth="1.5" fill="none" rx="0.5"/>,
  circle:  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>,
  fill:    <><path d="M2.5 12.5l4-4 1 1-4 4-1-1zM5.5 9.5l5-5 1 1" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 9.5s1.5 1.5 1.5 2.5a1.5 1.5 0 01-3 0c0-1 1.5-2.5 1.5-2.5z" fill="currentColor"/></>,
  eyedrop: <><path d="M9.5 3.5l2.5 2.5L6 12 3.5 9.5l6-6zM2.5 12.5l.8 2 2-.8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  mirror:  <><path d="M8 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1.5"/><path d="M2 5.5l3 2.5-3 2.5M14 5.5l-3 2.5 3 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  darken:  <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 2.5C5 2.5 2.5 5 2.5 8h11C13.5 5 11 2.5 8 2.5z" fill="currentColor" opacity=".6"/></>,
  lighten: <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>,
  region:  <><rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeDasharray="2 1.5" rx="1"/><path d="M11 5l2-2m0 0v2.5m0-2.5h-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></>,
};

const TOOL_GROUPS: Tool[][] = [
  ['pencil', 'eraser'],
  ['line', 'rect', 'circle'],
  ['fill', 'eyedrop'],
  ['darken', 'lighten'],
];
const TOOL_META: Record<Tool, { label: string; key: string }> = {
  pencil:  { label: 'Pencil',  key: 'B' },
  eraser:  { label: 'Eraser',  key: 'E' },
  line:    { label: 'Line',    key: 'L' },
  rect:    { label: 'Rect',    key: 'R' },
  circle:  { label: 'Circle',  key: 'C' },
  fill:    { label: 'Fill',    key: 'G' },
  eyedrop: { label: 'Eyedrop', key: 'I' },
  darken:  { label: 'Darken',  key: 'D' },
  lighten: { label: 'Lighten', key: 'S' },
};

// Tools that can paint continuously while the mouse is held down.
const DRAG_TOOLS = new Set<Tool>(['pencil', 'eraser', 'darken', 'lighten']);
// Tools that produce a shape on mouseUp using a preview overlay.
const SHAPE_TOOLS = new Set<Tool>(['line', 'rect', 'circle']);

// ── Shape rasterizers ──────────────────────────────────────────────────────
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

// ── PI3 brand mark (matches design) ─────────────────────────────────────────
function Pi3Mark() {
  const E = useEditorPalette();
  return (
    <span style={{
      fontFamily: "'Nunito', system-ui, sans-serif",
      fontWeight: 800, fontSize: 15, color: E.accent,
      letterSpacing: -0.5, flexShrink: 0,
    }}>
      pi<sup style={{ fontSize: '0.6em', verticalAlign: '0.1em' }}>3</sup>
    </span>
  );
}

function SLabel({ text, right }: { text: string; right?: ReactNode }) {
  const E = useEditorPalette();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{
        fontSize: 9, color: E.txtMute, fontFamily: E.font,
        textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600,
      }}>{text}</span>
      {right}
    </div>
  );
}

function ToolIcon({ id, size = 15 }: { id: Tool | 'mirror' | 'region'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none', display: 'block' }}>
      {TOOL_ICONS[id]}
    </svg>
  );
}

// ── ToolStrip ──────────────────────────────────────────────────────────────
function ToolStrip(props: {
  active: Tool;
  onSelect: (t: Tool) => void;
  mirror: boolean;
  onToggleMirror: () => void;
  onRegionClick: () => void;
}) {
  const E = useEditorPalette();
  const { active, onSelect, mirror, onToggleMirror, onRegionClick } = props;
  const [hov, setHov] = useState<string | null>(null);

  const toolButton = (tid: Tool) => {
    const on = active === tid;
    return (
      <button
        key={tid}
        title={`${TOOL_META[tid].label} (${TOOL_META[tid].key})`}
        aria-label={TOOL_META[tid].label}
        onMouseEnter={() => setHov(tid)}
        onMouseLeave={() => setHov(null)}
        onClick={() => onSelect(tid)}
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6,
          border: on ? `1px solid ${E.accentLine}` : '1px solid transparent',
          background: on ? E.accentSoft : hov === tid ? E.surface : 'transparent',
          color: on ? E.accent : hov === tid ? E.txt : E.txtMute,
          cursor: 'pointer', transition: 'all .1s',
        }}>
        <ToolIcon id={tid} />
      </button>
    );
  };

  const sep = <div style={{ width: 28, height: 1, background: E.border, margin: '4px 0' }}/>;

  return (
    <div style={{
      width: 50, background: E.panel, borderRight: `1px solid ${E.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 0', gap: 2, flexShrink: 0,
    }}>
      {TOOL_GROUPS.map((g, gi) => (
        <div key={gi} style={{ display: 'contents' }}>
          {gi > 0 && sep}
          {g.map(toolButton)}
        </div>
      ))}
      {sep}
      {/* Mirror — modifier toggle, not a tool */}
      <button
        title="Mirror (M)"
        aria-label="Mirror"
        onMouseEnter={() => setHov('mirror')}
        onMouseLeave={() => setHov(null)}
        onClick={onToggleMirror}
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6,
          border: mirror ? `1px solid ${E.accentLine}` : '1px solid transparent',
          background: mirror ? E.accentSoft : hov === 'mirror' ? E.surface : 'transparent',
          color: mirror ? E.accent : hov === 'mirror' ? E.txt : E.txtMute,
          cursor: 'pointer',
        }}>
        <ToolIcon id="mirror" />
      </button>
      {sep}
      {/* Region — Stage 1c placeholder */}
      <button
        title="Region (Q) — coming with Stage 1c"
        aria-label="Region"
        onClick={onRegionClick}
        onMouseEnter={() => setHov('region')}
        onMouseLeave={() => setHov(null)}
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6, border: '1px solid transparent',
          background: hov === 'region' ? E.surface : 'transparent',
          color: hov === 'region' ? E.txt : E.txtFaint,
          cursor: 'pointer',
        }}>
        <ToolIcon id="region" />
      </button>

      <div style={{ flex: 1 }}/>
      <div style={{ fontSize: 9, color: E.txtFaint, fontFamily: E.mono, marginBottom: 4 }}>
        {TOOL_META[active]?.key}
      </div>
    </div>
  );
}

// ── ColorLerpPanel — picks two palette colors, returns interpolations ──────
function ColorLerpPanel({ current, onApply }: { current: string; onApply: (c: string) => void }) {
  const E = useEditorPalette();
  const [a, setA] = useState('#b13e53');
  const [b, setB] = useState('#41a6f6');
  const [t, setT] = useState(0.5);
  const [picking, setPicking] = useState<'a' | 'b' | null>(null);

  const STEPS = 9;
  const swatches = Array.from({ length: STEPS }, (_, i) => hexLerp(a, b, i / (STEPS - 1)));
  const active = hexLerp(a, b, t);
  const nameA = PAL_NAMES[a] || '?';
  const nameB = PAL_NAMES[b] || '?';

  const pick = (c: string) => {
    if (picking === 'a') setA(c);
    else if (picking === 'b') setB(c);
    setPicking(null);
  };

  return (
    <div>
      <SLabel text="Color Lerp" right={
        <span style={{ fontSize: 8, color: E.accentLine, fontFamily: E.mono }}>Colors.lerp()</span>
      }/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div onClick={() => setPicking(p => p === 'a' ? null : 'a')}
            style={{ width: 26, height: 26, borderRadius: 5, background: a,
              border: `2px solid ${picking === 'a' ? E.txt : E.border}`, cursor: 'pointer' }}/>
          <span style={{ fontSize: 8, color: E.txtFaint, fontFamily: E.mono }}>A</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setT(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
            }}
            style={{ height: 18, borderRadius: 4, cursor: 'crosshair',
              background: `linear-gradient(to right, ${a}, ${b})`,
              border: `1px solid ${E.border}`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -3, bottom: -3, width: 4, borderRadius: 2,
              left: `calc(${t * 100}% - 2px)`, background: E.txt,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.6)', pointerEvents: 'none' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 7, color: E.txtFaint, fontFamily: E.mono }}>0</span>
            <span style={{ fontSize: 8, color: E.txtMute, fontFamily: E.mono }}>t = {t.toFixed(2)}</span>
            <span style={{ fontSize: 7, color: E.txtFaint, fontFamily: E.mono }}>1</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div onClick={() => setPicking(p => p === 'b' ? null : 'b')}
            style={{ width: 26, height: 26, borderRadius: 5, background: b,
              border: `2px solid ${picking === 'b' ? E.txt : E.border}`, cursor: 'pointer' }}/>
          <span style={{ fontSize: 8, color: E.txtFaint, fontFamily: E.mono }}>B</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        {swatches.map((c, i) => {
          const isActive = Math.round(t * (STEPS - 1)) === i;
          return (
            <div key={i} onClick={() => setT(i / (STEPS - 1))}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ height: 22, borderRadius: 3, background: c, width: '100%', cursor: 'pointer',
                border: `2px solid ${isActive ? E.txt : 'transparent'}`, boxSizing: 'border-box' }}/>
              {(i === 0 || i === (STEPS - 1) / 2 || i === STEPS - 1)
                ? <span style={{ fontSize: 7, color: E.txtFaint, fontFamily: E.mono }}>{Math.round((i / (STEPS - 1)) * 100)}%</span>
                : <span style={{ fontSize: 7, color: 'transparent' }}>·</span>}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
        borderRadius: 6, background: E.surface2, border: `1px solid ${E.border}`, marginBottom: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: 4, background: active,
          border: `1px solid ${E.borderMid}`, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: E.txt, fontFamily: E.mono, marginBottom: 2 }}>{active}</div>
          <div style={{ fontSize: 8, color: E.txtMute, fontFamily: E.mono, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            Colors.lerp(<span style={{ color: E.orange }}>{nameA}</span>,{' '}
            <span style={{ color: E.accent }}>{nameB}</span>, {t.toFixed(2)})
          </div>
        </div>
        <button
          onClick={() => onApply(active)}
          title="Set as current color"
          style={{ padding: '4px 8px', fontSize: 9, borderRadius: 4, cursor: 'pointer',
            background: active === current ? E.accentSoft : E.surface,
            border: `1px solid ${active === current ? E.accentLine : E.border}`,
            color: active === current ? E.accent : E.txt, fontFamily: E.font }}>
          Use
        </button>
      </div>

      {picking && (
        <div>
          <SLabel text={`Pick color ${picking.toUpperCase()}`}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
            {PALETTES.sweetie16.map((c, i) => (
              <div key={i} onClick={() => pick(c)}
                style={{ aspectRatio: 1, background: c, borderRadius: 3, cursor: 'pointer',
                  border: ((picking === 'a' && c === a) || (picking === 'b' && c === b))
                    ? `2px solid ${E.txt}` : '1px solid rgba(0,0,0,0.3)' }}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PixelEditor({
  open,
  onClose,
  onSave,
  onSaveAnimation,
  size = 32,
  initialName,
  initialAnimation,
  embedded = false,
}: PixelEditorProps) {
  const E = useEditorPalette();
  const isAnimMode = !!(initialAnimation || onSaveAnimation);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [gridSize, setGridSize] = useState<16 | 32>(size);
  const [frameData, setFrameData] = useState<Uint8ClampedArray[]>(() => [emptyBuf(gridSize)]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [fps, setFps] = useState(initialAnimation?.fps ?? 8);

  const [history, setHistory] = useState<Uint8ClampedArray[]>([]);
  const [future, setFuture] = useState<Uint8ClampedArray[]>([]);

  const [spriteName, setSpriteName] = useState(initialName || 'sprite');
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ef7d57');
  const [opacity, setOpacity] = useState(1);
  const [palette, setPalette] = useState<PaletteName>('sweetie16');
  const [mirrorX, setMirrorX] = useState(false);
  const [onionSkin, setOnionSkin] = useState(false);
  // Zoom levels expressed as percent. 100 = base 480px display.
  const [zoom, setZoom] = useState<50 | 100 | 200 | 400>(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [regionToast, setRegionToast] = useState(false);

  // Shape-tool drag state. null when not dragging.
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragNow, setDragNow] = useState<{ x: number; y: number } | null>(null);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const DISPLAY = 480 * (zoom / 100);

  // ── Pixel ops ──────────────────────────────────────────────────────────
  const drawPixel = useCallback((buf: Uint8ClampedArray, x: number, y: number, rgba: RGBA) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    const [r, g, b, a] = rgba;
    buf[i]     = Math.round(lerp(buf[i],     r, opacity));
    buf[i + 1] = Math.round(lerp(buf[i + 1], g, opacity));
    buf[i + 2] = Math.round(lerp(buf[i + 2], b, opacity));
    buf[i + 3] = Math.round(lerp(buf[i + 3], a, opacity));
  }, [gridSize, opacity]);

  const shadePixel = useCallback((buf: Uint8ClampedArray, x: number, y: number, dir: 1 | -1) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    if (buf[i + 3] === 0) return; // no-op on transparent
    const target = dir === 1 ? 255 : 0;
    buf[i]     = Math.round(lerp(buf[i],     target, SHADE_STEP));
    buf[i + 1] = Math.round(lerp(buf[i + 1], target, SHADE_STEP));
    buf[i + 2] = Math.round(lerp(buf[i + 2], target, SHADE_STEP));
  }, [gridSize]);

  const erasePixel = useCallback((buf: Uint8ClampedArray, x: number, y: number) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i = (y * gridSize + x) * 4;
    buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
  }, [gridSize]);

  const floodFill = useCallback((buf: Uint8ClampedArray, x: number, y: number, rgba: RGBA) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    const i0 = (y * gridSize + x) * 4;
    const [or, og, ob, oa] = [buf[i0], buf[i0 + 1], buf[i0 + 2], buf[i0 + 3]];
    if (or === rgba[0] && og === rgba[1] && ob === rgba[2] && oa === rgba[3]) return;
    const queue: [number, number][] = [[x, y]];
    const visited = new Set<string>();
    while (queue.length) {
      const [cx, cy] = queue.shift()!;
      const k = `${cx},${cy}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (cx < 0 || cx >= gridSize || cy < 0 || cy >= gridSize) continue;
      const ci = (cy * gridSize + cx) * 4;
      if (buf[ci] !== or || buf[ci + 1] !== og || buf[ci + 2] !== ob || buf[ci + 3] !== oa) continue;
      drawPixel(buf, cx, cy, rgba);
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }, [gridSize, drawPixel]);

  // Apply (and optionally mirror) a single pixel op.
  const apply = useCallback((buf: Uint8ClampedArray, x: number, y: number, op: (b: Uint8ClampedArray, x: number, y: number) => void) => {
    op(buf, x, y);
    if (mirrorX) op(buf, gridSize - 1 - x, y);
  }, [mirrorX, gridSize]);

  // ── Composite & grid render ────────────────────────────────────────────
  const composite = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // Checkerboard background for transparency
    const out = new Uint8ClampedArray(gridSize * gridSize * 4);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const i = (y * gridSize + x) * 4;
        const dark = (x + y) % 2 === 0;
        out[i]     = dark ? 25 : 20;
        out[i + 1] = dark ? 28 : 23;
        out[i + 2] = dark ? 44 : 34;
        out[i + 3] = 255;
      }
    }
    // Onion ghost (previous frame, 30%)
    if (onionSkin && frameIdx > 0 && frameData[frameIdx - 1]) {
      const src = frameData[frameIdx - 1];
      for (let i = 0; i < out.length; i += 4) {
        if (src[i + 3] === 0) continue;
        const a = (src[i + 3] / 255) * 0.3;
        const inv = 1 - a;
        out[i]     = Math.round(out[i]     * inv + src[i]     * a);
        out[i + 1] = Math.round(out[i + 1] * inv + src[i + 1] * a);
        out[i + 2] = Math.round(out[i + 2] * inv + src[i + 2] * a);
      }
    }
    // Current frame
    const src = frameData[frameIdx];
    if (src) {
      for (let i = 0; i < out.length; i += 4) {
        if (src[i + 3] === 0) continue;
        const a = src[i + 3] / 255;
        const inv = 1 - a;
        out[i]     = Math.round(out[i]     * inv + src[i]     * a);
        out[i + 1] = Math.round(out[i + 1] * inv + src[i + 1] * a);
        out[i + 2] = Math.round(out[i + 2] * inv + src[i + 2] * a);
      }
    }
    ctx.putImageData(new ImageData(out, gridSize, gridSize), 0, 0);
  }, [frameIdx, frameData, gridSize, onionSkin]);

  const drawGrid = useCallback(() => {
    const cv = gridCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, DISPLAY, DISPLAY);
    if (zoom < 100) return; // hide grid when zoomed out
    const px = DISPLAY / gridSize;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < gridSize; i++) {
      const p = i * px;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, DISPLAY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(DISPLAY, p); ctx.stroke();
    }
  }, [gridSize, DISPLAY, zoom]);

  // Draw the shape-tool preview overlay.
  const drawOverlay = useCallback(() => {
    const cv = overlayRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, DISPLAY, DISPLAY);
    if (!dragStart || !dragNow || !SHAPE_TOOLS.has(tool)) return;
    const px = DISPLAY / gridSize;
    const [r, g, b] = hexToRgb(color);
    ctx.fillStyle = `rgba(${r},${g},${b},${0.7 * opacity})`;
    const stamp = (x: number, y: number) => {
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
      ctx.fillRect(x * px, y * px, px, px);
      if (mirrorX) ctx.fillRect((gridSize - 1 - x) * px, y * px, px, px);
    };
    if (tool === 'line')   bresenhamLine(dragStart.x, dragStart.y, dragNow.x, dragNow.y, stamp);
    if (tool === 'rect')   rectOutline(dragStart.x, dragStart.y, dragNow.x, dragNow.y, stamp);
    if (tool === 'circle') ellipseOutline(dragStart.x, dragStart.y, dragNow.x, dragNow.y, stamp);
  }, [dragStart, dragNow, tool, color, opacity, gridSize, DISPLAY, mirrorX]);

  useEffect(() => { composite(); drawGrid(); }, [composite, drawGrid]);
  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  // ── Undo / redo ────────────────────────────────────────────────────────
  const commitPixels = useCallback((newBuf: Uint8ClampedArray) => {
    setHistory(h => [...h, frameData[frameIdx]]);
    setFuture([]);
    setFrameData(f => f.map((b, i) => (i === frameIdx ? newBuf : b)));
  }, [frameData, frameIdx]);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [...f, frameData[frameIdx]]);
    setFrameData(f => f.map((b, i) => (i === frameIdx ? prev : b)));
    setHistory(h => h.slice(0, -1));
  };
  const redo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setHistory(h => [...h, frameData[frameIdx]]);
    setFrameData(f => f.map((b, i) => (i === frameIdx ? next : b)));
    setFuture(f => f.slice(0, -1));
  };

  // ── Frame ops ──────────────────────────────────────────────────────────
  const addFrame = () => {
    setFrameData(f => [...f, emptyBuf(gridSize)]);
    setFrameIdx(frameData.length);
  };

  // ── Mouse handling ─────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const cellAt = (e: MouseEvent) => {
      const rect = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / gridSize));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / gridSize));
      return { x, y };
    };

    const handleMouseDown = (e: MouseEvent) => {
      const { x, y } = cellAt(e);
      if (tool === 'eyedrop') {
        const i = (y * gridSize + x) * 4;
        const buf = frameData[frameIdx];
        if (buf[i + 3] > 0) setColor(rgbToHex(buf[i], buf[i + 1], buf[i + 2]));
        return;
      }
      if (SHAPE_TOOLS.has(tool)) {
        setDragStart({ x, y });
        setDragNow({ x, y });
        return;
      }
      const newBuf = new Uint8ClampedArray(frameData[frameIdx]);
      const rgba = hexToRgb(color);
      if (tool === 'pencil')  apply(newBuf, x, y, (b, x, y) => drawPixel(b, x, y, rgba));
      if (tool === 'eraser')  apply(newBuf, x, y, erasePixel);
      if (tool === 'fill')    floodFill(newBuf, x, y, rgba); // fill ignores mirror
      if (tool === 'darken')  apply(newBuf, x, y, (b, x, y) => shadePixel(b, x, y, -1));
      if (tool === 'lighten') apply(newBuf, x, y, (b, x, y) => shadePixel(b, x, y, 1));
      commitPixels(newBuf);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if ((e.buttons & 1) === 0) return;
      const { x, y } = cellAt(e);
      if (SHAPE_TOOLS.has(tool) && dragStart) {
        setDragNow({ x, y });
        return;
      }
      if (!DRAG_TOOLS.has(tool)) return;
      const buf = new Uint8ClampedArray(frameData[frameIdx]);
      const rgba = hexToRgb(color);
      if (tool === 'pencil')  apply(buf, x, y, (b, x, y) => drawPixel(b, x, y, rgba));
      if (tool === 'eraser')  apply(buf, x, y, erasePixel);
      if (tool === 'darken')  apply(buf, x, y, (b, x, y) => shadePixel(b, x, y, -1));
      if (tool === 'lighten') apply(buf, x, y, (b, x, y) => shadePixel(b, x, y, 1));
      setFrameData(f => f.map((b, i) => (i === frameIdx ? buf : b)));
    };

    const handleMouseUp = () => {
      if (SHAPE_TOOLS.has(tool) && dragStart && dragNow) {
        const buf = new Uint8ClampedArray(frameData[frameIdx]);
        const rgba = hexToRgb(color);
        const plot = (px: number, py: number) => apply(buf, px, py, (b, x, y) => drawPixel(b, x, y, rgba));
        if (tool === 'line')   bresenhamLine(dragStart.x, dragStart.y, dragNow.x, dragNow.y, plot);
        if (tool === 'rect')   rectOutline(dragStart.x, dragStart.y, dragNow.x, dragNow.y, plot);
        if (tool === 'circle') ellipseOutline(dragStart.x, dragStart.y, dragNow.x, dragNow.y, plot);
        commitPixels(buf);
        setDragStart(null);
        setDragNow(null);
      }
    };

    cv.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      cv.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [tool, frameData, frameIdx, color, gridSize, commitPixels, drawPixel, erasePixel, floodFill, shadePixel, apply, dragStart, dragNow]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      const map: Record<string, Tool> = {
        b: 'pencil', e: 'eraser', l: 'line', r: 'rect', c: 'circle',
        g: 'fill', i: 'eyedrop', d: 'darken', s: 'lighten',
      };
      if (map[k]) { setTool(map[k]); return; }
      if (k === 'm') setMirrorX(m => !m);
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, history, future, frameData, frameIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playback ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      return;
    }
    playIntervalRef.current = setInterval(() => {
      setPlaybackIdx(i => (i + 1) % frameData.length);
    }, 1000 / fps);
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, fps, frameData.length]);

  // When playback is on, advance the displayed frame
  useEffect(() => { if (isPlaying) setFrameIdx(playbackIdx); }, [isPlaying, playbackIdx]);

  // ── Export ─────────────────────────────────────────────────────────────
  const exportFrame = async (idx: number): Promise<string> => {
    const out = new OffscreenCanvas(128, 128);
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const tmp = new OffscreenCanvas(gridSize, gridSize);
    const tctx = tmp.getContext('2d')!;
    const src = frameData[idx];
    tctx.putImageData(new ImageData(new Uint8ClampedArray(src), gridSize, gridSize), 0, 0);
    ctx.drawImage(tmp, 0, 0, gridSize, gridSize, 0, 0, 128, 128);
    const blob = await out.convertToBlob({ type: 'image/png' });
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

  if (!open) return null;

  const palColors = PALETTES[palette];

  // ── Chips (size, zoom) ─────────────────────────────────────────────────
  const sizeChip = (s: 16 | 32) => {
    const on = gridSize === s;
    return (
      <button key={s} onClick={() => setGridSize(s)}
        style={{ padding: '2px 7px', fontSize: 9, borderRadius: 99,
          background: on ? E.accentSoft : 'transparent',
          border: `1px solid ${on ? E.accentLine : E.border}`,
          color: on ? E.accent : E.txtMute, cursor: 'pointer', fontFamily: E.mono }}>
        {s}×{s}
      </button>
    );
  };
  const zoomChip = (z: 50 | 100 | 200 | 400) => {
    const on = zoom === z;
    return (
      <button key={z} onClick={() => setZoom(z)}
        style={{ padding: '2px 6px', fontSize: 9, borderRadius: 3,
          background: on ? E.surface2 : 'transparent',
          border: `1px solid ${on ? E.borderMid : 'transparent'}`,
          color: on ? E.txt : E.txtFaint, cursor: 'pointer', fontFamily: E.mono }}>
        {z}%
      </button>
    );
  };

  const divider: CSSProperties = { width: 1, height: 20, background: E.border, flexShrink: 0 };

  const inner = (
    <div
      onClick={embedded ? undefined : (e) => e.stopPropagation()}
      style={{
        display: 'flex', flexDirection: 'column',
        width: embedded ? '100%' : 'min(1200px, 96vw)',
        height: embedded ? '100%' : 'min(720px, 92vh)',
        background: E.bg,
        borderRadius: embedded ? 0 : 8,
        overflow: 'hidden',
        border: embedded ? 'none' : `1px solid ${E.border}`,
        fontFamily: E.font, color: E.txt,
      }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px',
          background: E.panel, borderBottom: `1px solid ${E.border}`, flexShrink: 0,
        }}>
          <Pi3Mark/>
          <div style={divider}/>
          <span style={{ fontSize: 10, color: E.txtMute }}>sprites /</span>
          <input
            value={spriteName}
            onChange={(e) => setSpriteName(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, fontFamily: E.mono, color: E.txt, fontWeight: 600,
              padding: '2px 4px', width: 140,
            }}/>
          <div style={divider}/>
          {sizeChip(16)}
          {sizeChip(32)}
          <div style={divider}/>
          {zoomChip(50)}{zoomChip(100)}{zoomChip(200)}{zoomChip(400)}
          <div style={{ flex: 1 }}/>
          <button onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)"
            style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent',
              border: `1px solid ${E.border}`, color: E.txtMute,
              cursor: history.length ? 'pointer' : 'not-allowed', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: history.length ? 1 : 0.5 }}>↩</button>
          <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)"
            style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent',
              border: `1px solid ${E.border}`, color: E.txtMute,
              cursor: future.length ? 'pointer' : 'not-allowed', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: future.length ? 1 : 0.5 }}>↪</button>
          <div style={divider}/>
          <button onClick={onClose}
            style={{ padding: '5px 12px', borderRadius: 6, background: 'transparent',
              border: `1px solid ${E.border}`, color: E.txtMute, cursor: 'pointer', fontSize: 11 }}>
            Cancel
          </button>
          <button onClick={handleSave}
            style={{ padding: '5px 14px', borderRadius: 6, background: E.accent,
              border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            Save
          </button>
        </div>

        {/* ── Main row ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ToolStrip
            active={tool}
            onSelect={setTool}
            mirror={mirrorX}
            onToggleMirror={() => setMirrorX(m => !m)}
            onRegionClick={() => { setRegionToast(true); setTimeout(() => setRegionToast(false), 2200); }}
          />

          {/* Canvas column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div style={{
              flex: 1, position: 'relative', overflow: 'auto', background: E.canvasBg,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40,
            }}>
              {/* Breadcrumb */}
              <div style={{
                position: 'absolute', top: 10, left: 14, display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 5, background: E.panel,
                border: `1px solid ${E.accentLine}`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: E.accent }}/>
                <span style={{ fontSize: 9, color: E.accent, fontFamily: E.mono }}>
                  {spriteName}{isAnimMode ? ` · frame ${frameIdx + 1}` : ''}
                </span>
                {mirrorX && (
                  <span style={{
                    fontSize: 8, color: E.orange, fontFamily: E.mono,
                    padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(246,165,96,0.12)', border: '1px solid rgba(246,165,96,0.35)',
                  }}>mirror</span>
                )}
              </div>

              {/* Region tool toast */}
              {regionToast && (
                <div style={{
                  position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                  padding: '6px 12px', borderRadius: 5, background: E.surface2,
                  border: `1px solid ${E.borderMid}`, fontSize: 10, color: E.txt,
                }}>
                  Region tool — lands with Stage 1c (sheet model).
                </div>
              )}

              {/* The actual editable canvas stack */}
              <div style={{
                position: 'relative', width: DISPLAY, height: DISPLAY,
                boxShadow: `0 0 0 1px ${E.borderStrong}, 0 12px 40px rgba(0,0,0,0.5)`,
                borderRadius: 2,
              }}>
                <canvas
                  ref={canvasRef}
                  width={gridSize}
                  height={gridSize}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    imageRendering: 'pixelated',
                    cursor: tool === 'eyedrop' ? 'crosshair' : 'default',
                  }}
                />
                <canvas
                  ref={gridCanvasRef}
                  width={DISPLAY}
                  height={DISPLAY}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                    pointerEvents: 'none', imageRendering: 'pixelated' }}
                />
                <canvas
                  ref={overlayRef}
                  width={DISPLAY}
                  height={DISPLAY}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                    pointerEvents: 'none' }}
                />
                {mirrorX && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1,
                    background: 'rgba(246,165,96,0.5)', pointerEvents: 'none',
                  }}/>
                )}
              </div>

              {/* Bottom-right grid indicator */}
              <div style={{
                position: 'absolute', bottom: 8, right: 14, fontSize: 8,
                color: E.txtFaint, fontFamily: E.mono,
              }}>
                {gridSize}×{gridSize} · {Math.round(DISPLAY / gridSize)}px·cell
              </div>
            </div>

            {/* Anim strip */}
            {isAnimMode && (
              <div style={{
                background: E.panel, borderTop: `1px solid ${E.border}`,
                padding: '7px 12px 8px', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <span style={{ fontSize: 9, color: E.accent, fontFamily: E.mono }}>{spriteName}</span>
                  <span style={{ fontSize: 9, color: E.txtFaint, fontFamily: E.mono }}>{frameData.length}f</span>
                  <div style={{ flex: 1 }}/>
                  <button onClick={() => setIsPlaying(p => !p)}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', borderRadius: 6,
                      background: isPlaying ? E.accentSoft : E.surface2,
                      border: `1px solid ${isPlaying ? E.accentLine : E.border}`,
                      color: isPlaying ? E.accent : E.txtMute, cursor: 'pointer' }}>
                    <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor">
                      {isPlaying
                        ? <><rect x="3" y="3" width="4" height="10" rx="1"/><rect x="9" y="3" width="4" height="10" rx="1"/></>
                        : <path d="M5 3l9 5-9 5V3z"/>}
                    </svg>
                  </button>
                  <button onClick={() => setOnionSkin(o => !o)}
                    style={{ padding: '3px 8px', fontSize: 9, borderRadius: 5,
                      background: onionSkin ? E.accentSoft : 'transparent',
                      border: `1px solid ${onionSkin ? E.accentLine : E.border}`,
                      color: onionSkin ? E.accent : E.txtMute, cursor: 'pointer' }}>
                    Onion
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: E.txtMute }}>FPS</span>
                    <input type="number" min={1} max={30} value={fps}
                      onChange={e => setFps(+e.target.value || 8)}
                      style={{ width: 38, padding: '2px 4px', fontSize: 10, fontFamily: E.mono,
                        background: E.surface2, border: `1px solid ${E.border}`,
                        borderRadius: 4, color: E.txt, textAlign: 'center' }}/>
                  </div>
                  <span style={{ fontSize: 9, color: E.txtFaint, fontFamily: E.mono }}>
                    {frameIdx + 1}/{frameData.length}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                  {frameData.map((_, i) => (
                    <button key={i} onClick={() => setFrameIdx(i)}
                      style={{
                        width: 48, height: 48, flexShrink: 0, borderRadius: 4, overflow: 'hidden',
                        cursor: 'pointer', position: 'relative', background: E.canvasBg,
                        border: `2px solid ${frameIdx === i ? E.accent : E.border}`, padding: 0,
                      }}>
                      <canvas
                        width={gridSize}
                        height={gridSize}
                        ref={(c) => {
                          if (c && frameData[i]) {
                            const ctx = c.getContext('2d');
                            if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(frameData[i]), gridSize, gridSize), 0, 0);
                          }
                        }}
                        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
                      />
                      <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: 7,
                        color: frameIdx === i ? E.accent : E.txtFaint, fontFamily: E.mono }}>{i + 1}</span>
                    </button>
                  ))}
                  <button onClick={addFrame}
                    style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 4,
                      border: `2px dashed ${E.border}`, background: 'transparent',
                      color: E.txtMute, cursor: 'pointer', fontSize: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{
            width: 268, background: E.panel, borderLeft: `1px solid ${E.border}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
          }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Current sprite summary */}
              <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${E.border}` }}>
                <SLabel text="Sprite"/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                  borderRadius: 5, background: E.accent + '14' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: E.accent, flexShrink: 0 }}/>
                  <span style={{ fontSize: 11, fontFamily: E.mono, fontWeight: 600, flex: 1, color: E.accent }}>
                    {spriteName}
                  </span>
                  <span style={{ fontSize: 8, color: E.txtFaint }}>{gridSize}×{gridSize}</span>
                </div>
                {isAnimMode && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 6px 3px 22px', borderRadius: 5, marginTop: 4,
                    background: E.orange + '14',
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: 99, background: E.orange, flexShrink: 0 }}/>
                    <span style={{ fontSize: 10, fontFamily: E.mono, flex: 1, color: E.orange }}>animation</span>
                    <span style={{ fontSize: 8, color: E.txtFaint, fontFamily: E.mono }}>{frameData.length}f</span>
                  </div>
                )}
              </div>

              {/* Color Lerp */}
              <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${E.border}` }}>
                <ColorLerpPanel current={color} onApply={setColor}/>
              </div>

              {/* Current color + opacity */}
              <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${E.border}` }}>
                <SLabel text="Color"/>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 6, background: color,
                    border: `2px solid ${E.borderStrong}`, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: E.txtFaint, fontFamily: E.mono, marginBottom: 4 }}>
                      {color.toUpperCase()}
                    </div>
                    <input type="range" min={0} max={1} step={0.05} value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: E.accent, margin: 0 }}/>
                    <div style={{ fontSize: 8, color: E.txtFaint }}>opacity {Math.round(opacity * 100)}%</div>
                  </div>
                </div>
              </div>

              {/* Palette */}
              <div style={{ padding: '12px 12px 10px', flex: 1 }}>
                <SLabel text="Palette" right={
                  <select value={palette} onChange={(e) => setPalette(e.target.value as PaletteName)}
                    style={{ fontSize: 9, color: E.txtMute, fontFamily: E.font,
                      background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <option value="sweetie16">Sweetie-16</option>
                    <option value="pico8">PICO-8</option>
                  </select>
                }/>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
                  {palColors.map((c, i) => (
                    <button key={i} onClick={() => setColor(c)}
                      style={{ aspectRatio: 1, background: c, borderRadius: 3, cursor: 'pointer',
                        border: c === color ? `2px solid ${E.txt}` : '1px solid rgba(0,0,0,0.35)',
                        padding: 0 }}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  if (embedded) return inner;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
      }}>
      {inner}
    </div>
  );
}
