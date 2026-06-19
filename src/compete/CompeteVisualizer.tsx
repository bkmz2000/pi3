import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "../state/useTheme";

const NODES = [
  { x: 0.12, y: 0.18 },
  { x: 0.33, y: 0.10 },
  { x: 0.55, y: 0.18 },
  { x: 0.76, y: 0.10 },
  { x: 0.88, y: 0.28 },
  { x: 0.20, y: 0.50 },
  { x: 0.50, y: 0.50 },
  { x: 0.80, y: 0.50 },
  { x: 0.12, y: 0.82 },
  { x: 0.44, y: 0.82 },
  { x: 0.72, y: 0.82 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [1, 6], [2, 6], [4, 7],
  [5, 6], [6, 7],
  [5, 8], [6, 9], [7, 10],
  [8, 9], [9, 10],
  [3, 7],
];

// State per node: s=source f=frontier v=visited u=unreached t=target p=path
type NodeState = 's' | 'f' | 'v' | 'u' | 't' | 'p';
const FRAMES: NodeState[][] = [
  ['s', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u'],
  ['v', 'f', 'u', 'u', 'u', 'f', 'u', 'u', 'u', 'u', 'u'],
  ['v', 'v', 'f', 'u', 'u', 'f', 'f', 'u', 'u', 'u', 'u'],
  ['v', 'v', 'f', 'u', 'u', 'v', 'f', 'u', 'f', 'u', 'u'],
  ['v', 'v', 'v', 'f', 'u', 'v', 'f', 'u', 'f', 'u', 'u'],
  ['v', 'v', 'v', 'f', 'u', 'v', 'v', 'f', 'f', 'f', 'u'],
  ['v', 'v', 'v', 'f', 'u', 'v', 'v', 'f', 'v', 'f', 'u'],
  ['v', 'v', 'v', 'v', 'f', 'v', 'v', 'f', 'v', 'f', 'u'],
  ['v', 'v', 'v', 'v', 'f', 'v', 'v', 'v', 'v', 'f', 't'],
  ['v', 'v', 'v', 'v', 'f', 'v', 'v', 'v', 'v', 'v', 't'],
  ['p', 'v', 'v', 'v', 'v', 'p', 'p', 'p', 'v', 'v', 't'],
];

const SPEED_VALUES = [0.5, 1, 2, 5];

const VIZ_FRAME_KEY = 'pi3compete.vizFrame';

function nodeColor(s: NodeState) {
  switch (s) {
    case 's': return { fill: '#7adfe6', stroke: '#7adfe6', text: '#062a26' };
    case 'f': return { fill: '#1e4d56', stroke: '#fbbf77', text: '#fbbf77' };
    case 'v': return { fill: '#0e3a40', stroke: '#2d6068', text: '#5b8489' };
    case 'u': return { fill: '#0c2e34', stroke: '#1a3a40', text: '#2d6068' };
    case 't': return { fill: '#0e4d2e', stroke: '#7ee0a8', text: '#7ee0a8' };
    case 'p': return { fill: '#4d3010', stroke: '#f7b67a', text: '#f7b67a' };
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, frameIdx: number) {
  ctx.clearRect(0, 0, w, h);
  const states = FRAMES[Math.max(0, Math.min(frameIdx, FRAMES.length - 1))];
  const r = Math.min(w * 0.042, h * 0.055, 22);

  for (const [a, b] of EDGES) {
    const na = NODES[a], nb = NODES[b];
    const sa = states[a], sb = states[b];
    const active = (sa === 'v' || sa === 'p' || sa === 's') && (sb === 'v' || sb === 'p' || sb === 's');
    const onPath = sa === 'p' && sb === 'p';
    ctx.strokeStyle = onPath ? '#f7b67a' : active ? '#2d6068' : '#0e2a30';
    ctx.lineWidth = onPath ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(na.x * w, na.y * h);
    ctx.lineTo(nb.x * w, nb.y * h);
    ctx.stroke();
  }

  for (let i = 0; i < NODES.length; i++) {
    const { x, y } = NODES[i];
    const cx = x * w, cy = y * h;
    const c = nodeColor(states[i]);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = states[i] === 'u' || states[i] === 'v' ? 1 : 2;
    ctx.stroke();

    ctx.fillStyle = c.text;
    ctx.font = `bold ${Math.round(r * 0.85)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), cx, cy);
  }
}

export default function CompeteVisualizer() {
  const theme = useThemeStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [frame, setFrame] = useState(() => {
    const saved = parseInt(localStorage.getItem(VIZ_FRAME_KEY) ?? '0', 10);
    return isNaN(saved) ? 0 : Math.max(0, Math.min(saved, FRAMES.length - 1));
  });
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const frameRef = useRef(frame);
  const playingRef = useRef(playing);
  const speedIdxRef = useRef(speedIdx);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef(0);
  const tickRef = useRef<((now: number) => void) | null>(null);

  frameRef.current = frame;
  playingRef.current = playing;
  speedIdxRef.current = speedIdx;

  tickRef.current = (now: number) => {
    if (!playingRef.current) return;
    const speed = SPEED_VALUES[speedIdxRef.current];
    const interval = 1000 / speed;
    if (now - lastTickRef.current >= interval) {
      lastTickRef.current = now;
      setFrame((f) => {
        const next = f + 1;
        if (next >= FRAMES.length) {
          setPlaying(false);
          return f;
        }
        localStorage.setItem(VIZ_FRAME_KEY, String(next));
        return next;
      });
    }
    rafRef.current = requestAnimationFrame((t) => tickRef.current?.(t));
  };

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, size.w, size.h, frame);
  }, [frame, size]);

  useEffect(() => {
    if (playing) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame((t) => tickRef.current?.(t));
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const setFrameManual = (f: number) => {
    const clamped = Math.max(0, Math.min(f, FRAMES.length - 1));
    setFrame(clamped);
    localStorage.setItem(VIZ_FRAME_KEY, String(clamped));
  };

  const btn = (style: React.CSSProperties) => ({
    all: 'unset' as const,
    cursor: 'pointer' as const,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 4,
    ...style,
  });

  const speed = SPEED_VALUES[speedIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, background: theme.consoleBg, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        <div style={{
          position: 'absolute', top: 8, left: 12,
          fontFamily: theme.fontUI, fontSize: 11, color: theme.consoleTxtMute,
          letterSpacing: 0.3,
        }}>
          BFS · node 1 → node 11 · length {frame >= FRAMES.length - 2 ? '4' : '?'}
        </div>
      </div>

      {/* Playback bar */}
      <div style={{
        height: 44,
        background: theme.surfacePanel,
        borderTop: `1px solid ${theme.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px',
        flex: 'none',
      }}>
        <button style={btn({ color: theme.panelTxtMute, width: 28, height: 28 })} onClick={() => { setPlaying(false); setFrameManual(0); }} title="Rewind">
          ⏮
        </button>
        <button
          style={btn({ color: theme.panelTxtMute, width: 28, height: 28, opacity: frame === 0 ? 0.35 : 1 })}
          disabled={frame === 0}
          onClick={() => { setPlaying(false); setFrameManual(frame - 1); }}
          title="Step back"
        >
          ◀
        </button>
        <button
          style={btn({
            width: 36, height: 36, borderRadius: 18,
            background: theme.runBg, color: theme.runTxt,
            fontSize: 14,
          })}
          onClick={() => {
            if (frame >= FRAMES.length - 1) { setFrameManual(0); setPlaying(true); }
            else setPlaying((p) => !p);
          }}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          style={btn({ color: theme.panelTxtMute, width: 28, height: 28, opacity: frame >= FRAMES.length - 1 ? 0.35 : 1 })}
          disabled={frame >= FRAMES.length - 1}
          onClick={() => { setPlaying(false); setFrameManual(frame + 1); }}
          title="Step forward"
        >
          ▶
        </button>
        <button
          style={btn({ color: speed !== 1 ? theme.accent : theme.panelTxtMute, fontFamily: theme.fontMono, fontSize: 11, fontWeight: 700, padding: '0 6px', height: 28 })}
          onClick={() => setSpeedIdx((i) => (i + 1) % SPEED_VALUES.length)}
          title="Speed"
        >
          {speed}×
        </button>

        <input
          type="range"
          min={0}
          max={FRAMES.length - 1}
          value={frame}
          onChange={(e) => { setPlaying(false); setFrameManual(Number(e.target.value)); }}
          style={{ flex: 1, accentColor: theme.accent }}
        />
        <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.consoleTxtMute, whiteSpace: 'nowrap' }}>
          {frame + 1} / {FRAMES.length}
        </span>
      </div>
    </div>
  );
}
