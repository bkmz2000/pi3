# pi3 (pi³) — Project Knowledge Base

> Compiled from codebase exploration (codebase-memory MCP graph: 2701 nodes, 7089 edges),
> full user-facing API review, and a live Mem0 persistence demo (2026-08-14).
> Cross-checked against AGENTS.md, CLAUDE.md, README.md, docs/api-v1.md, and the code.

---

## 1. What pi3 is

**pi3** is a **browser-based Python IDE for teaching kids aged 10–12**. Zero installation — students
open a URL and start coding. Supports plain Python, interactive input, and game development with a
custom Actor-based graphics API.

The name is a backronym: **P**hosphorus **I**odine **3** (PI₃ — an unstable, pyrotechnic compound that
reacts dramatically, like running code), also referencing π.

- License: MIT. Package: pi3-ide v1.0.0.
- PWA-installable; service worker caches Pyodide for fast subsequent loads.
- Bilingual UI: English + Russian (i18next).

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7, Tailwind CSS v4, Zustand v5, CodeMirror 6 |
| Python runtime | Pyodide 0.29.3 (WASM) in a Web Worker |
| Canvas | OffscreenCanvas (worker-side render via JS canvasRenderer.ts); Konva/react-konva for editors |
| Sprite/tile editors | SheetEditor (512×512), TileEditor (layer-based), PixelEditor |
| Backend | Express 4, better-sqlite3 (also @libsql/client), express-session |
| Auth | OAuth via **Loginus** (default, AUTH_PROVIDER=loginus) or **Keycloak**; password auth opt-in |
| i18n | i18next, en.json + ru.json |
| Testing | Jest (unit), server Jest suites (in-memory SQLite), Puppeteer E2E |
| Deploy | Docker, docker-compose, Makefile deploy/rollback to VPS; pre-push hook = sole CI gate |

---

## 3. Repository layout (key paths)

```
src/
  main.tsx / App.tsx        # entry + routes (AppInner for /ide, WelcomePage for public profile)
  SideMenu.tsx              # nav rail + panels
  FileBar.tsx               # file tabs
  CanvasWindow.tsx          # floating graphics canvas (draggable, screenshots)
  AssetEditor.tsx / PixelEditor.tsx / TileEditor.tsx / SheetEditor.tsx
  runner/
    RunnerProvider.tsx      # worker singleton, run/lint/stop, asset loading
    worker.ts               # Pyodide worker: init/run/interrupt/lint/event
    WorkerInterface.ts      # typed WorkerCommand/WorkerEvent unions
    canvasRenderer.ts       # JS-side draw-command renderer
  state/                    # Zustand stores + api client (IdeState, useLiveSession, useTheme, useUser...)
  components/               # ConsolePanel, DocsPanel (lazy), teacher/, user/, session/, projects/
  editor/                   # CodeMirror theme, indentation guides, graphicsCompletion, comments
  docs/                     # graphicsDocs.ts (API docs data, 160 entries — closest to source of truth)
  assets/python/            # THE student-facing Python library (see §5)
  assets/examples/          # hello_world, input, snake, sokoban, asteroids, catch, platformer, etc.
server/
  index.ts                  # Express entry (port 3001), COOP/COEP headers for SharedArrayBuffer
  db/                       # SQLite init + migrations (001..008), sessionStore, handle/word-lists
  middleware/               # auth (Bearer + session), projectAuth (owner/editor/viewer), rateLimit*
  routes/                   # auth, projects, shares, comments, users, groups, help-requests,
                            #   live (sessions), compete, moderation, snapshots, sessions
  sessions/                 # tokens.ts, comments.ts (live-session tokens + emoji comments)
  profile.ts                # DEPLOYMENT_PROFILE resolver (institutional | public)
  auth-providers/           # loginus.ts, keycloak.ts, types.ts
tests/
  unit/                     # Jest; api-surface snapshots; friendlyErrorI18n; linterI18n
  puppeteer/                # production-test-suite.js, ide-smoke-test.js, sprite-editor runner
  server/                   # API tests (profile matrix, snapshots, etc.)
docs/
  api-v1.md                 # v1 changelog (contains drift — see §7)
  doctrine.md               # Safety & Privacy doctrine (Core / Profile:institutional / Profile:public)
  ROADMAP.md, design-language.md, compete-design-deviations.md
  reference/            # 02-state, 04-graphics (canonical), 06-storage, 08-sprite-editor
```

---

## 4. Architecture highlights

