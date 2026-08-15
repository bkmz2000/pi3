# pi3 Visual Design Review — Consistency & Overall Quality

Conducted 2026-08-03 by a Fable subagent (model tuned for aesthetic/design judgment),
driving two logged-in browser sessions (student + teacher role) through the full
route map of the app, in both Studio and Midnight themes, via the chrome-devtools
MCP tools. Read-only review — no code changes made as part of this audit.

## 1. Overall verdict

The core product is more coherent than most classroom tools: one recognizable language (teal surfaces, peach/orange selection accent, mint-green "run", small-caps section labels, chip-style status indicators) carries convincingly from the IDE shell through panels, docs, both asset editors, and even the teacher problem form. The Studio/Midnight pair is a genuine reskin — same layout, same hierarchy — not two apps. What undermines the impression is decision drift at the edges: the primary-action color is a different hue on almost every surface (green, peach, cyan, and one alien blue), there is no corner-radius scale at all, and the teacher suite splits into two visual worlds mid-navigation. Midnight — the default look — additionally ships several "borrowed default" colors in its most-stared-at surface, the editor. It looks like an intentional product with about five unfinished seams.

## 2. Per-surface findings

### Landing page (`/`) and examples gallery (`/examples`)
- **Feels like the same product as Studio** — cream + teal + `#34a853` green is the Studio palette, so the marketing→product transition is smooth *if* the user lands in Studio. For Midnight users the jump is stark (known limitation of `src/pages/welcome/shared.tsx` hardcoded CSS; confirmed — `#0c8792`, `#11444b`, `#34a853` literals).
- **Two competing CTA accents on one page**: "Start free" is teal, "Open in editor" is green, same visual weight, same page. Pick one meaning per color.
- **Copy/layout mismatch**: the final section is a heading "Start free" directly above a button "Start free", with the caption "…the button **below** drops you straight into the editor" rendered *below* the button. Appears twice.
- **Gallery grid is left-weighted**: 2–3 fixed-width cards per row with the right ~40% of the viewport empty at desktop widths; rows of 2 vs 3 alternate arbitrarily. Reads unfinished compared to the tight landing sections.

### Core IDE shell (`/ide`)
- **Panels are the strongest system in the app.** Projects/Examples/Problems/Live/Settings/Reference all share the same header pattern, surface color (`rgb(17,68,75)` in Midnight), small-caps section labels, and orange active-state accent. Verified panel/rail/editor/console are all one teal ramp — internal consistency is real, not just claimed.
- **Midnight editor chrome is off-family** (measured): gutter `rgb(51,51,56)` and active-line `rgba(54,51,66,0.5)` — neutral gray and gray-purple on a teal editor (`rgb(14,58,64)`). These are stock-dark-theme values, not Midnight tokens; the gutter reads as a brown column bolted onto the teal editor. Studio's equivalents (white gutter, pale blue active line) are properly themed. Likely the CodeMirror theme setup in the editor component.
- **Indent markers render as solid lighter rectangles** on leading whitespace — they read as phantom selections, in both themes.
- **Naming collision**: the file explorer's header is the project-switcher dropdown showing the current project name — for a scratch session it reads "Examples ▾" while the rail's separate Examples panel is *also* titled "Examples". Two adjacent panels, same title, different content.
- **Empty-state copy drift**: explorer says "No sprites match" (implies a filter that doesn't exist); SheetEditor says "No sprites yet…".
- **Canvas window**: the monitor-metaphor dark chrome is defensible, but its default position covers the console's Copy/Clear buttons, and its 2px radius is the sharpest corner in an app that elsewhere uses 6–12px.
- Save-status chips ("Saved" / "Local only — Ctrl+S to save") are a nice, consistent pattern across IDE and projects page.

### Asset editors (`src/SheetEditor.tsx` vs `src/TileEditor.tsx`)
Two sibling modals from the same dispatcher (`src/AssetEditor.tsx`) with different chrome conventions: Sheet Editor has an **orange** title, a neutral "Close" text button, and saves via Ctrl+S; Tilemap Editor has a **white** title, a green "✓ Save" button plus a separate icon-only X. Tool rails, palettes, and side panels inside both are excellent and on-theme. Neither modal dims the background, while the teacher "New Group" dialog does use a scrim — the app has no single modal elevation policy.

### Projects page (`/projects`)
Clean and fully themed in both themes. One note: the placeholder cover thumbnails are saturated purple/magenta gradients — a hue family that exists nowhere else in the palette, and they're the largest color blocks on the page.

### Teacher suite (`src/components/teacher/`)
- **Two worlds inside one suite**: Groups/Student Projects/Help Requests live in a sidebar dashboard shell; clicking "Problems" in that same sidebar silently exits the shell to `/teacher/problems` — no sidebar, no header, notably darker background, full-bleed admin table. The problem list also introduces a peach "New Problem" primary while the dashboard uses green "+ New Group".
- **Native unstyled checkboxes** ("Freeze updates", "Show archived") sit next to a green button, while the IDE Settings panel uses custom iOS-style switches for identical semantics.
- **Empty states are bare gray sentences** ("No groups yet. Create one to get started." / "No student projects shared yet." / "No pending help requests.") with no hierarchy or inline CTA — compare the Live panel, which pairs its empty text with a full-width action button. Weakest-polish surfaces in the app.
- **Active sidebar pill overhangs** the sidebar's right border by ~20px on every tab — small, but it's on-screen constantly.
- The **problem edit form** (TeacherProblemForm) is, ironically, the most designed teacher surface — card sections, live "what students see" preview, tiered test editor with dashed empty slots. But it adds a *fourth* primary color: a cyan "Save Problem".
- Escape closes dropdowns but not the New Group modal — minor interaction inconsistency.
- `/teacher/projects/:projectId` unreachable (no shared projects) — skipped as briefed.

### Compete mode (`/compete/reverse-a-string`)
- **The blue Submit button is the single most off-system element in the app.** Measured `rgb(59,130,246)` / `rgb(37,99,235)` — Tailwind blue-500/600. It *is* tokenized (`submitBg` in `src/state/useTheme.ts:167,244`) but it's the only blue in an otherwise teal/peach/green/amber system; it reads as a framework default that never got a design pass. Three button treatments share this screen: filled green Run, filled blue Submit, outline-peach per-test Run.
- **Compete's editor background differs from the IDE editor within the same theme** (Studio: `rgb(233,227,211)` vs the IDE's `rgb(255,250,240)`; Midnight: near-black vs teal). Same "material" (a code editor), two finishes.
- Otherwise the statement panel, test rows, and rail are properly on-theme in both themes.

