// Three pi3 IDE redesign themes. Keys map 1:1 to references in
// app.jsx / ide-chrome.jsx / ide-panels.jsx / ide-editor.jsx.

const PI3_BASE = {
  fontUI: "'Inter Tight', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
  weightUI: 500,
  weightHeader: 700,

  radiusWindow: 4,
  radiusCard: 2,
  radiusButton: 2,
  radiusTab: "3px 3px 0 0",

  fsCode: 13,
  lhCode: 22,
};

const PI3_THEMES = {
  // ── Studio ───────────────────────────────────────────────────────────────
  studio: {
    ...PI3_BASE,
    name: "Studio",
    appBg: "#e9e3d3",
    appTxt: "#1f2933",
    surface: "#fbf6e9",
    shadowWindow: "0 30px 80px -28px rgba(20,30,40,0.40), 0 6px 18px rgba(20,30,40,0.10)",

    surfacePanel: "#fffaf0",
    panelHeader: "#fdf3e1",
    panelBorder: "rgba(20,30,40,0.10)",
    panelTxt: "#1f2933",
    panelTxtMute: "#5b6976",
    chip: "#f3ebd7",

    railBg: "#0e9aa7",
    railIcon: "rgba(255,255,255,0.78)",
    railIconActive: "#ffffff",
    railActiveBg: "rgba(255,255,255,0.20)",
    railHoverBg: "rgba(255,255,255,0.10)",
    railLogo: "#fffaf0",

    filebarBg: "#0e9aa7",
    tabActiveBg: "#fffaf0",
    tabActiveTxt: "#0a3d44",
    tabInactiveBg: "rgba(255,255,255,0.32)",
    tabInactiveTxt: "#0a3d44",
    tabInactiveHover: "rgba(255,255,255,0.55)",
    tabDirty: "#f59e0b",

    editorBg: "#fffaf0",
    editorTxt: "#1f2933",
    editorLN: "#b6c2c8",
    editorLNActive: "#0a3d44",
    editorLineActive: "rgba(14,154,167,0.06)",
    errorLine: "#ef4444",
    warnLine: "#f59e0b",
    errorChipBg: "#ef4444",
    errorChipTxt: "#ffffff",

    consoleBg: "#fdf3e1",
    consoleBorder: "rgba(20,30,40,0.08)",
    consoleTxt: "#1f2933",
    consoleTxtMute: "#7a8696",
    consoleInfo: "#0e7c52",
    consoleWarn: "#b45309",
    consoleErr: "#c4451c",

    successPill: "rgba(52,168,83,0.16)",
    successPillTxt: "#0e7c52",

    accent: "#f6a560",
    runBg: "#34a853",
    runTxt: "#ffffff",
    stopBg: "#ef4444",

    canvasFrame: "#0a3d44",
    canvasBorder: "rgba(255,255,255,0.10)",
    canvasTitle: "#0a3d44",
    canvasTitleTxt: "#fffaf0",
    canvasTitleTxtMute: "rgba(255,250,240,0.55)",
    canvasBg: "#072428",
    canvasOverlay: "rgba(7,36,40,0.7)",
    canvasHintTxt: "#fffaf0",
    canvasStar: "#5fd4dc",
    canvasRock: "#7a8696",
    canvasShip: "#fffaf0",
    canvasHud: "#5fd4dc",

    syn: {
      keyword: "#c2410c",
      string:  "#15803d",
      number:  "#a16207",
      comment: "#9ba3a8",
      func:    "#0e7490",
      builtin: "#7c3aed",
      decorator: "#0891b2",
      operator: "#475569",
      ident:   "#1e293b",
    },
  },

  // ── Midnight ─────────────────────────────────────────────────────────────
  midnight: {
    ...PI3_BASE,
    name: "Midnight",
    appBg: "#06181b",
    appTxt: "#e8f2f4",
    surface: "#0c2e34",
    shadowWindow: "0 30px 70px -20px rgba(0,0,0,0.6), 0 4px 18px rgba(0,0,0,0.3)",

    surfacePanel: "#11444b",
    panelHeader: "#0f3a40",
    panelBorder: "rgba(148,210,216,0.14)",
    panelTxt: "#e8f2f4",
    panelTxtMute: "#9bb3b8",
    chip: "rgba(255,255,255,0.06)",

    railBg: "#072428",
    railIcon: "rgba(155,210,216,0.7)",
    railIconActive: "#ffffff",
    railActiveBg: "rgba(120,210,220,0.18)",
    railHoverBg: "rgba(120,210,220,0.08)",
    railLogo: "#5fd4dc",

    filebarBg: "#0c2e34",
    tabActiveBg: "#11444b",
    tabActiveTxt: "#fff8ec",
    tabInactiveBg: "rgba(255,255,255,0.04)",
    tabInactiveTxt: "#9bb3b8",
    tabInactiveHover: "rgba(255,255,255,0.08)",
    tabDirty: "#fbbf77",

    editorBg: "#0e3a40",
    editorTxt: "#e8f2f4",
    editorLN: "#5b8489",
    editorLNActive: "#e8f2f4",
    editorLineActive: "rgba(120,210,220,0.06)",
    errorLine: "#ff8b8b",
    warnLine: "#fbbf77",
    errorChipBg: "#ff8b8b",
    errorChipTxt: "#062a26",

    consoleBg: "#072428",
    consoleBorder: "rgba(255,255,255,0.06)",
    consoleTxt: "#e8f2f4",
    consoleTxtMute: "#7d9499",
    consoleInfo: "#7ee0a8",
    consoleWarn: "#fbbf77",
    consoleErr: "#ff8b8b",

    successPill: "rgba(126,224,168,0.14)",
    successPillTxt: "#7ee0a8",

    accent: "#f7b67a",
    runBg: "#7ed3a4",
    runTxt: "#062a26",
    stopBg: "#ff8b8b",

    canvasFrame: "#031518",
    canvasBorder: "rgba(255,255,255,0.06)",
    canvasTitle: "#031518",
    canvasTitleTxt: "#e8f2f4",
    canvasTitleTxtMute: "rgba(232,242,244,0.55)",
    canvasBg: "#021012",
    canvasOverlay: "rgba(2,16,18,0.7)",
    canvasHintTxt: "#e8f2f4",
    canvasStar: "#5fd4dc",
    canvasRock: "#5b8489",
    canvasShip: "#fff8ec",
    canvasHud: "#5fd4dc",

    syn: {
      keyword:  "#f7b67a",
      string:   "#9be7c0",
      number:   "#fbbf77",
      comment:  "#5b8489",
      func:     "#7adfe6",
      builtin:  "#c4b5fd",
      decorator:"#7adfe6",
      operator: "#9bb3b8",
      ident:    "#e8f2f4",
    },
  },

  // ── Playful ──────────────────────────────────────────────────────────────
  // ── Daylight (paper + cyan, twin of Midnight) ────────────────────────────
  daylight: {
    ...PI3_BASE,
    name: "Daylight",
    appBg: "#e6dfcb",
    appTxt: "#0c2e34",
    surface: "#f7f1de",
    shadowWindow: "0 30px 80px -28px rgba(12,46,52,0.30), 0 4px 14px rgba(12,46,52,0.08)",

    surfacePanel: "#fbf6e6",
    panelHeader: "#f3ecd5",
    panelBorder: "rgba(12,46,52,0.10)",
    panelTxt: "#0c2e34",
    panelTxtMute: "#6b7e7f",
    chip: "#efe7cd",

    railBg: "#f3ecd5",
    railIcon: "rgba(12,46,52,0.55)",
    railIconActive: "#0e7c8a",
    railActiveBg: "rgba(14,124,138,0.12)",
    railHoverBg: "rgba(14,124,138,0.06)",
    railLogo: "#0e7c8a",

    filebarBg: "#f3ecd5",
    tabActiveBg: "#fbf6e6",
    tabActiveTxt: "#0c2e34",
    tabInactiveBg: "rgba(12,46,52,0.04)",
    tabInactiveTxt: "#6b7e7f",
    tabInactiveHover: "rgba(12,46,52,0.08)",
    tabDirty: "#d97a2b",

    editorBg: "#fbf6e6",
    editorTxt: "#0c2e34",
    editorLN: "#bdb39a",
    editorLNActive: "#0c2e34",
    editorLineActive: "rgba(14,124,138,0.07)",
    errorLine: "#c4451c",
    warnLine: "#b87a1f",
    errorChipBg: "#c4451c",
    errorChipTxt: "#fbf6e6",

    consoleBg: "#f3ecd5",
    consoleBorder: "rgba(12,46,52,0.08)",
    consoleTxt: "#0c2e34",
    consoleTxtMute: "#8a8870",
    consoleInfo: "#0e7c8a",
    consoleWarn: "#b87a1f",
    consoleErr: "#c4451c",

    successPill: "rgba(14,124,138,0.14)",
    successPillTxt: "#0e7c8a",

    accent: "#0e7c8a",
    runBg: "#2a9d8f",
    runTxt: "#fbf6e6",
    stopBg: "#c4451c",

    canvasFrame: "#0c2e34",
    canvasBorder: "rgba(255,255,255,0.06)",
    canvasTitle: "#0c2e34",
    canvasTitleTxt: "#fbf6e6",
    canvasTitleTxtMute: "rgba(251,246,230,0.6)",
    canvasBg: "#021012",
    canvasOverlay: "rgba(2,16,18,0.7)",
    canvasHintTxt: "#fbf6e6",
    canvasStar: "#5fd4dc",
    canvasRock: "#5b8489",
    canvasShip: "#fbf6e6",
    canvasHud: "#5fd4dc",

    syn: {
      keyword:  "#b35c1a",
      string:   "#1f7a4a",
      number:   "#a04419",
      comment:  "#9a957b",
      func:     "#0e7c8a",
      builtin:  "#6d4ec3",
      decorator:"#0e7c8a",
      operator: "#6b7e7f",
      ident:    "#1a2c2e",
    },
  },
};

