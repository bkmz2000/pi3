// Vector sprite editor — closely matches webide/src/SpriteEditor.tsx layout.
// Konva-based in the real app; rendered here as static SVG for design review.
//
// Layout:
//   ┌──────────────────────────────────────────────────────────┐
//   │ Save ▸  [sprite name]                              ✕     │
//   ├──────┬───────────────────────────────────────────────────┤
//   │ ◢ ▭  │                                                   │
//   │ ◯ ╱  │                Canvas (size × SCALE)              │
//   │ ✎ ⬡  │                checkerboard + crosshair           │
//   │ T    │                                                   │
//   │ ───  │                                                   │
//   │ ↶ ↷  │                                                   │
//   │ 🗑    │                                                   │
//   ├──────┴───────────────────────────────────────────────────┤
//   │ Fill ▣   Stroke ▣   Width ────●────  64/128             │
//   └──────────────────────────────────────────────────────────┘

function ToolBtn({ icon, label, kbd, active, theme, onClick, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} title={`${label}${kbd ? " ("+kbd+")" : ""}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        all: "unset", cursor: "pointer",
        width: 32, height: 32,
        borderRadius: theme.radiusButton,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: active
          ? theme.accent
          : danger
            ? (hover ? "rgba(196,69,28,0.18)" : "rgba(196,69,28,0.10)")
            : (hover ? theme.chip : "transparent"),
        color: active ? "#fff" : danger ? theme.stopBg : theme.panelTxt,
      }}>
      <PI3Icon name={icon} size={16} color="currentColor" strokeWidth={1.8} />
    </button>
  );
}

function Swatch({ color, active, ringColor, onClick }) {
  const isTrans = color === "transparent";
  return (
    <button type="button" onClick={onClick} aria-label={color}
      style={{
        all: "unset", cursor: "pointer",
        width: 22, height: 22, borderRadius: 3,
        background: isTrans
          ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 8px 8px"
          : color,
        boxShadow: active
          ? `0 0 0 2px ${ringColor}, inset 0 0 0 1px rgba(0,0,0,0.15)`
          : "inset 0 0 0 1px rgba(0,0,0,0.18)",
      }} />
  );
}

function ColorButton({ label, value, active, onClick, theme }) {
  const isTrans = value === "transparent";
  return (
    <button type="button" onClick={onClick}
      style={{
        all: "unset", cursor: "pointer",
        height: 28, padding: "0 10px",
        display: "inline-flex", alignItems: "center", gap: 8,
        background: active ? theme.chip : "transparent",
        border: `1px solid ${active ? theme.panelBorder : "transparent"}`,
        borderRadius: theme.radiusButton,
        fontFamily: theme.fontUI, fontSize: 11.5, fontWeight: theme.weightUI + 100,
        color: theme.panelTxtMute, textTransform: "uppercase", letterSpacing: 0.5,
      }}>
      <span>{label}</span>
      <span style={{
        width: 18, height: 18, borderRadius: 2,
        background: isTrans
          ? "repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 6px 6px"
          : value,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function ColorPopover({ open, value, onPick, theme, anchor = "left" }) {
  if (!open) return null;
  const palette = [
    "transparent",
    "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff",
    "#00ffff", "#ff8800", "#88ff00", "#0088ff", "#ff0088", "#884400", "#448800",
    "#004488", "#880044",
    // pi3 named extras
    "#1d2b53", "#7e2553", "#008751", "#5fd4dc", "#f6a560", "#0e7c8a",
  ];
  return (
    <div style={{
      position: "absolute", top: "100%", [anchor]: 0, marginTop: 6,
      background: theme.surfacePanel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: theme.radiusCard,
      boxShadow: "0 10px 32px -10px rgba(0,0,0,0.30)",
      padding: 10, width: 224, zIndex: 30,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, marginBottom: 8 }}>
        {palette.map(c => (
          <Swatch key={c} color={c} active={c === value}
            ringColor={theme.accent} onClick={() => onPick(c)} />
        ))}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 8px",
        background: theme.chip, borderRadius: 2,
        fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute,
      }}>
        <span style={{ flex: 1 }}>Custom</span>
        <span style={{ color: theme.panelTxt }}>{value}</span>
      </div>
    </div>
  );
}

function SpriteCanvas({ theme, size, scale, fill, stroke, strokeW, tool, mousePos }) {
  const W = size * scale;
  const H = size * scale;

  // Checkerboard transparency tile
  const tile = 8;
  const checks = [];
  for (let y = 0; y * tile < H; y++) {
    for (let x = 0; x * tile < W; x++) {
      if ((x + y) % 2 === 0) {
        checks.push(<rect key={`c${x}-${y}`} x={x * tile} y={y * tile} width={tile} height={tile} fill="rgba(127,127,127,0.10)" />);
      }
    }
  }

  // Demo: a vector spaceship made of pi3-style primitives so the canvas
  // shows "what the editor produces" rather than empty space.
  const cx = W / 2, cy = H / 2;
  const sw = strokeW * scale * 0.4;

  const cursorStyle = tool === "select" ? "default" : "crosshair";

  return (
    <div style={{
      position: "relative",
      width: W, height: H,
      background: "#ffffff",
      borderRadius: 2,
      boxShadow: `0 0 0 1px ${theme.panelBorder}, 0 24px 50px -22px rgba(0,0,0,0.30)`,
      overflow: "hidden",
      cursor: cursorStyle,
      flex: "none",
    }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {checks}

        {/* spaceship hull (polygon) */}
        <polygon
          points={`${cx},${cy - 110} ${cx + 86},${cy + 80} ${cx},${cy + 36} ${cx - 86},${cy + 80}`}
          fill={fill} stroke={stroke} strokeWidth={sw + 1.5} strokeLinejoin="round" />
        {/* cockpit (ellipse) */}
        <ellipse cx={cx} cy={cy - 30} rx="22" ry="34"
          fill={theme.accent} stroke={stroke} strokeWidth={sw + 1} />
        {/* exhaust (line / freehand) */}
        <path d={`M ${cx - 18} ${cy + 36} Q ${cx} ${cy + 96} ${cx + 18} ${cy + 36}`}
          fill={theme.runBg} stroke={stroke} strokeWidth={sw + 0.8} strokeLinejoin="round" />
        {/* small wing dot (rect) */}
        <rect x={cx - 70} y={cy + 50} width="14" height="14"
          fill={stroke} stroke={stroke} strokeWidth="1" />
        <rect x={cx + 56} y={cy + 50} width="14" height="14"
          fill={stroke} stroke={stroke} strokeWidth="1" />

        {/* selection box around hull (visible only for select tool) */}
        {tool === "select" && (
          <g>
            <rect x={cx - 88} y={cy - 114} width="176" height="200"
              fill="none" stroke={theme.accent} strokeWidth="1.5"
              strokeDasharray="6 4" />
            {[
              [cx - 88, cy - 114], [cx, cy - 114], [cx + 88, cy - 114],
              [cx - 88, cy - 14],  [cx + 88, cy - 14],
              [cx - 88, cy + 86],  [cx, cy + 86],  [cx + 88, cy + 86],
            ].map((p, i) => (
              <rect key={i} x={p[0] - 4} y={p[1] - 4} width="8" height="8"
                fill="#fff" stroke={theme.accent} strokeWidth="1.5" />
            ))}
          </g>
        )}

        {/* center crosshair (matches real editor) */}
        <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="#22d3ee" strokeWidth="1" />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="#22d3ee" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="3" fill="none" stroke="#22d3ee" strokeWidth="1" />

        {/* tool-specific cursor preview */}
        {tool === "rect" && (
          <rect x={mousePos.x - 30} y={mousePos.y - 22} width="60" height="44"
            fill="none" stroke={theme.accent} strokeWidth="1.4" strokeDasharray="4 3" />
        )}
        {tool === "ellipse" && (
          <ellipse cx={mousePos.x} cy={mousePos.y} rx="28" ry="22"
            fill="none" stroke={theme.accent} strokeWidth="1.4" strokeDasharray="4 3" />
        )}
        {tool === "polygon" && (
          <>
            <line x1={mousePos.x - 60} y1={mousePos.y + 30}
              x2={mousePos.x} y2={mousePos.y}
              stroke={theme.accent} strokeWidth="1.4" strokeDasharray="5 5" />
            <circle cx={mousePos.x - 60} cy={mousePos.y + 30} r="4" fill="#22d3ee" stroke="#000" />
            <circle cx={mousePos.x} cy={mousePos.y} r="3.5" fill="#ff4444" stroke="#000" />
          </>
        )}
        {(tool === "line" || tool === "freehand") && (
          <circle cx={mousePos.x} cy={mousePos.y} r="3" fill={theme.accent} stroke="#000" strokeWidth="0.8" />
        )}
      </svg>

      {/* corner readouts */}
      <span style={{
        position: "absolute", left: 8, top: 8,
        fontFamily: theme.fontMono, fontSize: 10, color: "#475569",
        background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 2,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
      }}>{size}×{size} · SVG</span>
      <span style={{
        position: "absolute", right: 8, top: 8,
        fontFamily: theme.fontMono, fontSize: 10, color: "#475569",
        background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 2,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
      }}>4 shapes</span>

      {/* tool hint near cursor */}
      {tool === "polygon" && (
        <span style={{
          position: "absolute",
          left: mousePos.x + 12, top: mousePos.y - 8,
          fontFamily: theme.fontMono, fontSize: 10.5, color: "#0e7490",
          background: "rgba(255,255,255,0.92)", padding: "2px 6px", borderRadius: 2,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>Click to add · Enter to close · Esc to cancel</span>
      )}
      {tool === "freehand" && (
        <span style={{
          position: "absolute",
          left: mousePos.x + 12, top: mousePos.y - 8,
          fontFamily: theme.fontMono, fontSize: 10.5, color: "#0e7490",
          background: "rgba(255,255,255,0.92)", padding: "2px 6px", borderRadius: 2,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>Drag · release near start to close</span>
      )}
    </div>
  );
}

function SpriteEditor({ theme, lang }) {
  const [tool, setTool] = useState("select");
  const [size, setSize] = useState(64);
  const [fill, setFill] = useState("#5fd4dc");
  const [stroke, setStroke] = useState("#0c2e34");
  const [strokeW, setStrokeW] = useState(3);
  const [name, setName] = useState("ship");
  const [showFill, setShowFill] = useState(false);
  const [showStroke, setShowStroke] = useState(false);
  // simulated cursor position over the canvas (px in canvas coords)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  // The real editor uses SCALE=5 for 64, SCALE=3 for 128. Keep that.
  const scale = size === 64 ? 5 : 3;

  const tools = [
    { id: "select",   icon: "cursor",  label: "Select",   kbd: "V" },
    { id: "rect",     icon: "square",  label: "Rectangle",kbd: "R" },
    { id: "ellipse",  icon: "circle",  label: "Ellipse",  kbd: "O" },
    { id: "line",     icon: "line",    label: "Line",     kbd: "L" },
    { id: "freehand", icon: "pencil",  label: "Pen",      kbd: "P" },
    { id: "polygon",  icon: "polygon", label: "Polygon",  kbd: "G" },
    { id: "text",     icon: "text",    label: "Text",     kbd: "T" },
  ];

  // canvas pixel size for the layout
  const W = size * scale; // 320 or 384
  const H = size * scale;

  const t = PI3_STRINGS[lang];

  return (
    <div style={{
      flex: 1, minHeight: 0,
      background: theme.appBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
      backgroundImage: `radial-gradient(circle, ${theme.panelBorder} 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
      overflow: "auto",
    }}
    onClick={() => { setShowFill(false); setShowStroke(false); }}
    >
      {/* The dialog — matches the real app's modal silhouette */}
      <div onClick={e => e.stopPropagation()}
        style={{
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusWindow,
          boxShadow: theme.shadowWindow,
          width: W + 24 + 56 + 24, // canvas + gutter + tool col + padding
          padding: 16,
          display: "flex", flexDirection: "column", gap: 12,
          fontFamily: theme.fontUI, color: theme.panelTxt,
        }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button"
            style={{
              all: "unset", cursor: "pointer",
              padding: "7px 14px",
              background: theme.runBg, color: theme.runTxt,
              borderRadius: theme.radiusButton,
              fontFamily: theme.fontUI, fontWeight: theme.weightUI + 200, fontSize: 13,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            <PI3Icon name="check" size={14} color="currentColor" strokeWidth={2.4} />
            Save SVG
          </button>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "0 10px", height: 28,
            background: theme.chip, borderRadius: theme.radiusButton,
            border: `1px solid ${theme.panelBorder}`,
            flex: 1, minWidth: 0,
          }}>
            <span style={{
              fontFamily: theme.fontUI, fontSize: 11, color: theme.panelTxtMute,
              textTransform: "uppercase", letterSpacing: 0.6,
            }}>name</span>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{
                all: "unset", flex: 1, minWidth: 0,
                fontFamily: theme.fontMono, fontSize: 13,
                color: theme.panelTxt,
              }} />
            <span style={{
              fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute,
            }}>.svg</span>
          </div>

          <div style={{
            display: "inline-flex", padding: 2,
            background: theme.chip, borderRadius: theme.radiusButton,
            border: `1px solid ${theme.panelBorder}`,
          }}>
            {[64, 128].map(s => (
              <button key={s} type="button" onClick={() => setSize(s)}
                style={{
                  all: "unset", cursor: "pointer",
                  padding: "4px 12px", borderRadius: theme.radiusButton,
                  fontFamily: theme.fontMono, fontSize: 12,
                  fontWeight: theme.weightUI + 100,
                  background: size === s ? theme.surfacePanel : "transparent",
                  color: size === s ? theme.panelTxt : theme.panelTxtMute,
                  boxShadow: size === s ? `0 0 0 1px ${theme.panelBorder}` : "none",
                }}>{s}px</button>
            ))}
          </div>

          <button type="button" title="Close"
            style={{
              all: "unset", cursor: "pointer",
              width: 28, height: 28, borderRadius: theme.radiusButton,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: theme.panelTxtMute,
            }}>
            <PI3Icon name="x" size={16} color="currentColor" strokeWidth={2} />
          </button>
        </div>

        {/* Body: tool column + canvas */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Vertical tool column */}
          <div style={{
            width: 40, padding: 4,
            background: theme.chip,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: theme.radiusCard,
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            {tools.map(tt => (
              <ToolBtn key={tt.id}
                icon={tt.icon} label={tt.label} kbd={tt.kbd}
                active={tool === tt.id} theme={theme}
                onClick={() => setTool(tt.id)} />
            ))}
            <div style={{ height: 1, background: theme.panelBorder, margin: "4px 4px" }} />
            <ToolBtn icon="undo" label="Undo" kbd="⌘Z" theme={theme} />
            <ToolBtn icon="redo" label="Redo" kbd="⇧⌘Z" theme={theme} />
            <div style={{ height: 1, background: theme.panelBorder, margin: "4px 4px" }} />
            <ToolBtn icon="x" label="Delete selected" kbd="⌫" theme={theme} danger />
          </div>

          {/* Canvas + status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0, alignItems: "center" }}>
            <div
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              onMouseMove={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
              }}>
              <SpriteCanvas
                theme={theme} size={size} scale={scale}
                fill={fill} stroke={stroke} strokeW={strokeW}
                tool={tool}
                mousePos={hovering ? mousePos : { x: -100, y: -100 }} />
            </div>

            {/* Status row */}
            <div style={{
              width: W, display: "flex", alignItems: "center", gap: 14,
              fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute,
              padding: "4px 2px",
            }}>
              <span>tool: <span style={{ color: theme.panelTxt }}>{tool}</span></span>
              <span>x: <span style={{ color: theme.panelTxt }}>{Math.max(0, Math.round(mousePos.x / scale))}</span></span>
              <span>y: <span style={{ color: theme.panelTxt }}>{Math.max(0, Math.round(mousePos.y / scale))}</span></span>
              <span style={{ flex: 1 }} />
              <span>scale: <span style={{ color: theme.panelTxt }}>{scale}×</span></span>
            </div>
          </div>
        </div>

        {/* Footer: colors + stroke width */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 10px",
          background: theme.chip,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusCard,
        }}>
          <div style={{ position: "relative" }}>
            <ColorButton label="Fill" value={fill} active={showFill} theme={theme}
              onClick={e => { e.stopPropagation(); setShowFill(s => !s); setShowStroke(false); }} />
            <ColorPopover open={showFill} value={fill} theme={theme}
              onPick={c => { setFill(c); setShowFill(false); }} />
          </div>

          <div style={{ position: "relative" }}>
            <ColorButton label="Stroke" value={stroke} active={showStroke} theme={theme}
              onClick={e => { e.stopPropagation(); setShowStroke(s => !s); setShowFill(false); }} />
            <ColorPopover open={showStroke} value={stroke} theme={theme}
              onPick={c => { setStroke(c); setShowStroke(false); }} />
          </div>

          <div style={{ width: 1, height: 22, background: theme.panelBorder }} />

          <span style={{
            fontFamily: theme.fontUI, fontSize: 11, color: theme.panelTxtMute,
            textTransform: "uppercase", letterSpacing: 0.6,
          }}>Width</span>
          <input type="range" min="0" max="8" step="1" value={strokeW}
            onChange={e => setStrokeW(+e.target.value)}
            style={{ width: 120, accentColor: theme.accent }} />
          <span style={{
            fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxt,
            minWidth: 28, textAlign: "right",
          }}>{strokeW}px</span>

          <div style={{ flex: 1 }} />

          <span style={{
            fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute,
          }}>{tool === "polygon" ? "Enter to close · Esc to cancel" :
              tool === "freehand" ? "Release near start to close" :
              tool === "text" ? "Click to place text" :
              tool === "select" ? "Click a shape · drag handles to resize" :
              "Click + drag on canvas"}</span>
        </div>
      </div>
    </div>
  );
}

window.SpriteEditor = SpriteEditor;
