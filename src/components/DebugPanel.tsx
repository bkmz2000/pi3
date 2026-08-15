import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRunnerStore } from "../runner/RunnerProvider";
import type { SlotSnapshot, DebugFrame, DebugSelectionAtom } from "../runner/WorkerInterface";
import { useThemeStore, type Theme } from "../state/useTheme";
import { Icon } from "./Icons";
import { hexToRgb, rgbToHex } from "../sheetPixels";
import { usePointerScrub } from "../hooks/usePointerScrub";

// Canonical Woodblock/Sweetie16 palette — must stay in sync with Colors.*
// in graphics/_color.py and src/palette.ts. Theme-independent: these are
// the student's debug.array(red=..., green=...) colors, not app chrome.
const HIGHLIGHT: Record<string, string> = {
  red: "#b13e53",
  green: "#38b764",
  blue: "#3b5dc9",
  yellow: "#ffcd75",
  cyan: "#73eff7",
  gray: "#566c86",
};

function pickColor(color: string): string | null {
  return HIGHLIGHT[color] ?? null;
}

// HSL L -= 18% while preserving hue — used when a cell has same-color fill+stroke,
// so the border stays visible against the fill.
function darkerShade(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const newL = Math.max(0, l - 0.18);
  const c = (1 - Math.abs(2 * newL - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rp = 0, gp = 0, bp = 0;
  if (hp < 1) [rp, gp, bp] = [c, x, 0];
  else if (hp < 2) [rp, gp, bp] = [x, c, 0];
  else if (hp < 3) [rp, gp, bp] = [0, c, x];
  else if (hp < 4) [rp, gp, bp] = [0, x, c];
  else if (hp < 5) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const m = newL - c / 2;
  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255);
}

// Fixed ink colors for text drawn on a saturated HIGHLIGHT swatch —
// theme-independent, same reasoning as HIGHLIGHT itself: the swatch color
// doesn't change with the app theme, so its contrasting ink shouldn't either.
const INK_DARK = "#0a1414";
const INK_LIGHT = "#f4f4f4";

function readableInk(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 140 ? INK_DARK : INK_LIGHT;
}

type ColorPick = { fill: string | null; stroke: string | null };

function pickFor1D(
  idx: number,
  fills: Record<string, DebugSelectionAtom[]>,
  strokes: Record<string, DebugSelectionAtom[]>,
): ColorPick {
  let fillColor: string | null = null;
  let strokeColor: string | null = null;
  const test = (atom: DebugSelectionAtom): boolean => {
    if (atom[0] === "index" && atom[1] === idx) return true;
    if (atom[0] === "range" && idx >= atom[1] && idx <= atom[2]) return true;
    return false;
  };
  for (const [color, atoms] of Object.entries(fills)) {
    for (const atom of atoms) if (test(atom)) fillColor = pickColor(color);
  }
  for (const [color, atoms] of Object.entries(strokes)) {
    for (const atom of atoms) if (test(atom)) strokeColor = pickColor(color);
  }
  if (fillColor && strokeColor && fillColor === strokeColor) {
    strokeColor = darkerShade(fillColor);
  }
  return { fill: fillColor, stroke: strokeColor };
}

function pickForGrid(
  r: number,
  c: number,
  fills: Record<string, DebugSelectionAtom[]>,
  strokes: Record<string, DebugSelectionAtom[]>,
): ColorPick {
  let fillColor: string | null = null;
  let strokeColor: string | null = null;
  const test = (atom: DebugSelectionAtom): boolean => {
    if (atom[0] === "cell" && atom[1] === r && atom[2] === c) return true;
    if (atom[0] === "row" && atom[1] === r) return true;
    if (atom[0] === "col" && atom[1] === c) return true;
    if (atom[0] === "region" && r >= atom[1] && c >= atom[2] && r <= atom[3] && c <= atom[4]) return true;
    return false;
  };
  for (const [color, atoms] of Object.entries(fills)) {
    for (const atom of atoms) if (test(atom)) fillColor = pickColor(color);
  }
  for (const [color, atoms] of Object.entries(strokes)) {
    for (const atom of atoms) if (test(atom)) strokeColor = pickColor(color);
  }
  if (fillColor && strokeColor && fillColor === strokeColor) {
    strokeColor = darkerShade(fillColor);
  }
  return { fill: fillColor, stroke: strokeColor };
}

function Cell({ pick, strokeWidth, children, size = 21, fresh = true, theme }: {
  pick: ColorPick;
  strokeWidth: number;
  children: React.ReactNode;
  size?: number;
  fresh?: boolean;
  theme: Theme;
}) {
  const background = pick.fill ?? theme.chip;
  const color = pick.fill ? readableInk(pick.fill) : theme.consoleTxtMute;
  const shadow = pick.stroke ? `inset 0 0 0 ${strokeWidth}px ${pick.stroke}` : undefined;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 8.5,
        fontWeight: 700,
        borderRadius: 2,
        background,
        color,
        boxShadow: shadow,
        opacity: fresh ? 1 : 0.5,
      }}
    >
      {children}
    </div>
  );
}

