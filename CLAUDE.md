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

## Local development setup

After cloning, run once:

```bash
make install-hooks
```

This installs a pre-push hook that runs `make test` (containerized lint,
typecheck, frontend tests, server tests) before allowing the push. Use
`git push --no-verify` only if you know why you're bypassing the gate.

**Deploying to the VPS:**

```bash
# Set your VPS host (once, gitignored):
echo "VPS=user@host" > Makefile.local

make deploy    # runs tests → builds image → ships to VPS
make rollback  # reverts to the previously-deployed image
```

GitHub Actions (`ci.yml`, `deploy.yml`) have been removed. The pre-push
hook is the sole test gate. The VPS deploy is manual via `make deploy`.

## Testing & CI Gates

The four gates run in `make test` (containerized via `Dockerfile.test`):
`lint`, `typecheck`, `test:ci` (frontend, coverage-gated), and
`test:server:ci` (server, coverage-gated). `docker-e2e` (Puppeteer) is
run manually; it is not part of the automated gate.

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

## Safety & Privacy Design Principles

These are durable doctrine, not per-PR notes. Every new feature must be
checked against them before implementation. If a proposed feature conflicts
with any principle below, flag it in the plan — do not build it silently.

**Shorthand.** Each principle is labeled `SPP-N` (Safety & Privacy
Principle N) — use that exact shorthand in commit messages, comments,
and docs. **Do not use `P#N`**: it collides with the product name "pi3"
in speech ("P three" vs "pi three") and in a grep of the codebase.

- **SPP-1: No persistent roles.** No standing "teacher" (or equivalent)
   badge grants one account ongoing visibility into another's activity.
   Any live/collaborative session is ephemeral (short expiry, ~2 hours)
   and symmetric — anyone can start one. The current persistent
   group/teacher-role system predates this decision and is scheduled
   for migration/removal.

- **SPP-2: No PII collected from students, ever.** Auto-generated login,
   only the password is user-editable. No name, email, or other
   identifier requested anywhere in the student path.

- **SPP-3: Tripwire — pi3 never facilitates first contact between
   strangers.** Every relationship that uses pi3 (a class, a study
   pair) must pre-exist it. Any proposed feature involving persistent
   handles, public profiles, follow/DM mechanics, or open leaderboards
   with cross-user interaction must be explicitly evaluated against
   this principle before being built.

- **SPP-4: In-session communication is emoji-only**, from a fixed small
   set, never free text — structural prevention of disclosure, not a
   filter.

- **SPP-5: Publishing anything (project, README, problem set) is a
   snapshot.** Private originals stay account-linked and editable; a
   share/publish action stamps an immutable, author-unlinked copy. New
   edits require a new snapshot.

- **SPP-6: Content scanning scope is the full raw text of a submission**
   — code, comments, docstrings, string literals, identifiers, titles,
   README — not just a labeled description field. No exceptions carved
   out for "it's just code."

- **SPP-7: Author-project linkage is internal-only, never publicly
   exposed.** A private mapping (account → shares) exists solely for
   (a) letting an author manage/revoke their own shares, (b) catching
   repeat abuse. It must never be reachable by any other user or
   public endpoint.

- **SPP-8: Moderation is layered, not airtight**, and documented as
   such: automated pattern scan for the accidental/lazy cases, a
   visible report mechanism, and a defined fast-takedown target —
   optimize for time-to-removal, not an unreachable zero-incidence
   guarantee.

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Zustand, Tailwind CSS (base only), CodeMirror 6
- **Backend**: Express, better-sqlite3, TypeScript (run via `tsx`)
- **Python Runtime**: Pyodide 0.29.3 (WASM, runs in a Web Worker; version is the installed `pyodide` npm package — `copy-pyodide.mjs` stamps it into `public/sw.js` at build time)
- **Canvas**: Konva.js / react-konva; OffscreenCanvas rendered inside the worker

