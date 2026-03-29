# AGENTS.md — pi3 Project

**Last Updated**: 2026-03-29  
**Recent Changes**: React component split, Python graphics module bug fixes, instructor sharing system documentation (content-anchored comments).

---

## Overview

**pi3** is a browser-based Python IDE for teaching 10-12 year olds. Zero installation — students open a URL and start coding. Supports plain Python, interactive input, and game development with the Actor-based graphics API.

The name "pi3" is a backronym: **P**hosphorus **I**odine **3** (phosphorus triiodide, PI₃) — an unstable compound that reacts dramatically, like running code. Also references the mathematical constant π (pi).

### Name Origin
- **Chemistry**: Phosphorus Triiodide (PI₃) - unstable, pyrotechnic, explodes on contact
- **Math**: References π (pi) and 3.14...
- **Tech**: Python + Graphics + Chemistry pun

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

Implemented via `indentationGuideField` StateField in `App.tsx`.

### Soft Line Wraps
CodeMirror configured with `EditorView.lineWrapping` for no horizontal scrolling.

### File Management
- **Auto-save on run**: Files are saved before running (`SideMenu.tsx:handleRunToggle`)
- **Ctrl+S save**: Keyboard shortcut saves all dirty files
- **Delete confirmation**: `window.confirm()` dialog before file deletion (`FileBar.tsx`)

### Console Panel
Located on the right side with:
- **Copy button**: Copies console output to clipboard
- **Clear button**: Clears console output
- **Input support**: Shows input prompt when Python requests input

**Note**: Stopping a graphical script no longer clears the console (uses `stop()` instead of `clear()` in `RunnerProvider.tsx`).

### Service Worker Caching
Pyodide and Ruff WASM are cached via Service Worker for faster subsequent loads:
- **Location**: `public/sw.js`
- **Cached assets**: Pyodide v0.26.4, Ruff WASM v0.15.8
- **Behavior**: Automatic caching on first load, serves from cache on subsequent loads
- **Version management**: Cache version `webide-v1`, auto-invalidated on version change

### Lazy Loading
SpriteEditor (Konva) is lazy-loaded via `React.lazy()` to reduce initial bundle size:
```typescript
const SpriteEditor = lazy(() => import("./SpriteEditor"));
```
Loaded only when the sprite editor panel is opened.

### PWA Support
The app is installable as a Progressive Web App:
- **Manifest**: `public/manifest.json` with full PWA configuration
- **Icons**: SVG icons in `public/` (icon-192.svg, icon-512.svg, icon-maskable.svg, favicon.svg) showing "pi³" branding
- **Loading screen**: Shows "pi³" logo while Python runtime initializes
- **Meta tags**: PWA-capable with proper theme-color and apple-mobile-web-app settings

---

## Linter (Ruff WASM)

### Overview
Python linting via `@astral-sh/ruff-wasm-web` running in the existing Pyodide worker. Linting only runs when the user clicks "Run" — not while typing.

### Architecture
```
SideMenu.tsx (handleRunToggle)
    ↓ lint(code, filename)
RunnerProvider.tsx (lint callback)
    ↓ postMessage({ cmd: "lint" })
worker.ts (Ruff WASM)
    ↓ postMessage({ type: "lint", diagnostics })
RunnerProvider.tsx (receives diagnostics)
    ↓ _appendOutput() to console panel
ConsolePanel (displays errors)
```

### Configuration
```typescript
ruffWorkspace = new Workspace({
  "indent-width": 4,
  "line-length": 100,
  lint: {
    select: ["E", "F", "W"],
    ignore: ["W292"],  // No newline at EOF
  },
}, PositionEncoding.Utf16);
```

### Features
- **No inline diagnostics**: Errors are NOT shown as squiggly underlines while typing
- **Run-time linting**: Lint runs only when user clicks "Run"
- **Console output**: Errors displayed with status messages:
  - "Checking for errors..." (while linting)
  - "Syntax error found (X issue(s))" (if errors exist)
  - "No errors found. Starting the script..." (if clean)
- **Errors printed to console panel**: Each error shown as `  {message} (line {row + 1})`
- **Script execution blocked**: If errors found, script does not run

