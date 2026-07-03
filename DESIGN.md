---
version: alpha
name: pi3 Problem Editor
description: Ergonomic code editor for the pi3 Python IDE, designed for 10-12 year olds
colors:
  background: "#e9e3d3"
  surface: "#fbf6e9"
  panel: "#fffaf0"
  panelHeader: "#fdf3e1"
  chip: "#f3ebd7"
  text: "#1f2933"
  muted: "#5b6976"
  faint: "#9aa6b2"
  border: "#dfdbd0"
  borderStrong: "#c5bfb3"
  accent: "#0e9aa7"
  accentDeep: "#0a3d44"
  accentSoft: "#e0f1f3"
  student: "#f6a560"
  studentSoft: "#fdf0e5"
  ok: "#0e7c52"
  okSoft: "#e0f0e8"
  warn: "#b87a1f"
  danger: "#c4451c"
typography:
  display:
    fontFamily: "'Nunito', system-ui, sans-serif"
    fontWeight: 800
  body:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: 13px
    lineHeight: 22px
rounded:
  sm: 4px
  md: 6px
  lg: 10px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 10px
  lg: 12px
  xl: 16px
components:
  editor-toolbar:
    backgroundColor: "#0e9aa7"
    height: 40px
    textColor: "#ffffff"
  file-tab-active:
    backgroundColor: "#fffaf0"
    textColor: "#0a3d44"
    rounded: "4px 4px 0 0"
    typography: "{typography.mono}"
    padding: "5px 12px"
  file-tab-inactive:
    backgroundColor: "#a3d4d8"
    textColor: "#ffffff"
    rounded: "4px 4px 0 0"
    typography: "{typography.mono}"
    padding: "5px 12px"
  button-run:
    backgroundColor: "#ffffff"
    textColor: "#0e9aa7"
    rounded: "{rounded.pill}"
    typography: "{typography.body}"
    padding: "5px 16px"
  editor-surface:
    backgroundColor: "#fffaf0"
    textColor: "{colors.text}"
    padding: 0px
  problem-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 10px
  section-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: 8px
    padding: 0px
  console-panel:
    backgroundColor: "#252d31"
    textColor: "#c8cdd0"
    rounded: 0px
    padding: 0px
  hint-card:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.text}"
    rounded: 6px
    padding: 0px
  test-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: 0px
    padding: 0px
---

## Overview

The pi3 Problem Editor is a student-facing code editing surface for a
browser-based Python IDE. Target users are 10-12 year olds learning to
program. The design prioritizes clarity, encouragement, and minimal cognitive
load — warm cream tones with a teal accent convey a safe, playful environment.

## Layout

Two-column editor body with no top shell bar to save vertical space for code:

- **Left**: Resizable problem panel (240–480px, collapsible to 40px).
  Content chunked into SectionCards: Description, Tests, Hints.
- **Right (flex)**: Code editor + resizable console, stacked vertically.
  Teal toolbar bar sits atop the code editor with file tabs and Run button.

The problem panel stays visible alongside the code so students never lose
context. SectionCards provide clear visual chunking matching the
TeacherProblemForm pattern.

## Editor Toolbar

Teal bar spanning the full editor width with pi3 logo, file tabs, project
context, Ctrl+Enter shortcut badge, Run button, and user avatar. Run button
is a white pill with scale-down press feedback.

## Code Editor

Off-white editor surface with line numbers (48px gutter) and teal-tinted
indentation guide bands (4-space increments). Transparent textarea over a
highlight overlay for full editability. Auto-indent on Enter and Tab.

## Console

Soft-dark console with animated status dot, load bar during execution,
and Clear/Show toggle. Drag-resizeable between 80–400px.

## Hints

Collapsible accordion cards with bulb icon inside a SectionCard. Only one
hint open at a time. Chip background with teal border when expanded.

## Interactions

- Run button: scale-down press effect, hover glow, disabled during execution
- Ctrl+Enter keyboard shortcut
- Problem panel: drag to resize, chevron to collapse/expand
- Console: drag handle to resize, Clear/Show toggle
- Hint cards: accordion with one open at a time
- Progressive test feedback: tests update one-by-one during run
