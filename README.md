# pi³ — Python IDE for Kids

A browser-based Python IDE designed for teaching kids aged 10-12. Zero installation — just open a URL and start coding!

<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/1e7ba6ee-a53a-4f0e-a457-37d158093373" />

## Features

### Learn Python the Fun Way

- **Interactive Console** — See `print()` output instantly
- **Input Support** — Practice with `input()` for interactive programs
- **Friendly Errors** — Clear error messages to help you learn

### Make Games with Graphics

Create games using the simple `graphics` API:

```python
from graphics import *
from graphics.actors import Actor


def draw(self):
    fill(self.color)
    stroke("white")
    rect(self.x - 50, self.y - 50, 100, 100)


box = Actor(draw=draw, color="red")


def tick():
    if Mouse.pressed:
        box.color = random_color()
    box.move_to(Mouse.x, Mouse.y)
    background("black")
    box.draw()


size(700, 410)
run(tick)
```

### Use Actors for Game Objects

The `Actor` system makes game objects easy:

```python
from graphics import *
from graphics.actors import Actor

ship = Actor(image=assets.sprites.ship, radius=20)


def tick():
    background("black")
    ship.point_towards(Mouse.x, Mouse.y)
    ship.move(5)
    ship.draw()


size(800, 800)
run(tick)
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

### Authentication & OAuth

pi3 integrates with **Loginus** for OAuth 2.0 authentication. See [LOGINUS_AUTH_INTEGRATION_UNIVERSAL.md](LOGINUS_AUTH_INTEGRATION_UNIVERSAL.md) for the complete OAuth integration guide.

**Recent Fix (2026-05-20):** OAuth cookie path was corrected from `/api/auth/callback` to `/` to fix login/logout redirect issues per OAuth specification.

---

## Deployment

Production deployment is governed by the fail-closed procedure in
[docs/deployment-data-safety.md](docs/deployment-data-safety.md). Never deploy a
mutable tag or replace the database volume. The Vercel production path remains
disabled until it has equivalent restore, rollback, and canary controls.

### Quick Start (Local Docker)

```bash
docker build -t pi3:local .
PI3_IMAGE=pi3:local docker compose up -d
# Access at http://localhost:8080
```

### Production candidate and promotion

`make deploy vps` runs local gates, builds and publishes a candidate, then
prints its immutable registry digest. It does **not** change production.
Production promotion is a separate, explicit step after reviewing the exact
commit, digest, profile, VPS, and origin and obtaining product-owner approval:

```bash
make promote-vps \
  CANDIDATE_IMAGE_REF='ghcr.io/bkmz2000/pi3@sha256:<reviewed-digest>' \
  PI3_RELEASE_APPROVAL='APPROVE <commit-sha> ghcr.io/bkmz2000/pi3@sha256:<reviewed-digest> institutional <VPS> https://pi3.sys5.ru'
```

The dedicated canary account, backup recovery identity, clean production
branch, passed local gate, and **READY** release policy are required. Promotion
runs an API/UI create-edit-reload-delete canary and uses release-specific,
digest-pinned image and Compose rollback. Do not bypass this workflow with
manual `docker compose up`, tag-based deployment, or a checkout/rebuild rollback.
See the policy for backup, restore, approval, and incident requirements.

CI and production deployment are separate; there is no automatic production
deploy on merge.

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
| Python Linter | Pure Python (linter.py in Pyodide) |
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
│   ├── worker.ts             # Pyodide + Python linter worker
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
4. **Linting** — Python linter checks code for errors when you click Run

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