### Runner / execution flow
1. User clicks Run (useRunButton.ts): save-if-dirty → lint → run().
2. RunnerProvider.run() loads assets as ImageBitmaps in the **main thread** (SVG sprites can't be
   decoded by createImageBitmap in the worker), then transfers them to the worker.
3. worker.ts writes Python modules + files into Pyodide's virtual FS, runs pyodide.runPythonAsync().
4. Draw commands are flushed to JS via _ide_flush_draw_commands; canvasRenderer.ts paints to an
   OffscreenCanvas. RGBA buffers cross the boundary, never ImageBitmaps into Python.

### Event flow (input)
RunnerProvider wires window mouse/keyboard listeners → postMessage({cmd:"event"}) → worker →
graphics._inject_event(kind, data) → sets polling flags on _state (_mouse_x, _keys_down, ...).
**Input is polling-based**: Keyboard.w.pressed, Mouse.down, etc. There are **no event decorators**.

### Interrupt mechanism (two-tier)
1. SharedArrayBuffer(1) byte = 2 for fast signal (needs COOP/COEP headers — set in dev
   vite.config.ts and prod server/index.ts).
2. postMessage({cmd:"interrupt"}) → graphics.stop() + graphics._clear(); worker ack interrupt_ack.

### Loop generation invalidation
_loop_generation **always increments** (never resets), +3 per run. Stale tick callbacks compare and skip.
Prevents old ticks firing in new runs. _reset_run_state() must NOT bump it (A2 invariant).

### Frame order (per tick)
update() for every living actor (registry) → main() → clear pressed/released flags → draw flush →
_flush_watches(). Mouse.pressed/Keyboard.*.pressed are edge flags cleared at end of frame.

### Key state cleared before each run
Actor registry + id counter reset, draw commands cleared, _loop_generation bumped, canvas size applied
**after** setup so g.size() takes effect. Stopping a graphical script no longer clears the console.

### Live sessions (newest subsystem, hottest node in graph: join has 33 callers)
- Token-based membership: **the signed token IS the session** (no server row); stamped onto 1s presence pings.
- useLiveSession (Zustand): start/join/adopt/leave, peerTabs (read-only live code), activePeer.
- server/routes/live.ts (createLiveRouter): start, join, allowed-emoji, :sid/comments, roster, presence.
- Symmetric peer sessions + asymmetric classroom sessions (groupId ⇒ classroom).
- Peer tabs: open a peer's live buffer as a read-only editor tab; leaving the session closes them.
- Rate limiting + stale-presence pruning (pruneStaleLivePresence).

### Compete mode (teacher-authored problems)
- server/routes/compete.ts (createCompeteRouter): problem CRUD, /problems/:slug/submit,
  /problems/:slug/tests-for-submit, hidden test-case execution.
- Frontend: src/compete/ (CompetePage, CompeteLeft, submitRunner, types), teacher problem
  form/list routes. Teacher generator API: pi3.testing (see §5).

### Error system (Phase D–E, all library errors structured)
- FriendlyError with {messageKey, messageArgs, titleKey} — no English prose from the library.
- error_hook.py classifies runtime exceptions; syntax_hints.py = shared pattern engine
  (smart quotes, empty imports, missing dots, homoglyphs) used by BOTH linter.py and error_hook.py.
- ALL_MESSAGE_KEYS registry in _errors.py; enforced by friendlyErrorI18n.test.ts (key existence
  + en/ru parity). Frontend renders via i18next.
- Migration errors: raise_migration_error, migration_property_raises,
  migration_setter_raises, MigrationProxy, migration_proxy_property — see §7.4.

### PWA
public/sw.js (cache webide-v6), manifest + SVG icons, loading screen with pi³ logo.
Registration fixed 2026-07-28 (registerServiceWorker.ts).

---

## 5. User-facing Python API surface (the core product)

### 5.1 graphics module — __all__ (≈110 names, frozen by snapshot test)

