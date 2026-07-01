import { useRunnerStore } from "../runner/RunnerProvider";
import type { SlotSnapshot, DebugFrame, DebugSelectionAtom } from "../runner/WorkerInterface";
import { useThemeStore } from "../state/useTheme";

// ── Color palette (vivid / desaturated pairs) ─────────────────────────────
const COLORS: Record<string, { vivid: string; desat: string; text: string }> = {
  red:    { vivid: "#ef4444", desat: "#fca5a5", text: "#fff" },
  green:  { vivid: "#10b981", desat: "#86efac", text: "#fff" },
  blue:   { vivid: "#3b82f6", desat: "#93c5fd", text: "#fff" },
  yellow: { vivid: "#f59e0b", desat: "#fde68a", text: "#1a1a1a" },
  cyan:   { vivid: "#06b6d4", desat: "#a5f3fc", text: "#fff" },
  gray:   { vivid: "#6b7280", desat: "#d1d5db", text: "#fff" },
};

function getCellColors(
  idx: number,
  highlights: Record<string, DebugSelectionAtom[]>,
  fresh: boolean,
): string | null {
  for (const [color, atoms] of Object.entries(highlights)) {
    for (const atom of atoms) {
      if (atom[0] === "index" && atom[1] === idx) {
        const c = COLORS[color];
        return c ? (fresh ? c.vivid : c.desat) : null;
      }
      if (atom[0] === "range" && idx >= atom[1] && idx <= atom[2]) {
        const c = COLORS[color];
        return c ? (fresh ? c.vivid : c.desat) : null;
      }
    }
  }
  return null;
}

function getGridCellColors(
  r: number,
  c: number,
  highlights: Record<string, DebugSelectionAtom[]>,
  fresh: boolean,
): string | null {
  for (const [color, atoms] of Object.entries(highlights)) {
    for (const atom of atoms) {
      if ((atom[0] === "cell" && atom[1] === r && atom[2] === c) ||
          (atom[0] === "row"  && atom[1] === r) ||
          (atom[0] === "col"  && atom[1] === c) ||
          (atom[0] === "region" && r >= atom[1] && c >= atom[2] && r <= atom[3] && c <= atom[4])) {
        const col = COLORS[color];
        return col ? (fresh ? col.vivid : col.desat) : null;
      }
    }
  }
  return null;
}

function Array1DRenderer({ slot }: { slot: SlotSnapshot }) {
  const theme = useThemeStore((s) => s.theme);
  const items = Array.isArray(slot.data) ? slot.data as unknown[] : [slot.data];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 0" }}>
      {items.map((item, i) => {
        const bg = getCellColors(i, slot.highlights, slot.fresh);
        return (
          <div
            key={i}
            style={{
              minWidth: 28, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 3,
              border: `1px solid ${theme.consoleBorder}`,
              background: bg ?? theme.surfacePanel,
              color: bg ? "#fff" : theme.consoleTxt,
              fontFamily: theme.fontMono, fontSize: 12,
              padding: "0 5px",
            }}
          >
            {String(item)}
          </div>
        );
      })}
    </div>
  );
}

