import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icons";
import { useRunner, type WatchEntry } from "../runner/RunnerProvider";
import { useThemeStore } from "../state/useTheme";
import type { RuntimeError } from "../runner/WorkerInterface";
import type { Theme } from "../state/useTheme";

function BlinkDot({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 6,
        background: color,
        display: "inline-block",
        animation: `pi3blink 1s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

const MIN_SIZE = 80;
const MAX_SIZE = 700;

// ── Category icons and colors for error cards ──

const CATEGORY_ICONS: Record<string, string> = {
  naming: "🔤",
  types: "🔀",
  grammar: "📝",
  missing: "🔍",
  logic: "🧮",
  "api-misuse": "🔧",
  internal: "⚙️",
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  naming: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  types: { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  grammar: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  missing: { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" },
  logic: { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" },
  "api-misuse": { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  internal: { bg: "#f1f5f9", border: "#94a3b8", text: "#334155" },
};

function ErrorCard({ error }: { error: RuntimeError }) {
  const { t } = useTranslation();
  const { applySuggestion } = useRunner();
  const [showRaw, setShowRaw] = useState(false);
  const [appliedTokens, setAppliedTokens] = useState<Set<string>>(new Set());
  const colors = CATEGORY_COLORS[error.category] ?? CATEGORY_COLORS.logic;
  const icon = CATEGORY_ICONS[error.category] ?? "❗";

  const handleApply = (token: string, replacement: string) => {
    applySuggestion(token, replacement);
    setAppliedTokens((prev) => new Set(prev).add(token));
  };

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginTop: 6,
        fontFamily: "system-ui, sans-serif",
      }}
      data-error-card
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: colors.text,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {error.titleKey ? t(error.titleKey) : error.title}
        </span>
        {error.isBlocking && (
          <span style={{ fontSize: 10, color: colors.text, opacity: 0.6, marginLeft: "auto" }}>
            {t("friendlyError.blocksRunning")}
          </span>
        )}
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: 12.5,
          color: colors.text,
          lineHeight: 1.45,
        }}
      >
        {error.messageKey ? t(error.messageKey, error.messageArgs) : error.message}
      </div>

      {/* Batch mode: per-error listing */}
      {error.perErrors && error.perErrors.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {error.perErrors.map((pe, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px",
                background: "rgba(0,0,0,0.05)",
                borderRadius: 4,
              }}
            >
              {/* Line snippet */}
              <div
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  color: colors.text,
                  whiteSpace: "pre",
                }}
              >
                <span style={{ opacity: 0.5, marginRight: 8, userSelect: "none" }}>
                  {String(pe.line).padStart(3, " ")} │
                </span>
                {pe.snippet}
              </div>
              {/* Error label */}
              <div
                style={{
                  marginLeft: 32,
                  fontSize: 10,
                  color: colors.text,
                  opacity: 0.55,
                  marginTop: 2,
                  fontStyle: "italic",
                }}
              >
                {pe.label}
              </div>
              {/* Per-error suggestion chips */}
              {pe.token && !appliedTokens.has(pe.token) && pe.suggestions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, marginLeft: 32 }}>
                  {pe.suggestions.map((c) => {
                    const token = pe.token!;
                    return (
                      <span
                        key={c}
                        onClick={() => handleApply(token, c)}
                        style={{
                          display: "inline-flex",
                          padding: "1px 8px",
                          borderRadius: 10,
                          background: colors.border,
                          color: "#fff",
                          fontSize: 10.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "opacity 0.1s",
                        }}
                        title={`Click to replace '${pe.token}' with '${c}'`}
                      >
                        {c}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* No suggestion fallback (tokenless or token applied) */}
              {pe.token && !appliedTokens.has(pe.token) && pe.suggestions.length === 0 && (
                <div
                  style={{
                    marginLeft: 32,
                    fontSize: 11,
                    color: colors.text,
                    opacity: 0.6,
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  '{pe.token}' is not defined
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Code snippet (single error mode) */}
      {!error.perErrors && error.codeSnippet && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "rgba(0,0,0,0.05)",
            borderRadius: 4,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11.5,
            lineHeight: 1.4,
            color: colors.text,
            overflow: "auto",
            whiteSpace: "pre",
          }}
        >
          <span style={{ opacity: 0.5, marginRight: 8, userSelect: "none" }}>
            {String(error.codeLine ?? "?").padStart(3, " ")} │
          </span>
          {error.codeSnippet}
        </div>
      )}

      {/* Suggestion chips (single error mode) */}
      {!error.perErrors && error.suggestions.filter((s) => !appliedTokens.has(s.token)).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {error.suggestions
            .filter((s) => !appliedTokens.has(s.token))
            .flatMap((s) =>
            s.candidates.map((c) => (
              <span
                key={`${s.token}-${c}`}
                onClick={() => handleApply(s.token, c)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 10px",
                  borderRadius: 12,
                  background: colors.border,
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "opacity 0.1s",
                }}
                title={`Click to replace '${s.token}' with '${c}'`}
              >
                {c}
              </span>
            ))
          )}
        </div>
      )}

      {/* DBG-5: frame + watches at crash */}
      {(error.frame !== undefined || (error.watches && error.watches.length > 0)) && (
        <div
          style={{
            marginTop: 8,
            padding: "5px 8px",
            background: "rgba(0,0,0,0.05)",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            color: colors.text,
            opacity: 0.8,
          }}
        >
          {error.frame !== undefined && (
            <div>{t('friendlyError.crashContext', { frame: error.frame })}</div>
          )}
          {error.watches && error.watches.length > 0 && (
            <div style={{ marginTop: error.frame !== undefined ? 2 : 0 }}>
              {t('friendlyError.watchesAtCrash')}
              {error.watches.map((w) => (
                <div key={w.label} style={{ marginLeft: 8 }}>
                  <span style={{ opacity: 0.65 }}>{w.label}</span>{" "}
                  <span>{w.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw traceback toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 8,
          fontSize: 11,
          color: colors.text,
          opacity: 0.65,
        }}
      >
        <span style={{ fontSize: 10 }}>{showRaw ? "▾" : "▸"}</span>
        {showRaw ? t("friendlyError.hideRaw") : t("friendlyError.showRaw")}
      </button>

      {showRaw && (
        <pre
          style={{
            margin: "6px 0 0",
            padding: "8px 10px",
            background: "rgba(0,0,0,0.06)",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: colors.text,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {error.cleanRaw || error.raw}
        </pre>
      )}
    </div>
  );
}

function WatchRow({ entry, theme }: { entry: WatchEntry; theme: Theme }) {
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    setHighlighted(true);
    const id = setTimeout(() => setHighlighted(false), 500);
    return () => clearTimeout(id);
  }, [entry.changedAt]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        padding: "2px 14px",
        borderRadius: 4,
        background: highlighted ? "rgba(255,220,0,0.18)" : "transparent",
        transition: "background 0.35s",
        minHeight: 22,
      }}
    >
      <span style={{ color: theme.consoleTxtMute, fontFamily: theme.fontMono, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "45%" }}>
        {entry.label}
      </span>
      {entry.value !== "" && (
        <span style={{ color: theme.consoleTxt, fontFamily: theme.fontMono, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "52%" }}>
          {entry.value}
        </span>
      )}
    </div>
  );
}

function WatchPanel({ watches, theme }: { watches: WatchEntry[]; theme: Theme }) {
  if (watches.length === 0) return null;
  return (
    <div
      style={{
        borderBottom: `1px solid ${theme.consoleBorder}`,
        padding: "4px 0",
        flex: "none",
      }}
    >
      {watches.map((w) => (
        <WatchRow key={w.label} entry={w} theme={theme} />
      ))}
    </div>
  );
}

export default function ConsolePanel({ onRight = false }: { onRight?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const { output, inputPrompt, respondToInput, clear, running, watches } = useRunner();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(() => onRight
    ? Math.round(window.innerWidth * 0.5)
    : Math.round(window.innerHeight * 0.3));
  const sizeRef = useRef(size);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [output, inputPrompt]);

  useEffect(() => {
    if (inputPrompt !== null) inputRef.current?.focus();
  }, [inputPrompt]);

  const submit = () => {
    if (inputPrompt === null) return;
    respondToInput(inputValue);
    setInputValue("");
  };

  const handleCopyConsole = () => {
    const text = output
      .map((l) => {
        if (l.kind === "error_card") return `[${l.error.title ?? l.error.titleKey}] ${l.error.message ?? l.error.messageKey ?? ""}`;
        return l.text;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startPos = onRight ? e.clientX : e.clientY;
    const startSize = sizeRef.current;
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      const delta = onRight
        ? startPos - ev.clientX   // dragging left = wider
        : startPos - ev.clientY;  // dragging up = taller
      const newSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, startSize + delta));
      sizeRef.current = newSize;
      setSize(newSize);
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      style={{
        ...(onRight
          ? { width: size, height: "100%", borderLeft: `1px solid ${theme.consoleBorder}` }
          : { height: size, borderTop: `1px solid ${theme.consoleBorder}` }),
        flex: "none",
        background: theme.consoleBg,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Resize handle */}
      <div
        onPointerDown={onResizeStart}
        style={{
          position: "absolute",
          ...(onRight
            ? { top: 0, bottom: 0, left: -4, width: 8, cursor: "ew-resize" }
            : { top: -4, left: 0, right: 0, height: 8, cursor: "ns-resize" }),
          touchAction: "none",
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: "absolute",
            ...(onRight
              ? { left: 2, top: "50%", transform: "translateY(-50%)", width: 3, height: 32 }
              : { top: 2, left: "50%", transform: "translateX(-50%)", width: 32, height: 3 }),
            borderRadius: 2,
            background: theme.panelBorder,
            opacity: 0.5,
            transition: "opacity 0.15s",
          }}
          className="resize-handle-bar"
        />
      </div>

      {/* Header */}
      <div
        style={{
          height: 32,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderBottom: `1px solid ${theme.consoleBorder}`,
          flex: "none",
        }}
      >
        <div
          style={{
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            color: theme.consoleTxt,
            fontSize: 12.5,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {t('sideMenu.console')}
        </div>
        <div
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: running ? theme.successPill : theme.chip,
            color: running ? theme.successPillTxt : theme.consoleTxtMute,
            fontFamily: theme.fontUI,
            fontSize: 10.5,
            fontWeight: theme.weightUI + 100,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {running ? t('app.statusRunning') : t('app.statusIdle')}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleCopyConsole}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: theme.fontUI,
            fontSize: 12,
            fontWeight: theme.weightUI,
            color: theme.consoleTxtMute,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="copy" size={13} color="currentColor" />
          {t('app.copyConsole')}
        </button>
        <button
          type="button"
          onClick={clear}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: theme.fontUI,
            fontSize: 12,
            fontWeight: theme.weightUI,
            color: theme.consoleTxtMute,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="trash" size={13} color="currentColor" />
          {t('app.clearConsole')}
        </button>
      </div>

      {/* Watch panel — auto-appears when watch() is called */}
      <WatchPanel watches={watches} theme={theme} />

      {/* Output */}
      <div
        style={{
          flex: 1,
          padding: "10px 14px",
          fontFamily: theme.fontMono,
          fontSize: 12.5,
          color: theme.consoleTxt,
          overflow: "auto",
          lineHeight: 1.55,
        }}
      >
        {output.map((line, i) => {
          if (line.kind === "error_card") {
            return <ErrorCard key={i} error={line.error} />;
          }
          return (
            <div
              key={i}
              style={{
                color: line.kind === "stderr" ? theme.consoleErr : theme.consoleTxt,
                display: "flex",
                gap: 10,
              }}
            >
              <span style={{ whiteSpace: "pre-wrap" }}>{line.text}</span>
            </div>
          );
        })}
        {inputPrompt !== null && (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <span style={{ color: theme.consoleInfo }}>{inputPrompt}</span>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{
                all: "unset",
                flex: 1,
                minWidth: 0,
                fontFamily: theme.fontMono,
                fontSize: 12.5,
                color: theme.consoleTxt,
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        )}
        {running && (
          <div style={{ display: "flex", gap: 10, color: theme.consoleTxtMute, marginTop: 4 }}>
            <span style={{ display: "inline-flex", gap: 4 }}>
              <BlinkDot color={theme.consoleInfo} />
              <BlinkDot color={theme.consoleInfo} delay={0.2} />
              <BlinkDot color={theme.consoleInfo} delay={0.4} />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
