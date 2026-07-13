# AGENTS.md — pi3 Project

**Last Updated**: 2026-05-28
**Recent Changes**: Removed `from_cfg`/`@method`/config.py, replaced `get_coords`/`set_coords` with direct property access (`actor.x`/`actor.y`/`actor.pos`/`actor.move_to`), added 5 warning-level linter checks (W001-W005).

---

## Overview

**pi3** is a browser-based Python IDE for teaching 10-12 year olds. Zero installation — students open a URL and start coding. Supports plain Python, interactive input, and game development with the Actor-based graphics API.

The name "pi3" is a backronym: **P**hosphorus **I**odine **3** (phosphorus triiodide, PI₃) — an unstable compound that reacts dramatically, like running code. Also references the mathematical constant π (pi).

### Name Origin
- **Chemistry**: Phosphorus Triiodide (PI₃) - unstable, pyrotechnic, explodes on contact
- **Math**: References π (pi) and 3.14...
- **Tech**: Python + Graphics + Chemistry pun

---

## Safety & Privacy Design Principles

Durable doctrine, not per-PR notes. Every new feature must be checked against
them before implementation. If a proposed feature conflicts with any
principle below, flag it in the plan — do not build it silently.

**Shorthand.** Each principle is labeled `SPP-N` (Safety & Privacy
Principle N) — use that exact shorthand in commit messages, comments,
and docs. **Do not use `P#N`**: it collides with the product name "pi3"
in speech and in a grep of the codebase.

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

---

## Editor Features

### Indentation Guides
Each 4-space indentation level is visually distinguished with colored backgrounds:
- Spaces 1-4: `#e0f2fe` (lightest blue)
- Spaces 5-8: `#bae6fd`
- Spaces 9-12: `#7dd3fc`
- Spaces 13-16: `#38bdf8`
- Spaces 17-20: `#0ea5e9`
- Spaces 21+: `#0284c7` (darkest)

Implemented via `indentationGuideField` StateField in `editor/theme.ts`.

### Soft Line Wraps
CodeMirror configured with `EditorView.lineWrapping` for no horizontal scrolling.

### File Management
- **Auto-save on run**: Files are saved before running (`useRunButton.ts:handleRunToggle`)
- **Auto-save interval**: Every 60 seconds while the project is dirty (`useAutoSave.ts`)
- **Ctrl+S save**: Keyboard shortcut saves all dirty files
- **Delete confirmation**: `window.confirm()` dialog before file deletion (`FileBar.tsx`)

### Console Panel
Resizeable panel at the bottom (or right side via settings) with:
- **Copy button**: Copies console output to clipboard
- **Clear button**: Clears console output
- **Input support**: Shows input prompt when Python requests input
- **Running indicator**: Animated dots while script executes

**Note**: Stopping a graphical script no longer clears the console (uses `stop()` instead of `clear()` in `RunnerProvider.tsx`).

### Service Worker Caching
Pyodide is cached via Service Worker for faster subsequent loads:
- **Location**: `public/sw.js`
- **Cached assets**: Pyodide v0.29.3
- **Behavior**: Automatic caching on first load, serves from cache on subsequent loads
- **Version management**: Cache version `webide-v4`, auto-invalidated on version change

### Lazy Loading
DocsPanel is lazy-loaded via `React.lazy()` to reduce initial bundle size:
```typescript
const DocsPanel = lazy(() => import("./components/DocsPanel"));
```
Loaded only when the docs panel is opened.

### PWA Support
The app is installable as a Progressive Web App:
- **Manifest**: `public/manifest.json` with full PWA configuration
- **Icons**: SVG icons in `public/` (icon-192.svg, icon-512.svg, icon-maskable.svg, favicon.svg) showing "pi³" branding
- **Loading screen**: Shows "pi³" logo while Python runtime initializes
- **Meta tags**: PWA-capable with proper theme-color and apple-mobile-web-app settings

---

## Linter (Python-based)

### Overview
Python linting implemented as a pure Python module (`linter.py`) running inside Pyodide. No external WASM dependencies. Linting runs when user clicks "Run" — not while typing.

