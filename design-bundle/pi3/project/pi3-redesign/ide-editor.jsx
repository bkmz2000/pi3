// Code editor surface (with line numbers, syntax-highlighted sample code, and gutter dots),
// console output area, and the floating canvas window.

function LineNumber({ n, theme, current }) {
  return (
    <div style={{
      width: 38, paddingRight: 10, textAlign: "right", flex: "none",
      color: current ? theme.editorLNActive : theme.editorLN,
      fontFamily: theme.fontMono, fontSize: theme.fsCode,
      lineHeight: theme.lhCode + "px",
    }}>{n}</div>
  );
}

function CodeLine({ tokens, theme, lineNo, currentLine, gutter }) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: lineNo === currentLine ? theme.editorLineActive : "transparent",
      position: "relative",
    }}>
      <div style={{
        width: 6, flex: "none",
        background: gutter === "err" ? theme.errorLine
          : gutter === "warn" ? theme.warnLine
          : "transparent",
      }} />
      <LineNumber n={lineNo} theme={theme} current={lineNo === currentLine} />
      <div style={{
        flex: 1, fontFamily: theme.fontMono, fontSize: theme.fsCode,
        lineHeight: theme.lhCode + "px",
        whiteSpace: "pre", color: theme.editorTxt,
      }}>
        {tokens.map((t, i) => (
          <span key={i} style={{ color: theme.syn[t.k] || theme.editorTxt, fontStyle: t.k === "comment" ? "italic" : "normal" }}>{t.t}</span>
        ))}
      </div>
    </div>
  );
}

function CodeEditor({ theme, lang }) {
  const lines = SAMPLE_CODE(lang);
  const currentLine = 18; // pretend cursor is here
  return (
    <div style={{
      flex: 1, minHeight: 0,
      background: theme.editorBg,
      overflow: "hidden",
      position: "relative",
      fontFamily: theme.fontMono,
    }}>
      <div style={{
        position: "absolute", inset: 0, overflow: "auto",
        padding: "12px 0",
      }}>
        {lines.map((ln, i) => (
          <CodeLine
            key={i}
            tokens={ln.tokens}
            lineNo={i + 1}
            currentLine={currentLine}
            gutter={ln.gutter}
            theme={theme}
          />
        ))}
        <div style={{ height: 200 }} />
      </div>

      {/* Inline error chip on a line */}
      <div style={{
        position: "absolute",
        left: 56, top: (12 - 1) + ((10 - 1) * theme.lhCode), // line 10
        background: theme.errorChipBg, color: theme.errorChipTxt,
        fontFamily: theme.fontUI, fontSize: 11.5, fontWeight: theme.weightUI + 100,
        padding: "2px 10px", borderRadius: 999,
        display: "inline-flex", alignItems: "center", gap: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        pointerEvents: "none",
      }}>
        <PI3Icon name="warn" size={12} color="currentColor" />
        {PI3_STRINGS[lang].editor.lintHint}
      </div>
    </div>
  );
}

