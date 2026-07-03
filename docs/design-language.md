# Pi3 Design Language

Reference document for the IDE's visual and interactional idioms.
A future agent reading this document should be able to judge "is this consistent with pi3?" without having seen the IDE.

---

## 1. Token Inventory

All colors, typography, and geometry live in `src/state/useTheme.ts`.
**Never hardcode hex values or font names.** Everything flows through `theme.*` obtained from `useThemeStore((s) => s.theme)`.

### 1a. Color tokens — semantic groups

**Text**
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `panelTxt` | `#1f2933` | `#e8f2f4` | Panel body text, dialog titles |
| `panelTxtMute` | `#5b6976` | `#9bb3b8` | Section labels, hints, secondary info |
| `consoleTxt` | `#1f2933` | `#e8f2f4` | Console output text |
| `consoleTxtMute` | `#7a8696` | `#7d9499` | Console copy/clear button labels |
| `railIcon` | `rgba(255,255,255,0.78)` | `rgba(155,210,216,0.7)` | Inactive rail button icons |
| `railIconActive` | `#ffffff` | `#ffffff` | Active/selected rail button icons |
| `railLogo` | `#fffaf0` | `#5fd4dc` | Pi3 logo mark in the rail (cream in Studio, teal in Midnight) |
| `canvasTitleTxt` | `#fffaf0` | `#e8f2f4` | Canvas window titlebar text |
| `canvasTitleTxtMute` | `rgba(255,250,240,0.55)` | `rgba(232,242,244,0.55)` | Muted canvas titlebar text |
| `canvasHintTxt` | `#fffaf0` | `#e8f2f4` | Hint labels overlaid on the canvas (e.g. "no output yet") |
| `appTxt` | `#1f2933` | `#e8f2f4` | App-level (behind panels) |

**Backgrounds**
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `appBg` | `#e9e3d3` | `#06181b` | Full-page background |
| `surface` | `#fbf6e9` | `#0c2e34` | Window/card surface (AssetEditor, test cards) |
| `surfacePanel` | `#fffaf0` | `#11444b` | Panel and console surfaces |
| `panelHeader` | `#fdf3e1` | `#0f3a40` | Panel header band |
| `consoleBg` | `#fdf3e1` | `#072428` | Console background |
| `editorBg` | `#fffaf0` | `#0e3a40` | Code editor background |
| `railBg` | `#0e9aa7` | `#072428` | Sidebar rail column |
| `filebarBg` | `#0e9aa7` | `#0c2e34` | File bar strip above the editor (same teal as rail in Studio, darker surface in Midnight) |
| `tabActiveBg` | `#fffaf0` | `#11444b` | Active file tab background |
| `tabInactiveBg` | `rgba(255,255,255,0.32)` | `rgba(255,255,255,0.04)` | Inactive file tab background |
| `tabInactiveHover` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.08)` | Hovered inactive tab background |
| `chip` | `#f3ebd7` | `rgba(255,255,255,0.06)` | Toggle rows, inactive selector pills, section chips |
| `railActiveBg` | `rgba(255,255,255,0.20)` | `rgba(120,210,220,0.18)` | Active/selected rail button |
| `railHoverBg` | `rgba(255,255,255,0.10)` | `rgba(120,210,220,0.08)` | Hovered rail button |
| `canvasFrame` | `#0a3d44` | `#031518` | Canvas window outer frame |
| `canvasBg` | `#072428` | `#021012` | Canvas content area |
| `canvasTitle` | `#0a3d44` | `#031518` | Canvas titlebar background |
| `canvasOverlay` | `rgba(7,36,40,0.7)` | `rgba(2,16,18,0.7)` | Semi-transparent overlay drawn over the canvas (loading, paused states) |
| `successPill` | `rgba(52,168,83,0.16)` | `rgba(126,224,168,0.14)` | Running status pill background |

**File tab text** (completes the tab token group)
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `tabActiveTxt` | `#0a3d44` | `#fff8ec` | Active tab label text |
| `tabInactiveTxt` | `#0a3d44` | `#9bb3b8` | Inactive tab label text |
| `tabDirty` | `#f59e0b` | `#fbbf77` | Unsaved-changes dot on tab |

**Editor internals**
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `editorTxt` | `#1f2933` | `#e8f2f4` | Main editor text color |
| `editorLN` | `#b6c2c8` | `#5b8489` | Line number gutter text |
| `editorLNActive` | `#0a3d44` | `#e8f2f4` | Current-line number highlight |
| `editorLineActive` | `rgba(14,154,167,0.06)` | `rgba(120,210,220,0.06)` | Active line background tint |
| `errorLine` | `#ef4444` | `#ff8b8b` | Gutter indicator for error lines |
| `warnLine` | `#f59e0b` | `#fbbf77` | Gutter indicator for warning lines |
| `errorChipBg` / `errorChipTxt` | `#ef4444` / `#ffffff` | `#ff8b8b` / `#062a26` | Inline error chip inside the editor |

