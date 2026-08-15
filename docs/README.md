# pi3 Documentation

**[CLAUDE.md](../CLAUDE.md) is the canonical, source-of-truth guide** for architecture, commands,
conventions, the student graphics API, linter, runner internals, sprite editor, instructor
sharing, common pitfalls, and agent instructions. **[AGENTS.md](../AGENTS.md) is a thin entry
point** that points here and carries the Knowledge Base (mem0) instructions.

---

## Current — verified against HEAD

| Doc | Description |
|-----|-------------|
| [api-v1.md](api-v1.md) | Graphics API changelog (authoritative; updated with every API change) |
| [pre-launch-smoke.md](pre-launch-smoke.md) | Manual smoke-test checklist |
| [audit-baseline.md](audit-baseline.md) | Phase-0 test baseline snapshot (historical record) |
| [doctrine.md](doctrine.md) | Safety & Privacy doctrine (Core / institutional / public) |
| [design-language.md](design-language.md) | Visual/UX tokens and idioms |
| [ROADMAP.md](ROADMAP.md) | Shipped / in-progress / planned features |
| [reconciliation-phase0-findings.md](reconciliation-phase0-findings.md) | Historical branch reconciliation record |
| [compete-design-deviations.md](compete-design-deviations.md) | Compete-mode vs design-language deviations |

## `reference/` — live module specs (verified against HEAD)

| Doc | Status |
|-----|--------|
| 02 | [State Management](reference/02-state-management.md) | Corrected 2026-08-14 (PanelId, WorkerEvent list, severity). |
| 04 | [Graphics Module](reference/04-graphics-module.md) | Corrected 2026-08-14 (`__all__`, Polar, Timer, anchors, velocity, Light attrs). **Canonical graphics API reference.** |
| 06 | [Storage & Persistence](reference/06-storage.md) | Corrected 2026-08-14 (save route, autosave, session prefix). |
| 08 | [Sheet Editor (pixel)](reference/08-sprite-editor.md) | Accurate. |

> Archived reference docs (01, 03, 05, 07, 09-14) and the `graphics-api-design.md` draft were
> **deleted 2026-08-14** — they predated the API-v1 rework and duplicated live content. Their
> unique content was folded into [CLAUDE.md](../CLAUDE.md).

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

    User types -> CodeMirror -> useEditor.changeFile -> dirtyFiles
    Run click  -> useRunnerStore -> WorkerCommand -> Pyodide -> WorkerEvent -> output
    Save       -> useIde.saveCurrentProject -> API -> IndexedDB cache

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

*Index updated 2026-08-14. CLAUDE.md is the single authoritative source for day-to-day codebase orientation.*
