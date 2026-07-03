# Compete-Mode Design Deviations

Inventory of visual/structural gaps between `src/compete/` and `docs/design-language.md`.
Written before code changes (per DL-B gate). Each deviation has a proposed resolution.

---

## D1 — Forced Midnight theme

**File**: `src/compete/CompetePage.tsx:105-108`
```tsx
useEffect(() => {
  savedTheme.current = useThemeStore.getState().themeId;
  setTheme('midnight');
  return () => setTheme(savedTheme.current);
}, [setTheme]);
```

**Problem**: Compete-mode ignores the user's theme preference and forces Midnight on mount.
**Resolution**: Remove this effect entirely. Compete-mode follows `useTheme` like every other page.
**Risk**: Compete's own components use hardcoded hex values that look fine in Midnight but may become invisible in Studio. Those are fixed in subsequent deviations.

---

## D2 — Custom mini-rail replaces the real Rail

**File**: `src/compete/CompetePage.tsx:267-285`

A bespoke 56px mini-rail is rendered with:
- `π` character as logo in `fontMono` at 18px — not `Pi3Logo`
- Two hardcoded `railBtn()` buttons constructed inline
- No `RailButton` component
- No actual navigation to panels (clicking "problems" does nothing meaningful; "debug" toggles a local flag)

**Problem**: The real rail (`src/SideMenu.tsx`) already exists, already includes a Problems panel button, and already provides the correct visual idiom. Compete-mode reimplements it incompletely.

**Resolution**: Render the real `Rail` (the default export from `SideMenu.tsx`) instead of the mini-rail. The Problems panel in the rail already links to `ProblemsPanel`. The debug toggle in compete can remain as a `RailButton` added to the rail (or removed — the DebugPanel already appears in the console sub-panel tree).

**Corollary**: The `debugOpen` local state and its conditional `DebugPanel` block (`CompetePage.tsx:320-328`) should be removed — `DebugPanel` is already embedded in `ConsolePanel` from the IDE side.

---

## D3 — Slim page header (48px title bar) is not an IDE idiom

**File**: `src/compete/CompetePage.tsx:289-302`

```tsx
<div style={{
  height: 48, background: theme.surfacePanel,
  borderBottom: `1px solid ${theme.panelBorder}`,
  display: 'flex', alignItems: 'center',
  padding: '0 16px', gap: 10, flex: 'none',
}}>
  <a href="/" style={{ color: theme.panelTxtMute, fontSize: 12, textDecoration: 'none' }}>
    ← IDE
  </a>
  <span style={{ fontFamily: theme.fontUI, fontSize: 15, fontWeight: 700, color: theme.panelTxt }}>
    {problem.title}
  </span>
</div>
```

**Problem**: The IDE has no page-level title bar — it uses the rail + file tabs instead. This bar is an orphan idiom.

**Resolution**: Remove the slim header. The problem title belongs in the statement panel's content area (as a Markdown `# heading` or as a styled title row within the statement panel, following the `PanelHeader` idiom). The "← IDE" back link can become a `RailButton`-style link in the rail (an `<a>` styled as a rail button).

---

## D4 — Submit button uses hardcoded colors

**File**: `src/compete/CompeteLeft.tsx:116-134`
```tsx
background: '#2d5ea8',
color: '#e8f0ff',
```

**Problem**: Submit is a primary action like Run, but it uses hardcoded blue instead of any theme token.

**Resolution**: Submit needs a theme token. Options:
- Re-use `theme.accent` (warm orange) — but accent is already used for progress fills, range sliders, active selectors. Using it for Submit creates semantic ambiguity.
- Add a new semantic pair `submitBg` / `submitTxt` to `useTheme.ts` in both Studio and Midnight themes.
- Use `theme.runBg` with a different icon — but that conflates Run and Submit visually.

**Proposed**: Add `submitBg` (a cool blue: `#2563eb` Studio / `#3b82f6` Midnight) and reuse `theme.runTxt` as the text color (white/dark-teal), since both themes' `runTxt` work on blue. Alternatively, if Ilya prefers no new tokens, map Submit to `theme.accent` since contest submission is conceptually the "success path."

---

## D5 — Python badge uses hardcoded colors

**File**: `src/compete/CompeteLeft.tsx:74-79`
```tsx
background: '#3b7a57',
color: '#a8e6c1',
```

**Problem**: The "Python" language badge uses hardcoded forest-green colors.

**Resolution**: Map to existing tokens. The IDE's `consoleInfo` color is green (used for info output); `successPill`/`successPillTxt` are green-tinted and convey "active/good." Use `background: theme.successPill, color: theme.successPillTxt` for the Python badge — semantically "this is Python" reads as affirmative/neutral positive.

---

## D6 — CodeMirror uses `githubDark` theme unconditionally

**File**: `src/compete/CompeteLeft.tsx:6`, `src/compete/CompeteLeft.tsx:141`
```tsx
import { githubDark } from "@uiw/codemirror-theme-github";
// ...
theme={githubDark}
```

**Problem**: The IDE's CodeMirror editor uses a custom theme derived from `theme.syn.*` and `theme.editorBg` tokens (see `src/components/CodeEditor.tsx` or equivalent). Compete forces `githubDark` regardless of the user's theme choice.