**Canvas game tokens** (used by the BFS visualiser and built-in game canvas)
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `canvasStar` | `#5fd4dc` | `#5fd4dc` | Star / collectible sprites |
| `canvasRock` | `#7a8696` | `#5b8489` | Rock / obstacle sprites |
| `canvasShip` | `#fffaf0` | `#fff8ec` | Player ship sprites |
| `canvasHud` | `#5fd4dc` | `#5fd4dc` | HUD text drawn on canvas |

**Borders**
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `panelBorder` | `rgba(20,30,40,0.10)` | `rgba(148,210,216,0.14)` | All panel dividers, card outlines |
| `consoleBorder` | `rgba(20,30,40,0.08)` | `rgba(255,255,255,0.06)` | Console header, resize handle |
| `canvasBorder` | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.06)` | Canvas window border |

**Actions / Accents**
| Token | Studio | Midnight | Usage example |
|---|---|---|---|
| `accent` | `#f6a560` | `#f7b67a` | Active selectors, links, progress fills, range accent |
| `runBg` | `#34a853` | `#7ed3a4` | Run button background, toggle-on state |
| `runTxt` | `#ffffff` | `#062a26` | Run button text |
| `stopBg` | `#ef4444` | `#ff8b8b` | Stop button background |
| `submitBg` | `#2563eb` | `#3b82f6` | Submit button background (compete mode); blue distinguishes it from run/stop |
| `submitTxt` | `#ffffff` | `#ffffff` | Submit button text |
| `successPillTxt` | `#0e7c52` | `#7ee0a8` | Running status pill text |

**Console output colors**
- `consoleInfo` — green (info messages)
- `consoleWarn` — amber (warnings)
- `consoleErr` — red (runtime errors in output stream)

### 1b. Typography tokens

| Token | Value | Used for |
|---|---|---|
| `fontUI` | `'Inter', system-ui, sans-serif` | All UI labels, panel headers, buttons |
| `fontMono` | `'JetBrains Mono', ui-monospace, monospace` | Code, console output, file names, line numbers |
| `weightUI` | `500` | Body text, secondary labels |
| `weightUI + 100` | `600` | Section labels, toggle labels, header text in small sizes |
| `weightHeader` | `700` | Panel titles, dialog titles |
| `fsCode` | `13` | Default code editor font size (overridden by user) |
| `lhCode` | `22` | Code line height |

Three weight steps in practice: 500 body / 600 emphasis / 700 title. No other weights are used.

### 1c. Geometry tokens

| Token | Value | Used for |
|---|---|---|
| `radiusWindow` | `4` | Outer window border-radius |
| `radiusCard` | `2` | Chip, toggle row, small card |
| `radiusButton` | `2` | Rail buttons, run/stop button |
| `radiusTab` | `"3px 3px 0 0"` | File tabs |
| `shadowWindow` | elaborate multi-layer box-shadow | Floating windows (AssetEditor) |

Note: components sometimes deviate upward from these values for specific UI elements (e.g., ThemedDialog uses `borderRadius: 10`; AssetEditor uses `borderRadius: 8`). The larger radii are reserved for prominent modal contexts — it is a judgment call, not a violation.

---

## 2. Visual Idioms

### 2a. File bar / Tab bar

`src/FileBar.tsx` — the 44px horizontal strip directly above the editor.

**Container**: `height: 44`, `background: theme.filebarBg`, `display: flex`, `alignItems: flex-end`, `padding: 0 12px 0 16px`. Tabs hang from the bottom edge — `alignItems: flex-end` means taller active tabs "grow upward."

**File tab dimensions** (`FileTab`, `src/FileBar.tsx:87-162`):
- Active: `height: 38`, `padding: 0 14px`, `background: theme.tabActiveBg`, `color: theme.tabActiveTxt`, `fontWeight: theme.weightUI + 100` (600)
- Inactive: `height: 32`, `background: theme.tabInactiveBg`, `color: theme.tabInactiveTxt`, `fontWeight: theme.weightUI` (500)
- Hover (inactive only): `background: theme.tabInactiveHover`
- `borderRadius: theme.radiusTab` = `"3px 3px 0 0"` (top corners only)
- `marginRight: 4` between tabs, `gap: 8` between label and indicators
- `fontSize: 13.5`, `fontFamily: theme.fontUI`
- Transition: `background 0.15s`

