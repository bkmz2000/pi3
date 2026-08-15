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

## Knowledge Base (READ FIRST — mirrors AGENTS.md)

This repo has a persistent mem0 knowledge base (local embeddings + Chroma) in `.mem0-trial/`.
**Before reading code or answering project questions, query it first** — ~10s, $0:

    cd .mem0-trial && .venv/bin/python kb.py query "<question>" --user pi3-kb --limit 3

- `--tier index` = distilled facts; `--tier archive` = verbatim `kb-docs/*.md` sections.
- **Bug questions: use the bug scope** — `kb.py query "<bug question>" --user pi3-bugs --collection kb_bugs --limit 5` (facts rank correctly there).
- **Trust the KB**: when it answers, do NOT re-read source to re-verify every fact — that re-derivation burns ~500K tokens. Read source only for fixes or when the KB is insufficient.
- Re-seed after significant changes (see AGENTS.md → Knowledge Base).

---
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

The gates run in `make test` (containerized via `Dockerfile.test`):
`lint`, `typecheck`, `test:ci` (frontend, coverage-gated),
`test:server:ci` (server, coverage-gated, institutional profile), and
`test:server:public` (server suite re-run under `DEPLOYMENT_PROFILE=public`
without coverage — same tests, other profile). `docker-e2e` (Puppeteer) is
run manually; it is not part of the automated gate.

**Profile matrix.** Two files pin `process.env.DEPLOYMENT_PROFILE = 'institutional'`
at the top because they exercise institutional-flavor behavior (teacher
directory, author-attached snapshots): `server/tests/api.test.ts`,
`server/tests/snapshots.test.ts`. Cross-profile coverage lives in
`server/tests/profileMatrix.test.ts` (both profiles verified inside one
suite). All other suites are profile-neutral and pass under either value.

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
  `test-utils.js`. `test:smoke`'s entrypoint is `tests/puppeteer/ide-smoke-test.js`;
  not wired into the automated `make test` gate — run manually.

**Testing the worker without Pyodide.** `src/runner/WorkerInterface.ts` defines
typed `WorkerCommand`/`WorkerEvent` unions. Test `RunnerProvider` /
`useRunnerStore` by posting synthetic `WorkerEvent`s to the message handler — no
real worker or WASM load required. This is the intended pattern for runner-layer
unit tests.

The phased test backlog (foundation regression net → state/runner units → E2E
for big features) is in the strategy plan
`~/.claude/plans/have-a-look-bright-honey.md`.

## Doctrine

Safety & Privacy doctrine — split into Core (universal), Profile:institutional,
Profile:public — lives in `docs/doctrine.md`. Deployment profile is selected
via `DEPLOYMENT_PROFILE` env var (`institutional` | `public`, default:
institutional). Profile resolver: `server/profile.ts`. Any feature that
touches identity, publishing, comments, or user directory must be checked
against this doctrine before landing.

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
| `/` | `AppInner` (institutional) / `WelcomePage` (public) | Landing or main IDE, profile-gated |
| `/ide` | `AppInner` | Main IDE (no project) |
| `/ide/:projectId` | `AppInner` | IDE loading a specific project |
| `/projects` | `ProjectsPage` | User project list |
| `/teacher` | `TeacherDashboard` | Teacher dashboard — live activity roster |
| `/teacher/projects/:projectId` | `TeacherProjectView` | Teacher view of one student's project |
| `/teacher/problems` | `TeacherProblemList` | Compete-mode problem list (teacher) |
| `/teacher/problems/new` | `TeacherProblemForm` | New compete-mode problem |
| `/teacher/problems/:slug/edit` | `TeacherProblemForm` | Edit compete-mode problem |
| `/compete/:slug` | `CompetePage` | Student-facing compete-mode problem |

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
- `src/SheetEditor.tsx` — 512×512 pixel sprite sheet editor, Sweetie 16 palette, animation frames
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
Service worker at `public/sw.js` (cache name `webide-v6`). Caches Pyodide CDN assets and app shell on install.

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

---

## Linter (Python-based)

Pure-Python linting runs inside Pyodide when the user clicks **Run** (not while typing).

### Checks Performed

| Code | Severity | Description |
|------|----------|-------------|
| E999 | error | Syntax error (missing colons, unclosed brackets, unterminated strings, etc.) |
| E101 | error | Indentation contains tabs |
| E111 | error | Indentation not multiple of 4 |
| E225 | error | Unsupported operand types (e.g. `3 + "2"`) |
| E225Call | error | Method call argument type mismatch (e.g. `list.append("str")` when list is `list[int]`) |
| E303 | error | Too many blank lines (>4) |
| E501 | error | Line too long (>100 chars) |
| F401 | error | Imported but unused |
| F821 | error | Undefined name |
| W001 | warning | Variable assigned but never used |
| W002 | warning | Non-descriptive variable name (`data`, `value`, `temp`, `result`, `thing`, `stuff`) |
| W003 | warning | Gibberish name (5+ chars, vowel ratio < 0.2) |
| W004 | warning | Similar name to existing variable (Levenshtein distance 1, >=3 chars) |
| W005 | warning | Variable type reassignment (e.g. `int` then `str`) |