Drawing: size, width, height, circle, rect, ellipse, line, point,
polyline, polygon, spline, text, text_size, text_align, say
Color: fill, no_fill, stroke, no_stroke, stroke_width, background, Colors,
lerp, darker, lighter, saturated, desaturated, random_color
Transform: push, pop, translate, rotate, scale + context managers
translated / rotated / scaled; Stamp (drawing macro replay)
Pixels: Sprite, PixelView, create_sprite, get_pixel, set_pixel, palette_swap,
flood_fill, darken/lighten/saturate/desaturate (sprite mutators)
Vectors: Vector2, Point (alias), Polar, AnchorPoint
Shapes: Line, Polygon, Spline (geometry: segments, bounds(), normal_at(), contains,
texture(), random(), bounce_of support)
Input: Mouse (x/y/pos/pressed/down/released), Keyboard (per-key .pressed/.down/.released,
Keyboard["w"] also works), Window (width/height/anchor methods)
Actors: Actor, Rect, Circle, Group, Collider
Game infra: Camera, Light, TilemapLayer, TileMap, TileRef, TileGroup, Cell,
Bounds, noise, Animation, Timer, State
Sheet/anim: SheetAnimation, SpriteEntry, SheetNamespace, AnimationController
Flow: run(main=None, fps=60), stop(), show() (still-picture paint)
Helpers: random(low, high), randint, pick, clamp, frame_rate, frame_count,
inspect(x), watch(label, value), assets, sheet

### 5.2 Actor API (biggest user-facing class)

- Properties: x, y (float), angle (degrees, 0°=up, clockwise, mod 360), vx, vy,
  visible, collidable, image, scale, flip_x, flip_y, collider.
- **Sealed after construction**: custom attrs must be declared in constructor kwargs or the
  init() hook; post-construction assignment raises a FriendlyError with suggestions.
- Movement: move() (no args — applies vx/vy once, manual), forward(d) (along angle),
  move_to(x,y), point_towards(x,y), rotate(deg), set_pos(v), set_vel(v).
- Spatial: distance_to, bounce, keep_in_bounds, random_position, wrap_x/wrap_y/wrap,
  in_bounds, future_state (one-frame collision lookahead snapshot).
- Lifecycle: init(), update(), draw() hooks; die()/is_alive(); reset() (sprite pixels).
- Collision: actor.collider.set_circle(r) / .set_rect(w,h) / .disable();
  collides_with(other), collides_any(group). Rect/Circle auto-configure colliders.
- Anchors: actor.center(), top(), bottom(), left(), right(), top_left()... return
  AnchorPoint (usable with g.text() / g.say()). **Methods now, not properties.**
- Static: Actor.all_actors(), Actor.random_coords().
- Rect/Circle: (x,y) = **center**; color/stroke_color/stroke_width params.
- Group: add/remove/iter (filters dead)/len/bool. NOTE: len() includes dead actors until next
  iteration.

### 5.3 pi3.testing (teacher generator API)

from pi3.testing import * — deterministic test generation, seeded by problem slug
(seed(slug) hashes slug → RNG).
Recipes: Literal, Compute(fn, args) (pure functions, args must be recipes), Integer(lo,hi),
Float, Choice(pop), String(len, chars), Permutation(pop), Sample(pop,k) (with
replacement), UniqueSample(pop,k) (without).
Tiers: Example, Easy, Medium, Hard (_TestSet, tier ints).
Combine: ex + easy*5 + medium*10, then .with_solution(solution_fn); rendering via print(tests).
API frozen by tests/unit/testing-api-surface.json.

### 5.4 pi3.debug (algorithm visualization for competitive students)

array, grid, text, stack, queue, set, show(), plus selectors range(lo,hi),
singles(*i), cell(r,c), label(name,val), named(v,name); re-exports inspect/watch.
Colors: red/green/blue/yellow/cyan/gray + stroke_* variants. Values pinned via watch() → Watch panel.
**DANGER**: exports range and set, shadowing Python builtins in star imports.

### 5.5 turtle (compat module)

Turtle class, bgcolor, setup, screensize, title, Screen, getscreen, done()
(calls show() internally). Coordinates transformed _to_screen to canvas space.

### 5.6 Linter (pure Python, runs inside Pyodide on Run click)

- Errors block execution; warnings don't: E999 (syntax), E101 (tabs), E111 (indent % 4),
  E225 (operand type mismatch), E225Call (method arg type mismatch), E303 (>4 blank lines),
  E501 (line >100), F401 (unused import), F821 (undefined name).
- Warnings: W001 (unused var), W002 (non-descriptive name), W003 (gibberish name),
  W004 (Levenshtein-similar names), W005 (type reassignment). Plus W_MethodNotCalled
  (e.g. apple.draw without ()) via ACTOR_METHODS.
- Type checks via Python ast: 3 + "2", x: Literal["up"] = "left", list.append("str").
- Star-import handling: from graphics import * recognized; known symbols not flagged.

---

## 6. Testing & quality gates

- **API-surface freeze**: tests/unit/api-surface.json, testing-api-surface.json,
  debug-api-surface.json — any public-name change turns CI red until docs + snapshot updated.
  Procedure: edit __all__ + _manifest.py EXPORTED_NAMES → update snapshot → update
  docs/api-v1.md → npm test.