### Types
```typescript
// WorkerInterface.ts
type LintDiagnostic = {
  code: string;
  message: string;
  row: number;
  column: number;
  endRow: number;
  endColumn: number;
  severity: "error" | "warning" | "info";
};
```

---

## Graphics API Architecture

### Module Structure

```
graphics/
  __init__.py      — g module (window, drawing, events)
  actors/
    __init__.py     — Actor class with from_cfg()
    config.py      — @method decorator + from_cfg()
```

### Two Ways to Create Actors

**1. Direct Constructor:**
```python
from graphics.actors import Actor

def draw_fn(self):
    g.fill(255, 0, 0)
    g.circle(self.x, self.y, 20)

player = Actor(x=100, y=100, draw=draw_fn)
player.set_coords(150, 150)
```

**2. From Config Module:**
```python
# player_cfg.py
from graphics.actors.config import method

x = 100
y = 100

@method
def draw(self):
    g.fill(255, 0, 0)
    g.circle(self.x, self.y, 20)

# main.py
from graphics.actors import Actor
import player_cfg

player = Actor.from_cfg(player_cfg)
```

### Config File Pattern

```python
# snake_cfg.py
import graphics as g
from graphics.actors.config import method

TILE_SIZE = 20  # uppercase = constant (not actor state)
GRID_SIZE = 20

x = 10  # initial position
y = 10
tail = []
direction = "up"

@method
def draw(self):
    cx, cy = self.get_coords()
    g.fill(0, 255, 0)
    g.rect(cx * TILE_SIZE, cy * TILE_SIZE, TILE_SIZE, TILE_SIZE)

@method
def update(self):
    if self.direction == "right":
        cx = (cx + 1) % GRID_SIZE
    self.set_coords(cx, cy)
```

**Rules:**
- `@method` decorator marks functions to bind as actor methods
- Module vars (x, y, tail, direction, etc.) become actor instance attributes
- `x` and `y` are used for initial position, passed to `set_coords()`
- Uppercase vars (TILE_SIZE, GRID_SIZE) are constants, not actor state

### Actor Properties vs Methods

| Property | How to Access |
|----------|---------------|
| Position (`_x`, `_y`) | `actor.get_coords()`, `actor.set_coords(x, y)` |
| Custom attributes | `actor.tail`, `actor.direction` (direct access) |
| System properties | `actor.x`, `actor.y`, `actor.angle` (read-only properties) |

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
    box.set_coords(x, y)

@g.on_mouse_click
def on_mouse_click(x, y):
    box.set_coords(x, y)
    box.color = random.randint(100, 255)