Errors (E/F codes) **block execution**; warnings (W codes) are shown but do not block. The linter also has a W_MethodNotCalled rule (e.g. `apple.draw` without `()`) via `ACTOR_METHODS` in `_manifest.py`.

### Type Checking
Uses Python's `ast`: binary op mismatches (`3 + "2"`), `Literal` value validation, method-call argument types (`arr.append("4")`). Star-import aware: `from graphics import *` is recognized; known symbols are not flagged.

### Translation
Diagnostics carry `{code, messageKey, messageArgs, row, column, endRow, endColumn, severity}`. Message keys (`linter.E999`, `linter.E225`, `linter.W001`, ...) are rendered via i18next (en/ru). See `src/assets/python/linter.py`.

---

## Editor Features

- **Indentation guides**: `indentationGuideField` StateField in `src/editor/theme.ts` colors each 4-space level (1-4 `#e0f2fe`, 5-8 `#bae6fd`, 9-12 `#7dd3fc`, 13-16 `#38bdf8`, 17-20 `#0ea5e9`, 21+ `#0284c7`).
- **Soft wrap**: `EditorView.lineWrapping` — no horizontal scrolling.
- **File management**: auto-save on run; auto-save every 60 s while dirty (`useAutoSave.ts`); Ctrl+S saves all dirty files; delete confirmation via `window.confirm()` (`FileBar.tsx`).
- **Console panel**: resizeable (bottom or right via settings), copy/clear buttons, input prompt support, running indicator.
- **Service worker**: `public/sw.js` caches Pyodide (cache name `webide-v6`; auto-invalidated on version change). DocsPanel is lazy-loaded via `React.lazy()`.

---

## Graphics API (student-facing)

**The canonical reference is `docs/reference/04-graphics-module.md`** (verified against HEAD) plus the changelog in `docs/api-v1.md`. The library lives in `src/assets/python/graphics/`; `__all__` (~110 names) is pinned by `_manifest.py EXPORTED_NAMES` and `tests/unit/api-surface.json`.

Key facts agents must not get wrong:
- **Input is polling-based** — `Mouse.pressed`, `Keyboard.w.down`. There are **no event decorators** (`@g.on_key_press`, `@g.every` never shipped).
- **Velocity is NOT auto-applied** — call `actor.move()` each frame; `forward(d)` steps along `angle` (0° = up).
- **`pos`/`vel` are getter methods** (`actor.pos()`, `actor.vel()`) — computed fresh each call, parens required; set with `set_pos(v)`/`set_vel(v)`. `actor.pos = v` raises a friendly migration error. Anchors are methods too (`actor.center()`, `Window.center()`).
- **`g.rect` is top-left anchored; `Actor.Rect` is center-anchored**.
- `graphics` exports `random_color` and `peek`; stdlib `random` is the way to get random floats. `pi3.debug` exports `between` and `members` (not `range`/`set`).
- `Timer.done()` → `Timer.is_done()`; `Light.radius/flicker/shade` are attributes now.
- `show()` paints a still picture once (counterpart to `run()`).

### Actor API (quick summary)
`Actor` (sealed after construction — declare custom attrs in constructor kwargs or `init()`), `Rect`/`Circle` (center-origin, auto-configure colliders), `Group`, `Collider`. Movement: `move()`, `forward(d)`, `move_to`, `point_towards`, `rotate`, `set_pos/set_vel`. Collision: `collider.set_circle/set_rect`, `collides_with`, `collides_any`. Lifecycle hooks: `init()`, `update()`, `draw()`, `die()`, `is_alive()`.

### pi3.testing (teacher generator API)
`from pi3.testing import *` — deterministic tests seeded by problem slug. Recipes: `Literal`, `Compute(fn, args)`, `Integer`, `Float`, `Choice`, `String`, `Permutation`, `Sample`, `UniqueSample`. Tiers `Example`/`Easy`/`Medium`/`Hard`; combine with `+` and `*`; `.with_solution(fn)`. API frozen by `tests/unit/testing-api-surface.json`.

### pi3.debug (algorithm visualization)
`array`, `grid`, `text`, `stack`, `queue`, `members`, `show()` + selectors `between`, `singles`, `cell`, `label`, `named`. (Named `between`/`members` rather than `range`/`set` to avoid shadowing builtins.)

---

## Architecture: Runner (internals)

### Event Flow
`RunnerProvider.tsx` wires window mouse/keyboard listeners → `postMessage({cmd:"event"})` → `worker.ts` calls `graphics._inject_event(kind, data)` → sets polling flags on `_state`.

