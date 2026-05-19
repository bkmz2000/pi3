import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icons";
import { useRunner } from "../runner/RunnerProvider";
import { useThemeStore } from "../state/useTheme";

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
const DEFAULT_HEIGHT = 180;
const DEFAULT_WIDTH = 300;

export default function ConsolePanel({ onRight = false }: { onRight?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const { output, inputPrompt, respondToInput, clear, running } = useRunner();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(onRight ? DEFAULT_WIDTH : DEFAULT_HEIGHT);
  const sizeRef = useRef(size);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    const text = output.map((l) => l.text).join("\n");
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
        {output.map((line, i) => (
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
        ))}
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