### Dev vs Production
In dev, Vite proxies `/api` to `:3001`. The `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers required for `SharedArrayBuffer` (Pyodide interrupt) are set in **both dev (`vite.config.ts` `server.headers`) and production (`server/index.ts` middleware before `express.static`)**. Pyodide loads from a local `/pyodide/` bundle first, then falls back to `cdn.jsdelivr.net`.

### Routes (src/App.tsx)
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `AppInner` | Main IDE (no project) |
| `/ide/:projectId` | `AppInner` | IDE loading a specific project |
| `/projects` | `ProjectsPage` | User project list |
| `/teacher` | `TeacherDashboard` | Teacher dashboard |
| `/teacher/projects/:projectId` | `TeacherProjectView` | Teacher view of a student project |
| `/teacher/problems` | `TeacherProblemList` | Compete-mode problem management |
| `/teacher/problems/new` | `TeacherProblemForm` | Create a compete-mode problem |
| `/teacher/problems/:slug/edit` | `TeacherProblemForm` | Edit a compete-mode problem |
| `/compete/:slug` | `CompetePage` | Student-facing compete-mode problem view |
| `/welcome` | `WelcomePage` | Teacher-facing welcome / landing page |

### State Management (src/state/)
- **`useTheme`** — Theme (Studio / Midnight / Daylight), font size. All UI uses `theme.xxx` inline style tokens. ~80 tokens in `src/state/useTheme.ts`.
- **`useUser`** — Auth state (`loading` / `logged_out` / `logged_in`). Flow: localStorage token → `checkSession()` on mount → Bearer token on API calls.
- **`useEditor`** (`IdeState.ts`) — Current project content (files, assets, currentFile), dirty tracking, file CRUD, save/fork/import/export. Built-in `Examples` map keyed by name.
- **`useIde`** (`IdeState.ts`) — UI state: active panel, project list.
- **`useRunnerStore`** (`RunnerProvider.tsx`) — Pyodide worker state: `ready`, `running`, `output`, `lintErrors`, canvas dimensions, `workerEpoch` (increments on hard-kill to force canvas remount).

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
- Session store: `SqliteSessionStore` (`server/db/sessionStore.ts`) writes to `sessions.db` in the same directory as `pi3.db` (derived from `DB_PATH`). Tests use the default in-memory MemoryStore (gated by `NODE_ENV !== 'test'`).
- Test DB: in-memory SQLite created in `server/tests/setup.ts`

### PWA
Service worker at `public/sw.js` (cache name `webide-v4`). Caches Pyodide CDN assets and app shell on install.

### OAuth & Authentication

The active provider is selected by `AUTH_PROVIDER=loginus|keycloak` (default: `loginus`). Provider adapters live in `server/auth-providers/`.

**Loginus env vars** (AUTH_PROVIDER=loginus, the current default):
- `LOGINUS_DOMAIN` — OAuth provider URL (default: `https://loginus.ru`)
- `LOGINUS_CLIENT_ID` — OAuth client ID
- `LOGINUS_CLIENT_SECRET` — OAuth client secret
- `LOGINUS_TEACHER_ROLE` — Role name for teachers (default: `teacher`)

**Keycloak env vars** (AUTH_PROVIDER=keycloak, pending migration):
- `KEYCLOAK_URL` — Keycloak server base URL, e.g. `https://auth.example.com`
- `KEYCLOAK_REALM` — Realm name, e.g. `pi3`
- `KEYCLOAK_CLIENT_ID` — OAuth client ID
- `KEYCLOAK_CLIENT_SECRET` — OAuth client secret
- `KEYCLOAK_TEACHER_ROLE` — Role name for teachers (default: `teacher`)

Keycloak uses standard OIDC endpoints under `{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/`. Roles are read from `realm_access.roles[]` or a top-level `roles[]` userinfo claim (configure a "User Realm Role" userinfo mapper in Keycloak).

**Auth Routes:**
- `GET /api/auth/login` — Initiates OAuth flow with state/nonce generation
- `GET /api/auth/callback` — OAuth callback; validates state, exchanges code for tokens, creates session
- `POST /api/auth/logout` — Revokes session; for Keycloak returns `endSessionUrl` in JSON so the client can redirect to RP-initiated logout

