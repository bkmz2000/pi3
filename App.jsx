const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#0e9aa7",
  "density": 1,
  "darkMode": false
}/*EDITMODE-END*/;

// ── pi3 Design Tokens ────────────────────────────────────────────────────────
const T = {
  appBg:        "#e9e3d3",
  surface:      "#fbf6e9",
  panel:        "#fffaf0",
  panelHeader:  "#fdf3e1",
  chip:         "#f3ebd7",
  border:       "rgba(20,30,40,0.10)",
  borderStrong: "rgba(20,30,40,0.18)",

  txt:       "#1f2933",
  txtMute:   "#5b6976",
  txtFaint:  "#9aa6b2",

  teal:      "var(--ocd-tweak-accent-color)",
  tealDeep:  "#0a3d44",
  tealSoft:  "rgba(14,154,167,0.10)",
  tealLine:  "rgba(14,154,167,0.30)",

  student:     "#f6a560",
  studentSoft: "rgba(246,165,96,0.16)",
  studentLine: "rgba(246,165,96,0.45)",

  ok:        "#0e7c52",
  okSoft:    "rgba(14,124,82,0.12)",
  warn:      "#b87a1f",
  warnSoft:  "rgba(184,122,31,0.14)",
  danger:    "#c4451c",
  dangerSoft:"rgba(196,69,28,0.12)",

  fontUI:    "'Inter', system-ui, sans-serif",
  fontMono:  "'JetBrains Mono', ui-monospace, monospace",
  fontDisplay:"'Nunito', system-ui, sans-serif",

  rCard:   10,
  rBtn:    6,
  rPill:   999,
  rInput:  7,

  shadowCard:   "0 1px 0 rgba(20,30,40,0.04), 0 1px 3px rgba(20,30,40,0.06)",
  shadowPop:    "0 12px 32px -8px rgba(20,30,40,0.18), 0 2px 8px rgba(20,30,40,0.06)",
  shadowDialog: "0 30px 80px -28px rgba(20,30,40,0.40), 0 6px 18px rgba(20,30,40,0.10)",
};

// ── Indentation guide colors (softer, pastel scale) ──────────────────────────
const INDENT_COLORS = [
  "rgba(14,154,167,0.06)", "rgba(14,154,167,0.10)",
  "rgba(14,154,167,0.15)", "rgba(14,154,167,0.20)",
  "rgba(14,154,167,0.25)", "rgba(14,154,167,0.30)",
];

// ── Tiny SVG icon paths ──────────────────────────────────────────────────────
const Icon = {
  play:   <path d="M3 2l10 6-10 6V2z" fill="currentColor"/>,
  stop:   <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/>,
  chevD:  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  chevR:  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  check:  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  dot:    <circle cx="8" cy="8" r="4" fill="currentColor"/>,
  bulb:   <path d="M6 13V10a3 3 0 1 1 4 0v3M6 13h4m-3 0v1.5h2V13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  bulbF:  <path d="M6 13V10a3 3 0 1 1 4 0v3M6 13h4m-3 0v1.5h2V13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12"/>,
  x:      <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>,
  file:   <path d="M3.5 2.5h5l4 4v7a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>,
  plus:   <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>,
  copy:   <><rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.3" fill="none"/></>,
  spark:  <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15M3.7 3.7l1.8 1.8M10.5 10.5l1.8 1.8M3.7 12.3l1.8-1.8M10.5 5.5l1.8-1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>,
  reload: <path d="M2 8a6 6 0 0 1 9.9-4.2M14 8a6 6 0 0 1-9.9 4.2M2 3v5h5M14 13v-5h-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  grip:   <><circle cx="5" cy="5" r="1.2" fill="currentColor" opacity="0.35"/><circle cx="9" cy="5" r="1.2" fill="currentColor" opacity="0.35"/><circle cx="5" cy="9" r="1.2" fill="currentColor" opacity="0.35"/><circle cx="9" cy="9" r="1.2" fill="currentColor" opacity="0.35"/></>,
  sidebar: <><rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor"/><rect x="2" y="7" width="9" height="2" rx="1" fill="currentColor"/><rect x="2" y="11" width="7" height="2" rx="1" fill="currentColor"/></>,
  flag:   <path d="M3 2.5v11m0-11l7 3.5-7 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  clock:  <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
};

