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

# Typecheck (no emit; app + server projects)
npm run typecheck

# Lint
npm run lint

# Unit tests (jsdom, src/components)
npm test
npm run test:watch

# Frontend tests with coverage gate (what CI runs)
npm run test:ci

# Server/API tests (Node, server/tests/)
npm run test:server

# Server tests with coverage gate (what CI runs)
npm run test:server:ci

# Run a single unit test file
npx jest tests/unit/SpriteEditor.polygon.test.tsx

# E2E (Puppeteer, requires running app)
npm run test:smoke
npm run test:puppeteer
```

## Testing & CI Gates

CI (`.github/workflows/ci.yml`) runs four required jobs before `docker-e2e`:
`lint`, `typecheck`, `test` (frontend `test:ci`, coverage-gated), and
`server-tests` (`test:server:ci`, coverage-gated). `docker-e2e` runs the
Puppeteer production suite + sprite-editor suite.

**The coverage ratchet.** Thresholds in `jest.config.cjs` and
`server/tests/jest.server.config.js` are seeded at *real measured actuals*, not
aspirational targets. The rule: **floors only ever move up.** When you add a
tier of tests, bump the relevant threshold slot **in the same PR**, so the diff
shows the gain and CI prevents later regression. A feature PR that drops the
test ratio of the area it touches turns CI red — by design, this is what keeps
tests in sync with feature velocity. Frontend uses per-path slots
(`./src/state/`, `./src/runner/`) checked independently of `global`.

**Where tests live.**
- Frontend unit (jsdom): `tests/unit/**/*.test.{ts,tsx}`. Mocks in
  `tests/unit/__mocks__/` (konva, react-konva, useUser).
- Server/API (node, in-memory SQLite): `server/tests/**/*.test.ts`; DB harness
  in `server/tests/setup.ts`.
- E2E (Puppeteer, needs running app): `tests/puppeteer/`. Shared helpers in
  `test-utils.js`. Note: `test:smoke`'s entrypoint `ide-smoke-test.js` does not
  yet exist — writing it is a planned Tier 3 item, not wired into CI until then.

**Testing the worker without Pyodide.** `src/runner/WorkerInterface.ts` defines
typed `WorkerCommand`/`WorkerEvent` unions. Test `RunnerProvider` /
`useRunnerStore` by posting synthetic `WorkerEvent`s to the message handler — no
real worker or WASM load required. This is the intended pattern for runner-layer
unit tests.

The phased test backlog (foundation regression net → state/runner units → E2E
for big features) is in the strategy plan
`~/.claude/plans/have-a-look-bright-honey.md`.

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
- **Assets** — built-in pack + user assets with asset editor button
- **Settings** — theme, font size, console auto-hide, show hitboxes
- **Docs** (`src/components/DocsPanel.tsx`) — bilingual API reference

**Asset editor split**: `src/AssetEditor.tsx` is the unified dispatcher modal. It shows a type picker for `mode='new'` and delegates to the appropriate leaf editor:
- `src/PixelEditor.tsx` — 16×16 / 32×32 pixel sprite editor + animation frames
- `src/TileEditor.tsx` — layer-based tilemap editor (cells, areas, undo/redo)

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

### OAuth & Authentication

**OAuth Provider:** Loginus (lk.systematika.org)

**Environment Variables** (server-side):
- `LOGINUS_DOMAIN` — OAuth provider URL (default: `https://loginus.ru`)
- `LOGINUS_CLIENT_ID` — OAuth client ID
- `LOGINUS_CLIENT_SECRET` — OAuth client secret
- `LOGINUS_TEACHER_ROLE` — Role name for teachers (default: `teacher`)

**Auth Routes:**
- `GET /api/auth/login` — Initiates OAuth flow with state/nonce generation
- `GET /api/auth/callback` — OAuth callback; validates state, exchanges code for tokens, creates session
- `POST /api/auth/logout` — Revokes session and redirects to OAuth logout (if id_token present)

**Key Implementation Details:**
- OAuth state and return URL stored in httpOnly cookies with `path: '/'` and `sameSite: 'lax'` (critical for callback validation)
- State is cryptographically signed with `SESSION_SECRET` using HMAC-SHA256
- Session created via `express-session` with settings in `server/index.ts` 
- `authMiddleware` in `server/middleware/auth.ts` validates Bearer tokens and session cookies
- Frontend auth flow: `useUser` → `checkSession()` on mount → `getMe()` API call to verify session
- Password auth can be enabled via `ALLOW_PASSWORD_AUTH=true` environment variable
- See `LOGINUS_AUTH_INTEGRATION_UNIVERSAL.md` for complete OAuth integration guide

**Recent Fix (2026-05-20):**
Fixed critical OAuth cookie path validation issue. OAuth state/return cookies were scoped to `/api/auth/callback` instead of `/`, preventing proper callback verification. Changed to `path: '/'` per OAuth 2.0 specification. This fixed:
- Login redirecting to Loginus dashboard instead of app callback
- Logout validation errors with OAuth provider
- Infinite redirect loops during authentication