function ScrollTrack({ children }: { children: React.ReactNode }) {
  // Horizontal scroll when content exceeds width; inner track centers when it fits.
  return (
    <div style={{ width: "100%", overflowX: "auto", overflowY: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "center", minWidth: "min-content" }}>
        {children}
      </div>
    </div>
  );
}

function Array1DRenderer({ slot, theme }: { slot: SlotSnapshot; theme: Theme }) {
  const items = Array.isArray(slot.data) ? (slot.data as unknown[]) : [slot.data];
  const fills = slot.highlights;
  const strokes = slot.strokes ?? {};
  const sw = slot.strokeWidth ?? 2;
  return (
    <ScrollTrack>
      <div style={{ display: "flex", gap: 3, padding: "0 2px" }}>
        {items.map((item, i) => (
          <Cell key={i} pick={pickFor1D(i, fills, strokes)} strokeWidth={sw} fresh={slot.fresh} theme={theme}>
            {String(item)}
          </Cell>
        ))}
      </div>
    </ScrollTrack>
  );
}

function GridRenderer({ slot, theme }: { slot: SlotSnapshot; theme: Theme }) {
  const rows = Array.isArray(slot.data) ? (slot.data as unknown[][]) : [];
  const fills = slot.highlights;
  const strokes = slot.strokes ?? {};
  const sw = slot.strokeWidth ?? 2;
  return (
    <ScrollTrack>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 2px" }}>
        {rows.map((row, r) => (
          <div key={r} style={{ display: "flex", gap: 3 }}>
            {(Array.isArray(row) ? row : []).map((cellVal, c) => (
              <Cell
                key={c}
                pick={pickForGrid(r, c, fills, strokes)}
                strokeWidth={sw}
                fresh={slot.fresh}
                size={24}
                theme={theme}
              >
                {String(cellVal)}
              </Cell>
            ))}
          </div>
        ))}
      </div>
    </ScrollTrack>
  );
}

function TextRenderer({ slot, theme }: { slot: SlotSnapshot; theme: Theme }) {
  const s = String(slot.data);
  const fills = slot.highlights;
  const strokes = slot.strokes ?? {};
  const sw = slot.strokeWidth ?? 2;
  return (
    <ScrollTrack>
      <div style={{ display: "flex", gap: 2, padding: "0 2px" }}>
        {s.split("").map((ch, i) => (
          <Cell key={i} pick={pickFor1D(i, fills, strokes)} strokeWidth={sw} fresh={slot.fresh} size={18} theme={theme}>
            {ch === " " ? " " : ch}
          </Cell>
        ))}
      </div>
    </ScrollTrack>
  );
}

