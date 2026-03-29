# pi³ IDE TODO

## Critical Fixes (Week 1-2)
- [ ] Fix SharedArrayBuffer crossOriginIsolated check
- [ ] Add Pyodide load failure handling with retry UI
- [ ] Bundle size optimization (compression, splitting)
- [ ] Service worker offline handling

## Features

### Single-File Export (Week 3)
- [ ] Export project as standalone HTML file
- [ ] Include assets inline (base64)
- [ ] Self-contained Pyodide runtime

### Instructor Sharing Backend (Week 4)
- [ ] Cloudflare Worker for code sharing API
- [ ] KV storage for sessions
- [ ] Session creation on student "Share" action
- [ ] Short session IDs (random, e.g., `abc123`)
- [ ] Code blob storage (zip of project)
- [ ] Comment storage per session
- [ ] Session expiration (1 hour since last edit)

### Instructor Dashboard (Week 5)
- [ ] View active sessions list (~20 students)
- [ ] Real-time code display (polling)
- [ ] Add content-anchored comments (not line-based)
- [ ] Delete session
- [ ] Session search/filter

### Student Comment View (Week 6)
- [ ] "View Teacher Comments" button in IDE
- [ ] Poll for new comments (not too frequently)
- [ ] Display comments next to matching code content
- [ ] Comment notification indicator

### Tile Editor (Week 7)
- [ ] Grid-based level editor
- [ ] Tile palette from sprites
- [ ] Export as JSON/level format
- [ ] Integrate with examples (sokoban, platformer)

### Explorable Docs (Week 8)
- [ ] Built-in help panel in IDE
- [ ] Graphics API reference
- [ ] Runnable examples in docs
- [ ] Translatable (i18n support)

## Documentation
- [ ] Instructor guide for course setup
- [ ] Common student mistakes reference
- [ ] Graphics API docs (auto-generated or manual)
