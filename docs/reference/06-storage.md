# Storage & Persistence Reference

**Verified against:** `src/utils/storage.ts`, `src/utils/zip.ts`, `src/state/IdeState.ts`, `server/` at HEAD

---

## Overview

The app uses three persistence layers in priority order:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Server** | Express + SQLite (`server/`) | Primary storage for logged-in users |
| **IndexedDB** | `ProjectStorage` (`src/utils/storage.ts`) | Offline cache + save queue |
| **localStorage** | `writeAnonStash` | Anonymous-session stash for example edits |

---

## Server API (primary)

**Route:** `PUT /api/projects/:id/save` (`saveProjectContent` in `src/state/api.ts`)

Payload:
```typescript
{
  files: Record<string, string>;
  assets: Record<string, string>;       // name → dataURL
  tilemaps: Record<string, TilemapData>;
  sounds: Record<string, string>;
  sheet?: EncodedSheet;                 // sparse-chunk format (see sheetCodec.ts)
  currentFile: string;
}
```

The sheet is sparse-chunk-encoded before sending (`encodeSheet` in `sheetCodec.ts`). Empty 32×32 regions are omitted; this shrinks a typical 512×512 sheet by 10–30× before gzip.

### Error handling in `saveCurrentProject`

`saveCurrentProject` returns `Promise<boolean>`:

| Condition | `saveError.kind` | Returns | Dirty set |
|-----------|-----------------|---------|-----------|
| Offline | `"network"` (queue) | `true` | cleared |
| 401 Unauthorized | `"auth"` (anon stash) | `true` | cleared |
| 4xx other (e.g. 413) | `"payload"` | `false` | **kept dirty** |
| network error | `"network"` (queue) | `true` | cleared |
| Success | — | `true` | cleared |

`"payload"` errors do **not** queue (retrying won't help) and do **not** clear dirty, so the user keeps seeing the save chip.

---

## IndexedDB (`ProjectStorage`)

**File:** `src/utils/storage.ts`  
**Singleton:** `export const projectStorage`

### Databases

| DB | Purpose |
|----|---------|
| `WebIDE` | Project metadata cache (list view) |
| `WebIDE-content` | Full project content cache + save queue |

### Key methods

```typescript
// Metadata cache (for offline project list)
projectStorage.cacheProjectMeta(projects)
projectStorage.getCachedProjectMeta() → Promise<Record[]>

// Full content cache (for offline editing)
projectStorage.cacheProjectContent(id, content)
projectStorage.getCachedContent(id)

// Offline save queue
projectStorage.queueSave({ id, files, assets, tilemaps, sounds, sheet, currentFile, savedAt })
projectStorage.getQueuedSaves()
projectStorage.removeQueuedSave(queueId)

// ZIP download (from server or cache)
projectStorage.downloadProjectZip(id)
```

### Offline flow

1. `saveCurrentProject` detects offline (`isOnline()` returns false)
2. Calls `queueSave` → written to `WebIDE-content` object store
3. Shows `saveError { kind: "network" }` — user sees "Offline — saved locally"
4. On reconnect, `syncQueuedSaves()` is called — drains the queue in order, calls API for each, removes on success

---

## ZIP format

**File:** `src/utils/zip.ts`

Used for project export/download and import.

### Structure

```
project.zip
├── project.json      # manifest
├── files/
│   ├── main.py
│   └── ...
├── assets/
│   ├── sprite.png
│   └── ...
├── tilemaps/
│   └── level.json
└── sounds/
    └── pop.mp3
```

### Manifest (`project.json`)

```typescript
interface ProjectManifest {
  id: string;
  name: string;
  updatedAt: string;
  currentFile?: string;
  files: string[];
  assets: string[];
  tilemaps?: string[];
  sounds?: string[];
}
```

### Key functions

```typescript
projectToZip(project: StoredProject) → Promise<Uint8Array>
zipToProject(input: ArrayBuffer | Uint8Array, defaults?) → Promise<StoredProject>
downloadProjectZip(project, filename?) → Promise<void>
```

---

## Anonymous stash (`writeAnonStash`)

**File:** `src/utils/anonStash.ts`

Used when the user edits an example or is not logged in. Writes to `localStorage` keyed by `exampleName`. On login, the app checks the stash and offers to fork-and-claim the content.

`writeAnonStash` returns `{ ok: boolean; reason?: "quota" | "unavailable" }`. A `"quota"` result surfaces `saveError { kind: "quota" }`.

---

## Auto-save

**File:** `src/hooks/useAutoSave.ts`

- Debounced: 3 s after last change (DEBOUNCE_MS), then every 60 s while dirty (AUTO_SAVE_INTERVAL = 60000)
- Calls `useIde.getState().saveCurrentProject()`
- Only fires when `dirtyFiles.size > 0`
- Clears dirty set with `markClean(keys)` on success (key-specific, race-safe)

---

## Session IDs

**File:** `src/state/sessionId.ts`

```typescript
EXAMPLE_SESSION_PREFIX = "__example_session_"
isExampleSessionId(id) → boolean
exampleNameFromSessionId(id) → string
```

A `currentProjectId` starting with `"__example_session_"` triggers the anon-stash path in `saveCurrentProject`. Real server projects have numeric IDs assigned by the API.

---

*Verified against live source at HEAD. The save-flow contract is pinned by `tests/unit/` T1/T2 suites.*