### Architecture
```
useRunButton.ts (handleRunToggle)
    ↓ lint(code, filename)
RunnerProvider.tsx (lint callback)
    ↓ postMessage({ cmd: "lint" })
worker.ts
    ↓ pyodide.runPython(`lint(code, filename)`)
linter.py (runs inside Pyodide)
    ↓ returns diagnostics list
postMessage({ type: "lint", diagnostics })
RunnerProvider.tsx (receives diagnostics)
    ↓ _appendOutput() to console panel
ConsolePanel (displays errors)
```

### Checks Performed

| Code | Severity | Description |
|------|----------|-------------|
| E999 | error | Syntax error (missing colons, unclosed brackets, unterminated strings, etc.) |
| E101 | error | Indentation contains tabs |
| E111 | error | Indentation not multiple of 4 |
| E225 | error | Unsupported operand types (e.g., `3 + "2"`) |
| E225Call | error | Method call argument type mismatch (e.g., `list.append("str")` when list is `list[int]`) |
| E303 | error | Too many blank lines (>4) |
| E501 | error | Line too long (>100 chars) |
| F401 | error | Imported but unused |
| F821 | error | Undefined name |
| W001 | warning | Variable assigned but never used |
| W002 | warning | Non-descriptive variable name (`data`, `value`, `temp`, `result`, `thing`, `stuff`) |
| W003 | warning | Gibberish name (5+ chars, vowel ratio < 0.2) |
| W004 | warning | Similar name to existing variable (Levenshtein distance 1, >=3 chars) |
| W005 | warning | Variable type reassignment (e.g., `int` then `str`) |

Errors (E/F codes) block execution. Warnings (W codes) are shown but do not block.

### Type Checking
The linter includes basic type checking using Python's `ast` module:
- **Binary operation type mismatches**: `3 + "2"`, `"hello" * "world"`, etc.
- **Literal type validation**: `x: Literal["up", "down"] = "left"` reports an error
- **Method call type checking**: `arr = [1, 2, 3]; arr.append("4")` reports error since `append` expects `int` not `str`

### Features
- **No inline diagnostics**: Errors NOT shown as squiggly underlines while typing
- **Run-time linting**: Lint runs only when user clicks "Run"
- **Console output**: Errors displayed with status messages
- **Script execution blocked**: If errors found, script does not run. Warnings only do not block.
- **Star-import handling**: `from graphics import *` is recognized; symbols from known modules are not flagged as undefined

### File Location
`src/assets/python/linter.py` — bundled into Pyodide worker at initialization.

### Types
```typescript
type LintDiagnostic = {
  code: string;                  // e.g., "E225", "W001"
  messageKey: string;            // e.g., "linter.E225"
  messageArgs: Record<string, string | number>;  // e.g., {op: "+", left: "int", right: "str"}
  row: number;
  column: number;
  endRow: number;
  endColumn: number;
  severity: "error" | "warning";
};
```

### Translation
Messages are translated via i18n using `messageKey` and `messageArgs`. Supported keys:
- `linter.E999` — Generic syntax error
- `linter.E999Colon` — Missing colon
- `linter.E999Unclosed` — Unclosed bracket
- `linter.E999Unterminated` — Unterminated string
- `linter.E999Invalid` — Invalid syntax
- `linter.E999EOL` — Premature end of line
- `linter.E999Unmatched` — Unmatched brackets
- `linter.E999Assign` — Assignment error
- `linter.E101` — Indentation contains tabs
- `linter.E111` — Indentation not multiple of 4
- `linter.E225` — Unsupported operand types
- `linter.E225Call` — Method call argument type mismatch
- `linter.E303` — Too many blank lines
- `linter.E501` — Line too long
- `linter.F401` — Unused import
- `linter.F821` — Undefined name
- `linter.W001` — Unused variable
- `linter.W002` — Non-descriptive variable name
- `linter.W003` — Gibberish name
- `linter.W004` — Similar variable names (possible typo)
- `linter.W005` — Type reassignment

---

## Graphics API Architecture

### Module Structure

```
graphics/
  __init__.py      — g module (drawing, color, events, loop, camera, light, tilemaps, animations)
  actors/
    __init__.py     — Actor, Rect, Circle, Group, Collider
  animation.py      — Standalone Animation class (manual frame cycling)
```

