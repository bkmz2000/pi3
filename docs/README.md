# pi3 Documentation

**[CLAUDE.md](../CLAUDE.md) is the authoritative quick-reference for architecture, commands, and conventions.** The files below are deeper-dive references.

---

## Current — verified against HEAD

| Doc | Description |
|-----|-------------|
| [api-v1.md](api-v1.md) | Graphics API changelog (authoritative; updated with every API change) |
| [pre-launch-smoke.md](pre-launch-smoke.md) | Manual smoke-test checklist |
| [audit-baseline.md](audit-baseline.md) | Phase-0 test baseline snapshot (historical record) |

---

## `reference/` — archived module specs

All 14 numbered docs have been moved to `reference/`. They were written **2026-04-30** and predate the API-v1 rework, error system, decomposition, and pixel editor. **Four have been fully rewritten; the rest carry a staleness banner.**

| # | Doc | Status |
|---|-----|--------|
| 01 | [Project Overview](reference/01-project-overview.md) | Archived — verify before use |
| 02 | [State Management](reference/02-state-management.md) | **Rewritten — accurate** |
| 03 | [Runner Module](reference/03-runner-module.md) | Archived — verify before use |
| 04 | [Graphics Module](reference/04-graphics-module.md) | **Rewritten — accurate** |
| 05 | [UI Components](reference/05-ui-components.md) | Archived — verify before use |
| 06 | [Storage & Persistence](reference/06-storage.md) | **Rewritten — accurate** |
| 07 | [Linter](reference/07-linter.md) | Archived — verify before use |
| 08 | [Sheet Editor (pixel)](reference/08-sprite-editor.md) | **Rewritten — accurate** |
| 09 | [PWA & Service Worker](reference/09-pwa.md) | Archived — verify before use |
| 10 | [Hooks](reference/10-hooks.md) | Archived — verify before use |
| 11 | [Internationalization](reference/11-i18n.md) | Archived — verify before use |
| 12 | [Code Editor](reference/12-code-editor.md) | Archived — verify before use |
| 13 | [Python Assets](reference/13-python-assets.md) | Archived — verify before use |
| 14 | [Pedagogy](reference/14-pedagogy.md) | Archived — verify before use |

---

## Quick reference

### Tech stack
- **Frontend:** React 19, TypeScript, Vite, Zustand, Tailwind (base), CodeMirror 6
- **Backend:** Express + better-sqlite3 + tsx
- **Python runtime:** Pyodide 0.29.3 (WASM, Web Worker)
- **Pixel canvas:** `SheetEditor.tsx` — 512×512 sheet, Sweetie 16 palette
- **Tile editor:** `TileEditor.tsx` — layer-based with area brushes
- **State:** `useEditor` (content) + `useIde` (UI/save) + `useRunnerStore` (worker)

### Data flow

```
User types → CodeMirror → useEditor.changeFile → dirtyFiles
Run click  → useRunnerStore → WorkerCommand → Pyodide → WorkerEvent → output
Save       → useIde.saveCurrentProject → API → IndexedDB cache
```

### Key source locations

| What | Where |
|------|-------|
| Routes | `src/App.tsx` |
| Editor store | `src/state/editorStore.ts` |
| IDE store | `src/state/IdeState.ts` |
| Runner store | `src/runner/RunnerProvider.tsx` |
| Worker commands/events | `src/runner/WorkerInterface.ts` |
| Graphics API | `src/assets/python/graphics/__init__.py` |
| API surface manifest | `src/assets/python/graphics/_manifest.py` |
| Error i18n keys | `src/assets/python/graphics/_errors.py` |
| Pixel editor | `src/SheetEditor.tsx` |
| Tile editor | `src/TileEditor.tsx` |
| Save utilities | `src/utils/storage.ts`, `src/utils/zip.ts` |
| Server routes | `server/index.ts` |

---

*Index updated 2026-06-13. CLAUDE.md is the single authoritative source for day-to-day codebase orientation.*
