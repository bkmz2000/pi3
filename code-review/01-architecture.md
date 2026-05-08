# Architecture Review

## 1. Dual Storage Systems — the biggest problem

There are **two completely independent storage backends** that don't know about each other:

| System | Location | Technology |
|--------|----------|------------|
| Local/PWA | `utils/storage.ts` | IndexedDB |
| Server | `server/` | SQLite via Express |

The `useIde` Zustand store (`state/IdeState.ts`) talks to IndexedDB. The `state/useProjects.ts` Zustand store and `state/api.ts` talk to the server. They are never synced.

**Consequence**: A project created offline (IndexedDB) never appears on the server. A project created on the server never appears in IndexedDB. The `/projects` page uses the server API; the side panel "projects" panel uses IndexedDB. Users get different lists in different places.

**Fix**: Decide which is primary (server with IndexedDB as cache, or IndexedDB with server sync) and implement a clear sync strategy. For an educational tool targeting offline-capable use, IndexedDB-first with background server sync would make sense.

## 2. Route `/ide/:projectId` doesn't load project content

`App.tsx` route `/ide/:projectId` renders `AppInner` but there's no effect that reads the `projectId` param and loads files. The `state/useProjects.ts` `loadProject()` creates an **empty** project shell:

```ts
const editorProject: Project = {
  name: project.name,
  files: {},   // ← empty!
  assets: {},  // ← empty!
};
```

So navigating to `/ide/some-id` shows a blank editor. The actual file contents live in the SQLite `files` table but are never fetched.

## 3. Two `useProjects` hooks — conflicting paths

| File | Purpose |
|------|---------|
| `src/hooks/useProjects.ts` | Wraps `useIde` store (IndexedDB) |
| `src/state/useProjects.ts` | Zustand store talking to REST API |

Both are named `useProjects`. The first is used by `SideMenu.tsx` (the side panel showing projects). The second is used by `ProjectsPage.tsx`. They share no state.

## 4. `forkCurrentExample` defined but never called

`IdeState.ts` lines 299-316 define a `forkCurrentExample` action in the store but it is never invoked anywhere. Dead code.

## 5. No error boundaries

Zero React error boundaries anywhere. If any component throws during render, the entire app goes white. The `Suspense` around `SpriteEditor` only catches lazy-load, not render errors.