function GridRenderer({ slot }: { slot: SlotSnapshot }) {
  const theme = useThemeStore((s) => s.theme);
  const rows = Array.isArray(slot.data) ? slot.data as unknown[][] : [];
  return (
    <div style={{ overflowX: "auto", padding: "4px 0" }}>
      <table style={{ borderCollapse: "collapse", fontFamily: theme.fontMono, fontSize: 11 }}>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {(Array.isArray(row) ? row : []).map((cellVal, c) => {
                const bg = getGridCellColors(r, c, slot.highlights, slot.fresh);
                return (
                  <td
                    key={c}
                    style={{
                      width: 24, height: 22,
                      textAlign: "center",
                      border: `1px solid ${theme.consoleBorder}`,
                      background: bg ?? theme.surfacePanel,
                      color: bg ? "#fff" : theme.consoleTxt,
                      padding: "0 2px",
                    }}
                  >
                    {String(cellVal)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextRenderer({ slot }: { slot: SlotSnapshot }) {
  const theme = useThemeStore((s) => s.theme);
  const s = String(slot.data);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: "4px 0" }}>
      {s.split("").map((ch, i) => {
        const bg = getCellColors(i, slot.highlights, slot.fresh);
        return (
          <div
            key={i}
            style={{
              width: 18, height: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 2,
              border: `1px solid ${theme.consoleBorder}`,
              background: bg ?? "transparent",
              color: bg ? "#fff" : theme.consoleTxt,
              fontFamily: theme.fontMono, fontSize: 12,
            }}
          >
            {ch === " " ? " " : ch}
          </div>
        );
      })}
    </div>
  );
}

function SlotTrack({ slot }: { slot: SlotSnapshot }) {
  const theme = useThemeStore((s) => s.theme);
  const label = Object.values(slot.labels ?? {})[0] ?? `line ${slot.line}`;
  const stale = !slot.fresh;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: theme.fontUI, fontSize: 11, color: theme.panelTxtMute,
        marginBottom: 2,
      }}>
        <span style={{ fontWeight: 600, color: stale ? theme.panelTxtMute : theme.panelTxt }}>
          {label}
        </span>
        <span style={{ opacity: 0.5 }}>line {slot.line}</span>
        {stale && <span style={{ color: "#888", fontSize: 10 }}>(stale)</span>}
      </div>
      {(slot.kind === "array" || slot.kind === "stack" || slot.kind === "queue" || slot.kind === "set") && (
        <Array1DRenderer slot={slot} />
      )}
      {slot.kind === "grid" && <GridRenderer slot={slot} />}
      {slot.kind === "text" && <TextRenderer slot={slot} />}
    </div>
  );
}

export default function DebugPanel() {
  const theme = useThemeStore((s) => s.theme);
  const debugFrames = useRunnerStore((s) => s.debugFrames);
  const scrubIndex = useRunnerStore((s) => s.debugScrubIndex);
  const debugScrubTo = useRunnerStore((s) => s.debugScrubTo);

  if (debugFrames.length === 0) return null;

  const idx = scrubIndex ?? debugFrames.length - 1;
  const frame: DebugFrame | undefined = debugFrames[idx];
  if (!frame) return null;

  return (
    <div style={{
      borderBottom: `1px solid ${theme.consoleBorder}`,
      background: theme.surfacePanel,
      padding: "6px 12px 4px",
      flex: "none",
    }}>
      {/* Scrub bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 6,
        fontFamily: theme.fontUI, fontSize: 11,
      }}>
        <span style={{ color: theme.panelTxt, fontWeight: 600 }}>debug</span>
        <button
          style={{
            all: "unset", cursor: "pointer",
            color: theme.panelTxtMute, fontSize: 13, lineHeight: "1",
            opacity: idx === 0 ? 0.35 : 1,
          }}
          disabled={idx === 0}
          onClick={() => debugScrubTo(Math.max(0, idx - 1))}
          title="Previous frame"
        >&#9664;</button>
        <input
          type="range"
          min={0}
          max={debugFrames.length - 1}
          value={idx}
          onChange={(e) => debugScrubTo(Number(e.target.value))}
          style={{ flex: 1, accentColor: theme.accent, cursor: "pointer" }}
        />
        <button
          style={{
            all: "unset", cursor: "pointer",
            color: theme.panelTxtMute, fontSize: 13, lineHeight: "1",
            opacity: idx >= debugFrames.length - 1 ? 0.35 : 1,
          }}
          disabled={idx >= debugFrames.length - 1}
          onClick={() => debugScrubTo(Math.min(debugFrames.length - 1, idx + 1))}
          title="Next frame"
        >&#9654;</button>
        <span style={{ color: theme.consoleTxtMute, whiteSpace: "nowrap" }}>
          {idx + 1} / {debugFrames.length}
        </span>
      </div>

      {/* Slot tracks */}
      {frame.slots.map((slot) => (
        <SlotTrack key={`${slot.filename}:${slot.line}`} slot={slot} />
      ))}
    </div>
  );
}