There is no `config.py` or `@method` decorator. Actors are created directly via constructors or subclassing.

### Creating Actors

**1. Direct Constructor:**
```python
from graphics.actors import Actor

def draw_fn(self):
    g.fill(255, 0, 0)
    g.circle(self.x, self.y, 20)

player = Actor(x=100, y=100, draw=draw_fn)
player.x = 150
player.y = 150
```

**2. Using move_to:**
```python
player = Actor(x=100, y=100, draw=draw_fn)
player.move_to(150, 150)
```

**3. Using the pos Vector2 property:**
```python
player = Actor(x=100, y=100, draw=draw_fn)
player.pos = Vector2(150, 150)
```

**4. Subclassing:**
```python
class Player(Actor):
    def draw(self):
        g.fill(Colors.blue)
        g.rect(self.x - 10, self.y - 10, 20, 20)

player = Player(x=100, y=100)
```

**5. Built-in shapes:**
```python
# Rect: (x, y) is the center
box = Rect(x=100, y=200, width=60, height=40, color="red")

# Circle: (x, y) is the center
ball = Circle(x=100, y=200, radius=30, color="blue")
```

### Actor Properties

| Property | Access | Description |
|----------|--------|-------------|
| `x`, `y` | Read-write (float) | Position |
| `angle` | Read-write (float, 0-360) | Rotation in degrees |
| `vx`, `vy` | Read-write (float) | Velocity (applied automatically each frame) |
| `pos` | Read-write (Vector2) | Position as Vector2 |
| `vel` | Read-write (Vector2) | Velocity as Vector2 |
| `visible` | Read-write (bool) | Whether the actor is drawn |
| `scale` | Read-write (float) | Drawing scale (default 1.0) |
| `flip_x`, `flip_y` | Read-write (bool) | Horizontal/vertical flip |
| `image` | Read-write | Sprite/SpriteEntry/SheetAnimation to draw |
| `collider` | Read-only (Collider) | Hitbox configuration |

### Actor Methods

**Movement:**
- `move(distance)` — Move in the direction of `angle`
- `move_to(x, y)` — Teleport to position
- `change_x_by(dx)` / `change_y_by(dy)` — Offset by delta
- `rotate(degrees)` — Rotate by relative degrees
- `point_towards(x, y)` — Face a target coordinate

**Lifecycle:**
- `die()` — Mark as dead (removed from Group iteration, skips draw/update)
- `is_alive()` — Returns True if not dead
- `init()` — Hook called during `__init__` (override in subclasses)
- `update()` — Hook called each frame (override in subclasses)
- `draw()` — Hook called each frame (override in subclasses)

**Spatial helpers:**
- `random_position()` — Teleport to random position within canvas
- `wrap_x()` / `wrap_y()` / `wrap()` — Screen wrapping
- `in_bounds()` — Check if center is inside canvas

**Pixel editing (sprites):**
- `reset()` — Restore original pixel data
- Iteration: `for pixel in actor:` — Yields PixelView objects

**Anchor points** (return AnchorPoint, usable with `g.text()`):
- `actor.center`, `actor.top`, `actor.bottom`, `actor.left`, `actor.right`
- `actor.top_left`, `actor.top_right`, `actor.bottom_left`, `actor.bottom_right`

**Collision (configure via `actor.collider.set_circle()` or `actor.collider.set_rect()`):**
- `actor.collides_with(other)` — Check collision with another actor
- `actor.collides_any(group)` — Check collision with any actor in a Group

**Animation (for sprites with `SpriteEntry` image):**
- `actor.<anim_name>.tick()` — Advance animation frame (call in `update()`)

**Velocity:** `actor.vx` and `actor.vy` are applied automatically each frame via `_apply_velocity()`. Set these and the actor moves each tick without manual position updates.

### Group (Actor Collection)
```python
enemies = Group()
enemies.add(Enemy(x=100, y=50))
for enemy in enemies:        # Automatically filters dead actors
    enemy.update()
```

### Event Handlers