### Dialogs generally
New Group dialog and the user menu are clean and token-consistent. The inline new-file input in the explorer is a nice lightweight pattern. The inconsistencies are policy-level: scrim vs no-scrim, Escape vs no-Escape, X-icon vs "Close" text — each dialog picks its own.

### Radius / material audit (code-level)
`borderRadius` tally across `src/**/*.tsx`: 6 (×42), 4 (×41), 5 (×36), 8 (×30), 3 (×19), 2 (×17), 7 (×6), 10 (×7), 12 (×6), plus pill values. Every integer from 2–12 is in active use — there is no radius scale, and it's visible: 2px canvas window and compete buttons vs 10–12px dialogs and cards.

## 3. Top 5 prioritized fixes (impact ÷ effort, best first)

1. **One primary-action color.** Collapse Submit (blue), Save Problem (cyan), New Problem (peach), Create/New Group (green), Start live session (peach) onto the existing run-green token — or promote peach to "primary" and reserve green strictly for run/success. Deleting `submitBg` alone removes the worst outlier. Mostly token edits; largest coherence gain per hour.
2. **Fix the two Studio breakages**: teacher sidebar active item renders white-on-white (illegible), and the canvas "LIVE" chip uses light-theme colors (`rgb(14,124,82)` on 16% green) on the permanently dark canvas header, making it nearly invisible. Both are one-line color fixes with high visibility.
3. **Re-map Midnight's CodeMirror chrome** (gutter `#333338`, active line `#363342`) onto the Midnight teal ramp. This is the surface students stare at all day in the default theme; it's the difference between "themed editor" and "stock dark theme in a teal frame".
4. **Unify the teacher suite**: keep Problems (list + form) inside the dashboard shell, swap native checkboxes for the app switch component, and give the three empty states the Live-panel treatment (sentence + CTA). Medium effort, turns the teacher area from "separate mini-app" into part of the product.
5. **Adopt a 3-step radius scale** (e.g. 2 for chips, 6 for buttons/inputs, 10 for cards/dialogs) and align the two asset-editor headers (title color, Save/Close convention, one scrim policy for all modals). Mechanical cleanup with a broad, quiet payoff.

## 4. Cross-theme note

Midnight ↔ Studio is a deliberate, structurally faithful reskin — layout, spacing, and hierarchy are identical, and nearly every surface flipped (panels, dialogs, console, projects page, compete, teacher dashboard) re-themed cleanly. The exceptions: **(a)** teacher dashboard active-nav pill is illegible in Studio (white text on near-white); **(b)** the canvas window keeps dark chrome in Studio (defensible) but its LIVE/status chips follow the *global* theme tokens, so they vanish against the dark header; **(c)** Midnight's editor gutter/active-line are foreign grays while Studio's are properly themed — Midnight got less finishing; **(d)** LoadingScreen (`src/components/LoadingScreen.tsx`, Tailwind `bg-cyan-950`) belongs to neither theme — tolerable ahead of Midnight, a hard dark flash ahead of Studio; if theme can't be known pre-store, a neutral near-black would offend less; **(e)** landing/examples are Studio-flavored and never re-theme (known architectural limitation).

## Housekeeping notes from the review run

Both browser contexts were restored to Midnight and their original URLs (teacher →
`/compete/reverse-a-string`, student → `/projects`) at the end of the run. One
persistent side effect: loading the "Bouncing Actor" example in the student scratch
editor triggered the auto-save flow, creating a project "bouncing actor (saved work)"
in the student's project list — left in place rather than risk a destructive delete.
Nothing was submitted in the problem editor, and no accounts were signed out.

**Test artifacts left in the local dev DB (`pi3.db`), pending cleanup decision:**
- User `ui_review_teacher` (role manually flipped to `teacher` for this review)
- User `ui_review_student`
- Project "hello world (saved work)" (student)
- Project "bouncing actor (saved work)" (student, side effect noted above)
- Compete problem `reverse-a-string` (teacher)

## Raw agent transcript

Full JSONL transcript of the reviewing subagent (tool calls, screenshots, etc.):
`/tmp/claude-1000/-home-rennorb-Documents-web-ide-react-webide/ea5cc333-31dd-4ba6-baa0-6d10bf964a0d/tasks/ae28b823124a00268.output`

Note: this is a `/tmp` path — may not survive a reboot or tmp cleanup. It's also a
raw transcript (verbose, not meant for casual reading) rather than a formatted
report; this file is the report.
