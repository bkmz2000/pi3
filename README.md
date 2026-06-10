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

pi3 uses Docker for production deployment with GitHub Actions CI/CD.

### Quick Start (Local Docker)

```bash
# Build the Docker image
docker build -t pi3 .

# Run with docker-compose
docker-compose up -d

# Access at http://localhost
```

### Server Setup Requirements

1. **Docker** - Install Docker Engine on the server
2. **Docker Compose** - Install docker-compose plugin
3. **Node.js** - Required for building the Docker image (or use cloud build)
4. **Git** - For pulling latest code

### Manual Deployment

```bash
# Pull latest code
git pull origin main

# Build the Docker image
docker build -t pi3:latest .

# Stop existing container
docker stop pi3 || true
docker rm pi3 || true

# Run new container
docker run -d \
  --name pi3 \
  --restart unless-stopped \
  -p 8080:5173 \
  -v pi3-data:/app/data \
  pi3:latest
```

### Rollback Procedure

To rollback to a previous version:

```bash
# SSH to server
ssh user@server

# Navigate to app directory
cd /app/pi3

# Checkout previous commit
git checkout <previous-sha>

# Rebuild and restart
docker build -t pi3:latest .
docker stop pi3 || true
docker rm pi3 || true
docker run -d \
  --name pi3 \
  --restart unless-stopped \
  -p 8080:5173 \
  -v pi3-data:/app/data \
  pi3:latest
```

### GitHub Actions

- **CI** runs on every PR and push to main (tests + lint)
- **Deploy** automatically runs on merge to main (server-side build via SSH)

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
