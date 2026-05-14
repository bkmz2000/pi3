# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev (frontend + backend together)
npm run dev:all

# Frontend only (Vite on :5173, proxies /api → :3001)
npm run dev

# Backend only (Express on :3001)
npm run server

# Build
npm run build

# Lint
npm run lint

# Unit tests (jsdom, src/components)
npm test
npm run test:watch

# Server/API tests (Node, server/tests/)
npm run test:server

# Run a single unit test file
npx jest tests/unit/SpriteEditor.polygon.test.tsx

# E2E (Puppeteer, requires running app)
npm run test:smoke
npm run test:puppeteer
```

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Zustand, Tailwind CSS (base only), CodeMirror 6
- **Backend**: Express, better-sqlite3, TypeScript (run via `tsx`)
- **Python Runtime**: Pyodide 0.26.4 (WASM, runs in a Web Worker)
- **Canvas**: Konva.js / react-konva; OffscreenCanvas rendered inside the worker

### Dev vs Production
In dev, Vite proxies `/api` to `:3001`. The `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers required for `SharedArrayBuffer` (Pyodide interrupt) are **only set in `vite preview`**, not in dev mode. Pyodide loads from a local `/pyodide/` bundle first, then falls back to `cdn.jsdelivr.net`.

### Routes (src/App.tsx)
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `AppInner` | Main IDE (no project) |
| `/ide/:projectId` | `AppInner` | IDE loading a specific project |
| `/projects` | `ProjectsPage` | User project list |
| `/teacher` | `TeacherDashboard` | Teacher dashboard (placeholder) |

### State Management (src/state/)
- **`useTheme`** — Theme (Studio / Midnight / Daylight), font size. All UI uses `theme.xxx` inline style tokens. ~80 tokens in `src/state/useTheme.ts`.
- **`useUser`** — Auth state (`loading` / `logged_out` / `logged_in`). Flow: localStorage token → `checkSession()` on mount → Bearer token on API calls.
- **`useEditor`** (`IdeState.ts`) — Current project content (files, assets, currentFile), dirty tracking, file CRUD, save/fork/import/export. Built-in `Examples` map keyed by name.
- **`useIde`** (`IdeState.ts`) — UI state: active panel, project list.
- **`useRunnerStore`** (`RunnerProvider.tsx`) — Pyodide worker state: `ready`, `running`, `output`, `lintErrors`, canvas dimensions.

### Python Runner (src/runner/)
`worker.ts` runs in a Web Worker. Communication uses strongly-typed `WorkerCommand` / `WorkerEvent` unions in `WorkerInterface.ts`. Key commands: `init` (write Python modules to Pyodide FS), `run` (execute entry file with assets as `ImageBitmap`s), `interrupt`, `lint`, `event` (mouse/keyboard forwarded to Python).

The graphics library at `src/assets/python/graphics/` is a custom Python module written to Pyodide's virtual FS at `init` time. The sprite editor color palette must stay in sync with `COLOR_NAMES` in that module.

### Panel System (src/SideMenu.tsx)
Rail-based layout. Most panel content is inline in `SideMenu.tsx`; `DocsPanel` is a separate lazy component:
- **Projects** — built-in examples + user projects list
- **Assets** — built-in pack + user assets with sprite editor button
- **Settings** — theme, font size, console auto-hide, show hitboxes
- **Docs** (`src/components/DocsPanel.tsx`) — bilingual API reference

**Docs maintenance**: `src/docs/graphicsDocs.ts` is the single source of truth for the API reference panel. Update it whenever `src/assets/python/graphics/` changes (add/remove/rename functions, change parameter names or defaults).

### Key Patterns
- **Inline styles everywhere** — no CSS classes for layout; all layout/color references `theme.xxx` tokens
- **Zustand selectors at call site** — no centralized selector file
- **Icons** — `src/components/Icons.tsx`, custom SVG `Icon` component with `IconName` union type; do not import `react-icons` directly

### Server & Database
- Express at `server/index.ts`, port 3001 (or `$PORT`)
- SQLite via better-sqlite3 at `server/db/index.ts`; migrations in `server/db/migrations/`
- Schema: `users` (id, api_token, name, role), `projects` (files/assets stored as JSON strings), `project_shares` (owner/editor/viewer roles)
- Auth: `Bearer <api_token>` header, checked in `server/middleware/`
- Test DB: in-memory SQLite created in `server/tests/setup.ts`

### PWA
Service worker at `public/sw.js` (cache name `webide-v2`). Caches Pyodide CDN assets and app shell on install.
