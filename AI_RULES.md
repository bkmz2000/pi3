# AI_RULES.md — pi3 IDE

Guidance for AI assistants (Claude Code, Copilot, etc.) working on this codebase.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **State:** Zustand v5
- **Styling:** Tailwind CSS v4 (base only); all visual styling uses **inline styles** with design tokens from `useThemeStore`
- **Editor:** CodeMirror 6 with custom Python extensions
- **Python runtime:** Pyodide v0.29.3 (in a Web Worker)
- **Backend:** Express.js v4 + better-sqlite3 (local dev / VPS) or Turso/libsql (Vercel)
- **Testing:** Jest (jsdom) + Puppeteer (E2E)
- **i18n:** i18next (English / Russian)
- **Pixel editor:** OffscreenCanvas (pure pixel manipulation, no Konva for the sheet editor)
- **Tile editor:** Konva/react-konva (the *only* place Konva is used)

## Library Rules

- **Icons:** Always use `<Icon name="…" />` from `src/components/Icons.tsx`. Never import `react-icons` or `lucide-react` directly in UI code.
- **Styling:** Never use Tailwind utility classes for layout or color. All styling is **inline** via `theme.*` tokens obtained from `useThemeStore((s) => s.theme)`.
- **Theme Awareness:** Every UI component must respect the current theme (Studio / Midnight). Use `theme.*` tokens for colors, borders, backgrounds. No hardcoded hex or rgb values.
- **State Management:** All shared state lives in Zustand stores under `src/state/`. No Redux, no Context for global state.
- **Components:** Every new React component lives in its own file. Never add new components to existing files.
- **Python Graphics:** The public API is pinned by `_manifest.py` and a CI snapshot. Adding a new exported name requires updating the manifest and snapshot.
- **API Calls:** Use the pre-configured `api` object from `src/state/api.ts`. It handles auth headers, error classification, and `connect.sid` cookies automatically.
- **Konva:** Use only inside `TileEditor.tsx`. Do not introduce Konva anywhere else.

## Teacher Problem UI (Current State)

The teacher problem authoring experience lives in `src/components/teacher/TeacherProblemForm.tsx`. It is a **fullscreen** form with three selectable layouts:

- **Tabbed:** Horizontal section tabs + right sticky preview
- **Sidebar:** Vertical numbered nav + centered content + right preview
- **Accordion:** Stacked collapsible sections + slide-over preview drawer

All three share identical form state (title, slug, statement, starter code, test cases, generator). The design uses the pi3 SectionCard pattern and teal accent throughout.

## Suggested Alternative Designs

### 1. Progress Wizard (step-by-step)

**Concept:** Break the form into sequential logical steps (Details → Statement → Code → Tests → Review) with a progress bar at the top. Each step shows only the relevant fields, reducing cognitive load.

**Why:** Teachers new to the platform may feel overwhelmed by all sections on one screen. A wizard provides clear guidance and ensures nothing is skipped. The final "Review" step could include a live summary and a one-click publish.

**Key interaction:** "Next/Previous" buttons with smooth transitions; simple vertical bar showing step completion.

### 2. Live Code Sandbox (integrated runner)

**Concept:** The right side of the form is replaced by a fully functional IDE panel where teachers can write, run, and test their starter code and test cases immediately, without leaving the form. The preview shows exactly what students will see and can execute example inputs.

**Why:** The current preview is static Markdown. Making it interactive would let teachers validate test cases (input → output) directly, reducing the need to switch to the student view manually. It would tighten the feedback loop.

**Key interaction:** A Run button inside the form that runs the starter code against teacher-authored inputs, showing output inline.

### 3. Visual Test Builder (drag & drop)

**Concept:** Replace the textual input/expected textareas with a visual builder using cards. Teachers drag pre-built blocks (Input, Expected Output, Hint) onto a canvas, reorder them, and connect them with arrows to define test sequences.

**Why:** The current table-like test editing is functional but plain. A visual tool could make test design more engaging and intuitive, especially for teachers who think visually. This approach also aligns with the drag-and-drop nature of the tile editor elsewhere in the app.

**Key interaction:** Drag from a palette of test templates, arrange on a 2D grid, double-click to edit values.