```python
@g.on_key_press("w", "arrow_up")
def go_up():
    snake.direction = "up"

@g.every(5)
def game_loop():
    snake.update()

@g.on_mouse_move
def on_mouse_move(x, y):
    player.move_to(x, y)

@g.on_mouse_click
def on_mouse_click(x, y):
    spawn_bullet(x, y)
```

**Note:** Mouse event handlers receive `(x, y)` coordinates as arguments.

### Color Functions

- `fill(r, g, b)` or `fill("red")` — set fill color
- `fill(None)` — disable fill (same as `no_fill()`)
- `stroke(r, g, b)` or `stroke("blue")` — set stroke color
- `stroke(None)` — disable stroke (same as `no_stroke()`)
- `no_fill()` / `no_stroke()` — explicitly disable fill/stroke
- `stroke_width(w)` — set stroke width

### Color Palette (Sweetie 16)

Access via `Colors.<name>` or string name in `fill()`/`stroke()`:
black, wine, red, orange, yellow, lime, green, teal, navy, blue, sky, cyan, white, silver, gray, slate

### Color Helpers
- `lerp(a, b, t)` — Linear interpolation between two colors
- `darker(c, steps=1)` / `lighter(c, steps=1)` — Adjust brightness
- `saturated(c, steps=1)` / `desaturated(c, steps=1)` — Adjust saturation
- `random_color()` — Random color from the palette

### Vector Math
- `Vector2(x, y)` / `Point(x, y)` (alias) — 2D vector
- `Polar(magnitude, angle_degrees)` — Create vector from polar coordinates

### Timing
- `frame_rate(fps)` — Set target FPS (default 60)
- `frame_count` — Number of frames since run started
- `Timer(s=, ms=)` — Countdown timer with `.done()`, `.left()`, `.elapsed()`, `.restart()`

### Sprite Assets

Sprites are loaded via `assets.sprites.<name>` (extension automatically stripped):
```python
ship = Actor(image=assets.sprites.spaceship)
```

**Sheet animations** (via `assets.sheet`):
```python
player = Actor(image=assets.sheet.player)
# Access animations: player.idle.tick(), player.walk.tick()
```

### Camera

```python
with Camera() as cam:
    cam.follow(player, lerp=0.1)  # lerp < 1 = smooth follow
    g.background(Colors.navy)
    # Draw everything...
    for enemy in enemies:
        enemy.draw()
```

### Light

```python
light = Light(ambient=(40, 40, 60), radius=200, mode="hsl")
light.add_obstacles(walls)  # Any Group or Actor list
light.add_source(player)    # Position from Actor or (x, y) tuple
light.shade("wine")         # Color tint
light.flicker(True)         # Torch flicker effect
light.draw()                # Must be called in draw loop
```

### Tilemaps

```
TilemapLayer   — Grid-based layer with named tiles
TileMap        — Multi-layer tilemap
TileRef        — Reference to tiles in specific layer/area
TileGroup      — Named area group within a layer
Cell           — Individual cell
Bounds         — Iterable collection of cell positions
```

### Sound

```python
assets.sounds.explosion.play()
assets.sounds.music.loop()
assets.sounds.music.pause()
assets.sounds.music.stop()
```

Supported formats: MP3, OGG, WAV.

### Animation (Standalone)

```python
walk = Animation(frames=[frame1, frame2, frame3], fps=8)
walk.play()        # Start playing (default: looping)
walk.pause()       # Freeze on current frame
walk.reset()       # Back to frame 0
walk.update()      # Advance one tick (call in main loop)
g.image(walk.frame, x, y)  # Draw current frame
```

### Full API Surface

Exported from `graphics/__init__.py` (`__all__`):
```
size, width, height,
circle, rect, ellipse, line, point,
text, text_size, text_align, say,
fill, no_fill, stroke, no_stroke, stroke_width,
background,
push, pop, translate, rotate, scale,
image,
frame_rate, frame_count,
random, random_color,
Colors, AnchorPoint,
lerp, darker, lighter, saturated, desaturated,
Sprite, PixelView, create_sprite, get_pixel, set_pixel,
palette_swap, flood_fill,
darken, lighten, saturate, desaturate,
Vector2, Point, Polar,
Mouse, Keyboard, Window,
Camera,
TilemapLayer, TileMap, TileRef, TileGroup, Cell, Bounds,
noise,
Light,
Animation,
SheetAnimation, SpriteEntry, SheetNamespace, AnimationController,
run, stop,
assets, sheet,
```