function LegendSwatch({ fill, stroke }: { fill: string | null; stroke: string | null }) {
  const box = 9;
  const border = 1.5;
  if (fill) {
    return (
      <span
        style={{
          display: "inline-block",
          width: box,
          height: box,
          borderRadius: 2,
          background: fill,
          boxShadow: stroke ? `inset 0 0 0 ${border}px ${stroke}` : undefined,
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        width: box,
        height: box,
        borderRadius: 2,
        background: "transparent",
        boxShadow: stroke ? `inset 0 0 0 ${border}px ${stroke}` : undefined,
      }}
    />
  );
}

function Legend({ slot, theme }: { slot: SlotSnapshot; theme: Theme }) {
  const fills = slot.highlights;
  const strokes = slot.strokes ?? {};
  const legend = slot.legend ?? {};
  const usedColors = new Set([...Object.keys(fills), ...Object.keys(strokes)]);
  if (usedColors.size === 0) return null;
  // Render in legend-dict order first (matches Python insertion), then any
  // remaining unlabelled colors at the end.
  const ordered: string[] = [];
  for (const c of Object.keys(legend)) if (usedColors.has(c)) ordered.push(c);
  for (const c of usedColors) if (!ordered.includes(c)) ordered.push(c);

  return (
    <div
      style={{
        marginTop: 8,
        fontSize: 11,
        color: theme.consoleTxtMute,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      {ordered.map((color) => {
        const base = pickColor(color);
        if (!base) return null;
        const hasFill = fills[color] && fills[color].length > 0;
        const hasStroke = strokes[color] && strokes[color].length > 0;
        const strokeSwatch = hasFill && hasStroke ? darkerShade(base) : (hasStroke ? base : null);
        const fillSwatch = hasFill ? base : null;
        const label = legend[color] ?? color;
        return (
          <span key={color} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <LegendSwatch fill={fillSwatch} stroke={strokeSwatch} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

function SlotTrack({ slot, theme }: { slot: SlotSnapshot; theme: Theme }) {
  const primaryLabel = Object.values(slot.labels ?? {})[0];
  return (
    <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11,
          color: theme.consoleTxtMute,
          marginBottom: 6,
          display: "flex",
          gap: 8,
          justifyContent: "center",
        }}
      >
        {primaryLabel && <span style={{ color: theme.consoleTxt, fontWeight: 600 }}>{primaryLabel}</span>}
        <span style={{ opacity: 0.6 }}>line {slot.line}</span>
        {!slot.fresh && <span style={{ opacity: 0.6 }}>(stale)</span>}
      </div>
      {(slot.kind === "array" || slot.kind === "stack" || slot.kind === "queue" || slot.kind === "set") && (
        <Array1DRenderer slot={slot} theme={theme} />
      )}
      {slot.kind === "grid" && <GridRenderer slot={slot} theme={theme} />}
      {slot.kind === "text" && <TextRenderer slot={slot} theme={theme} />}
      <Legend slot={slot} theme={theme} />
    </div>
  );
}

function Timeline({
  current,
  total,
  onChange,
  theme,
}: {
  current: number;
  total: number;
  onChange: (idx: number) => void;
  theme: Theme;
}) {
  const { trackRef, onPointerDown, onPointerMove, onPointerUp } = usePointerScrub<HTMLDivElement>(total, onChange);

  const pct = total <= 1 ? 0 : (current / (total - 1)) * 100;
  const thumbSize = 14;
  const trackH = 4;

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative",
        flex: 1,
        height: thumbSize + 4,
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      {/* Track */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `calc(50% - ${trackH / 2}px)`,
          height: trackH,
          background: theme.consoleBorder,
          borderRadius: trackH,
        }}
      />
      {/* Filled portion */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: `${pct}%`,
          top: `calc(50% - ${trackH / 2}px)`,
          height: trackH,
          background: HIGHLIGHT.green,
          borderRadius: trackH,
        }}
      />
      {/* Frame ticks */}
      {total <= 40 && Array.from({ length: total }).map((_, i) => {
        const pct = total <= 1 ? 0 : (i / (total - 1)) * 100;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${pct}%`,
              top: `calc(50% - 2px)`,
              width: 4,
              height: 4,
              marginLeft: -2,
              borderRadius: 4,
              background: i <= current ? HIGHLIGHT.green : theme.consoleBorder,
            }}
          />
        );
      })}
      {/* Thumb */}
      <div
        style={{
          position: "absolute",
          left: `${pct}%`,
          top: `calc(50% - ${thumbSize / 2}px)`,
          width: thumbSize,
          height: thumbSize,
          marginLeft: -thumbSize / 2,
          borderRadius: "50%",
          background: HIGHLIGHT.green,
          border: `2px solid ${theme.consoleTxt}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  title,
  children,
  theme,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: theme.chip,
        color: theme.consoleTxt,
        border: `1px solid ${theme.consoleBorder}`,
        borderRadius: 2,
        width: 32,
        height: 28,
        fontFamily: "inherit",
        fontSize: 12,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function DebugPanel() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const debugFrames = useRunnerStore((s) => s.debugFrames);
  const scrubIndex = useRunnerStore((s) => s.debugScrubIndex);
  const debugScrubTo = useRunnerStore((s) => s.debugScrubTo);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const total = debugFrames.length;
  const idx = scrubIndex ?? Math.max(0, total - 1);
  const atEnd = idx >= total - 1;

  useEffect(() => {
    if (!playing || total <= 1) return;
    const id = window.setInterval(() => {
      const cur = useRunnerStore.getState().debugScrubIndex ?? total - 1;
      if (cur >= total - 1) {
        setPlaying(false);
        return;
      }
      debugScrubTo(cur + 1);
    }, 1100);
    return () => window.clearInterval(id);
  }, [playing, total, debugScrubTo]);

  const frame: DebugFrame | undefined = useMemo(() => debugFrames[idx], [debugFrames, idx]);

  if (total === 0 || !frame) return null;

  const step = (dir: number) => {
    setPlaying(false);
    debugScrubTo(Math.max(0, Math.min(total - 1, idx + dir)));
  };

  return (
    <div
      style={{
        background: theme.consoleBg,
        borderBottom: `1px solid ${theme.consoleBorder}`,
        padding: "14px 16px",
        flex: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Row 1 — array / grid / text renderers per slot */}
        {frame.slots.map((slot) => (
          <div key={`${slot.filename}:${slot.line}`} style={{ width: "100%" }}>
            <SlotTrack slot={slot} theme={theme} />
          </div>
        ))}

        {/* Row 2 — timeline centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            maxWidth: 420,
          }}
        >
          <Timeline
            current={idx}
            total={total}
            onChange={(n) => {
              setPlaying(false);
              debugScrubTo(n);
            }}
            theme={theme}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11,
              color: theme.consoleTxtMute,
              whiteSpace: "nowrap",
              minWidth: 46,
              textAlign: "right",
            }}
          >
            {idx + 1} / {total}
          </span>
        </div>

        {/* Row 3 — buttons centered */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <ControlButton onClick={() => step(-1)} disabled={idx === 0} title={t('frameControls.previousFrame')} theme={theme}>
            <Icon name="step-back" size={14} />
          </ControlButton>
          <ControlButton
            onClick={() => {
              if (atEnd) debugScrubTo(0);
              setPlaying((p) => !p);
            }}
            title={t('frameControls.playPause')}
            theme={theme}
          >
            <Icon name={playing ? "pause" : "play"} size={14} />
          </ControlButton>
          <ControlButton onClick={() => step(1)} disabled={atEnd} title={t('frameControls.nextFrame')} theme={theme}>
            <Icon name="step-fwd" size={14} />
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