function ConsoleStrip({ theme, lang, running }) {
  const t = PI3_STRINGS[lang];
  return (
    <div style={{
      height: 132, flex: "none",
      background: theme.consoleBg,
      borderTop: `1px solid ${theme.consoleBorder}`,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        height: 32, padding: "0 14px",
        display: "flex", alignItems: "center", gap: 14,
        borderBottom: `1px solid ${theme.consoleBorder}`,
      }}>
        <div style={{
          fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100,
          color: theme.consoleTxt, fontSize: 12.5, letterSpacing: 0.4,
          textTransform: "uppercase",
        }}>{t.console.title}</div>
        <div style={{
          padding: "2px 8px", borderRadius: 999,
          background: running ? theme.successPill : theme.chip,
          color: running ? theme.successPillTxt : theme.consoleTxtMute,
          fontFamily: theme.fontUI, fontSize: 10.5, fontWeight: theme.weightUI + 100,
          textTransform: "uppercase", letterSpacing: 0.6,
        }}>{running ? t.console.running : t.console.idle}</div>
        <div style={{ flex: 1 }} />
        <button type="button" style={{
          all: "unset", cursor: "pointer",
          fontFamily: theme.fontUI, fontSize: 12, fontWeight: theme.weightUI,
          color: theme.consoleTxtMute,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <PI3Icon name="trash" size={13} color="currentColor" />
          {t.console.clear}
        </button>
      </div>
      <div style={{
        flex: 1, padding: "10px 14px",
        fontFamily: theme.fontMono, fontSize: 12.5,
        color: theme.consoleTxt,
        overflow: "auto", lineHeight: 1.55,
      }}>
        {t.console.lines.map((line, i) => (
          <div key={i} style={{
            color: line.k === "info" ? theme.consoleInfo
              : line.k === "warn" ? theme.consoleWarn
              : line.k === "err" ? theme.consoleErr
              : theme.consoleTxt,
            display: "flex", gap: 10,
          }}>
            <span style={{ color: theme.consoleTxtMute, flex: "none", width: 50 }}>{line.t}</span>
            <span style={{ flex: "none", width: 12, opacity: 0.7 }}>{line.k === "info" ? "›" : line.k === "warn" ? "!" : line.k === "err" ? "✕" : "·"}</span>
            <span style={{ whiteSpace: "pre-wrap" }}>{line.text}</span>
          </div>
        ))}
        {running && (
          <div style={{ display: "flex", gap: 10, color: theme.consoleTxtMute }}>
            <span style={{ width: 50 }}>—</span>
            <span style={{ width: 12 }}>·</span>
            <span style={{ display: "inline-flex", gap: 4 }}>
              <BlinkDot color={theme.consoleInfo} />
              <BlinkDot color={theme.consoleInfo} delay={0.2} />
              <BlinkDot color={theme.consoleInfo} delay={0.4} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function BlinkDot({ color, delay = 0 }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: 6, background: color, display: "inline-block",
      animation: `pi3blink 1s ease-in-out ${delay}s infinite`,
    }} />
  );
}

// The floating Canvas window — Pico-8 style game viewport.
function CanvasWindow({ theme, lang, running, frame, onClose, dock = "br" }) {
  const t = PI3_STRINGS[lang];
  const w = 360;
  const h = 360 + 30; // titlebar + canvas
  const dockStyle = {
    br: { right: 24, bottom: 24 },
    bl: { left: 84, bottom: 24 },
    tr: { right: 24, top: 76 },
  }[dock];
  return (
    <div style={{
      position: "absolute", ...dockStyle, width: w, height: h,
      background: theme.canvasFrame,
      borderRadius: theme.radiusCard,
      boxShadow: "0 14px 40px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)",
      border: `1px solid ${theme.canvasBorder}`,
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      zIndex: 5,
    }}>
      <div style={{
        height: 30, padding: "0 10px 0 14px",
        display: "flex", alignItems: "center", gap: 8,
        background: theme.canvasTitle,
        color: theme.canvasTitleTxt,
        borderBottom: `1px solid ${theme.canvasBorder}`,
        fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, fontSize: 12.5,
      }}>
        <PI3Icon name="play" size={11} color={running ? theme.runBg : theme.canvasTitleTxt} />
        <span>{t.canvas.title}</span>
        <span style={{
          padding: "1px 7px", borderRadius: 999,
          background: running ? theme.successPill : theme.chip,
          color: running ? theme.successPillTxt : theme.consoleTxtMute,
          fontSize: 10, fontWeight: theme.weightUI + 100,
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>{running ? t.canvas.live : t.canvas.paused}</span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: theme.fontMono, fontSize: 11, color: theme.canvasTitleTxtMute,
        }}>60 FPS</span>
        <button type="button" onClick={onClose} aria-label="Close canvas"
          style={{
            all: "unset", cursor: "pointer",
            width: 22, height: 22, borderRadius: 6,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: theme.canvasTitleTxtMute,
          }}>
          <PI3Icon name="close" size={12} color="currentColor" />
        </button>
      </div>
      <div style={{
        flex: 1, position: "relative",
        background: theme.canvasBg,
        imageRendering: "pixelated",
      }}>
        <CanvasArt theme={theme} running={running} frame={frame} />
        {!running && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, color: theme.canvasHintTxt,
            background: theme.canvasOverlay,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 999,
              background: theme.runBg, color: theme.runTxt,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(52,168,83,0.35)",
            }}>
              <PI3Icon name="play" size={22} color="currentColor" />
            </div>
            <div style={{
              fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, fontSize: 14,
              color: theme.canvasHintTxt,
            }}>{t.canvas.pressRun}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Static-ish "game" — a ship + a few rocks + score, drawn from the running frame.
function CanvasArt({ theme, running, frame }) {
  const f = frame || 0;
  // Ship oscillates, rocks drift
  const shipX = 180 + Math.sin(f / 30) * 60;
  const shipY = 250;
  const rocks = [
    { x: ((f * 0.6) % 360), y: 50, s: 22 },
    { x: ((f * 0.9 + 120) % 360), y: 120, s: 16 },
    { x: ((f * 0.4 + 240) % 360), y: 180, s: 28 },
  ];
  return (
    <svg width="100%" height="100%" viewBox="0 0 360 360" style={{ display: "block" }}>
      {/* starfield */}
      {Array.from({ length: 30 }).map((_, i) => {
        const sx = (i * 53) % 360;
        const sy = (i * 97) % 360;
        const tw = ((f / 6 + i * 13) % 60) / 60;
        return <rect key={i} x={sx} y={sy} width={2} height={2} fill={theme.canvasStar} opacity={0.3 + tw * 0.7} />;
      })}
      {/* rocks */}
      {rocks.map((r, i) => (
        <g key={i} transform={`translate(${r.x}, ${r.y}) rotate(${f + i * 60})`}>
          <path
            d={`M -${r.s} -2 L -${r.s/2} -${r.s} L ${r.s/2} -${r.s/1.4} L ${r.s} 0 L ${r.s/2} ${r.s} L -${r.s/2} ${r.s/1.2} Z`}
            fill={theme.canvasRock}
          />
        </g>
      ))}
      {/* ship */}
      <g transform={`translate(${shipX}, ${shipY})`}>
        <path d="M 0 -18 L 14 16 L 0 8 L -14 16 Z" fill={theme.canvasShip} />
        <path d="M 0 8 L 6 18 L 0 14 L -6 18 Z" fill={theme.runBg} />
      </g>
      {/* HUD */}
      <text x="14" y="26" fill={theme.canvasHud} fontFamily={theme.fontMono} fontWeight="700" fontSize="14">SCORE 0420</text>
      <text x="288" y="26" fill={theme.canvasHud} fontFamily={theme.fontMono} fontWeight="700" fontSize="14">LIVES ♥♥♥</text>
    </svg>
  );
}

window.CodeEditor = CodeEditor;
window.ConsoleStrip = ConsoleStrip;
window.CanvasWindow = CanvasWindow;
