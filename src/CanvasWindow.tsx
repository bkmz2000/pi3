import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRunner } from "./runner/RunnerProvider";

export default function CanvasWindow() {
  const { t } = useTranslation();
  const { attachCanvas, canvasActive } = useRunner();
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragState = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  useEffect(() => {
    attachCanvas(ref.current);
    return () => attachCanvas(null);
  }, [attachCanvas]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    setPos({
      x: dragState.current.baseX + e.clientX - dragState.current.startX,
      y: dragState.current.baseY + e.clientY - dragState.current.startY,
    });
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  return (
    <div
      className="fixed z-50 rounded-xl border border-white/10 bg-black/80 overflow-hidden shadow-2xl transition-opacity"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        right: "2rem",
        bottom: "2rem",
        opacity: canvasActive ? 1 : 0,
        pointerEvents: canvasActive ? "auto" : "none",
      }}
    >
      <div
        className="h-6 bg-white/10 cursor-grab active:cursor-grabbing flex items-center px-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="text-white/40 text-xs select-none">{t('canvas.label')}</span>
      </div>
      <canvas ref={ref} className="block" />
    </div>
  );
}
