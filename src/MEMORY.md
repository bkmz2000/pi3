---
schemaVersion: 1
scope: workspace
updatedAt: "2026-07-02T18:34:13.252Z"
workspaceName: "src"
---

# Project Memory

## Project Overview
Redesigning the pi3 problem editor for 10–12 year-old learners and teachers, preserving the warm cream + teal visual model. The workspace contains both student-facing editor components (App.jsx) and teacher-facing authoring (TeacherProblemForm.jsx), along with supporting design system files.

## Current State
- **Student editor** (App.jsx): two-column layout (problem panel left, code+console right), teal file-tab bar, resizable panels, interactive code surface, warm console (#252d31), and animated Run feedback.
- **Teacher form** (TeacherProblemForm.jsx): completely redesigned as a **fullscreen** authoring tool with **three distinct layouts** (Tabbed, Sidebar, Accordion) that share the same form state and live student preview. Each layout provides strong visual separation between problem details, statement, starter code, tests, and generator sections, all using pi3 SectionCards and tokens.
- Tabbed layout: horizontal section tabs with amber content-dots, centered editing area, pinned 380px preview.
- Sidebar layout: vertical numbered nav rail, progress stepper, prev/next navigation, right preview.
- Accordion layout: all sections stacked and collapsible, with toggleable slide-over preview drawer.
- Layout switcher control present in each layout; switching preserves all form data.
- The form is truly fullscreen (100vh) with no top shell chrome.
- DESIGN.md exists and codifies the visual system.

## Artifacts
- `App.jsx` – student-facing editor, two-column ergonomic layout, teal tab bar, interactive code surface, Run button with phase animations.
- `TeacherProblemForm.jsx` – teacher authoring form, fullscreen with three layouts, shared preview pane.
- `DESIGN.md` – authoritative design tokens and component patterns for the pi3 visual model.
- `side-panels.jsx`, `canvas-window.jsx` – supporting components following pi3 token system.

## Design Direction
- Maintain warm cream (#e9e3d3) and off-white (#fffaf0) backgrounds, teal (#0e9aa7) accent, soft borders, friendly typography.
- Maximize ergonomics by keeping problem statement always visible; student editor has two‑column layout, teacher form is fullscreen with immediate visual feedback.
- Use SectionCard pattern (icon + title header, bordered card) for chunking content in all contexts.
- Teacher form now offers three distinct fullscreen layouts to accommodate different authoring workflows while preserving design consistency.

## User Feedback
- User requested fullscreen teacher form and explicit separation between different parts of problem settings, with at least three different layouts.
- Preference for preserving the existing styling model and keeping a live student preview.

## Decisions
- Teacher form is fullscreen and includes layout switcher; three layouts all share the same form state.
- Student preview remains sticky/pinned in Tabbed and Sidebar layouts, toggles as a drawer in Accordion layout.
- Strong visual separation between sections via SectionCards, borders, and layout‑specific navigation (tabs, stepper, accordion headers).
- Topbar save-status pill (amber/green) retained in all layouts; auto-clears after idle.
- All new components pull tokens from `theme` (useThemeStore) to stay consistent with pi3.

## Open Questions
- Should the student editor support multiple files per problem?
- Need teacher feedback on preferred layout, form ergonomics, and navigation patterns.

## Next Steps
- Gather teacher feedback on which layout is most intuitive and productive.
- Integrate the new TeacherProblemForm into the main application routes.
- Extract SectionCard, RunButton, and possibly layout‑switching primitives as reusable components.

## Promotion Candidates For DESIGN.md
- Fullscreen teacher form with multiple layout modes (decision).
- Visual separation patterns: tabbed sections, sidebar nav, accordion sections.
- Layout‑switcher control that preserves form state (UX pattern).
- Student preview pane/drawer behavior across screen sizes.

## Recent History
- 2026-07-02: Redesigned student editor with teal file-tab bar, interactive code surface, animated Run feedback.
- 2026-07-02: User requested TeacherProblemForm redesign; studied existing form and pi3 tokens.
- 2026-07-02: Built first two‑pane teacher form with sticky preview, test arrow cards, generator table, save‑status pill.
- 2026-07-02: User demanded more radical redesign; built fullscreen form with three distinct layouts (Tabbed, Sidebar, Accordion) and layout switcher.