import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRunner, useRunnerStore, type Screenshot } from "./runner/RunnerProvider";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { useEditor, isExampleSessionId } from "./state/IdeState";
import { uploadProjectThumbnail } from "./state/api";

export default function CanvasWindow() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { attachCanvas, canvasActive, running, canvasWidth, canvasHeight, captureScreenshot, paused, speed, pause, resume, step, setGameSpeed, stepBack, stepFwd } = useRunner();
  const workerEpoch = useRunnerStore((s) => s.workerEpoch);
  const frameHistory = useRunnerStore((s) => s.frameHistory);
  const scrubIndex = useRunnerStore((s) => s.scrubIndex);
  const projectId = useEditor((s) => s.currentProjectId);
  const canPersist = !!projectId && !isExampleSessionId(projectId);
  const snaps = useRunnerStore((s) => s.screenshots);
  const addScreenshot = useRunnerStore((s) => s.addScreenshot);
  const clearScreenshots = useRunnerStore((s) => s.clearScreenshots);
  const [showHistory, setShowHistory] = useState(false);
  const [coverId, setCoverId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const snapIdRef = useRef(0);

  // Reset history when project changes
  useEffect(() => {
    clearScreenshots();
    setCoverId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const capture = async () => {
    const blob = await captureScreenshot();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const snap: Screenshot = { id: ++snapIdRef.current, url, blob };
    addScreenshot(snap);
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

  const setAsCover = async (snap: Screenshot) => {
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

  // Clamp so the title bar never ends up outside the viewport (canvas resize or window resize)
  useEffect(() => {
    const clamp = () => {
      if (!windowRef.current) return;
      const rect = windowRef.current.getBoundingClientRect();
      const dy = rect.top < 0 ? -rect.top : 0;
      const dx = rect.left < 0 ? -rect.left : 0;
      if (dx !== 0 || dy !== 0) setPos(p => ({ x: p.x + dx, y: p.y + dy }));
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
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

  const w = canvasWidth > 0 ? canvasWidth : 300;
  const h = canvasHeight > 0 ? canvasHeight : 300;
  const [visualScale, setVisualScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      if (!canvasActive) { setVisualScale(1); return; }
      const maxW = window.innerWidth * 0.85;
      const maxH = (window.innerHeight - 60) * 0.85; // subtract approx title bar + console
      const ws = w > maxW ? maxW / w : 1;
      const hs = h > maxH ? maxH / h : 1;
      setVisualScale(Math.min(ws, hs, 1));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
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

  const visualW = Math.round(w * visualScale);
  const visualH = Math.round(h * visualScale);

  return (
    <div
      ref={windowRef}
      style={{
        position: "fixed",
        right: 24,
        bottom: 156,
        width: `${visualW}px`,
        height: `${visualH + 30}px`, // +30 for title bar
        // content-box, not the project-wide border-box default: width/height
        // above are meant to be the exact content size for the flex children
        // (title bar + canvas) to fill without shrinking. Under border-box,
        // this element's own 1px border ate 2px out of that declared height,
        // leaving the flex column 2px short — which either compressed a
        // child (flex-shrink) or, once shrink was disabled, overflowed and
        // got clipped by overflow:hidden instead. content-box makes the
        // border additive so neither happens.
        boxSizing: "content-box",
        background: theme.canvasFrame,
        borderRadius: theme.radiusCard,
        boxShadow:
          "0 14px 40px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)",
        border: `1px solid ${theme.canvasBorder}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
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
          flexShrink: 0,
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
        {running && canvasActive && (
          <>
            {paused && frameHistory.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); stepBack(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={scrubIndex === 0}
                title={t('canvas.rewindBack')}
                style={{
                  all: 'unset', cursor: scrubIndex === 0 ? 'not-allowed' : 'pointer',
                  width: 22, height: 22, borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.accent, opacity: scrubIndex === 0 ? 0.35 : 1,
                }}
              >
                <Icon name="step-back" size={13} color="currentColor" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (paused) resume(); else pause(); }}
              onPointerDown={(e) => e.stopPropagation()}
              title={paused ? t('sideMenu.resume') : t('sideMenu.pause')}
              style={{
                all: 'unset', cursor: 'pointer',
                width: 22, height: 22, borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: theme.canvasTitleTxt,
                background: paused ? 'rgba(255,220,0,0.22)' : 'transparent',
              }}
            >
              <Icon name={paused ? 'play' : 'pause'} size={13} color="currentColor" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); step(); }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!paused}
              title={t('sideMenu.step')}
              style={{
                all: 'unset', cursor: paused ? 'pointer' : 'not-allowed',
                width: 22, height: 22, borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: theme.canvasTitleTxt, opacity: paused ? 1 : 0.35,
              }}
            >
              <Icon name="step-fwd" size={13} color="currentColor" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setGameSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1); }}
              onPointerDown={(e) => e.stopPropagation()}
              title={t('sideMenu.speed')}
              style={{
                all: 'unset', cursor: 'pointer',
                height: 22, padding: '0 4px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: theme.fontUI, fontSize: 11, fontWeight: 600,
                color: speed === 1 ? theme.canvasTitleTxt : theme.accent,
              }}
            >
              {speed === 1 ? '1x' : speed === 2 ? '½x' : '¼x'}
            </button>
            {paused && frameHistory.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); stepFwd(); }}
                onPointerDown={(e) => e.stopPropagation()}
                title={t('canvas.rewindFwd')}
                style={{
                  all: 'unset', cursor: 'pointer',
                  width: 22, height: 22, borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: scrubIndex === null ? theme.canvasTitleTxt : theme.accent,
                }}
              >
                <Icon name="step-fwd" size={13} color="currentColor" />
              </button>
            )}
          </>
        )}
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
          width: `${visualW}px`,
          height: `${visualH}px`,
          flexShrink: 0,
          position: "relative",
          background: theme.canvasBg,
          imageRendering: "pixelated",
          overflow: "hidden",
        }}
      >
        <canvas
          key={workerEpoch}
          ref={ref}
          width={w}
          height={h}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
          }}
        />
        {scrubIndex !== null && frameHistory[scrubIndex] && (
          <>
            <img
              src={frameHistory[scrubIndex].url}
              alt=""
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                imageRendering: "pixelated",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.75)",
                color: "#ffe040",
                fontFamily: theme.fontUI,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {t('canvas.rewindChip', {
                frame: frameHistory[scrubIndex].frame,
                back: frameHistory.length - 1 - scrubIndex,
              })}
            </div>
            {/* Ring drawn as a plain sibling div, not styled on the <img> itself:
                border/outline/box-shadow on a replaced element (<img>) don't
                paint reliably in all browsers — a plain div always does. Placed
                last (after the rewind chip) because the chip's own `transform`
                promotes it to a separate compositing layer, and on some Chrome
                builds that layer's bounds silently occlude earlier siblings
                painted underneath it — painting last avoids that entirely. */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                boxShadow: "inset 0 0 0 2px rgba(255,220,0,0.7)",
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}