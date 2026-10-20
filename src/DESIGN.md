---
version: alpha
name: TeacherProblemForm — pi3 Redesign
---

## Overview

Redesigned teacher-side problem authoring form for the pi3 coding platform. Teachers write problem statements, authored starter code, and test cases with Python generator support. A sticky student preview pane shows exactly what learners will see.

## Colors

- **appBg**: #e9e3d3 (warm cream page background)
- **surface**: #fbf6e9 (subtle off-white for inputs, test cards)
- **panel**: #fffaf0 (SectionCard background)
- **panelHeader**: #fdf3e1 (SectionCard header strip — slightly warmer than panel)
- **chip**: #f3ebd7 (badge background, pill chips)
- **border**: rgba(20,30,40,0.08) (soft card separators)
- **borderStrong**: rgba(20,30,40,0.15) (input borders)
- **teal**: #0e9aa7 (brand accent — icons, links, section headers)
- **actionBg/actionTxt**: #b45309/#ffffff (filled create/save/preview actions; high-contrast warm action color)
- **amber**: #d48c1a (unsaved/dirty state)
- **green**: #0e7c52 (saved state, use-tests button)

## Typography

- **fontUI**: Inter, system-ui, sans-serif (form fields, labels, buttons)
- **fontMono**: JetBrains Mono, ui-monospace, monospace (code, slugs, test data)
- **fontDisplay**: Nunito, system-ui, sans-serif (problem title in preview)

## Rounded scale

- Cards: 12px
- Buttons: 8px
- Inputs: 8px
- Pills: 999px

## Spacing

- Section gap: 18px between cards
- Card inner padding: 18px
- Form field gap: 16px

## Components

### SectionCard

Container with panel background, soft border, 12px radius. Icon+title header strip uses panelHeader background with bottom border. Used for: Problem Details, Statement, Starter Code, Test Cases, Generator.

### Topbar

Sticky at top, panel background (#fffaf0), subtle shadow. Left: back link + divider + title + save-status pill. Right: keyboard shortcut hint + discard + save button. Save button uses the shared `actionBg`/`actionTxt` warm fill with a checkmark icon.

### TestCaseCard

Two-column input→expected layout with teal arrow divider. Monospace textareas with transparent background. Header shows test index, tier, visibility badge, and delete button. Visibility badge uses green pill for "Shown" and muted pill for "Hidden".

### TierGroup

Groups test cards by tier (1-3) with star rating, tier label, and explanatory subtitle. Empty state uses dashed border placeholder. "Add Tier N test" link button in teal.

### StudentPreview

Right-side sticky panel (400px). Teal topbar with preview icon. Problem title in panelHeader strip. Statement rendered below with examples section showing visible test cases in Input/Expected split cards.

### Generator

ConsoleView shows script output with status dot. Dark-background code editor surface (nord-inspired syntax colors: blue comments, peach/orange variables, green functions). Run button uses the shared green `runBg`/`runTxt` tokens. Generated test table with tier, visibility, input/expected columns, remove button, and "Use These Tests" green action button.

## Interactions

- Typing marks form dirty → amber "Unsaved" pill (auto-clears after 4s idle)
- Run Generator button shows loading state, then populates output console + test table
- Test visibility toggle switches between green "Shown" and muted "Hidden" pill
- Generated tests have per-row remove (`×`) and bulk "Use These Tests" adoption in the shared warm `actionBg`/`actionTxt` style
- Discard button and duplicate save bar at bottom for long-form ergonomics
