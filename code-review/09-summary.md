# Summary & Recommended Priority

## Most impactful changes (high priority)

1. **Resolve dual storage** — Decide: IndexedDB-primary with server sync, or server-primary with IndexedDB cache. Then implement the sync layer and eliminate the duplicate code paths.

2. **Fix `/ide/:projectId` route** — Actually load project files from the storage backend when navigating to this route.

3. **Fix the example auto-fork** — Either actually fork when the user edits an example, or remove the misleading code.

4. **Delete duplicate files** — Remove `src/IconButton.tsx` (unused), remove the duplicate `NewProjectDialog` or merge them.

5. **Add error boundaries** — Wrap the app in a top-level `ErrorBoundary` to prevent white-screen-of-death.

## Medium priority

6. **Split `SpriteEditor.tsx`** — 1070 lines is too much. Split into at least a `spriteEditor/` directory.

7. **Split `SideMenu.tsx`** — Extract `ProjectsPanel`, `AssetsPanel`, `AssetTile`, `SettingsPanel` into separate files.

8. **Fix `interrupt()` race condition** — Wait for actual worker acknowledgment before resolving.

9. **Fix canvas flash on stop** — Don't hide canvas until interrupt is confirmed.

10. **Add server-side request validation** — Use zod for request body validation.

## Lower priority / nice to haves

11. **Add real drawing tests for SpriteEditor** — Test actual SVG export, not just button existence.

12. **Fix `defaultChecked` bug in Settings panel** — Change to `checked` + `onChange`.

13. **Remove dead code** — `forkCurrentExample`, `IdeState.assets` field, `lastSaveTime`, `createProjectRouter` in files.ts.

14. **Add `.env.example`** — Document `VITE_API_URL`.

15. **Update Pyodide to match npm version** — v0.29.3 vs v0.26.4 in worker.

16. **Add CSP headers** — Content-Security-Policy on the server.

17. **Audit CodeMirror overrides** — Check if still needed.

18. **`* { transition }` removal** — Remove global transition from index.css.