```

**Note:** Mouse event handlers receive `(x, y)` coordinates as arguments.

### Public Actor Methods

- `set_coords(x, y)`, `get_coords()` — position
- `get_coords()` returns `(x, y)` tuple
- `set_coords(x, y)` sets position
- Direct attribute access: `actor.tail`, `actor.direction`

### Color Functions

- `fill(r, g, b)` or `fill("red")` — set fill color
- `fill(None)` — disable fill (same as `no_fill()`)
- `stroke(r, g, b)` or `stroke("blue")` — set stroke color
- `stroke(None)` — disable stroke (same as `no_stroke()`)
- `no_fill()` / `no_stroke()` — explicitly disable fill/stroke

### Sprite Assets

Sprites are loaded via `assets.sprites.<name>` (extension automatically stripped):
```python
ship = Actor(image=assets.sprites.spaceship, radius=10)
```

Assets are stored in `src/assets/sprites/` and included via `pickAssets()` in `IdeState.ts`.

---

## Stack

- **React 19 + TypeScript + Vite** — frontend
- **Tailwind CSS** — styling
- **Zustand** — state management
- **CodeMirror 6** — code editor
- **Pyodide** — Python runtime in a Web Worker
- **Ruff WASM** — Python linter (via `@astral-sh/ruff-wasm-web`)
- **react-konva** — sprite editor canvas
- **Jest + Puppeteer** — testing

---

## Project Structure

```
src/
  App.tsx                    # Root layout (LoadingScreen, ConsolePanel, CodeMirror)
  FileBar.tsx               # File tabs
  SideMenu.tsx             # Navigation rail + panels (projects, assets, settings)
  CanvasWindow.tsx          # Floating graphics canvas
  SpriteEditor.tsx         # Konva-based vector sprite editor

  components/
    Backdrop.tsx           # Modal backdrop
    ConsolePanel.tsx       # Console output + input
    IconButton.tsx        # Reusable icon button
    LoadingScreen.tsx      # Initial loading UI
    ProjectButton.tsx      # Project list item
    SidePanel.tsx         # Slide-out panel
    dialogs/
      ImportDialog.tsx     # ZIP import dialog
      NewProjectDialog.tsx # New project dialog

  editor/
    theme.ts               # CodeMirror theme + indentation guides

  state/
    IdeState.ts           # Zustand stores (useEditor, useIde)
    assets.ts             # Asset packing

  runner/
    RunnerProvider.tsx    # Worker singleton, run/lint/stop
    WorkerInterface.ts    # TypeScript types
    worker.ts             # Pyodide + Ruff WASM worker

  hooks/
    useAutoSave.ts        # Auto-save logic
    usePanels.ts          # Panel state
    useProjects.ts        # Project management
    useRunButton.ts       # Run/stop button

  utils/
    storage.ts            # IndexedDB project storage
    zip.ts                # ZIP import/export

  i18n/
    index.ts              # i18next config
    en.json               # English translations
    ru.json               # Russian translations

  assets/
    python/
      graphics/
        __init__.py      # g module (drawing, color, events, loop)
        actors/
          __init__.py     # Actor class
          config.py       # @method decorator + from_cfg()
      shim.py             # Legacy p5 API
      transform.py        # AST transformer
    examples/
      hello_world/        # Hello world example
      input/              # Input example
      bounce/             # Bounce example
      snake/
        snake.py          # main entry
        snake_cfg.py     # snake config
        apple_cfg.py     # apple config
      sokoban/            # Sokoban example
      p5/                 # p5 example
      asteroids/          # Asteroids example
    sprites/               # Packaged sprites

tests/
  puppeteer/
    production-test-suite.js # E2E tests (12 tests)
  unit/                      # Jest unit tests (38 tests)
```

---

## Running Locally

```bash
npm install
npm run dev        # Start dev server (http://localhost:5173)
npm test           # Run unit tests
npm run lint       # Run ESLint
npm run test:puppeteer  # Run E2E tests (dev server must be running)
```

---

## Testing

### E2E Tests (12 tests)
```bash
npm run test:puppeteer
```

Tests: Core UI, Python execution, p5 sketch, Asset panel, Project panel, Error handling, Console output, Sprite editor, Hello World, Snake, Bounce, Sokoban

### Unit Tests (39 tests)
```bash
npm test
```

---

## Architecture: Runner

### Event Flow

1. `RunnerProvider.tsx` wires mouse/keyboard listeners to `window`
2. Events sent to worker via `postMessage({ cmd: "event", ... })`
3. `worker.ts` receives and calls `_inject_event(kind, data)`
4. `_inject_event` in `graphics/__init__.py` dispatches to handlers

### Lint Flow

1. User clicks "Run" button in `SideMenu.tsx`
2. `handleRunToggle()` calls `lint(code, filename)` to check for errors
3. `RunnerProvider.tsx` sends `postMessage({ cmd: "lint", code, filename })` to worker
4. `worker.ts` runs Ruff via WASM, returns diagnostics via `postMessage({ type: "lint", diagnostics })`
5. `RunnerProvider.tsx` receives diagnostics and returns them to `handleRunToggle()`
6. If errors: prints status + errors to console, does NOT run
7. If clean: prints "No errors found", then runs the script

### Key Fixes

- **Mouse event filtering**: `mousemove` only calls `on_mouse_move` handlers, `mousedown` only calls `on_mouse_click` handlers
- **State clearing**: `Actor._registry.clear()` and `Actor._id_counter = 0` called before user code runs
- **Canvas size**: Applied AFTER `setup_func()` runs to ensure `g.size()` takes effect
- **Stop behavior**: Uses `stop()` instead of `clear()` to preserve console output
- **interrupt_ack mechanism**: `RunnerProvider.tsx:interrupt()` returns a Promise that resolves when the worker acknowledges with `interrupt_ack`, ensuring the worker is fully stopped before code runs again
- **_loop_generation invalidation**: `_loop_generation` ALWAYS INCREMENTS (never resets to a fixed value). Each run adds +3 to `_loop_generation` (worker initialization: +1, runGraphicsScript: +1, g.run(): +1). Old ticks have smaller `my_generation` values and skip when they see larger `_loop_generation` values. Runs get unique generations (3, 6, 9, 12...) preventing old ticks from executing in new runs.

### Asset Loading (2026-03-28)

**Problem**: SVG sprites couldn't be decoded by `createImageBitmap` in Web Worker context.

**Solution**: Create ImageBitmaps in main thread using `new Image()` + canvas, then transfer to worker.

```
RunnerProvider.tsx (main thread)
    ↓ creates ImageBitmap via Image+canvas
    ↓ postMessage with transferable