### Lint Flow
Run click → `handleRunToggle()` → `lint(code, filename)` → worker → `pyodide.runPython(lint)` → diagnostics → console. Errors abort the run; warnings only print a count.

### Run Flow
Save-if-dirty → `clear()` console → lint (abort on errors) → `run(files, assets, entry)` → assets as ImageBitmaps (main thread) → worker writes files to Pyodide FS → `pyodide.runPythonAsync()` → stdout/stderr streamed back (rAF-batched).

### Interrupt Mechanism (two-tier)
1. `SharedArrayBuffer(1)` byte=2 fast signal (needs COOP/COEP headers — set in dev `vite.config.ts` and prod `server/index.ts`).
2. `postMessage({cmd:"interrupt"})` → `graphics.stop()` + `graphics._clear()` → `interrupt_ack`.

### Loop Generation Invalidation
`_loop_generation` **always increments** (+3 per run, never resets). Stale tick callbacks compare and skip, preventing old ticks firing in new runs. `_reset_run_state()` must NOT bump it (A2 invariant).

### Key State Clearing (before each run)
`Actor._registry` + `_id_counter` reset; `_draw_commands` cleared; `_loop_generation` bumped; canvas size applied AFTER setup so `g.size()` takes effect. Stopping no longer clears the console.

### Asset Loading
SVG sprites can't be decoded by `createImageBitmap` in the worker → ImageBitmaps are created in the **main thread** (`new Image()` + canvas) and transferred. ImageBitmaps never cross into Python — only metadata (name, w, h) + RGBA buffers.

---

## Sprite Editor

`SheetEditor.tsx` is the pixel sprite editor (replaced the old Konva vector editor). Tools: pencil, eraser, fill, line, rect, ellipse, region, select, tile (stamp), wand. Sweetie 16 palette (must match `COLOR_NAMES`), brush sizes 1/2/4/8, undo/redo (`makeUndoStack`, Ctrl+Z / Ctrl+Y), grid sizes 1..128. Sheet is 512×512, sprites are regions, animation strips are horizontal rows.

---

## Instructor Sharing System

Privacy-first code sharing for instructor oversight. No accounts required for basic flow; data stored in SQLite.
- Student clicks "Share with teacher" → `POST /api/projects/:id/share`.
- Instructor dashboard at `/teacher` (or `/teacher/projects/:projectId`).
- Comments are **anchored to content, not line numbers** — store an `anchor` string; on display, find the first line containing it. If not found → "orphaned" (instructor can reattach).
- Security: OAuth school accounts or password "outsider" accounts; project access only for owner + explicitly shared teachers; teacher dashboard requires teacher role.

---

## Common Pitfalls (students' code)

- Override `draw()` / `update()` on Actor subclasses — called automatically each frame.
- Collision needs `collider.set_circle(r)` or `.set_rect(w,h)` first; `Rect`/`Circle` auto-configure.
- `Rect`/`Circle`: `(x, y)` is the **center**, not top-left.
- Angle 0 = **up** (`actor.forward(d)`); 90° = right; clockwise on screen.
- Velocity is NOT auto-applied — call `actor.move()` each frame.
- Actor kwargs: known names go through property setters; unknown kwargs become plain attrs (typo risk) — but post-construction new attrs raise a friendly sealed-attr error; declare in `init()`.
- Sheet animations: `actor.image = assets.sheet.player` → animate via `actor.walk.tick()`, not `actor.image.walk.tick()`.
- `fill(None)` == `no_fill()`.
- ZIP export loses non-file data (tilemaps, animations, sounds, sheet).

---

## Agent Instructions (working on this codebase)

1. **ALWAYS** run `npm run lint` after making changes
2. **ALWAYS** run `npm test` for unit tests after changes
3. **ALWAYS** run `npm run test:puppeteer` for E2E tests
4. **NEVER** commit without verifying tests pass
5. **UPDATE** the docs (CLAUDE.md, docs/reference/04-graphics-module.md, api-v1.md) with significant API/architectural changes
6. **RESPECT** React 19 compiler constraints
7. **MAINTAIN** backward compatibility for student projects
8. **QUERY THE KB FIRST** (see Knowledge Base section) — do not re-derive facts from source
9. **WRITE BACK EVERY IMPORTANT FINDING** — if you make a design decision, discover a bug or quirk, learn something non-obvious, or fix anything a future agent would need to know, persist it: (a) add/update the relevant section in `CLAUDE.md` or `docs/` for architectural/API facts, and (b) seed the knowledge base so the next session gets it for free:

       cd .mem0-trial && .venv/bin/python kb.py index kb-docs/*.md --user pi3-kb --batch 2

   Prefer `kb.py archive` (free, raw sections) for bulk material and `kb.py index` (dsv4-flash extraction) for distilled facts. Do not let a finding die in this conversation — the KB is the project's long-term memory.

