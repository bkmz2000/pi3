import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { Theme } from "../state/useTheme";
import { screenToBufferPoint, bearingDegrees } from "../canvasWindowGeometry";

type Point = { x: number; y: number };

const RULER = 14;

/** Rounds a target step to a "nice" 1/2/5 * 10^n value, like a chart axis. */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}

export function MeasureOverlay({
  canvasRef,
  w,
  h,
  visualScale,
  canvasScale,
  active,
  theme,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  w: number;
  h: number;
  visualScale: number;
  canvasScale: number;
  active: boolean;
  theme: Theme;
}) {
  const [cursor, setCursor] = useState<Point | null>(null);
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);
  const draggingRef = useRef(false);

  // Own listeners on the same canvas node RunnerProvider already wires up —
  // both sets fire independently, so this never steals mouse input from a
  // running program.
  useEffect(() => {
    if (!active) {
      setCursor(null);
      setDrag(null);
      draggingRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toBuffer = (e: MouseEvent): Point =>
      screenToBufferPoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvasScale || 1);

    const onMove = (e: MouseEvent) => {
      const p = toBuffer(e);
      setCursor(p);
      if (draggingRef.current) setDrag((d) => (d ? { start: d.start, end: p } : d));
    };
    const onDown = (e: MouseEvent) => {
      const p = toBuffer(e);
      draggingRef.current = true;
      setDrag({ start: p, end: p });
    };
    const onUp = () => { draggingRef.current = false; };
    const onLeave = () => setCursor(null);

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseup", onUp);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, canvasRef, canvasScale]);

  if (!active) return null;

  const toDispX = (x: number) => x * visualScale;
  const toDispY = (y: number) => y * visualScale;

  // Aim for ~60 displayed px between major ticks regardless of canvas size/zoom.
  const majorStep = niceStep(60 / Math.max(visualScale, 0.001));
  const minorStep = majorStep / 5;

  const xTicks: { x: number; major: boolean }[] = [];
  for (let i = 0; i * minorStep <= w; i++) xTicks.push({ x: i * minorStep, major: i % 5 === 0 });
  const yTicks: { y: number; major: boolean }[] = [];
  for (let i = 0; i * minorStep <= h; i++) yTicks.push({ y: i * minorStep, major: i % 5 === 0 });

  const dist = drag ? Math.hypot(drag.end.x - drag.start.x, drag.end.y - drag.start.y) : 0;
  const angle = drag ? bearingDegrees(drag.start, drag.end) : 0;

  const tickColor = "rgba(255,255,255,0.4)";
  const labelStyle: CSSProperties = {
    position: "absolute",
    fontFamily: theme.fontMono,
    fontSize: 10,
    color: "#fff",
    background: "rgba(0,0,0,0.72)",
    padding: "1px 4px",
    borderRadius: 3,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <svg width={visualScale * w} height={visualScale * h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <rect x={0} y={0} width={visualScale * w} height={RULER} fill="rgba(0,0,0,0.55)" />
        <rect x={0} y={0} width={RULER} height={visualScale * h} fill="rgba(0,0,0,0.55)" />
        {xTicks.map(({ x, major }) => (
          <line key={`xt${x}`} x1={toDispX(x)} x2={toDispX(x)} y1={major ? 0 : RULER * 0.45} y2={RULER} stroke={tickColor} strokeWidth={1} />
        ))}
        {yTicks.map(({ y, major }) => (
          <line key={`yt${y}`} y1={toDispY(y)} y2={toDispY(y)} x1={major ? 0 : RULER * 0.45} x2={RULER} stroke={tickColor} strokeWidth={1} />
        ))}
        {xTicks.filter((tk) => tk.major && tk.x > 0).map(({ x }) => (
          <text key={`xl${x}`} x={toDispX(x) + 2} y={RULER - 3} fill="#fff" fontSize={8} fontFamily={theme.fontMono}>{Math.round(x)}</text>
        ))}
        {yTicks.filter((tk) => tk.major && tk.y > 0).map(({ y }) => (
          <text key={`yl${y}`} x={RULER + 2} y={toDispY(y) + 3} fill="#fff" fontSize={8} fontFamily={theme.fontMono}>{Math.round(y)}</text>
        ))}
        {cursor && (
          <>
            <line x1={toDispX(cursor.x)} x2={toDispX(cursor.x)} y1={0} y2={RULER} stroke={theme.accent} strokeWidth={1.5} />
            <line y1={toDispY(cursor.y)} y2={toDispY(cursor.y)} x1={0} x2={RULER} stroke={theme.accent} strokeWidth={1.5} />
          </>
        )}
        {drag && (
          <line
            x1={toDispX(drag.start.x)} y1={toDispY(drag.start.y)}
            x2={toDispX(drag.end.x)} y2={toDispY(drag.end.y)}
            stroke={theme.accent} strokeWidth={1.5} strokeDasharray="4 3"
          />
        )}
      </svg>
      {cursor && !drag && (
        <div style={{ ...labelStyle, left: toDispX(cursor.x) + 10, top: toDispY(cursor.y) + 10 }}>
          {Math.round(cursor.x)}, {Math.round(cursor.y)}
        </div>
      )}
      {drag && (
        <div style={{ ...labelStyle, left: toDispX((drag.start.x + drag.end.x) / 2) + 10, top: toDispY((drag.start.y + drag.end.y) / 2) + 10 }}>
          {Math.round(dist)}px, {Math.round(angle)}°
        </div>
      )}
    </div>
  );
}