worker.ts
    ↓ receives ImageBitmap
    ↓ sets _asset_bitmaps via _shim._ide_build_assets()
```

**Data URL handling**: Assets stored as URL-encoded SVG data URLs (e.g., `data:image/svg+xml,%3csvg...`). Main thread parses and creates ImageBitmap using Image element.

**_ide_build_assets**: Now accepts a list of (name, bitmap) pairs from `Object.entries()`, strips `.svg` extension from names, and returns SimpleNamespace with `sprites` attribute.

---

## Sprite Editor

### Layout (2026-03-28)
- Tools on the LEFT side (vertical stack)
- Canvas on the RIGHT side  
- Colors/width controls BELOW the canvas
- Save button in UPPER LEFT corner
- PNG export removed (only SVG save)

### Features
- **Tools**: rectangle, ellipse, line, polygon (click to place points, Enter/click to close), freehand, select (transformer for resize/move)
- **Color picker**: predefined palette + custom color input (fill and stroke as popovers)
- **Stroke width**: 0-4 range
- **Undo/Redo**: history stack, Ctrl+Z / Ctrl+Shift+Z
- **Delete**: select + Delete key or trash icon
- **Save as SVG**: serializes shapes back to SVG format

---

## Instructor Sharing System

### Overview
Privacy-first code sharing for instructor oversight during courses. No accounts required, no data stored long-term.

### Architecture
```
Student Browser (IDE) ──HTTP──▶ Cloudflare Worker ──KV──▶ Session Storage
                                           ↑
Instructor Browser (Dashboard) ──polls for sessions + adds comments
```

### Session Flow
1. Student clicks "Share" → code + assets zipped → sent to Worker
2. Worker stores zip in KV with random session ID (e.g., `abc123`)
3. Student sends link via Zoom: `pi3.app/share/abc123`
4. Instructor opens share link or dashboard, sees code
5. Instructor adds comments → stored in KV
6. Student polls for comments → sees them in IDE

### KV Schema
```
share:{session_id} = {
  code: string,           // zipped project (base64)
  timestamp: number,       // last update time
  expires: number         // expiration timestamp (1 hour from last edit)
}
comments:{session_id} = [
  { anchor: string, text: string, timestamp: number }
]
```

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
- No accounts required
- Session IDs are random (unpredictable)
- Data expires automatically (1 hour since last edit)
- No IP logging
- Student code is not read by us (only stored for sharing)

---

## Common Pitfalls

- **`@method` functions require `self`**: `def draw(self):` not `def draw():`
- **`x`/`y` in config**: Used for initial position, not stored as attributes
- **Cross-actor references**: Define in main file, not config (e.g., `apple` in `snake_cfg` must be set in `snake.py`)
- **Mouse handler signatures**: Must accept `(x, y)` parameters
- **Linter runs on "Run" click**: Errors are NOT shown while typing, only when you try to run

---

## Agent Instructions

When working on this codebase:
1. **ALWAYS** run `npm run lint` after making changes
2. **ALWAYS** run `npm test` for unit tests after changes
3. **ALWAYS** run `npm run test:puppeteer` for E2E tests
4. **NEVER** commit without verifying tests pass
5. **UPDATE** AGENTS.md with significant architectural changes
6. **RESPECT** React 19 compiler constraints
7. **MAINTAIN** backward compatibility for student projects