**Dirty dot**: 7×7 circle, `background: theme.tabDirty`, with a halo ring via `boxShadow: 0 0 0 2px [activeBg|filebarBg]` — the ring color matches the tab's background, punching a gap between the dot and any content behind it.

**Rename mode**: double-click a tab puts it in an `<input>` with `all: "unset"`, same font/size/color as the tab label; `onBlur` commits.

**New file button**: `+` icon, height 32, `padding: 0 10px`, same inactive tab colors.

**Right side of FileBar**: `ProjectShareActions` (student share-with-teacher widget) + `AuthSection` (user pill / login button). These are floated right using spacer (`flex: 1` on the left side).

---

### 2b. The rail

**What it is**: A 60px wide vertical column (`src/SideMenu.tsx:299-398`) that is always visible on the left edge.

**Structure**:
- Background: `theme.railBg`
- Logo at top (`Pi3Logo` component, 26px Nunito font, `theme.railLogo`)
- Stack of `RailButton`s (44×44 each, `theme.radiusButton`, gap 8)
- Run/stop button (same 44×44 size) with `theme.runBg`/`stopBg`
- Thin horizontal divider: `width: 26, height: 1, background: rgba(148,210,216,0.22)`
- Spacer (`flex: 1`) pushes bottom buttons down
- Bottom: docs + settings rail buttons

**Rail button states** (`src/SideMenu.tsx:48-112`):
- Idle: transparent bg, `theme.railIcon` color
- Hover: `theme.railHoverBg` bg, same icon color
- Active (panel open): `theme.railActiveBg` bg, `theme.railIconActive` color
- All transitions: `0.15s background, 0.15s color`
- Icon size: 21 (via `<Icon name="..." size={21} color="currentColor" />`)

### 2b. Floating panels

Panels slide in at `left: 60` (next to the rail) as an absolutely-positioned full-height drawer (`src/SideMenu.tsx:402-467`).

**Outer container**:
- `position: absolute`, `top: 0, bottom: 0, left: 60`
- Width: 320px for most panels, 520px for Docs
- `background: theme.surfacePanel`
- `borderRight: 1px solid theme.panelBorder`
- `boxShadow: "8px 0 28px rgba(0,0,0,0.28), 2px 0 6px rgba(0,0,0,0.10)"`
- `zIndex: 10`

**Panel header** (`PanelHeader` component, `src/SideMenu.tsx:494-527`):
- `padding: 16px 20px 12px`, `borderBottom: 1px solid panelBorder`
- `background: theme.panelHeader`
- Title: 17px, `theme.weightHeader`, `theme.panelTxt`
- Close button (`CloseButton` component) at right

**Exception**: `ProblemsPanel` uses its own 40px header with `padding: 0 8px 0 12px` and 13px title — a legacy inconsistency. Future panels should use `PanelHeader`.

**Panel body**:
- `padding: 16px`, `overflowY: auto`, `flex: 1`

**Section labels** (`SectionLabel` component, `src/SideMenu.tsx:529-554`):
- 11.5px, `textTransform: uppercase`, `letterSpacing: 0.8`, `theme.panelTxtMute`, `marginBottom: 8`
- Used to group settings within a panel body

### 2c. Indent guide variables

The editor applies indentation depth guides via CSS custom properties injected inline on the editor wrapper (`src/App.tsx:409-414`):

```
--indent-guide-1 … --indent-guide-6
```

Values: Midnight uses `rgba(95,212,220,0.06)` incrementing by `+0.04` per level. Studio uses `rgba(14,154,167,0.07)` incrementing by `+0.04`. The teal base color is always the rail/accent family — guides are barely visible tints of the same hue.

---

### 2d. Toggle rows

`ToggleRow` component (`src/SideMenu.tsx:562-648`) — the canonical idiom for a boolean setting:

- Full-width `<button>` with `all: "unset"`, `padding: 12px 14px`, `marginBottom: 6`
- Background: `theme.chip`, `borderRadius: theme.radiusCard`
- Label (left): 14px, `weightUI + 100`, `panelTxt`; hint below at 12px, `panelTxtMute`, `marginTop: 2`
- Custom toggle switch (right): 40×24 pill (`borderRadius: 999`), knob 18×18 translates left/right with `transition: left 0.18s`
- On color: `theme.runBg` (or `theme.accent` for non-boolean settings); off color: `theme.panelBorder`
- Knob always `#fff` with subtle shadow

### 2e. Segment selectors (theme / language)

