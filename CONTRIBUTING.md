# Contributing to pi³ IDE

Thank you for your interest in contributing to pi³!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd webide
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:5173

## Development Workflow

### Running Tests

```bash
# Unit tests (Jest)
npm test

# E2E tests (Puppeteer) - requires dev server running
npm run dev &
npm run test:puppeteer
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Type check
npx tsc --noEmit
```

### Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Project Structure

```
src/
├── App.tsx                    # Main layout component
├── SideMenu.tsx               # Navigation rail + side panels
├── FileBar.tsx               # File tabs
├── CanvasWindow.tsx           # Graphics output canvas
├── SpriteEditor.tsx          # Vector sprite editor (Konva)
├── state/
│   └── IdeState.ts           # Zustand state management
├── runner/
│   ├── worker.ts             # Pyodide + Ruff Web Worker
│   └── RunnerProvider.tsx    # Worker interface
├── components/               # Reusable UI components
│   ├── Backdrop.tsx
│   ├── ConsolePanel.tsx
│   ├── IconButton.tsx
│   ├── LoadingScreen.tsx
│   ├── ProjectButton.tsx
│   ├── SidePanel.tsx
│   └── dialogs/
├── editor/
│   └── theme.ts              # CodeMirror theme + indentation guides
└── assets/
    ├── python/graphics/      # Python graphics API
    │   ├── __init__.py
    │   └── actors/
    └── examples/              # Built-in example projects
```

## Coding Guidelines

### TypeScript

- Use explicit types for function parameters and return values
- Prefer interfaces for object shapes
- Use functional components with hooks (no class components)
- Follow React 19 compiler constraints (no setState in useEffect)

### Python (Graphics API)

- Follow PEP 8 conventions
- Use meaningful variable names
- Add docstrings for public functions
- Handle errors gracefully with try/except

### CSS / Tailwind

- Use Tailwind utility classes exclusively
- Follow the existing cyan color theme
- Ensure accessibility (ARIA labels, focus states)

## Making Changes

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the guidelines above
3. **Run tests** to ensure nothing is broken
4. **Submit a pull request** with a clear description

## Reporting Issues

When reporting bugs, please include:

- Browser and OS version
- Steps to reproduce the issue
- Expected vs actual behavior
- Any relevant console output or error messages

## Ideas for Contributions

- New example projects for students
- Additional graphics functions (shapes, colors, etc.)
- Tutorial documentation
- Accessibility improvements
- Performance optimizations

Thank you for helping make pi³ better for young learners!
