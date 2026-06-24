import { create } from "zustand";

export type ThemeId = "studio" | "midnight";

export interface Theme {
  name: string;
  appBg: string;
  appTxt: string;
  surface: string;
  shadowWindow: string;

  surfacePanel: string;
  panelHeader: string;
  panelBorder: string;
  panelTxt: string;
  panelTxtMute: string;
  chip: string;

  railBg: string;
  railIcon: string;
  railIconActive: string;
  railActiveBg: string;
  railHoverBg: string;
  railLogo: string;

  filebarBg: string;
  tabActiveBg: string;
  tabActiveTxt: string;
  tabInactiveBg: string;
  tabInactiveTxt: string;
  tabInactiveHover: string;
  tabDirty: string;

  editorBg: string;
  editorTxt: string;
  editorLN: string;
  editorLNActive: string;
  editorLineActive: string;
  errorLine: string;
  warnLine: string;
  errorChipBg: string;
  errorChipTxt: string;

  consoleBg: string;
  consoleBorder: string;
  consoleTxt: string;
  consoleTxtMute: string;
  consoleInfo: string;
  consoleWarn: string;
  consoleErr: string;

  successPill: string;
  successPillTxt: string;

  accent: string;
  runBg: string;
  runTxt: string;
  stopBg: string;
  submitBg: string;
  submitTxt: string;

  canvasFrame: string;
  canvasBorder: string;
  canvasTitle: string;
  canvasTitleTxt: string;
  canvasTitleTxtMute: string;
  canvasBg: string;
  canvasOverlay: string;
  canvasHintTxt: string;
  canvasStar: string;
  canvasRock: string;
  canvasShip: string;
  canvasHud: string;

  syn: {
    keyword: string;
    string: string;
    number: string;
    comment: string;
    func: string;
    builtin: string;
    decorator: string;
    operator: string;
    ident: string;
  };

  radiusWindow: number;
  radiusCard: number;
  radiusButton: number;
  radiusTab: string;
  fsCode: number;
  lhCode: number;
  fontUI: string;
  fontMono: string;
  weightUI: number;
  weightHeader: number;
}

const BASE = {
  fontUI: "'Inter', system-ui, sans-serif",
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

const THEMES: Record<ThemeId, Theme> = {
  studio: {
    ...BASE,
    name: "Studio",
    appBg: "#e9e3d3",
    appTxt: "#1f2933",
    surface: "#fbf6e9",
    shadowWindow:
      "0 30px 80px -28px rgba(20,30,40,0.40), 0 6px 18px rgba(20,30,40,0.10)",
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
    submitBg: "#2563eb",
    submitTxt: "#ffffff",
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
      string: "#15803d",
      number: "#a16207",
      comment: "#9ba3a8",
      func: "#0e7490",
      builtin: "#7c3aed",
      decorator: "#0891b2",
      operator: "#475569",
      ident: "#1e293b",
    },
  },
  midnight: {
    ...BASE,
    name: "Midnight",
    appBg: "#06181b",
    appTxt: "#e8f2f4",
    surface: "#0c2e34",
    shadowWindow:
      "0 30px 70px -20px rgba(0,0,0,0.6), 0 4px 18px rgba(0,0,0,0.3)",
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
    submitBg: "#3b82f6",
    submitTxt: "#ffffff",
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
      keyword: "#f7b67a",
      string: "#9be7c0",
      number: "#fbbf77",
      comment: "#5b8489",
      func: "#7adfe6",
      builtin: "#c4b5fd",
      decorator: "#7adfe6",
      operator: "#9bb3b8",
      ident: "#e8f2f4",
    },
  },
};

type UseThemeStore = {
  themeId: ThemeId;
  theme: Theme;
  fontSize: number;
  setTheme: (id: ThemeId) => void;
  setFontSize: (size: number) => void;
};

const _savedThemeId = (localStorage.getItem("pi3_theme") as ThemeId | null);
const _initThemeId: ThemeId = (_savedThemeId && _savedThemeId in THEMES) ? _savedThemeId : "midnight";
const _initFontSize = parseInt(localStorage.getItem("pi3_fontSize") ?? "16", 10) || 16;

export const useThemeStore = create<UseThemeStore>((set) => ({
  themeId: _initThemeId,
  theme: THEMES[_initThemeId],
  fontSize: _initFontSize,
  setTheme: (id: ThemeId) => {
    localStorage.setItem("pi3_theme", id);
    set({ themeId: id, theme: THEMES[id] });
  },
  setFontSize: (size: number) => {
    localStorage.setItem("pi3_fontSize", String(size));
    set({ fontSize: size });
  },
}));