- **Coverage ratchet**: thresholds seeded at real measured actuals; floors only move up. Per-path
  slots (./src/state/, ./src/runner/) checked independently of global.
- **Profile matrix**: DEPLOYMENT_PROFILE = institutional | public. Suites pinned to institutional:
  api.test.ts, snapshots.test.ts; cross-profile in profileMatrix.test.ts.
- Commands: make test (containerized lint+typecheck+unit+server), npm run test:ci,
  npm run test:server:ci, npm run test:puppeteer, npm run test:smoke. Pre-push hook runs
  make test (use git push --no-verify only knowingly). Docker E2E manual, not gated.
- Worker tests without Pyodide: post synthetic WorkerEvents to the runner message handler.

---

## 7. API review findings (constructive criticism, 2026-08-14)

### 7.1 Documentation vs. code drift (highest priority for a teaching product)

- **AGENTS.md documents APIs that do not exist**: @g.on_key_press("w", ...) and @g.every(5)
  decorators (none in code — input is polling); "velocity applied automatically each frame" (false
  since v1 — call actor.move()); actor.pos = Vector2(...) read-write (raises — use
  set_pos()/pos()); move(distance), change_x_by, change_y_by (removed).
- **docs/api-v1.md says rotate(angle) takes radians**; the renderer
  (canvasRenderer.ts:275 deg→rad) and DocsPanel say degrees (clockwise). api-v1.md is wrong.
- **AGENTS.md says "angle 0 means right"**; code forward() computes (sin, -cos) ⇒ 0° = up.
  DocsPanel and point_towards agree with 0° = up.
- Fix: src/docs/graphicsDocs.ts is the nearest source of truth; regenerate api-v1.md from it and
  sweep AGENTS.md tables to match v1. Add a CI check for documented-but-absent names.

### 7.2 Real bug — debug overlay facing tick disagrees with movement

_draw_actor_info_overlay draws the facing tick as (x + cos(angle)*14, y + sin(angle)*14) —
points right at angle 0. forward() at angle 0 moves **up** (sin, -cos). With "show actor info"
on, the cyan facing line points the wrong way. Fix: use the same (sin, -cos) convention.

### 7.3 Namespace collisions in star imports (silent breakage risk)

- ~~graphics.__all__ exports random and inspect — shadow Python stdlib modules~~ —
  RESOLVED 2026-08-14: random was removed (kids use stdlib import random /
  random.uniform), inspect → peek. Old names raise friendly migration errors.
- ~~pi3.debug.__all__ exports **range and set** — shadows builtins~~ —
  RESOLVED 2026-08-14: debug.range → debug.between, debug.set → debug.members.
  (The internal scrubber slot kinds "range"/"set" in the worker data format are unchanged.)

### 7.4 Property→method migration churn (API regressions for the audience)

pos, vel, all anchors, Shape.bounds, Timer.done() converted from properties to methods,
with MigrationProxy objects that **raise on any non-call use** (including harmless
print(actor.pos) or actor.pos.x). Consequences:
- actor.x = 5 works but sibling actor.pos = Vector2(5,6) raises — asymmetric ergonomics.
- Every pre-v1 tutorial/project breaks; students pay the churn cost.
- 150+ lines of shim machinery in _errors.py to paper over breaking renames.
- ~~Suggest: keep pos/vel/anchors as real read-write properties~~ — USER DECISION 2026-08-14:
  **pos/vel stay getter methods** (parens = computed, not stored). Reimplemented as real
  `def pos(self)`/`def vel(self)` (fresh Vector2, mutation-isolated); they now appear in
  ACTOR_METHODS so the linter's W_MethodNotCalled flags `actor.pos` missing parens; the API
  snapshot classifies them as methods; `actor.pos = v` raises a friendly migration error via
  __setattr__; `Actor(pos=...)` kwargs route through set_pos/set_vel. Anchors (center/top/...),
  Shape.bounds, Timer.done still use the proxy shim — open for a later decision.

### 7.5 rect (function) vs Rect (actor) — same name, opposite anchoring

- g.rect(x,y,w,h): **(x,y) = top-left** (renderer ctx.rect, DocsPanel agrees).
- Actor.Rect(x,y,width,height): **(x,y) = center**.
- Classic beginner trap when switching between immediate drawing and actors. Add
  rect(..., *, center=False) or a centered_rect, and cross-reference in both DocsPanel entries.

### 7.6 Smaller warts

- say() accepts only an AnchorPoint — say("hi", 100, 100) crashes with a raw AttributeError
  instead of a friendly error; text() accepts both forms.