Row of equal-weight buttons in `src/SideMenu.tsx:693-741`:
- `flex: 1` each, `padding: 10px 0`, `borderRadius: theme.radiusCard`, `fontSize: 13`
- Active: `background: theme.accent`, `color: "#fff"`, `fontWeight: 600`
- Inactive: `background: theme.chip`, `color: theme.panelTxt`
- `transition: background 0.15s`

### 2f. Console panel

`src/components/ConsolePanel.tsx`:

**Header** (32px height, `src/ConsolePanel.tsx:493-568`):
- `padding: 0 14px`, `borderBottom: 1px solid consoleBorder`
- Label: 12.5px, `weightUI + 100`, `consoleTxt`, `textTransform: uppercase`, `letterSpacing: 0.4`
- Status pill: `borderRadius: 999`, `padding: 2px 8px`, 10.5px, uppercase, `letterSpacing: 0.6`
  - Running: `successPill` bg, `successPillTxt` text
  - Idle: `chip` bg, `consoleTxtMute` text
- Spacer, then text-only action buttons (`consoleTxtMute`, 12px, icon size 13, gap 4)

**Resize handle**: 8px invisible strip at edge (top/left depending on orientation); contains a visible 32×3 (or 3×32) bar in `panelBorder` color at 50% opacity.

**Output area**: `fontMono` 12.5px, `lineHeight: 1.55`, `consoleTxt`, `padding: 10px 14px`

**Sub-panels** (WatchPanel, DebugPanel) appear above the output via `borderBottom: 1px solid consoleBorder` — not separate windows.

### 2g. Canvas window titlebar

`src/CanvasWindow.tsx:198-250`:
- 30px height, `background: theme.canvasTitle`, `borderBottom: 1px solid canvasBorder`
- `padding: 0 10px 0 14px`, `fontUI`, `weightUI + 100`, 12.5px
- Left: small `<Icon>` (size 11) + label + status pill (borderRadius 999, fontSize 10)
- Right control buttons (each 22×22, `borderRadius: 4`, `all: "unset"`): step-back, pause/play, step-fwd, speed text, camera, screenshot count

### 2h. Primary action button (Run/Stop)

`src/SideMenu.tsx:342-361`:
- `all: "unset"`, 44×44, `borderRadius: theme.radiusButton`
- Running: `theme.stopBg` bg; Idle: `theme.runBg` bg; text: `theme.runTxt`
- Disabled: `opacity: 0.5`, `cursor: not-allowed`
- Icon: size 20, `color="currentColor"`

### 2i. Canvas window outer frame

`src/CanvasWindow.tsx:163-183`:
- `position: fixed`, `right: 24`, `bottom: 156`
- `background: theme.canvasFrame`, `borderRadius: theme.radiusCard`
- `boxShadow: "0 14px 40px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)"`
- `border: 1px solid theme.canvasBorder`, `overflow: hidden`
- `zIndex: 20`
- `opacity: 0 / 1` controlled by `canvasActive`, with `transition: opacity 0.3s`
- `imageRendering: pixelated` on both the canvas element and its wrapper div — pixel-art games must not be interpolated.
- Draggable via pointer capture (`onPointerDown`/`Move`/`Up`); title bar is the drag handle, `cursor: "grab"`

**Screenshot history tray**: `position: absolute, top: 32, right: 6`, `background: theme.surfacePanel`, `border: panelBorder`, `borderRadius: 6`, `padding: 6`, `boxShadow: "0 6px 18px rgba(0,0,0,0.25)"`. Each thumbnail 48×48, `borderRadius: 4`, selected thumbnail has `2px solid theme.accent` ring.

**Rewind overlay**: active scrub frame shown as `<img>` with `position: absolute` over the canvas, `outline: 2px solid rgba(255,220,0,0.7)` inset; label chip at bottom center with `background: rgba(0,0,0,0.75)`, `color: "#ffe040"` — a one-off hardcoded yellow not from theme tokens (consistent with the error card category pattern).

---

### 2j. Comment popover

Inline code comments from teacher render as a fixed popover (`src/App.tsx:454-484`):
- `position: fixed`, `left: 320`, `width: 280`
- `background: theme.surfacePanel`, `border: 1px solid theme.panelBorder`, `borderRadius: 8`
- `boxShadow: "0 8px 24px rgba(0,0,0,0.28)"`, `zIndex: 50`, `padding: 12`
- Each comment card: `background: theme.surface`, `borderRadius: 6`, `padding: 8px 10px`, `border: 1px solid theme.panelBorder`
- Author name: 11.5px, weight 600, `panelTxt`; date: 10.5px, `panelTxtMute`; body: 12.5px, `panelTxt`, `white-space: pre-wrap`

---

### 2k. Auth error banner