**Key Implementation Details:**
- OAuth state and return URL stored in httpOnly cookies with `path: '/'` and `sameSite: 'lax'` (critical for callback validation)
- State is cryptographically signed with `SESSION_SECRET` using HMAC-SHA256
- Session created via `express-session` with settings in `server/index.ts`
- `authMiddleware` in `server/middleware/auth.ts` validates Bearer tokens and session cookies
- Frontend auth flow: `useUser` → `checkSession()` on mount → `getMe()` API call to verify session
- Password auth can be enabled via `ALLOW_PASSWORD_AUTH=true` environment variable
- See `LOGINUS_AUTH_INTEGRATION_UNIVERSAL.md` for the original Loginus integration guide

### API Surface Snapshots

**Graphics library (`pi3` student API):** `tests/unit/api-surface.json` is a checked-in snapshot of the graphics library's public API surface (derived from `_manifest.py EXPORTED_NAMES`). The test at `tests/unit/apiSurfaceSnapshot.test.ts` asserts it matches the live manifest. **Any future add/remove of a public name turns CI red** until the snapshot and docs are updated.

Update procedure:
1. Edit `graphics/__init__.py` `__all__` and `_manifest.py` `EXPORTED_NAMES`
2. Update `tests/unit/api-surface.json` to match
3. Update `docs/api-v1.md` changelog
4. Run `npm test` to verify the snapshot test passes

**`pi3.testing` (teacher generator API):** `tests/unit/testing-api-surface.json` is a checked-in snapshot of `pi3.testing.__all__`. The test at `tests/unit/testingApiSurface.test.ts` asserts it matches the live module. **Any future add/remove/rename turns CI red** — this matters because a silent rename of `UniqueSample` or `Integer` would break every existing problem generator.

Update procedure:
1. Edit `__all__` in `src/assets/python/pi3/testing.py`
2. Update `tests/unit/testing-api-surface.json` to match
3. Run `npm test` to verify

`pi3.__init__.py` exposes both `debug` and `testing` submodules. Use `from pi3.testing import *` in generator code.

**i18n discipline for TeacherProblemForm:** Any new user-facing string in `TeacherProblemForm.tsx` must go through `t()`. Add both `en.json` and `ru.json` entries under the `teacher.generator.*` namespace (or other `teacher.*` keys as appropriate). The parity check in `friendlyErrorI18n.test.ts` enforces that en/ru have matching keys across `friendlyError`; teacher keys are manually maintained.

### Error System (Phases D-E, 2026-06-10)

All library-raised teaching errors now use structured i18n keys through `FriendlyError` (`src/assets/python/graphics/_errors.py`). The frontend renders all text through i18next for bilingual support.

- **error_hook.py** — Classifies Python exceptions into structured `{messageKey, messageArgs, titleKey}` dicts. No longer produces English prose.
- **syntax_hints.py** — Shared pattern engine for syntax error classification (smart quotes, empty imports, missing dots, homoglyphs, etc.). Called by both `linter.py` and `error_hook.py`.
- **ALL_MESSAGE_KEYS** in `_errors.py` — Registry of every i18n key the Python side can emit. Enforced by `tests/unit/friendlyErrorI18n.test.ts`.
- **Key files**: `_errors.py`, `error_hook.py`, `syntax_hints.py`, `linter.py`, `en.json`, `ru.json`, `WorkerInterface.ts`, `ConsolePanel.tsx`, `useRunButton.ts`
- **Tests**: `tests/unit/friendlyErrorI18n.test.ts` (key existence + parity), `tests/unit/linterI18n.test.ts` (linter keys), `tests/unit/apiSurfaceSnapshot.test.ts` (API freeze)

**Recent Fix (2026-05-20):**
Fixed critical OAuth cookie path validation issue. OAuth state/return cookies were scoped to `/api/auth/callback` instead of `/`, preventing proper callback verification. Changed to `path: '/'` per OAuth 2.0 specification. This fixed:
- Login redirecting to Loginus dashboard instead of app callback
- Logout validation errors with OAuth provider
- Infinite redirect loops during authentication
