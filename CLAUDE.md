# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Detailed architecture notes are available in [`AGENTS.md`](AGENTS.md).**

## Commands

- `npm run dev` — Start development server (Vite)
- `npm run build` — Build for production (`tsc -b && vite build`)
- `npm run lint` — Run ESLint
- `npm run preview` — Preview production build locally
- `npm test` or `npm run test:e2e` — Run end-to-end tests (Jest + Puppeteer)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:debug` — Run tests with `--runInBand --no-coverage --verbose`

## High-Level Architecture

This is a browser-based Python IDE for teaching 10‑12 year olds. Zero installation — students open a URL and start coding. Supports plain Python, interactive input, and p5.js-style canvas sketches.

### Stack
- **React 19 + TypeScript + Vite** — frontend
- **Tailwind CSS** — styling (via `@tailwindcss/vite`)
- **Zustand** — state management (two stores: `useEditor`, `useIde`)
- **CodeMirror 6** — code editor (`@uiw/react-codemirror`)
- **Pyodide** — Python runtime in a Web Worker
- **react‑konva** — sprite editor canvas
- **Konva.js** — 2D canvas graphics library for sprite editor

### Key Directories
- `src/` — React components and application logic
  - `App.tsx` — root layout: Rail | Editor | ConsolePanel | CanvasWindow
  - `SideMenu.tsx` — left rail nav + slide‑out panels (projects, assets, settings)
  - `FileBar.tsx` — file tabs with inline rename, add, delete
  - `CanvasWindow.tsx` — floating draggable canvas for p5 sketches
  - `SpriteEditor.tsx` — Konva‑based vector sprite editor modal with polygon/freehand tools and fill support
  - `state/` — Zustand stores (`IdeState.ts`, `assets.ts`)
  - `runner/` — Python runner with Web Worker (`RunnerProvider.tsx`, `worker.ts`, `WorkerInterface.ts`)
  - `assets/` — example Python files and sprite images
- `tests/e2e/` — end‑to‑end tests using Jest + Puppeteer
- `public/` — static assets (Pyodide can be placed here for local use)

### State Management
- `useEditor` (in `IdeState.ts`) — manages current file, project files, assets, dirty files
- `useIde` (in `IdeState.ts`) — manages active side panel, user projects, loading state
- `useRunnerStore` (in `RunnerProvider.tsx`) — manages runner state (ready, running, output, inputPrompt)

### Runner Architecture
The runner has two layers:

1. **Worker (`worker.ts`)** — runs Pyodide in a Web Worker. Handles:
   - Pyodide lifecycle (`ensurePyodide`, `initPyodide`)
   - File writes to Pyodide FS (`prepareFiles`)
   - Transform call → run (plain or p5)
   - Event injection into shim (`_inject_event`)
   - Input response resolution (`_console.resolve`)
   - Interrupt via `SharedArrayBuffer` + `noLoop()`

2. **RunnerProvider (`RunnerProvider.tsx`)** — module‑level singleton that:
   - Creates the worker and routes messages
   - Batches output via `requestAnimationFrame` (prevents render‑per‑line)
   - Fetches assets (main thread fetch → `ArrayBuffer` → transfer to worker)
   - Wires mouse/keyboard events to worker messages (`wireEvents`)

**Worker is a module‑level singleton** — never recreated; `if (worker) return worker` guard makes it StrictMode safe.

### Python Transform Pipeline (`transform.py`)
Rewrites user code before execution:
1. Gathers `State(...)` assignments (supports multiple state variables)
2. Strips `@use(state_var)` decorators and rewrites bare state key names to `state_var.key`
3. Injects `State = SimpleNamespace` preamble if state is used
4. Detects `setup`/`draw` function definitions (p5 sketch) or `input()` calls
5. Rewrites `input(...)` → `await console.ainput(...)`
6. Wraps in appropriate entrypoint (`_build_p5` or `_build_plain`)

### p5 Shim (`shim.py`)
Runs inside the Pyodide worker:
- Uses `OffscreenCanvas` — no DOM access
- Draw loop via `js.setTimeout` + `pyodide.ffi.create_proxy`
- User sketch runs in its own namespace; `_current_user_globals` points to the sketch’s `__globals__`
- `_inject_event()` updates shim globals before calling the handler
- Implements `imageMode()` and `rectMode()` with CORNER, CENTER, CORNERS, RADIUS modes
- Integrates Actor system for game objects (collision detection, movement, drawing)

### Actor System (`actors.py`)
Simple game‑object system for kids without OOP knowledge:
- `Actor()` factory function creates game objects
- Collision functions (`collides()`, `point_in()`)
- Movement helpers (`bounce_off_edges()`, `wrap_around_edges()`, `move_towards()`, `keep_on_screen()`)
- Functions injected into Python builtins by `shim.py`; graceful degradation if import fails

### Asset System
- **Pack assets** — static sprite images in `src/assets/sprites/` enumerated at build time via Vite glob
- **User‑created sprites** — stored as data URLs in project assets, appear alongside pack assets
- When running, assets are fetched on the main thread, converted to `ArrayBuffer`, and transferred (zero‑copy) to the worker
- Worker creates `ImageBitmap`s and exposes them via `assets.sprites.name` namespace

### Project Type
```typescript
type Project = {
  files: Record<string, string>;    // filename → code
  assets: Record<string, string>;   // pack sprite name → url (selected for this project)
  sprites?: Record<string, string>; // user‑created sprite name → data URL (merged with assets)
}
```

## Testing

End‑to‑end tests use **Jest + Puppeteer**. They run sequentially (`maxWorkers: 1`) to avoid browser conflicts.

- **Test location**: `tests/e2e/*.test.{ts,tsx}`
- **Setup/teardown**: `tests/e2e/globalSetup.js`, `tests/e2e/globalTeardown.js`, `tests/e2e/setupTests.js`
- **Configuration**: `jest.e2e.config.js`, `jest‑puppeteer.config.js`
- **Test report**: Generated as `test‑report.html` (jest‑html‑reporter)
- **Pyodide loading can be slow** → `testTimeout: 60000`

Locally, tests run with browser visible (`headless: false`, `devtools: true`, `slowMo: 50`). In CI they run headless.

## Important Invariants & Pitfalls

- **Worker is a singleton** — never recreated; guard with `if (worker) return worker`
- **OffscreenCanvas transferred once** — `canvasTransferred` flag prevents double‑transfer
- **`?raw` imports only in main thread** — Vite cannot reliably handle `?raw` imports inside worker modules; `shim.py`, `transform.py`, `actors.py` are imported in `RunnerProvider.tsx` and passed via `init` message
- **No `asyncio.run()`** — Pyodide has a running event loop; use `get_event_loop().run_until_complete()` instead
- **Output batching** — stdout/stderr messages are queued and flushed on `requestAnimationFrame` to avoid one React re‑render per print line
- **Loop generation counter** — `_loop_generation` in shim prevents double‑loop when re‑running a p5 sketch
- **`_current_user_globals` is the sketch namespace** — assign directly (`=`), not `.update()`, so the dict is the same object as the sketch functions’ `__globals__`
- **Actor system is optional** — actors module import is wrapped in try/except; if import fails, dummy functions are provided
- **`use()` function must be defined** — `@use` decorator requires `use()` function in namespace; defined in `shim.py` before actors import

## Recent Development Notes

See `AGENTS.md` and `devlog.md` for detailed changelog and implementation details of recent features:
- ImageMode/RectMode implementation in shim.py
- Transform module enhancements for multiple state variables
- Asset system overhaul for user‑created sprites
- Sprite editor polygon and freehand tools with fill support
- Asset renaming fix (focus loss issue)
- Actor system implementation with collision detection
- `@use` decorator fix and actors module integration

## Running Locally

```bash
npm install
npm run dev
```

Pyodide is loaded from CDN by default. To use a local copy, place Pyodide files in `public/pyodide/`.


Context limit is ~65k usable tokens. Minimize file re-reads. Prefer targeted edits over read-modify-read cycles
