# pi³ — Python IDE for Kids

A browser-based Python IDE designed for teaching kids aged 10-12. Zero installation — just open a URL and start coding!

![pi³ IDE](https://via.placeholder.com/800x400?text=pi3+Python+IDE)

## Features

### Learn Python the Fun Way

- **Interactive Console** — See `print()` output instantly
- **Input Support** — Practice with `input()` for interactive programs
- **Friendly Errors** — Clear error messages to help you learn

### Make Games with Graphics

Create games using the simple `graphics` API:

```python
import graphics as g

@g.setup
def setup():
    g.size(400, 400)

@g.every(5)
def game_loop():
    g.fill("red")
    g.circle(g.mouse_x(), g.mouse_y(), 20)

g.run()
```

### Use Actors for Game Objects

The `Actor` system makes game objects easy:

```python
from graphics.actors import Actor

def draw(self):
    x, y = self.get_coords()
    g.fill("blue")
    g.rect(x - 25, y - 25, 50, 50)

player = Actor(x=200, y=200, draw=draw)
```

### Create Sprites

Draw your own game characters with the built-in vector sprite editor:
- **Polygon tool** — Click to add points, close shapes with Enter
- **Freehand tool** — Draw freehand shapes
- **Rectangle & Ellipse** — Basic geometric shapes
- **SVG Export** — Save sprites as scalable graphics

### Built-in Examples

Start learning with ready-made projects:
- **hello world** — Your first Python program
- **input** — Learn how to get user input
- **bounce (new API)** — Bouncing ball with the graphics API
- **snake** — Classic snake game
- **sokoban** — Push box puzzle
- **asteroids** — Space shooter with sprites

---

## Getting Started

### For Students

1. Open the IDE in your browser
2. Choose an example project to learn from
3. Click **Run** to see your code execute
4. Edit the code and run again!

### For Developers

```bash
# Clone the repository
git clone <repository-url>
cd webide

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server runs at `http://localhost:5173`

### Running Tests

```bash
# Unit tests
npm test

# E2E tests (requires dev server running)
npm run dev &
npm run test:puppeteer
```

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Code Editor | CodeMirror 6 |
| Python Runtime | Pyodide (WebAssembly) |
| Python Linter | Ruff (WASM) |
| Graphics | Canvas 2D API |
| Sprite Editor | Konva.js |
| Testing | Jest + Puppeteer |
| PWA | Service Worker |

### Key Files

```
src/
├── App.tsx                    # Main layout
├── SideMenu.tsx               # Navigation rail + panels
├── FileBar.tsx               # File tabs
├── CanvasWindow.tsx           # Graphics output
├── SpriteEditor.tsx          # Vector sprite editor
├── state/
│   └── IdeState.ts           # Zustand stores
├── runner/
│   ├── worker.ts             # Pyodide + Ruff worker
│   └── RunnerProvider.tsx    # Worker interface
├── components/               # Reusable UI components
├── editor/
│   └── theme.ts              # CodeMirror theme
└── assets/
    ├── python/graphics/      # graphics API module
    └── examples/            # Example projects
```

---

## How It Works

1. **Python in the Browser** — Pyodide runs Python compiled to WebAssembly in a Web Worker
2. **Graphics** — The `graphics` module draws to an OffscreenCanvas transferred to the worker
3. **Event Handling** — Mouse and keyboard events are captured in the main thread and sent to the worker
4. **Linting** — Ruff WASM checks code for errors when you click Run

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
