# Audit Baseline — 2026-06-09

Recorded before the pi3 remediation plan is executed. All findings below are
pre-existing on the `main` branch at commit `05a7d0f`.

## Verification gate result

| Check | Status |
|-------|--------|
| `npm run typecheck` | ✅ pass |
| `npm run lint` | ❌ fail (pre-existing, fixed in Phase 0 commit) |
| `npm run test:ci` | ❌ fail (pre-existing, see below) |
| `npm run test:server:ci` | ✅ pass |

### Pre-existing lint errors (fixed in Phase 0)

- `src/TileEditor.tsx:598,639` — `useMemo` called after conditional `return null` (hooks-rules violation)
- `src/ProjectExplorer.tsx:744` — `onAddSprite`, `onAddSound` unused params
- `src/SheetEditor.tsx` — `SPRITE_LIBRARY`, `libFolder/setLibFolder`, `handleLibraryPick`, `addAssetInstance` unused
- `src/components/ErrorBoundary.tsx:48` — `react-refresh/only-export-components` on class-component file
- `src/hooks/useProjects.ts:10` — `createIdeProject` unused
- `.tsbuild/`, `coverage/` directories not in eslint ignore list

### Pre-existing test failures

**`tests/unit/ProjectExplorer.test.tsx`** — parse error:
```
SyntaxError: Cannot use 'import.meta' outside a module
  at src/runner/RunnerProvider.tsx:7910
```
Jest can't handle `import.meta.url` in `RunnerProvider.tsx`. This is a Jest
config gap, not a runtime bug.

**`tests/unit/useTheme.test.ts`** — assertion failure:
```
expect(theme).toBeDefined()  →  Received: undefined
```
Theme store test doesn't find the theme object. Pre-existing; unrelated to any
phase of the remediation plan.

### Pre-existing coverage threshold failures

```
global statements: 12.76% < 14% threshold
global branches:    8.57% < 11% threshold
global lines:      14.23% < 16% threshold
src/state/ branches: 34.24% < 39% threshold
```

The thresholds in `jest.config.cjs` are set above the actual coverage — floors
higher than the real numbers. This is a baseline defect that pre-dates this
audit.

## Production behavior (crossOriginIsolated / Stop button)

Production server does **not** set COOP/COEP headers. Verified:
- `crossOriginIsolated` → `false`
- `typeof SharedArrayBuffer` → `"undefined"`
- `while True: pass` + Stop → worker stuck; Run broken until page reload

Fix tracked in Phase 1.

## Pyodide version mismatch

- Installed package: `pyodide@0.29.3`
- CDN fallback hardcoded: `v0.26.4` (in `worker.ts` and `public/sw.js`)
- Service worker cache name: `webide-v3`

Fix tracked in Phase 2.

## Dead APIs in README

Lines 25, 37, 42, 73, 74 reference `get_coords`, `set_coords`, `point_to`,
`move_forward`, `mouse_x()`, `mouse_y()` — none exist in the current graphics
module.

Fix tracked in Phase 3.