- text() has no docstring; padding is keyword-only → text("hi", x, y, 6) bare TypeError.
- watch(label) one-arg form keys on repr(label) → watch('score') shows quotes; two-arg
  watch('score', score) doesn't. Inconsistent label rendering.
- Group.__len__ counts dead actors until next iteration prunes.
- Colors.random(seed=, exclude=) vs random_color() — two overlapping helpers.
- fill() / fill(None) / no_fill() — three spellings; docs should say all equivalent.

### 7.7 Five sources of truth for the API surface — already drifting

graphicsDocs.ts, docs/api-v1.md, _manifest.py EXPORTED_NAMES, snapshot JSONs, and AGENTS.md
independently describe the surface. Fix: generate api-v1.md from the manifest, add a CI test that every
DocsPanel entry resolves against EXPORTED_NAMES, re-sync AGENTS.md from the same source.

### 7.8 Priority order

1. ~~Fix facing-tick bug (one line).~~ — DONE 2026-08-14
2. ~~Rename range/set/random/inspect collisions.~~ — DONE 2026-08-14
3. ~~Reconcile docs with code (api-v1.md, AGENTS.md).~~ — DONE 2026-08-14
4. ~~Restore pos/anchors as properties~~ — pos/vel RESOLVED 2026-08-14 (keep getter methods); anchors still open.
5. Remaining polish items — still open: CSP headers (decision), API warts (7.6, decision).

---

## 8. Live sessions & compete — operational details

- Presence pinger: usePresencePinger (~1s cadence), pruneStaleLivePresence on server.
- Session tokens: server/sessions/tokens.ts (issueSessionToken/verifySessionToken),
  rate-limited, expiry in expires_at.
- Emoji comments on live sessions: POST /:sid/comments, allowed-emoji list.
- Teacher live roster: LiveRoster; help-request queue: HelpRequestsSection/GroupQueueView.
- Compete submit: src/compete/submitRunner.ts (runSubmit), server scans/validates problem body
  (scanProblemBody/validateProblemBody), hidden tests via pi3.testing.

---

## 9. Deployment & operations

- npm run dev = Vite on :5173 proxying /api → :3001; npm run dev:all runs both.
- make install-hooks installs pre-push test gate; make deploy / make rollback for VPS
  (set VPS=user@host in Makefile.local).
- Dockerfile, Dockerfile.test (containerized tests), docker-compose.yml.
- GitHub Actions removed (2026); pre-push hook is the sole gate.
- Sessions DB (sessions.db) beside pi3.db; in-memory MemoryStore for tests
  (NODE_ENV=test).
- OAuth cookies: state/return URL in httpOnly cookies, path:'/', sameSite:'lax', HMAC-SHA256
  signed with SESSION_SECRET (fixed 2026-05-20: was scoped to /api/auth/callback).

---

## 10. Mem0 trial setup (2026-08-14) — persistent knowledge base

Fully local, no API keys: **mem0ai 2.0.18** + Ollama (qwen3:8b LLM, nomic-embed-text
embeddings) + **Chroma** vector store on disk.

Location: .mem0-trial/ (gitignored). Demo scripts demo_session1.py (add) /
demo_session2.py (fresh-process retrieval).

**API gotchas learned (mem0 2.x differs from older docs):**
- Use filters={"user_id": ...} — top-level user_id= kwargs RAISE in search()/get_all().
- Results wrapped: {"results": [...]}, each item has memory/hash/metadata/created_at.
- Config key is **ollama_base_url**, not host (LLM and embedder).
- mem0ai alone lacks drivers: install chromadb + ollama separately.
- Set MEM0_DIR env to relocate data dir (default ~/.mem0 is read-only in sandbox).
- spaCy/PostHog warnings are harmless noise.

**Observations**: 16 raw facts → ~50 extracted memories; retrieval is semantic and precise (it
recovered "velocity not auto-applied", "no event decorators", "g.rect vs Rect anchoring", the
range/set shadowing warning). Latency ~3 min/16 adds on qwen3:8b GPU. For production:
tune limit, consider a reranker, or wire mem0's MCP server into the agent harness.

---

*Sources: codebase-memory MCP graph (2701 nodes/7089 edges), AGENTS.md, CLAUDE.md, README.md,
docs/api-v1.md, src/docs/graphicsDocs.ts, src/assets/python/** (graphics, actors, pi3, turtle,
linter), src/runner/**, server/**, src/state/useLiveSession.ts, live Mem0 demo.*