function Svg({ children, size = 14, color = "currentColor", ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ color, flex: "none", display: "block", ...props.style }} {...props}>
      {children}
    </svg>
  );
}

// ── Problem data ─────────────────────────────────────────────────────────────
const PROBLEM = {
  title: "Draw a Colorful Square",
  number: 4,
  unit: "Shapes & Colors",
  description: `Write a program that draws a **colorful square** in the center of the screen. The square should be 160 pixels wide and use a bright fill color of your choice. When you're happy with your code, press **Run** to test it!`,
  starter: `# Draw a colorful square
import graphics as g

def draw():
    # Fill the background
    g.fill(240, 248, 255)

    # Draw your square here!
    # Use g.rect(x, y, width, height)


    # Pick a color with g.fill(r, g, b)
    # g.fill(255, 128, 0) — try orange!


g.loop(draw)
`,
  hints: [
    { id: 1, title: "Where to place the square", body: "Use `g.rect(x, y, width, height)`. For a 160px square in the center of a 400×400 canvas, try `x = 120` and `y = 120`." },
    { id: 2, title: "How to pick a color", body: "Call `g.fill(r, g, b)` before `g.rect()`. Each number is 0–255. Try `g.fill(255, 128, 0)` for orange or `g.fill(46, 196, 182)` for teal." },
    { id: 3, title: "Don't forget g.loop()!", body: "Always end your program with `g.loop(draw)` so the canvas stays open and keeps updating. Without it, your drawing disappears!" },
  ],
  tests: [
    { label: "Uses g.rect() to draw a rectangle", passed: null },
    { label: "Rectangle is at least 140px wide", passed: null },
    { label: "Uses g.fill() to set a color", passed: null },
    { label: "Has g.loop(draw) at the end", passed: null },
  ],
};

