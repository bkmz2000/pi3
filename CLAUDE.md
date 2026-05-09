# pi3 IDE — Codebase Guide

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Zustand, Tailwind CSS (base only), CodeMirror 6
- **Backend**: Express, better-sqlite3, TypeScript
- **Python Runtime**: Pyodide (in-browser WASM Python)
- **Canvas**: Konva.js, react-konva

## Architecture

### Routes (src/App.tsx)
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `AppInner` | Main IDE |
| `/ide/:projectId` | `AppInner` | IDE loading a specific project |
| `/projects` | `ProjectsPage` | User project list |
| `/teacher` | `TeacherDashboard` | Teacher dashboard (placeholder) |

### State Management (src/state/)
- **`useTheme`** — Theme selection (Studio / Midnight / Daylight), font size. All UI components read from `useThemeStore`.
- **`useUser`** — Auth state (loading / logged_out / logged_in), login/logout, session check.
- **`useEditor`** — Current project content (files, assets, current file), file CRUD, dirty tracking.
- **`useIde`** — UI state: active panel, project list, showHitboxes, showConsoleOnRun, save/fork/import/export.

### Theme System
App uses inline styles referencing `theme.xxx` tokens from `useThemeStore`. Three themes:
- **Studio** — warm beige/amber, teal rail
- **Midnight** — dark teal/cyan (default)
- **Daylight** — warm light, teal accents

Theme tokens: `src/state/useTheme.ts` — `Theme` interface with ~80 tokens for backgrounds, text, borders, syntax highlighting, spacing, typography.

### CodeMirror Themes
- `@uiw/codemirror-theme-github` — `githubDark` for Midnight mode, `githubLight` for Studio/Daylight
- Indentation guides from `src/editor/theme.ts` (`indentationGuideField` + `indentationGuides` CSS classes)

### Auth UI Components (src/components/user/)
- `AuthSection` — displays LoginButton or UserMenu based on auth state
- `LoginButton` — "Sign In" button, opens LoginDialog
- `UserMenu` — avatar + initials, dropdown with "My Projects" and "Sign Out"
- `LoginDialog` — modal with name input, creates user via API

### Projects Page (src/components/projects/)
- `ProjectsPage` — full-page project list with "Back to Editor" button
- `ProjectCard` — card with project name, role badge, Open/Share/Delete buttons
- `NewProjectDialog` — create project modal
- `ShareDialog` — share project dialog (email + role selection)

### Panel System (src/SideMenu.tsx)
Rail-based panel UI. Panels are inline overlays (not separate components):
- **Projects** — examples + user projects list
- **Assets** — built-in + user assets with sprite editor button
- **Settings** — theme selector, font size, console auto-hide, show hitboxes

### Python Graphics Library (src/assets/python/graphics/)
Custom `graphics` module with `COLOR_NAMES` dict. Colors used in sprite editor palette match these exactly.

### Icons (src/components/Icons.tsx)
Custom SVG icon set: `Icon` component with `IconName` type. Replaces `react-icons/md`.

## Key Patterns
- **Inline styles everywhere** — no CSS classes for layout, all styles reference `theme.xxx` tokens
- **Zustand stores** — selectors at component level, not centralized
- **Console resizing** — pointer event-based drag handle, clamped 80px–600px
- **Auth flow** — localStorage token → `checkSession()` on mount → `useUser` state

## Server
- Express server at `server/index.ts`
- Database: SQLite via better-sqlite3 at `server/db/index.ts`
- Migrations: `server/db/migrations/001_initial.sql`
- Test setup: `server/tests/setup.ts` (in-memory SQLite)