**Resolution**: Import the same custom CodeMirror theme factory the IDE uses. The IDE's editor and compete's editor should render identically — same font, same syntax colors, same background.

---

## D7 — VerdictCard uses hardcoded hex colors

**File**: `src/compete/CompetePage.tsx:35-68`
```tsx
background: ok ? '#10b98122' : '#ef444422',
border: `1px solid ${ok ? '#10b981' : '#ef4444'}`,
color: ok ? '#10b981' : '#ef4444',
```

**Problem**: Success/failure colors are hardcoded hex — invisible in light themes or different from the IDE's semantic palette.

**Resolution**:
- Success state: `background: theme.successPill`, `border: 1px solid theme.successPillTxt`, `color: theme.successPillTxt`
- Failure state: the IDE uses `theme.consoleErr` for errors. Map: `background: rgba` of `consoleErr` at low alpha, `border: 1px solid consoleErr`, `color: consoleErr`

The `'✅'` / `'❌'` emoji can stay — the IDE uses emoji in `ErrorCard` (`CATEGORY_ICONS`) so this is in-character.

---

## D8 — Test case result indicators use hardcoded green/red

**File**: `src/compete/CompetePage.tsx:371-375`, `src/compete/CompetePage.tsx:408-413`
```tsx
color: run.passed ? '#10b981' : '#ef4444'
border: `1px solid ${run ? (run.passed ? '#10b98166' : '#ef444466') : theme.panelBorder}`
```

**Problem**: Same hardcoded green/red as D7.

**Resolution**: Use `theme.successPillTxt` for pass color and `theme.consoleErr` for fail color. For the border alpha variants, use `rgba` composition: `theme.successPillTxt` at 40% opacity for the pass border, `theme.consoleErr` at 40% for the fail border.

---

## D9 — `error_card` output in CompeteLeft is dumbed down

**File**: `src/compete/CompeteLeft.tsx:201-203`
```tsx
if (line.kind === 'error_card') {
  return <div key={i} style={{ color: theme.consoleErr, fontStyle: 'italic' }}>Runtime error</div>;
}
```

**Problem**: The IDE renders `ErrorCard` (the full structured card with category, message, code snippet, suggestions). Compete renders a plain italic "Runtime error" string. This discards all the teaching value of the error system.

**Resolution**: Import and render `ErrorCard` from `src/components/ConsolePanel.tsx` (or extract it to its own file). The compete console should show the same error card the IDE does.

**Note**: `ErrorCard` uses category-specific hardcoded colors (`CATEGORY_COLORS` in ConsolePanel.tsx) — this is an approved exception per the design doc (Section 7). Don't "fix" those colors.

---

## D10 — `debugOpen` / `DebugPanel` rendered outside ConsolePanel

**File**: `src/compete/CompetePage.tsx:113`, `src/compete/CompetePage.tsx:320-328`

The compete page has its own `debugOpen` toggle and renders `<DebugPanel />` conditionally in a `flex: 0 0 220px` strip below the editor.

**Problem**: In the IDE, `DebugPanel` is a sub-panel that appears inside `ConsolePanel` (between the header and the output). Compete's placement is separate and doesn't follow this idiom.

**Resolution**: Once D2 is resolved (real `Rail` + real `ConsolePanel`), DebugPanel appears where it should automatically. Remove the `debugOpen` state and the manual `DebugPanel` render from CompetePage.

---

## D11 — No `SideMenu` / Rail in compete

This is the root cause of D2 and D10. Compete uses its own layout instead of inheriting from the IDE's shell.

**Resolution**: The compete page layout should be:
```
[Rail (60px)] [Main content area (flex: 1)]
```
Where Rail is the real `Rail` export from `SideMenu.tsx`. Main content is the compete-specific split layout (editor+console left, statement right).

The Problems panel already exists in Rail (`activePanel === "problems"` → `<ProblemsPanel />`). No new panel is needed.

---

## Summary table

| ID | File | Severity | Token fix needed? |
|---|---|---|---|
| D1 | CompetePage.tsx:105-108 | High | No — remove code |
| D2 | CompetePage.tsx:267-285 | High | No — use real Rail |
| D3 | CompetePage.tsx:289-302 | Medium | No — remove element |
| D4 | CompeteLeft.tsx:116-134 | High | Yes — `submitBg`/`submitTxt` or `accent` |
| D5 | CompeteLeft.tsx:74-79 | Medium | No — `successPill`/`successPillTxt` |
| D6 | CompeteLeft.tsx:6,141 | High | No — use IDE CM theme |
| D7 | CompetePage.tsx:35-68 | High | No — `successPill`, `consoleErr` |
| D8 | CompetePage.tsx:371-413 | Medium | No — `successPillTxt`, `consoleErr` |
| D9 | CompeteLeft.tsx:201-203 | High | No — import `ErrorCard` |
| D10 | CompetePage.tsx:113,320-328 | Medium | No — remove, use ConsolePanel |
| D11 | CompetePage.tsx layout | High | No — structural change |