---

## API Surface Snapshot

`tests/unit/api-surface.json` freezes the public graphics API surface. Any
add/remove of a name in `__all__` must update the snapshot and `docs/api-v1.md`
in the same commit. CI fails if they diverge.

Update procedure:
1. Edit `graphics/__init__.py` `__all__` and `_manifest.py` `EXPORTED_NAMES`
2. Update `tests/unit/api-surface.json` to match
3. Update `docs/api-v1.md` changelog
4. Run `npm test` to verify

## Stack

- **React 19 + TypeScript + Vite 7** — frontend
- **Tailwind CSS v4** — styling
- **Zustand v5** — state management
- **CodeMirror 6** — code editor
- **Pyodide v0.29.3** — Python runtime in a Web Worker
- **JSZip** — project import/export
- **react-konva** — sprite editor canvas (lazy-loaded)
- **Express.js v4 + better-sqlite3** — backend server
- **i18next** — internationalization
- **Jest + Puppeteer** — testing

---

## Project Structure

```
src/
  main.tsx                  # React entry point (BrowserRouter + StrictMode)
  App.tsx                   # Root layout (routes, LoadingScreen, editor, console, canvas)
  appInit.ts                # App initialization (auth error handler)
  FileBar.tsx               # File tabs + share/help actions
  SideMenu.tsx              # Navigation rail + side panels (projects, assets, tilemaps, animations, settings, docs)
  CanvasWindow.tsx          # Floating graphics canvas (draggable, screenshots)
  AssetEditor.tsx           # Overlay editor for sprites/tilemaps/animations
  PixelEditor.tsx           # Pixel art editor for sprites
  TileEditor.tsx            # Tilemap editor
  SheetEditor.tsx           # Sprite sheet editor

  components/
    Backdrop.tsx            # Modal backdrop (click outside to close)
    ConsolePanel.tsx        # Console output + input prompt (resizeable)
    DocsPanel.tsx           # Reference documentation panel (lazy-loaded)
    IconButton.tsx          # Reusable icon button
    Icons.tsx               # SVG icon definitions
    LoadingScreen.tsx       # Initial loading UI ("pi³" logo)
    ProjectButton.tsx       # Project list item
    SaveErrorIndicator.tsx  # Save error banner (auth/network)
    SidePanel.tsx           # Slide-out panel with focus management
    ThemedDialog.tsx        # Themed modal dialog
    ToastContainer.tsx      # Toast notification stack
    dialogs/
      ForkDialog.tsx        # Fork confirmation dialog
      ImportDialog.tsx      # ZIP import dialog
    projects/
      index.ts              # Barrel export
      NewProjectDialog.tsx  # New project dialog
      ProjectCard.tsx       # Project card
      ProjectRow.tsx        # Project row
      ProjectsPage.tsx      # /projects route
      ShareDialog.tsx       # Project sharing dialog
    teacher/
      TeacherDashboard.tsx  # /teacher route
      TeacherProjectView.tsx # /teacher/projects/:projectId
      GroupsSection.tsx     # Group management
      HelpRequestsSection.tsx # Help request queue
      StudentProjectsSection.tsx # Student project listing
      GroupQueueView.tsx    # Group-specific help queue
      NavItem.tsx           # Teacher nav item
      styles.ts             # Teacher-specific styles
    user/
      AuthSection.tsx       # Auth UI section
      HandleAvatar.tsx      # User avatar with handle
      LoginButton.tsx       # Login button
      LoginDialog.tsx       # Login dialog
      UserMenu.tsx          # User dropdown menu
      index.ts              # Barrel export

  editor/
    theme.ts                # CodeMirror theme + indentation guides
    comments.ts             # Teacher comment extension
    graphicsCompletion.ts   # Graphics API autocomplete source

  state/
    IdeState.ts             # Zustand stores (useEditor, useIde)
    assets.ts               # Asset packing (sprites, sounds, library packs)
    api.ts                  # API client + typed endpoint functions
    apiBase.ts              # API base URL
    asyncAction.ts          # Async action utilities
    notificationsStore.ts   # Notifications store
    projectNormalization.ts # Normalize API projects to editor format
    toastsStore.ts          # Toast notifications store
    useNotifications.ts     # Notifications hook
    useTeacherShare.ts      # Teacher share hook
    useTheme.ts             # Theme state (light/dark, editor colors, font)
    useToasts.ts            # Toast hook
    useUser.ts              # User auth state (authState, login/logout)

  runner/
    RunnerProvider.tsx      # Worker singleton, run/lint/stop, asset loading, event wiring
    worker.ts               # Pyodide Web Worker — Python execution, canvas rendering, interrupts
    WorkerInterface.ts      # TypeScript types for worker commands/events
    canvasRenderer.ts       # JS-side canvas renderer for draw commands

  hooks/
    useAutoSave.ts          # 60-second auto-save interval
    usePanels.ts            # Panel open/close/toggle state
    useProjects.ts          # Project CRUD operations
    useRunButton.ts         # Run/stop button orchestration (lint → save → run)

  utils/
    storage.ts              # IndexedDB project cache (WebIDE v2)
    zip.ts                  # ZIP import/export (JSZip)
    anonStash.ts            # Anonymous session persistence (localStorage)
    userDisplay.ts          # User display name formatting

  docs/
    concepts.ts             # Graphics concepts reference data
    graphicsDocs.ts         # API documentation data
    recipes.ts              # Code recipes (copy-pasteable snippets)

  i18n/
    index.ts                # i18next config (en + ru, localStorage + browser detection)
    en.json                  # English translations
    ru.json                  # Russian translations

  assets/
    python/
      graphics/
        __init__.py         # g module (drawing, color, events, loop, camera, light, tilemaps, noise)
        actors/
          __init__.py       # Actor, Rect, Circle, Group, Collider
        animation.py        # Standalone Animation class
      linter.py             # Python linter (runs inside Pyodide)
    examples/
      hello_world/          # Hello world (print)
      input/                # Input example (name, age prompts)
      bounce/               # Ball bouncing (graphics intro)
      bouncing_actor/       # Actor-based bounce
      snake/                # Snake game (snake.py only, no _cfg files)
      sokoban/              # Sokoban puzzle
      asteroids/            # Asteroids game
      catch/                # Catch game
      p5/                   # Processing/p5-inspired sketch
      platformer/           # Platformer game
      dungeon/              # Dungeon generator
      cave_generator/       # Cave generator
      color_shifter/        # Color animation
      gradient_sky/         # Sky gradient
      random_walls/         # Random wall generation
      robot/                # Robot drawing
      sprite_painter/       # Procedural sprite painting
      swatches/             # Color palette swatches
    sprites/                # ~83 SVG sprite assets (Kenney game assets)
    sounds/
      kenney_rpg-audio/     # RPG audio pack

server/
  index.ts                  # Express app entry (CORS, sessions, routes, static, SPA fallback)
  session.d.ts              # Session type augmentation
  db/
    index.ts                # SQLite init, migrations, reset
    handle.ts               # User handle generation
    word-lists.ts           # Word lists for handles
    migrations/
      001_initial.sql ...
      008_group_polish.sql
  middleware/
    auth.ts                 # Auth middleware (session + API token)
    projectAuth.ts          # Project access control (owner/editor/viewer roles)
  routes/
    auth.ts                 # OAuth/outsider login/logout
    projects.ts             # Project CRUD + save + share + help requests
    shares.ts               # Project sharing (nested under projects)
    comments.ts             # Teacher comments (nested under projects)
    users.ts                # User management (me, search, outsider)
    groups.ts               # Group/class CRUD + invite codes
    help-requests.ts        # Help request queue
  tests/                    # Server-side API tests

tests/
  puppeteer/
    production-test-suite.js   # Main E2E test suite
    sprite-editor-test-runner.js
    onboarding.test.js
    test-utils.js
  unit/                        # Jest unit tests

public/
  sw.js                    # Service worker (Pyodide caching)
  manifest.json            # PWA manifest
  icon-192.svg / icon-512.svg / icon-maskable.svg / favicon.svg
```

