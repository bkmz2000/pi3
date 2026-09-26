# Storage & Persistence Reference

**Verified against:** `src/utils/storage.ts`, `src/utils/zip.ts`, `src/state/IdeState.ts`, `server/`

---

## Overview

The app uses these persistence layers:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Server** | Express + SQLite (`server/`) | Primary durable storage for logged-in users |
| **IndexedDB** | `ProjectStorage` (`src/utils/storage.ts`) | Offline cache, retry queue, and independent local drafts; recovery only, not an off-device backup |
| **localStorage** | `src/utils/anonStash.ts` | Legacy single-stash migration source only |

The UI distinguishes a project **on this device** from one **saved to the account**. Browser storage may be cleared or lost and is never described as a backup.

---

## Server API (primary durable storage)

**Route:** `PUT /api/projects/:id/save` (`saveProjectContent` in `src/state/api.ts`)

Payload:
```typescript
{
  files: Record<string, string>;
  assets: Record<string, string>;
  tilemaps: Record<string, TilemapData>;
  sounds: Record<string, string>;
  sheet?: EncodedSheet;
  currentFile: string;
}
```

The sheet is sparse-chunk-encoded before sending (`encodeSheet` in `sheetCodec.ts`); empty chunks are omitted for sparse sheets. Project revisions are loaded from the API and submitted with `If-Match`; a save is treated as durable only after a subsequent read returns the expected revision and matching project content.

### Save states and failure handling

`saveCurrentProject` returns `Promise<boolean>`. A successful local write is not a cloud save:

| Condition | Behavior | User state |
|-----------|----------|------------|
| Anonymous/example project | Persist a separate IndexedDB draft | On this device — not backed up |
| Offline | Persist locally and retain a versioned queued save for later sync | Offline/local; not cloud-saved |
| Auth failure or revision conflict | Keep local recovery data; do not overwrite the remote project | Local recovery/error state |
| Payload or verification failure | Keep the dirty state and local recovery copy | Error; not cloud-saved |
| Verified server write/read-back | Advance the known revision and clear only edits represented by that verified snapshot | Saved to account |

Each queued row is a complete snapshot and carries a tab-local writer ID. A newer offline save coalesces only older snapshots from that same tab; independent tabs keep separate rows and their captured server revisions. After a verified write, only causally related same-tab rows may be rebased. Legacy or versionless rows whose provenance/baseline is ambiguous are copied into deterministic anonymous recovery drafts before their queue rows are removed. Conflicts/auth failures likewise become recovery drafts before removal; network and read-back verification failures retain the queue. Never infer a snapshot's `If-Match` baseline from another tab's cache revision.

---

## IndexedDB (`ProjectStorage`)

**File:** `src/utils/storage.ts`  
**Database:** `WebIDE`, schema version 4

Stores include `projectMeta`, `projectContent`, `saveQueue`, and `anonymousDrafts`. Existing stores and rows must not be deleted or cleared during upgrades.

### Key methods

```typescript
// Project list metadata and full-content offline cache
projectStorage.cacheProjectMeta(projects)
projectStorage.getCachedProjectMeta() -> Promise<Record<string, unknown>[]>
projectStorage.cacheProjectContent(id, content)
projectStorage.getCachedProjectContent(id) -> Promise<ProjectContent | null>

// Independent local drafts
projectStorage.saveAnonymousDraft(draft)
projectStorage.getAnonymousDraft(id) -> Promise<AnonymousDraft | null>
projectStorage.listAnonymousDrafts() -> Promise<AnonymousDraft[]>
projectStorage.deleteAnonymousDraft(id)

// Versioned offline retry queue
projectStorage.queueSave(content)
projectStorage.getQueuedSaves()
projectStorage.removeQueuedSave(queueId)

// ZIP export
projectStorage.downloadProjectZip(id)
```

The cache may be used to reopen a project offline, but it does not satisfy the durable **Saved** contract. Keep a clear local-only status until server verification succeeds or the student completes a ZIP export.

### Upgrade and legacy recovery

The previously released v3 database uses `projectMeta`, `projectContent`, and `saveQueue`; upgrades must preserve their rows. Migration copies only records from a legacy `projects` store that is actually present (the retained v1/v2 schema used `keyPath: id`). It iterates with a cursor, preserves the original store, and copies content-bearing records into recoverable drafts/full-content cache while metadata-only records remain metadata-only. Existing destination records win collisions; migration must remain safe when `anonymousDrafts` already exists.

The v2 release explicitly cleared the legacy `projects` store. Data already erased by that historical upgrade is unrecoverable; do not fabricate a replacement v3 `projects` store or infer deleted records from a synthetic fixture. Migration tests should model released v1/v2 and actual v3 store layouts.

### Offline flow

1. `saveCurrentProject` writes a full local recovery copy before attempting a server save.
2. If offline, it adds a versioned queued record and displays a local/offline status.
3. On reconnect, `syncQueuedSaves()` selects the newest complete snapshot per project/tab, sends its captured revision, verifies server revision/content, and finalizes only rows from the same writer.
4. Ambiguous legacy/versionless snapshots and conflicts/auth failures are preserved as anonymous recovery drafts before queue removal; network or verification failures keep the queue. All such states remain visibly non-durable.

---

## Anonymous drafts

**Files:** `src/utils/storage.ts`, `src/utils/anonStash.ts`, `src/state/sessionId.ts`

Anonymous example sessions and standalone projects are stored as separate records in IndexedDB's `anonymousDrafts` store. Standalone draft IDs use `ANON_DRAFT_PREFIX`; example sessions use `EXAMPLE_SESSION_PREFIX`. The Projects page lists local drafts and the editor can reopen them. On a fresh `/ide` visit, the app restores the newest local draft when no explicit project route is selected.

The historical `pi3_anon_stash` localStorage value is migrated into IndexedDB. The legacy key is removed only after the IndexedDB copy succeeds. Local drafts are still browser/profile/device-local recovery copies. Export them or claim/sync them to an account for durable protection.

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
projectToZip(project: StoredProject) -> Promise<Uint8Array>
zipToProject(input: ArrayBuffer | Uint8Array, defaults?) -> Promise<StoredProject>
downloadProjectZip(project, filename?) -> Promise<void>
```

---

## Session and draft IDs

**File:** `src/state/sessionId.ts`

- `EXAMPLE_SESSION_PREFIX` identifies a locally edited built-in example session.
- `ANON_DRAFT_PREFIX` identifies a standalone anonymous project/recovery copy.
- These IDs are browser-local keys, not server project IDs. The current project ID determines whether saving uses IndexedDB or the account API.
- The historical `pi3_anon_stash` is migrated to a distinct deterministic recovery ID; an existing destination is retained rather than overwritten.

---

## Auto-save

**File:** `src/hooks/useAutoSave.ts`

- Debounced: 3 seconds after the last change, then every 60 seconds while dirty.
- Calls `useIde.getState().saveCurrentProject()`.
- Only fires when `dirtyFiles.size > 0`.
- The save action owns snapshot-aware dirty cleanup; the hook does not clear dirty keys after the promise resolves.
- Automatic retries pause on payload and revision-conflict errors until the user explicitly resolves/retries.

---

*Release authority and unresolved durability requirements are maintained in [Deployment and Project Data Safety Policy](../deployment-data-safety.md).*