Appears at the very top of the editor area (`src/App.tsx:358-384`):
- `background: '#dc2626'` (hardcoded red — one of the few hardcoded non-error-card colors)
- `color: 'white'`, `padding: 10px 16px`, `fontSize: 14`, `flexShrink: 0`
- Dismiss `×` button: `fontSize: 18`, no background, no border, right-aligned

---

### 2l. Status pill (recurring pattern)

Used in console header, canvas titlebar, and compete mode test results:
- `borderRadius: 999`, `padding: 2px 8px` (or `1px 7px` for small variants)
- 10–10.5px font, `textTransform: uppercase`, `letterSpacing: 0.5–0.6`
- Two semantic states: success (`successPill`/`successPillTxt`) vs idle (`chip`/`consoleTxtMute`)

---

---

## 2m. Collapsible section header (ProjectExplorer)

`Section` component (`src/ProjectExplorer.tsx:604-631`) — the collapsible group header used inside the project panel:

- `marginBottom: 4`, section toggle button: `all: "unset"`, `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`, `letterSpacing: "0.06em"`, `color: theme.panelTxtMute`
- Chevron: `▾`/`▸` at `fontSize: 9`, `width: 8`
- Actions slot on the right, `display: flex`, `gap: 2`
- Body: `paddingLeft: 4` when open

This is a tighter, more compact variant of `SectionLabel` — used for items that hold nested content rather than just labelling a flat list.

---

## 2n. Filter chip (ProjectExplorer)

`chipStyle` function (`src/ProjectExplorer.tsx:764-771`) — small pill used to filter/select category in lists:

- `all: "unset"`, `padding: "3px 8px"`, `borderRadius: 20`, `fontSize: 11`, `fontWeight: 600`, `fontFamily: theme.fontUI`
- Active: `background: theme.accent`, `color: "#fff"`
- Inactive: `background: theme.chip`, `color: theme.panelTxtMute`

Distinct from the segment selector (§2e): chips are smaller (11px vs 13px) and rounder (radius 20 vs `radiusCard` = 2), used inline in list headers.

---

## 2o. Auth section (FileBar right side)

Three states, all in `src/components/user/`:

**Loading** (`AuthSection`): 16×16 circle, `border: 2px solid theme.chip`, `borderTopColor: theme.runBg`, `borderRadius: 999`, spinning via `pi3blink` animation.

**Logged out** (`LoginButton`): plain text button — `all: "unset"`, `padding: "4px 8px"`, `fontSize: 12`, `fontWeight: 500`, `color: theme.panelTxtMute`. No background, no border. Minimal, unobtrusive.

**Logged in** (`IdentityBlock` inside `UserMenu`): 40×40 `Avatar` + handle in `fontMono` 13px weight 700 `theme.accent`, display name below in 11.5px `panelTxtMute`. Handle is copyable — turns to `theme.runBg` (green) on copy confirmation with an inline checkmark SVG.

---

## 2p. System overlays (fixed-position HUD elements)

These float outside the normal layout, anchored to the viewport:

**`SaveErrorIndicator` Chip** (`src/components/SaveErrorIndicator.tsx`):
- `position: fixed`, `bottom: 16`, `left: 16`, `zIndex: 9998`
- `borderRadius: 20`, `padding: "5px 10px"`, `fontSize: 12`, `fontWeight: 500`, `color: "#fff"`
- `boxShadow: "0 1px 6px rgba(0,0,0,0.22)"`, `pointerEvents: none`
- Background is semantic and hardcoded: `rgba(0,0,0,0.45)` saving, `rgba(30,120,70,0.85)` saved, `#b07100` auth error, `#c0392b` network/quota error, `rgba(80,80,80,0.7)` local-only

**`ToastContainer`** (`src/components/ToastContainer.tsx`):
- `position: fixed`, `bottom: 20`, `right: 20`, `zIndex: 9999`
- Each toast: `padding: "12px 16px"`, `borderRadius: 6`, `fontSize: 13`, `color: theme.surfacePanel` (light text on colored bg)
- Background: `#e05` error, `#2d5` success, `theme.accent` default (all hardcoded — toasts are intentionally vivid and theme-independent)
- `boxShadow: "0 2px 8px rgba(0,0,0,0.15)"`, `minWidth: 200`, `maxWidth: 300`
- Dismiss `×` button: `all: "unset"`, `fontSize: 16`

---

## 2q. Autocomplete tooltip (CodeMirror)

`makeAutocompleteTheme` (`src/editor/graphicsCompletion.ts:293-370`) — the completion dropdown is themed via a CodeMirror EditorView theme, not inline React styles, but uses the same tokens:

- Tooltip shell: `background: theme.surfacePanel`, `border: 1px solid theme.panelBorder`, `borderRadius: theme.radiusCard + 2` px, `boxShadow: "0 4px 20px rgba(0,0,0,0.22)"`
- Completion label: `fontMono` 12px, `panelTxt`
- Completion detail: `fontMono` 11px, `panelTxtMute`, `fontStyle: "normal"` (overriding CodeMirror's italic default)
- Selected row: `background: theme.accent + "22"` (22 = 13% alpha hex)
- Completion type icons: all rendered as text characters (`ƒ`, `⬡`, `·`, `k`), colored `theme.accent`
- Info panel (right side): same surface/border/shadow as the list tooltip

---

### 2r. Compete page layout

`src/compete/CompetePage.tsx` + `src/compete/CompeteLeft.tsx` — the `/compete/:slug` route.

**Overall structure**: full-viewport flex row (`height: 100vh`). Left half is `CompeteLeft` (editor + console), right half is the problem panel. Both are `flex: 0 0 50%`. The IDE `Rail` is prepended on the far left (same as the main IDE).

**Toolbar** (`CompeteLeft`, 40px):
- `height: 40`, `background: theme.surfacePanel`, `borderBottom: 1px solid panelBorder`
- Left side: Python language pill (uses `successPill` bg + `successPillTxt` color, `fontMono`, `borderRadius: radiusCard`) + `solution.py` filename (`fontMono`, 12px, `panelTxtMute`)
- Middle: test pass count pill — `borderRadius: 999`; pass: `successPill` bg + `successPillTxt`; fail: `${consoleErr}22` bg + `consoleErr` text
- Right: **Run** button (`runBg`/`runTxt`) + **Submit** button (`submitBg`/`submitTxt`); both 12.5px, weight 700, `radiusButton`, `opacity: 0.6` when disabled

**Console strip** (bottom of `CompeteLeft`):
- `borderTop: 1px solid consoleBorder`, `background: consoleBg`
- Collapsed: `height: 32`; expanded: `height: 140`; `transition: height 0.15s`
- Header (32px): click anywhere to toggle; uppercase "Console" label (`fontSize: 11.5`, weight 600, `consoleTxtMute`); running indicator shows `BlinkDot` trio; chevron `▾`/`▴` at right

**Problem panel** (right half):
- `background: theme.surfacePanel`, standard `PanelHeader` style (`padding: 12px 20px 10px`, `panelHeader` bg, `panelBorder` bottom, title 16px `weightHeader`)
- Statement rendered via `<ReactMarkdown>` in a scrollable body (`fontSize: 14`, `lineHeight: 1.7`)
- Section label above tests: 11.5px, uppercase, `letterSpacing: 0.8`, `panelTxtMute` — matches the `SectionLabel` idiom
- Test cards: `background: theme.surface`, `borderRadius: radiusCard`, border color driven by run result (`${passColor}66` / `${failColor}66` / `panelBorder`)

**`VerdictCard`** (appears between header and statement after submit):
- `margin: 12px 16px`, `padding: 14px 16px`, `borderRadius: radiusCard`
- Pass: `successPill` bg + `successPillTxt` border/text; Fail: `${consoleErr}22` bg + `consoleErr` border/text
- Emoji (✅ / ❌) at 22px — one-off; not a pattern to replicate elsewhere
- Title: 15px, weight 700; subtitle: 12.5px, `panelTxtMute`; dismiss `<Icon name="close" size={14} />`

**`ProgressBar`** (appears during submit run):
- `margin: 12px 16px`, 12.5px `panelTxtMute` label above
- Track: `height: 3`, `borderRadius: 2`, `background: chip`
- Fill: `background: accent`, `transition: width 0.15s` — same pattern as other progress bars in the app

---

## 3. Interactional Patterns

### 3a. Button base

All interactive elements start with `all: "unset"` to strip browser defaults, then apply custom styling. This is universal — no exceptions.

### 3b. Hover treatment

Inline styles cannot use CSS `:hover`. The IDE pattern is `useState(false)` + `onMouseEnter`/`onMouseLeave`:

```tsx
const [hover, setHover] = useState(false);
// ...
onMouseEnter={() => setHover(true)}
onMouseLeave={() => setHover(false)}
// ...
background: hover ? theme.railHoverBg : 'transparent'
```

`ProblemsPanel` (`src/ProblemsPanel.tsx:137-138`) uses direct `e.currentTarget.style.background` mutation — simpler but less idiomatic. The `useState` approach is preferred for named components.

Transition: `transition: "background 0.15s, color 0.15s"` on anything that changes bg/color on hover.

### 3c. Disabled state

- `opacity: 0.5` (rail run button at 0.5, compete button at 0.6)
- `cursor: not-allowed` or `cursor: default`
- `disabled` HTML attribute set where appropriate

### 3d. Loading / in-progress state

- Blinking dot animation via `pi3blink` CSS keyframe: three 6px dots, staggered delays (0, 0.2s, 0.4s), color `theme.consoleInfo`
- Used in ConsolePanel and CompeteLeft to show active execution

### 3e. Focus rings

The IDE does not implement custom focus rings (no visible `:focus` styles in the source). Browser defaults apply, but this is not a deliberate pattern — it's an accessibility gap, not something to replicate.

### 3f. Transitions

- Hover/active background shifts: `0.15s`
- Toggle switch state: `0.18s`
- Progress bar width: `0.15s`
- Canvas window opacity on show/hide: `0.3s`
- No other animation timings are used.

---

## 4. Composition Rules

### 4a. Modal vs inline panel

- **Sidebar panel** (320/520px sliding drawer): for persistent context (project list, docs, settings). Content the user might want to leave open.
- **`ThemedDialog`** (`src/components/ThemedDialog.tsx`): for confirmations, alerts, short-form input. Small (max 440px), dimmed backdrop `rgba(0,0,0,0.5)`, `borderRadius: 10`, `padding: 24`.
- **`AssetEditor` / large modal** (`src/AssetEditor.tsx`): for complex editing contexts (sprite editor, tilemap editor). Near-fullscreen: `min(1200px, 96vw)` × `min(720px, 92vh)`, `surface` bg, `shadowWindow`, `borderRadius: 8`, backdrop `rgba(0,0,0,0.55)`.

### 4b. Main area composition

The IDE's main area (`src/App.tsx`) is a flex row:
- Rail (60px, flex-none)
- Editor region (flex: 1) stacked vertically with the console below
- Canvas window is a fixed-position floating overlay (not in the flex flow)

The console appears below the editor as a resizable strip — `borderTop: 1px solid consoleBorder`, draggable handle.

### 4c. Primary action placement

Primary actions (Run/Stop) live in the **rail**, not in the editor toolbar. Secondary actions (copy, clear) appear in panel headers as text+icon buttons at the right.

### 4d. Panel switching

Switching panels is instant (no animation on the panel itself). The `activePanel` state swap causes an immediate unmount/mount. The `Backdrop` component (`src/components/Backdrop.tsx`) handles click-outside dismissal.

### 4e. Content that scrolls

Panel bodies are `overflowY: auto`, `flex: 1`. The header is `flex: none`, pinned at top. Long lists (projects, docs) scroll within the panel — the header stays fixed.

---

## 5. The Pi3 Voice in UI

### 5a. Language style

Labels are **terse and technical**, not friendly-prose:
- "Console" not "Output console"
- "Run" not "Run your code"
- "Settings" not "Preferences"
- Section labels are ALL CAPS (via `textTransform: uppercase`)

### 5b. Iconography

All icons are **custom hand-crafted SVGs** in `src/components/Icons.tsx`, dispatched through the `<Icon name="..." />` component. The dispatch table (`Icon` function, line 350–394) is the authoritative list of available icons.

Icon style: stroke-based line icons (`strokeWidth: 1.8`, `strokeLinecap: round`, `strokeLinejoin: round`), except for a few filled icons (play, stop, pause) which use `fill`. Icons are sized with a `size` prop; common sizes are 11 (tiny inline), 13 (header action), 14 (close button), 18–21 (rail).

To add a new icon: implement an `IconFoo` function in `Icons.tsx`, add `"foo"` to the `IconName` union, add the `case "foo":` in the `Icon` switch.

### 5c. Information density

The IDE is **moderately dense** — it is a productivity tool, not a marketing page:
- 44px rail buttons (comfortable touch targets)
- 32px console header
- 12–14px body text
- 10–11.5px metadata/labels
- Padding tends to be 8–16px inside panels; 4–8px between items

### 5d. Theme philosophy

Two themes: **Studio** (warm cream background, teal rail) and **Midnight** (deep teal/dark, same teal rail). Both share the same rail color family (`railBg` is teal in both). Midnight is the default for new sessions. They differ in surface brightness but share the same structural tokens — no component should behave differently per-theme.

---

## 6. What Is Deliberately NOT a Pattern

- **No Tailwind utility classes for layout or color.** Tailwind is present but used at most for global base resets. All layout and color is inline styles via `theme.*`.
- **No `react-icons` in UI code.** Only the custom `<Icon>` component from `Icons.tsx`.
- **No hardcoded hex values in components.** Even one-off `"#fff"` on a toggle knob is a judgment call that should be documented.
- **No CSS `:hover`, `:focus`, or `:active` selectors.** State is managed in React; browser pseudo-classes are not relied on for visual feedback.
- **No Tailwind `className` for spacing or color.** Using `className="p-4 bg-red-500"` would be out of character.
- **No multiple imports of the same logical component.** The IDE doesn't duplicate — `BlinkDot` is defined locally in ConsolePanel and CompeteLeft separately, which is a known duplication that should be resolved.

---

## 7. Known Exceptions and One-Instance Patterns

These appear once and may or may not be patterns — noted for honesty:

- **`ErrorCard`** (`src/components/ConsolePanel.tsx`) uses category-specific hardcoded hex colors (`CATEGORY_COLORS` map), not theme tokens. This is deliberate — the error categories have their own semantic palette (red for grammar, purple for logic, etc.) that is independent of the theme. This is the only major exception to the token rule.
- **`AssetEditor` backdrop** uses `rgba(0,0,0,0.55)` vs `ThemedDialog`'s `rgba(0,0,0,0.50)` — minor inconsistency, not a pattern.
- **`ThemedDialog` `borderRadius: 10`** vs token value of `radiusWindow: 4` — dialogs intentionally use a rounder radius to feel distinct from the workspace.
- **`ProblemsPanel` header** does not use the `PanelHeader` component; it rolls its own 40px header at 13px title. This is an inconsistency from its age, not a deliberate choice.
- **`railLogo` color** in Midnight is `#5fd4dc` (teal accent); in Studio it is `#fffaf0` (cream). The `Pi3Logo` component renders in the rail with this token — the logo deliberately changes color per theme (see §1a Text table).
- **`submitBg`/`submitTxt`** are blue (Studio `#2563eb`, Midnight `#3b82f6`) — the only blue action in the app. This is intentional: compete submission is a distinct semantic action from running code (green) or stopping it (red). Do not use blue for anything else.
- **Canvas game tokens** (`canvasStar`, `canvasRock`, `canvasShip`, `canvasHud`) are used exclusively by the built-in BFS visualiser and asteroid-game canvas rendering. They are not general-purpose colors; do not use them outside of canvas game drawing code. `canvasOverlay` and `canvasHintTxt` may be used for any overlay drawn on the canvas surface.
- **`SidePanel`** (`src/components/SidePanel.tsx`) uses Tailwind classes (`bg-cyan-800`, `border-white/10`, etc.) instead of theme tokens. This component is unused by the main IDE; it was scaffolded for a different context. Do not use it as a model.
- **`LoadingScreen`** (`src/components/LoadingScreen.tsx`) also uses Tailwind (`bg-cyan-950`, `text-cyan-300`, `animate-spin`) and is the only screen that shows while Pyodide loads before the theme store is available — it has no access to `theme.*` by design. This is the single valid use of Tailwind for visual styling.
- **Toast colors** (`ToastContainer`) and **SaveErrorIndicator chip colors** are hardcoded per semantic state (error/success/auth/offline) and are intentionally vivid and theme-independent — they must be readable regardless of theme.
- **Rewind frame overlay** uses hardcoded `rgba(255,220,0,0.7)` yellow outline and `"#ffe040"` text — a one-off debugging color not from the token set.

---

## Summary: Consistent-across-3+-surfaces (true patterns)

| Pattern | Where to verify |
|---|---|
| `useThemeStore((s) => s.theme)` to obtain tokens | Every UI file |
| `all: "unset"` on every `<button>` | SideMenu, ConsolePanel, ProblemsPanel, CanvasWindow |
| `<Icon name="..." size={n} color="currentColor" />` for all icons | SideMenu, ConsolePanel, ProblemsPanel |
| `theme.fontUI` / `theme.fontMono` — never hardcoded | SideMenu, ConsolePanel, CompetePage |
| Status pills: `borderRadius: 999`, uppercase, 10–10.5px | ConsolePanel header, CanvasWindow titlebar, CompeteLeft toolbar |
| Progress bar: 3px track `chip` bg + `accent` fill, `transition: width 0.15s` | CompetePage `ProgressBar`, CanvasWindow |
| Hover state via `useState` + `onMouseEnter/Leave` | RailButton, ProblemsPanel rows |
| Transition `0.15s` on hover color/background changes | RailButton, SegmentSelector |
| `panelHeader` bg + `panelBorder` bottom for header band | PanelHeader, ProblemsPanel, ConsolePanel |
| `chip` bg for non-action interactive surfaces (toggle rows, inactive selectors) | SideMenu settings |
| Floating panels: shadow `8px 0 28px` + `panelBorder` right border | SideMenu panel container |
