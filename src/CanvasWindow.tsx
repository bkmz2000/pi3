import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRunner } from "./runner/RunnerProvider";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";

export default function CanvasWindow() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { attachCanvas, canvasActive, running } = useRunner();
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
      style={{
        position: "absolute",
        right: 24,
        bottom: 156,
        width: 360,
        height: 360 + 30,
        background: theme.canvasFrame,
        borderRadius: theme.radiusCard,
        boxShadow:
          "0 14px 40px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)",
        border: `1px solid ${theme.canvasBorder}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 5,
        transition: "opacity 0.3s",
        opacity: canvasActive ? 1 : 0,
        pointerEvents: canvasActive ? "auto" : "none",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          height: 30,
          padding: "0 10px 0 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: theme.canvasTitle,
          color: theme.canvasTitleTxt,
          borderBottom: `1px solid ${theme.canvasBorder}`,
          fontFamily: theme.fontUI,
          fontWeight: theme.weightUI + 100,
          fontSize: 12.5,
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <Icon name="play" size={11} color={running ? theme.runBg : theme.canvasTitleTxt} />
        <span>{t('canvas.label')}</span>
        <span
          style={{
            padding: "1px 7px",
            borderRadius: 999,
            background: running ? theme.successPill : theme.chip,
            color: running ? theme.successPillTxt : theme.consoleTxtMute,
            fontSize: 10,
            fontWeight: theme.weightUI + 100,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {running ? "live" : "paused"}
        </span>
        <div style={{ flex: 1 }} />
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          background: theme.canvasBg,
          imageRendering: "pixelated",
        }}
      >
        <canvas
          ref={ref}
          className="block"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