---

## Running Locally

```bash
npm install
npm run dev              # Start dev server (http://localhost:5173)
npm test                 # Run unit tests (Jest)
npm run lint             # Run ESLint
npm run test:puppeteer   # Run E2E tests (dev server must be running)
npm run test:server      # Run server-side tests
```

---

## Testing

### E2E Tests
```bash
npm run test:puppeteer
```

### Unit Tests
```bash
npm test
```

---

## Architecture: Runner

### Event Flow

1. `RunnerProvider.tsx` wires mouse/keyboard listeners to `window`
2. Events sent to worker via `postMessage({ cmd: "event", ... })`
3. `worker.ts` receives and calls `graphics._inject_event(kind, data)`
4. `_inject_event` in `graphics/__init__.py` dispatches to handlers

### Lint Flow

1. User clicks "Run" button in `SideMenu.tsx`
2. `handleRunToggle()` calls `lint(code, filename)` to check for errors
3. `RunnerProvider.tsx` sends `postMessage({ cmd: "lint", code, filename })` to worker
4. `worker.ts` runs the Python linter, returns diagnostics via `postMessage({ type: "lint", diagnostics })`
5. `RunnerProvider.tsx` receives diagnostics and returns them to `handleRunToggle()`
6. If errors: prints status + errors to console, does NOT run
7. If only warnings: prints warning count, then runs the script
8. If clean: prints "No errors found", then runs the script

