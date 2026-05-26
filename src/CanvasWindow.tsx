import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRunner, useRunnerStore } from "./runner/RunnerProvider";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { useEditor, isExampleSessionId } from "./state/IdeState";
import { uploadProjectThumbnail } from "./state/api";

type Snap = { id: number; url: string; blob: Blob };
const MAX_SNAPS = 5;

export default function CanvasWindow() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { attachCanvas, canvasActive, running, canvasWidth, canvasHeight, captureScreenshot } = useRunner();
  const projectId = useEditor((s) => s.currentProjectId);
  const canPersist = !!projectId && !isExampleSessionId(projectId);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [coverId, setCoverId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const snapIdRef = useRef(0);

  useEffect(() => {
    return () => { snaps.forEach((s) => URL.revokeObjectURL(s.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset history when project changes
  useEffect(() => {
    setSnaps((cur) => {
      cur.forEach((s) => URL.revokeObjectURL(s.url));
      return [];
    });
    setCoverId(null);
  }, [projectId]);

  const capture = async () => {
    const blob = await captureScreenshot();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const snap: Snap = { id: ++snapIdRef.current, url, blob };
    setSnaps((cur) => {
      const next = [snap, ...cur];
      while (next.length > MAX_SNAPS) {
        const dropped = next.pop()!;
        URL.revokeObjectURL(dropped.url);
      }
      return next;
    });
    if (canPersist && projectId) {
      try {
        setBusy(true);
        await uploadProjectThumbnail(projectId, blob);
        setCoverId(snap.id);
      } catch (err) {
        console.warn("Thumbnail upload failed:", err);
      } finally {
        setBusy(false);
      }
    }
  };

  const setAsCover = async (snap: Snap) => {
    if (!canPersist || !projectId) return;
    try {
      setBusy(true);
      await uploadProjectThumbnail(projectId, snap.blob);
      setCoverId(snap.id);
    } catch (err) {
      console.warn("Thumbnail upload failed:", err);
    } finally {
      setBusy(false);
    }
  };
  const ref = useRef<HTMLCanvasElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
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

  // Clamp after canvas resize so the title bar never ends up above the viewport
  useEffect(() => {
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    if (rect.top < 0) setPos(p => ({ x: p.x, y: p.y - rect.top }));
  }, [canvasWidth, canvasHeight]);

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
    const newX = dragState.current.baseX + e.clientX - dragState.current.startX;
    let newY = dragState.current.baseY + e.clientY - dragState.current.startY;

    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      const projectedTop = rect.top + (newY - pos.y);
      if (projectedTop < 0) newY -= projectedTop;
    }

    setPos({ x: newX, y: newY });
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  // Calculate visual scale to respect Python's size() call while keeping canvas usable
  const w = canvasWidth > 0 ? canvasWidth : 300;
  const h = canvasHeight > 0 ? canvasHeight : 300;
  const [visualScale, setVisualScale] = useState(1);
  useEffect(() => {
    if (!canvasActive) {
      setVisualScale(1);
      return;
    }
    
    // Get viewport width (approximate using window.innerWidth)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxAllowedWidth = viewportWidth * 0.8; // 80% of viewport width
    const maxAllowedHeight = viewportHeight * 0.8; // 80% of viewport height
    
    // Calculate scale needed to fit within max allowed dimensions
    const widthScale = w > maxAllowedWidth ? maxAllowedWidth / w : 1;
    const heightScale = h > maxAllowedHeight ? maxAllowedHeight / h : 1;
    const scale = Math.min(widthScale, heightScale, 1); // Never scale up, only down if needed
    setVisualScale(scale);
  }, [canvasActive, w, h]);

  // Recompute the display↔native scale whenever the canvas is rendered.
  // Stored in the runner so mouse coords map correctly.
  // This combines the Python-set size with any visual scaling applied.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const displayW = el.getBoundingClientRect().width || w;
      const displayH = el.getBoundingClientRect().height || h;
      // Actual scale factor from pixel buffer to displayed pixels
      const scaleW = displayW > 0 ? w / displayW : 1;
      const scaleH = displayH > 0 ? h / displayH : 1;
      // Use average scale for mouse mapping (could be improved to handle non-uniform scaling)
      useRunnerStore.setState({ canvasScale: (scaleW + scaleH) / 2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, canvasActive, visualScale]);

  return (
    <div
      ref={windowRef}
      style={{
        position: "fixed",
        right: 24,
        bottom: 156,
        width: `${w}px`,
        height: `${h + 30}px`, // +30 for title bar
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
          {running ? t('canvas.statusLive') : t('canvas.statusPaused')}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); capture(); }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={!canvasActive || busy}
          title={t('canvas.screenshot')}
          style={{
            all: 'unset',
            cursor: canvasActive && !busy ? 'pointer' : 'default',
            opacity: canvasActive ? (busy ? 0.5 : 1) : 0.35,
            width: 22, height: 22, borderRadius: 4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: theme.canvasTitleTxt,
          }}
        >
          <Icon name="camera" size={14} color="currentColor" />
        </button>
        {snaps.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowHistory((v) => !v); }}
            onPointerDown={(e) => e.stopPropagation()}
            title={t('canvas.screenshotHistory')}
            style={{
              all: 'unset', cursor: 'pointer',
              padding: '0 4px', height: 18, borderRadius: 9,
              background: showHistory ? theme.chip : 'transparent',
              color: theme.canvasTitleTxt,
              fontFamily: theme.fontMono, fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            {snaps.length}
          </button>
        )}
      </div>
      {showHistory && snaps.length > 0 && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 32, right: 6,
            background: theme.surfacePanel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 6,
            padding: 6,
            display: 'flex', gap: 6,
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            zIndex: 10,
          }}
        >
          {snaps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAsCover(s)}
              disabled={!canPersist || busy}
              title={canPersist ? t('canvas.setAsCover') : t('canvas.screenshotNoProject')}
              style={{
                all: 'unset', cursor: canPersist && !busy ? 'pointer' : 'default',
                width: 48, height: 48, borderRadius: 4,
                border: `2px solid ${s.id === coverId ? theme.accent : 'transparent'}`,
                overflow: 'hidden', display: 'block',
                opacity: canPersist ? 1 : 0.6,
              }}
            >
              <img src={s.url} width={48} height={48} style={{ display: 'block', objectFit: 'cover', imageRendering: 'pixelated' }} alt="" />
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          width: `${w}px`,
          height: `${h}px`,
          position: "relative",
          background: theme.canvasBg,
          imageRendering: "pixelated",
          overflow: "hidden",
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Canvas pixel buffer stays at native (w, h). Visual size scales
            down via CSS so it always fits while preserving
            aspect ratio. Mouse coords are remapped via canvasScale. */}
        <canvas
          ref={ref}
          width={w}
          height={h}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            aspectRatio: `${w} / ${h}`,
            imageRendering: 'pixelated',
            transformOrigin: 'top left',
            transform: `scale(${visualScale})`,
          }}
        />
      </div>
    </div>
  );
}