window.PI3_THEMES = PI3_THEMES;

// Font pairings the user can swap between via the Tweaks panel.
// Each pair: a UI typeface + a monospace.
const PI3_FONTS = {
  "inter":     { name: "Inter Tight + JetBrains Mono", ui: "'Inter Tight', system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace", weightUI: 500, weightHeader: 700 },
  "ibm":       { name: "IBM Plex Sans + IBM Plex Mono", ui: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace", weightUI: 500, weightHeader: 600 },
  "geist":     { name: "Geist + Geist Mono",            ui: "'Geist', system-ui, sans-serif",        mono: "'Geist Mono', ui-monospace, monospace",       weightUI: 500, weightHeader: 700 },
  "space":     { name: "Space Grotesk + Space Mono",    ui: "'Space Grotesk', system-ui, sans-serif",mono: "'Space Mono', ui-monospace, monospace",      weightUI: 500, weightHeader: 700 },
  "jbsans":    { name: "JetBrains Mono only (mono UI)", ui: "'JetBrains Mono', ui-monospace, monospace", mono: "'JetBrains Mono', ui-monospace, monospace", weightUI: 500, weightHeader: 700 },
  "system":    { name: "System UI + ui-monospace",      ui: "system-ui, -apple-system, sans-serif",   mono: "ui-monospace, SFMono-Regular, monospace",     weightUI: 500, weightHeader: 700 },
};

window.PI3_FONTS = PI3_FONTS;