### Run Flow

1. `useRunButton.handleRunToggle()` reads code and dirty state from `useEditor`
2. If dirty, calls `saveCurrentProject()` to persist
3. Calls `clear()` to reset console
4. (Optional) Lints code; aborts on errors
5. Calls `run(files, assets, entry)` on the runner
6. `RunnerProvider.run()` loads assets as ImageBitmaps, transfers to worker
7. `worker.ts` receives `cmd: "run"`, prepares files in Pyodide FS
8. Executes via `pyodide.runPythonAsync()`
9. Stdout/stderr streamed back via postMessage, batched by requestAnimationFrame

### Interrupt Mechanism

Two-tier interrupt:
1. `SharedArrayBuffer(1)` byte set to 2 for fast signal (if available)
2. `postMessage({ cmd: "interrupt" })` triggers `graphics.stop()` + `graphics._clear()`
3. Worker sends `interrupt_ack` back
4. `RunnerProvider.interrupt()` returns a Promise that resolves on ack (or 150ms timeout)

### Loop Generation Invalidation

`_loop_generation` ALWAYS INCREMENTS (never resets). Each run adds +3. Old tick callbacks compare their stored generation against current and skip if stale. Runs get unique generations (3, 6, 9, 12...) preventing old ticks from executing in new runs.

### Key State Clearing (before each run)

- `Actor._registry.clear()` and `Actor._id_counter = 0`
- `_draw_commands = []`
- `_loop_generation` incremented
- Canvas size applied AFTER setup functions run so `g.size()` takes effect

### Asset Loading

**Problem**: SVG sprites couldn't be decoded by `createImageBitmap` in Web Worker context.

**Solution**: Create ImageBitmaps in main thread using `new Image()` + canvas, then transfer to worker.

```
RunnerProvider.tsx (main thread)
    ↓ creates ImageBitmap via Image + canvas
    ↓ postMessage with transferable
worker.ts
    ↓ receives ImageBitmap
    ↓ stores in module-level runAssets/runAnimations
    ↓ RGBA pixel buffers extracted on-demand for draw commands
```

**Data URL handling**: Assets stored as data URLs. Main thread parses and creates ImageBitmaps.

**JS-side rendering**: `_ide_flush_draw_commands` callback renders directly to OffscreenCanvas 2D context using `canvasRenderer.ts`. ImageBitmaps never cross into Python — only metadata (names, dimensions) and RGBA buffers do.

---

## Sprite Editor

### Layout
- Tools on the LEFT side (vertical stack)
- Canvas on the RIGHT side
- Colors/width controls BELOW the canvas
- Save button in UPPER LEFT corner