const FILES = [
  { name: "main.py", active: true },
  { name: "helpers.py", active: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION CARD — from TeacherProblemForm pattern
// ═══════════════════════════════════════════════════════════════════════════════

function SectionCard({ icon, title, badge, children, style }) {
  return (
    <div style={{
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      overflow: "hidden",
      ...style,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 11px",
        borderBottom: `1px solid ${T.border}`,
        background: T.panelHeader,
      }}>
        <span style={{ color: T.teal, flexShrink: 0, display: "flex" }}>
          <Svg size={13}>{icon}</Svg>
        </span>
        <span style={{
          fontFamily: T.fontUI,
          fontSize: 11.5,
          fontWeight: 600,
          color: T.txtMute,
          flex: 1,
        }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontFamily: T.fontUI,
            fontSize: 10,
            fontWeight: 600,
            color: T.txtFaint,
            background: T.chip,
            padding: "1px 7px",
            borderRadius: T.rPill,
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: 10 }}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CODE EDITOR
// ═══════════════════════════════════════════════════════════════════════════════

function CodeEditor({ code, onChange }) {
  const editorRef = React.useRef(null);
  const highlightRef = React.useRef(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [cursorLine, setCursorLine] = React.useState(0);

  const lines = code.split("\n");
  const lineHeight = 22;
  const gutterW = 48;

  function getIndent(line) {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    return Math.floor(match[1].length / 4);
  }

  function handleScroll() {
    const el = editorRef.current;
    if (el) {
      setScrollTop(el.scrollTop);
      setScrollLeft(el.scrollLeft);
    }
  }

  function handleInput(e) {
    if (onChange) onChange(e.target.value);
  }

  function handleKeyDown(e) {
    const ta = e.target;
    const val = ta.value;
    const pos = ta.selectionStart;
    const before = val.substring(0, pos);
    setCursorLine(before.split("\n").length - 1);

    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = before.lastIndexOf("\n") + 1;
      const currentLine = val.substring(lineStart, pos);
      const indentMatch = currentLine.match(/^(\s*)/);
      let indent = indentMatch ? indentMatch[1] : "";
      if (currentLine.trimEnd().endsWith(":")) {
        indent += "    ";
      }
      const after = val.substring(pos);
      const newVal = before + "\n" + indent + after;
      if (onChange) onChange(newVal);
      const newPos = pos + 1 + indent.length;
      requestAnimationFrame(() => {
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
      });
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const newVal = before + "    " + val.substring(pos);
      if (onChange) onChange(newVal);
      const newPos = pos + 4;
      requestAnimationFrame(() => {
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
      });
    }
  }

  function handleClick(e) {
    const ta = e.target;
    requestAnimationFrame(() => {
      const before = ta.value.substring(0, ta.selectionStart);
      setCursorLine(before.split("\n").length - 1);
    });
  }

  const bandW = 32; // width of each 4-space indent band

  return (
    <div style={{
      flex: 1,
      position: "relative",
      overflow: "hidden",
      background: "#fffaf0",
    }}>
      {/* Highlight layer: line numbers + indent bands */}
      <div
        ref={highlightRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div style={{
          transform: `translate(-${scrollLeft}px, -${scrollTop}px)`,
        }}>
          {lines.map((line, i) => {
            const indent = getIndent(line);
            const indentBands = [];
            for (let j = 0; j < indent; j++) {
              indentBands.push(INDENT_COLORS[Math.min(j, INDENT_COLORS.length - 1)]);
            }
            return (
              <div key={i} style={{
                display: "flex",
                height: lineHeight,
                alignItems: "stretch",
              }}>
                {/* Line number */}
                <span style={{
                  width: gutterW,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 10,
                  fontFamily: T.fontMono,
                  fontSize: 11.5,
                  color: i === cursorLine ? T.teal : T.txtFaint,
                  fontWeight: i === cursorLine ? 600 : 400,
                  userSelect: "none",
                  lineHeight: 1,
                }}>
                  {i + 1}
                </span>
                {/* Indentation bands */}
                <div style={{ display: "flex", height: "100%" }}>
                  {indentBands.map((c, j) => (
                    <div key={j} style={{
                      width: bandW,
                      height: "100%",
                      background: c,
                      borderRight: j < indentBands.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transparent textarea */}
      <textarea
        ref={editorRef}
        value={code}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onScroll={handleScroll}
        spellCheck={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          overflow: "auto",
          fontFamily: T.fontMono,
          fontSize: 13,
          lineHeight: `${lineHeight}px`,
          color: T.txt,
          padding: 0,
          margin: 0,
          tabSize: 4,
          caretColor: T.teal,
          whiteSpace: "pre",
          paddingLeft: gutterW,
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSOLE PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function ConsolePanel({ output, errors, warnings, running }) {
  const [cleared, setCleared] = React.useState(false);
  const [height, setHeight] = React.useState(150);
  const startYRef = React.useRef(0);
  const startHRef = React.useRef(0);

  const hasOutput = output.length > 0 && !cleared;
  const errorCount = errors.length;
  const warnCount = warnings.length;
  const statusColor = errorCount > 0 ? T.danger : warnCount > 0 ? T.warn : running ? T.student : T.ok;

  function onDragStart(e) {
    e.preventDefault();
    startYRef.current = e.clientY || e.touches?.[0]?.clientY || 0;
    startHRef.current = height;
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove);
    document.addEventListener("touchend", onDragEnd);
  }
  function onDragMove(e) {
    const y = e.clientY || e.touches?.[0]?.clientY || 0;
    const delta = startYRef.current - y;
    setHeight(Math.max(80, Math.min(400, startHRef.current + delta)));
  }
  function onDragEnd() {
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
  }

  const display = cleared ? [] : output;

  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column" }}>
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        style={{
          height: 5,
          cursor: "ns-resize",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.tealSoft}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{
          width: 28, height: 3,
          borderRadius: T.rPill,
          background: T.borderStrong,
        }} />
      </div>

      {/* Console surface — soft dark, warmer tone */}
      <div style={{
        background: "#252d31",
        color: "#c8cdd0",
        fontFamily: T.fontMono,
        fontSize: 12,
        lineHeight: 1.55,
        height,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        borderTop: `1px solid ${T.border}`,
      }}>
        {/* Console header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 10px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flex: "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 7, height: 7, borderRadius: T.rPill,
              background: statusColor,
              animation: running ? "pi3-pulse 1.2s ease-in-out infinite" : "none",
              boxShadow: running ? `0 0 6px ${statusColor}` : "none",
            }} />
            <span style={{
              fontFamily: T.fontUI,
              fontSize: 10.5,
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 0.2,
            }}>
              {running ? "Running…" : "Output"}
              {!running && errorCount > 0 && ` · ${errorCount} error${errorCount > 1 ? "s" : ""}`}
              {!running && warnCount > 0 && ` · ${warnCount} warning${warnCount > 1 ? "s" : ""}`}
            </span>
          </div>
          <button onClick={() => setCleared(!cleared)} style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: T.fontUI,
            fontSize: 10.5,
            fontWeight: 500,
            color: "rgba(255,255,255,0.3)",
            padding: "2px 7px",
            borderRadius: 4,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >
            {cleared ? "Show" : "Clear"}
          </button>
        </div>

        {/* Output lines */}
        <div style={{ padding: "6px 10px", flex: 1 }}>
          {!hasOutput && !running ? (
            <span style={{ color: "rgba(255,255,255,0.22)", fontStyle: "italic", fontFamily: T.fontUI, fontSize: 12 }}>
              Run your code to see output here
            </span>
          ) : (
            <>
              {running && (
                <div style={{ color: T.student, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <Svg size={11} color={T.student}><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></Svg>
                  Running main.py…
                </div>
              )}
              {running && <div style={{ height: 3, background: "rgba(255,255,255,0.04)", borderRadius: T.rPill, marginBottom: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "40%", background: T.student, borderRadius: T.rPill, animation: "pi3-load-bar 1.2s ease-in-out infinite" }} />
              </div>}
              {display.map((line, i) => (
                <div key={i} style={{
                  color: line.type === "error" ? "#fca5a5"
                       : line.type === "warning" ? "#fde68a"
                       : line.type === "success" ? "#86efac"
                       : line.type === "info" ? "rgba(255,255,255,0.35)"
                       : "rgba(255,255,255,0.65)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  paddingLeft: line.type === "info" ? 0 : 0,
                }}>
                  {line.text}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST ROW
// ═══════════════════════════════════════════════════════════════════════════════

function TestRow({ label, passed }) {
  const icon = passed === true ? Icon.check :
               passed === false ? Icon.x :
               <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>;

  const color = passed === true ? T.ok :
                passed === false ? T.danger :
                T.txtFaint;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "3px 0",
      fontSize: 11.5,
      fontFamily: T.fontUI,
      color,
      transition: "color 0.3s, opacity 0.3s",
      fontWeight: passed != null ? 600 : 400,
      opacity: passed === null ? 0.6 : 1,
    }}>
      <Svg size={12} color={color}>{icon}</Svg>
      <span>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HINT CARD
// ═══════════════════════════════════════════════════════════════════════════════

function HintCard({ hint, index, expanded, onToggle }) {
  return (
    <div style={{
      background: T.chip,
      borderRadius: 6,
      overflow: "hidden",
      border: expanded ? `1px solid ${T.tealLine}` : `1px solid transparent`,
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: expanded ? "0 1px 4px rgba(14,154,167,0.08)" : "none",
    }}>
      <button
        onClick={() => onToggle(hint.id)}
        style={{
          all: "unset",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 9px",
          cursor: "pointer",
          fontFamily: T.fontUI,
          fontSize: 11.5,
          fontWeight: 600,
          color: expanded ? T.tealDeep : T.txtMute,
          boxSizing: "border-box",
          transition: "color 0.15s",
        }}
      >
        <Svg size={13} color={expanded ? T.teal : T.txtFaint}>
          {expanded ? Icon.bulbF : Icon.bulb}
        </Svg>
        <span style={{ flex: 1, textAlign: "left" }}>Hint {index + 1}: {hint.title}</span>
        <Svg size={11} color={expanded ? T.teal : T.txtFaint} style={{
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
        }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </Svg>
      </button>
      <div style={{
        maxHeight: expanded ? 200 : 0,
        overflow: "hidden",
        transition: "max-height 0.25s cubic-bezier(0.3, 0.7, 0.3, 1)",
      }}>
        <div style={{
          padding: "0 9px 8px 28px",
          fontSize: 12,
          lineHeight: 1.5,
          color: T.txtMute,
          fontFamily: T.fontUI,
        }}>
          {hint.body}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FILE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function FileTab({ name, active, onSelect }) {
  return (
    <div
      onClick={() => onSelect(name)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: "4px 4px 0 0",
        background: active ? "#fffaf0" : "rgba(255,255,255,0.14)",
        cursor: "pointer",
        fontFamily: T.fontMono,
        fontSize: 11.5,
        fontWeight: 600,
        color: active ? "#0a3d44" : "rgba(255,255,255,0.75)",
        userSelect: "none",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <Svg size={11} color={active ? T.teal : "rgba(255,255,255,0.5)"}>{Icon.file}</Svg>
      {name}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EDITOR TOOLBAR — teal bar, now with project context + prominent Run
// ═══════════════════════════════════════════════════════════════════════════════

function EditorToolbar({ files, activeFile, onSelectFile, onRun, running, runPhase }) {
  const runLabel = running
    ? (runPhase === 1 ? "Running…" : runPhase === 2 ? "Testing…" : "Running…")
    : "Run";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      background: T.teal,
      padding: "0 12px",
      height: 40,
      flex: "none",
      gap: 12,
    }}>
      {/* Left: pi3 brand + file tabs */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: "100%" }}>
        {/* pi3 mark */}
        <span style={{
          fontFamily: T.fontDisplay,
          fontWeight: 800,
          fontSize: 18,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: -0.3,
          lineHeight: 1,
          paddingBottom: 8,
          flex: "none",
        }}>
          pi<span style={{ fontSize: 12, verticalAlign: "0.12em" }}>3</span>
        </span>

        {/* File tabs */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: "100%" }}>
          {files.map(f => (
            <FileTab
              key={f.name}
              name={f.name}
              active={f.name === activeFile}
              onSelect={onSelectFile}
            />
          ))}
          <button style={{
            all: "unset",
            cursor: "pointer",
            padding: "4px 6px",
            marginBottom: 4,
            borderRadius: 4,
            color: "rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
            transition: "background 0.12s, color 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
          >
            <Svg size={12}>{Icon.plus}</Svg>
          </button>
        </div>
      </div>

      {/* Right: project name + shortcut + Run */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 5 }}>
        {/* Project context */}
        <span style={{
          fontFamily: T.fontUI,
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.55)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <Svg size={10} color="rgba(255,255,255,0.4)">{Icon.flag}</Svg>
          Problem {PROBLEM.number} · {PROBLEM.unit}
        </span>

        {/* Ctrl+Enter hint */}
        <span style={{
          fontFamily: T.fontUI,
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          background: "rgba(255,255,255,0.1)",
          padding: "2px 7px",
          borderRadius: T.rPill,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}>
          <kbd style={{
            fontFamily: T.fontMono,
            fontSize: 9.5,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
          }}>Ctrl+Enter</kbd>
        </span>

        {/* Run button — larger, more prominent */}
        <button
          onClick={onRun}
          disabled={running}
          style={{
            all: "unset",
            cursor: running ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 16px",
            borderRadius: T.rPill,
            background: running ? "rgba(255,255,255,0.2)" : "#fff",
            color: running ? "rgba(255,255,255,0.7)" : T.teal,
            fontFamily: T.fontUI,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.1,
            transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
            boxShadow: running ? "none" : "0 1.5px 3px rgba(0,0,0,0.18)",
            transform: running ? "scale(0.97)" : "scale(1)",
          }}
          onMouseEnter={e => {
            if (!running) {
              e.currentTarget.style.background = "#f2fafb";
              e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.22)";
            }
          }}
          onMouseLeave={e => {
            if (!running) {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.boxShadow = "0 1.5px 3px rgba(0,0,0,0.18)";
            }
          }}
          onMouseDown={e => {
            if (!running) {
              e.currentTarget.style.transform = "scale(0.96)";
            }
          }}
          onMouseUp={e => {
            if (!running) {
              e.currentTarget.style.transform = "scale(1)";
            }
          }}
        >
          <Svg size={14} color={running ? "rgba(255,255,255,0.7)" : T.teal}>
            {running ? Icon.spark : Icon.play}
          </Svg>
          {runLabel}
        </button>

        {/* User avatar */}
        <div style={{
          width: 26, height: 26,
          borderRadius: T.rPill,
          background: T.student,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.fontUI,
          fontWeight: 700,
          fontSize: 11,
          flex: "none",
        }}>
          AL
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PROBLEM PANEL — resizable, with SectionCard chunking
// ═══════════════════════════════════════════════════════════════════════════════

function ProblemPanel({ problem, tests, hints, expandedHint, onToggleHint, runPhase }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [width, setWidth] = React.useState(300);
  const dragRef = React.useRef(null);

  function onDragStart(e) {
    e.preventDefault();
    const startX = e.clientX || e.touches?.[0]?.clientX || 0;
    const startW = width;
    function onMove(ev) {
      const x = ev.clientX || ev.touches?.[0]?.clientX || 0;
      setWidth(Math.max(240, Math.min(480, startW + (x - startX))));
    }
    function onEnd() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onEnd);
  }

  const hasRun = tests.some(t => t.passed != null);
  const passCount = tests.filter(t => t.passed === true).length;
  const failCount = tests.filter(t => t.passed === false).length;
  const running = runPhase > 0 && runPhase < 3;

  return (
    <>
      <div style={{
        width: collapsed ? 40 : width,
        flex: "none",
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        transition: collapsed ? "width 0.25s cubic-bezier(0.2, 0.7, 0.3, 1)" : "none",
        overflow: "hidden",
      }}>
        {/* Panel header — compact, with collapse toggle */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: collapsed ? "10px 8px" : "10px 12px",
          borderBottom: `1px solid ${T.border}`,
          background: T.panelHeader,
          flex: "none",
        }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <Svg size={14} color={T.teal}>{Icon.sidebar}</Svg>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: T.fontUI,
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.txtFaint,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  lineHeight: 1,
                  marginBottom: 1,
                }}>
                  Problem {problem.number}
                </div>
                <div style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 15,
                  fontWeight: 800,
                  color: T.txt,
                  letterSpacing: -0.2,
                  lineHeight: 1.15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {problem.title}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Show problem" : "Hide problem"}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              color: T.txtFaint,
              display: "flex",
              alignItems: "center",
              flex: "none",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.chip; e.currentTarget.style.color = T.txtMute; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txtFaint; }}
          >
            <Svg size={15}>
              {collapsed ? Icon.chevR : Icon.chevD}
            </Svg>
          </button>
        </div>

        {!collapsed && (
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {/* Test progress bar — always visible after first run */}
            {hasRun && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 2px",
              }}>
                <div style={{
                  flex: 1,
                  height: 6,
                  borderRadius: T.rPill,
                  background: T.border,
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${(passCount / tests.length) * 100}%`,
                    background: failCount > 0 ? T.student : T.ok,
                    borderRadius: T.rPill,
                    transition: "width 0.5s cubic-bezier(0.3, 0.7, 0.3, 1)",
                  }} />
                </div>
                <span style={{
                  fontFamily: T.fontUI,
                  fontSize: 11,
                  fontWeight: 700,
                  color: failCount > 0 ? T.warn : T.ok,
                }}>
                  {passCount}/{tests.length}
                </span>
              </div>
            )}

            {/* Running indicator */}
            {running && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 10px",
                background: T.studentSoft,
                borderRadius: 6,
                border: `1px solid ${T.studentLine}`,
              }}>
                <Svg size={13} color={T.student}>{Icon.spark}</Svg>
                <span style={{
                  fontFamily: T.fontUI,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: T.student,
                }}>
                  {runPhase === 1 ? "Running your code…" : "Checking tests…"}
                </span>
              </div>
            )}

            {/* Description Card */}
            <SectionCard icon={Icon.file} title="Description">
              <div style={{
                fontFamily: T.fontUI,
                fontSize: 13,
                lineHeight: 1.55,
                color: T.txt,
              }}>
                {problem.description}
              </div>
            </SectionCard>

            {/* Tests Card */}
            <SectionCard
              icon={Icon.check}
              title="Tests"
              badge={hasRun ? `${passCount}/${tests.length} passed` : "4 checks"}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {tests.map((t, i) => (
                  <TestRow key={i} label={t.label} passed={t.passed} />
                ))}
              </div>
            </SectionCard>

            {/* Hints Card */}
            <SectionCard icon={Icon.bulb} title="Hints" badge={`${hints.length} available`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {hints.map((h, i) => (
                  <HintCard
                    key={h.id}
                    hint={h}
                    index={i}
                    expanded={expandedHint === h.id}
                    onToggle={onToggleHint}
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Resize drag handle */}
      {!collapsed && (
        <div
          ref={dragRef}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          style={{
            width: 4,
            flex: "none",
            cursor: "col-resize",
            background: "transparent",
            transition: "background 0.15s",
            position: "relative",
            zIndex: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.tealSoft; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PROBLEM EDITOR
// ═══════════════════════════════════════════════════════════════════════════════

function ProblemEditor() {
  const [code, setCode] = React.useState(PROBLEM.starter);
  const [activeFile, setActiveFile] = React.useState("main.py");
  const [running, setRunning] = React.useState(false);
  const [expandedHint, setExpandedHint] = React.useState(null);
  const [consoleOutput, setConsoleOutput] = React.useState([]);
  const [tests, setTests] = React.useState(PROBLEM.tests.map(t => ({...t})));
  const [runPhase, setRunPhase] = React.useState(0); // 0=idle, 1=running, 2=evaluating, 3=done

  function handleRun() {
    setRunning(true);
    setRunPhase(1);
    setConsoleOutput([{ text: "> python main.py", type: "info" }]);
    setTests(PROBLEM.tests.map(t => ({ ...t, passed: null })));

    // Phase 1 → 2: switch to evaluating
    setTimeout(() => {
      setRunPhase(2);
      setConsoleOutput(prev => [...prev, { text: "  Running tests…", type: "info" }]);
    }, 700);

    // Progressive test results
    setTimeout(() => {
      setTests(prev => prev.map((t, i) => i === 0 ? { ...t, passed: true } : t));
    }, 1100);

    setTimeout(() => {
      setTests(prev => prev.map((t, i) => i <= 1 ? { ...t, passed: true } : t));
    }, 1500);

    setTimeout(() => {
      setTests(prev => prev.map((t, i) => i <= 2 ? { ...t, passed: true } : t));
      setTests(prev => prev.map((t, i) => i === 3 ? { ...t, passed: false } : t));
    }, 1900);

    // Phase 3: done
    setTimeout(() => {
      setRunPhase(3);
      setRunning(false);

      const passCount = 1;
      const total = 4;
      if (passCount === total) {
        setConsoleOutput(prev => [
          ...prev,
          { text: "", type: "info" },
          { text: "✓ All 4 tests passed! Great job!", type: "success" },
          { text: "  Your colorful square is ready. Try changing the color next!", type: "info" },
        ]);
      } else {
        setConsoleOutput(prev => [
          ...prev,
          { text: "", type: "info" },
          { text: `✗ 1/4 tests passed. Keep going!`, type: "error" },
          { text: "  Hint: make sure you call g.rect() after setting a fill color with g.fill().", type: "warning" },
        ]);
      }
      setTimeout(() => setRunPhase(0), 2500);
    }, 2300);
  }

  function handleToggleHint(id) {
    setExpandedHint(expandedHint === id ? null : id);
  }

  // Keyboard shortcut
  React.useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!running) handleRun();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [running]);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: T.appBg,
      fontFamily: T.fontUI,
    }}>
      {/* ── Main editor body — no top shell bar; more vertical space ── */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
        margin: 10,
        borderRadius: T.rCard,
        background: T.surface,
        boxShadow: T.shadowCard,
      }}>
        {/* Problem panel + resize handle */}
        <ProblemPanel
          problem={PROBLEM}
          tests={tests}
          hints={PROBLEM.hints}
          expandedHint={expandedHint}
          onToggleHint={handleToggleHint}
          runPhase={runPhase}
        />

        {/* Code + Console column */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          borderRadius: `0 ${T.rCard}px ${T.rCard}px 0`,
          overflow: "hidden",
        }}>
          {/* Editor toolbar — teal bar with project context */}
          <EditorToolbar
            files={FILES}
            activeFile={activeFile}
            onSelectFile={setActiveFile}
            onRun={handleRun}
            running={running}
            runPhase={runPhase}
          />

          {/* Code editor */}
          <CodeEditor
            code={code}
            onChange={setCode}
          />

          {/* Console */}
          <ConsolePanel
            output={consoleOutput}
            errors={[]}
            warnings={[]}
            running={running}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: T.appBg,
    }}>
      <style>{`
        @keyframes pi3-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes pi3-load-bar {
          0% { margin-left: -60%; width: 60%; }
          50% { margin-left: 40%; width: 40%; }
          100% { margin-left: 100%; width: 30%; }
        }
      `}</style>
      <ProblemEditor />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