### Features
- **Tools**: select, rectangle, ellipse, line, pen, polygon (click to place points, double-click/Enter to close), text, path-edit
- **Color picker**: Sweetie 16 predefined palette + custom color input (fill and stroke as popovers)
- **Stroke width**: 0-4 range
- **Undo/Redo**: history stack, Ctrl+Z / Ctrl+Shift+Z
- **Delete**: select + Delete key or trash icon
- **Grid**: Toggle grid overlay with configurable size
- **Center point**: Configure rotation center for sprites
- **Save**: SVG serialization back to sprite format

---

## Instructor Sharing System

### Overview
Privacy-first code sharing for instructor oversight during courses. No accounts required, no data stored long-term.

### Architecture
```
Student Browser (IDE) ──HTTP──▶ Express Server ──SQLite──▶ Project + Comments Storage
                                      ↑
Instructor Browser (Dashboard) ──polls for projects + adds comments
```

### Session Flow
1. Student clicks "Share with teacher" → enters teacher's username/email
2. Project shared via `POST /api/projects/:id/share`
3. Instructor opens dashboard at `/teacher` or views project at `/teacher/projects/:projectId`
4. Instructor adds comments → stored in SQLite via `/api/projects/:id/comments`
5. Student polls for comments → sees them in IDE

### Comment Anchoring
Comments are anchored to **content**, not line numbers. This means if student adds/removes lines, comments stay attached to matching code.

**Anchor matching:**
- Comments store an `anchor` string (typically a unique line or line fragment)
- When displaying, find first line containing the anchor text
- If anchor not found, comment shows as "orphaned" (instructor can reattach)

**Example:**
```
Student code:                 Instructor comment:
@every(1)            ────▶   anchor: "def loop"
def loop():                   text: "you have a typo, should be 'def loop():'"
    ...

After student adds line above:
1. @every(1)                  # comment still shows here
2. def loop():
    ...
```

### Security & Privacy
- OAuth-based school accounts or password-based "outsider" accounts
- Student code accessible only to project owner and explicitly shared teachers
- Teacher dashboard requires teacher role
- Group/classroom system for organized classrooms

---

## Common Pitfalls

- **`draw()` and `update()` hooks**: Override these on Actor subclasses — they are called automatically each frame
- **Collision requires collider setup**: Call `actor.collider.set_circle(radius)` or `.set_rect(w, h)` before `.collides_with()` works. `Rect` and `Circle` classes auto-configure their colliders.
- **`Rect`/`Circle` center origin**: Both shapes use `(x, y)` as their **center**, not top-left corner
- **Angle 0 means right**: `actor.move(distance)` moves to the right at angle 0, down (screen y-axis) as angle increases
- **Mouse handler signatures**: Must accept `(x, y)` parameters
- **Linter runs on "Run" click**: Errors are NOT shown while typing, only when you try to run
- **Actor kwargs**: Only known property names (`x`, `y`, `angle`, `vx`, `vy`, `image`, etc.) go through property setters. Unknown kwargs are set directly on the instance — a typo like `player.x=100, player.y=200, player.vx=5` (instead of `vx=5`) creates a custom attribute, not velocity.
- **Velocity auto-apply**: `actor.vx` and `actor.vy` are applied automatically each frame. You do NOT need to call `actor.x += actor.vx` in `update()`.
- **Sheet animations**: For `actor.image = assets.sheet.player`, access animations via `actor.walk.tick()`, not `actor.image.walk.tick()`.
- **`fill(None)` vs `no_fill()`**: Both disable fill. Use whichever is clearer.
- **ZIP export loses non-file data**: Tilemaps, animations, sounds, and sprite sheet data are NOT included in project ZIP exports.

---

## Agent Instructions

When working on this codebase:
1. **CHECK** proposed features against the Safety & Privacy Design Principles above. If in conflict, flag it — do not build silently.
2. **ALWAYS** run `npm run lint` after making changes
3. **ALWAYS** run `npm test` for unit tests after changes
4. **ALWAYS** run `npm run test:puppeteer` for E2E tests
5. **NEVER** commit without verifying tests pass
6. **UPDATE** AGENTS.md with significant architectural changes
7. **RESPECT** React 19 compiler constraints
8. **MAINTAIN** backward compatibility for student projects

---

## See Also

- [ROADMAP.md](docs/ROADMAP.md) — planned and in-progress features
