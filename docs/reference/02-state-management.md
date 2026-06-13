# State Management Reference

**Verified against:** `src/state/` at HEAD

---

## Store layout

The state is split across multiple files. `IdeState.ts` re-exports everything; existing imports still work.

| File | Store / export | Purpose |
|------|---------------|---------|
| `editorStore.ts` | `useEditor` | Project content, active file, dirty tracking, file/asset/tilemap/sound/sheet CRUD |
| `IdeState.ts` | `useIde` | UI state, user project list, save orchestration, settings |
| `exampleProjects.ts` | `Examples` | Built-in example map |
| `projectTypes.ts` | types | `Project`, `TilemapData`, `SheetData`, `SheetAnimationStrip`, etc. |
| `sessionId.ts` | helpers | `EXAMPLE_SESSION_PREFIX`, `isExampleSessionId`, `exampleNameFromSessionId` |
| `RunnerProvider.tsx` | `useRunnerStore` | Worker state: ready, running, output, lint errors, canvas |

---

## Editor store (`useEditor`)

**File:** `src/state/editorStore.ts`

### State shape

```typescript
type EditorState = {
  currentFile: string;
  project: Project;
  currentProjectId: string | null;
  dirtyFiles: Set<string>;
  // ... actions
}
```

### Project type

```typescript
interface Project {
  files: Record<string, string>;      // filename → content
  assets: Record<string, string>;     // name → dataURL
  tilemaps?: Record<string, TilemapData>;
  sounds?: Record<string, string>;    // name → dataURL
  sheet?: SheetData;                  // pixel sprite sheet
  currentFile?: string;
  name?: string;
}
```

### Actions

| Action | Signature | Notes |
|--------|-----------|-------|
| `changeCurrentFile` | `(name) → void` | Switch active tab |
| `changeCurrentProject` | `(project, projectId?) → void` | Load project, resets dirty set |
| `changeFile` | `(name, text) → void` | Edit file; copy-on-write clones example on first edit |
| `saveFile` | `(name) → void` | Remove file from dirty set |
| `deleteFile` | `(name) → void` | Remove file from project |
| `renameFile` | `(oldName, newName) → void` | Rename in-place |
| `changeAsset` | `(name, url) → void` | Set asset by exact key |
| `toggleAsset` | `(name, url) → void` | Add if absent, remove if present |
| `addAssetInstance` | `(baseName, url) → void` | Add with auto-numbered key if collision |
| `removeAsset` | `(instanceName) → void` | Delete by exact key |
| `saveTilemap` | `(name, data) → void` | Save/replace tilemap |
| `deleteTilemap` | `(name) → void` | Remove tilemap |
| `addSound` | `(name, url) → void` | Add sound with auto-numbered key if collision |
| `removeSound` | `(name) → void` | Remove sound |
| `setSheet` | `(data) → void` | Replace the full pixel sprite sheet |
| `markClean` | `(keys?: Iterable<string>) → void` | Clear dirty flags; if keys provided, only those keys |

### Dirty tracking

`dirtyFiles` is a `Set<string>`. File edits add the filename; asset/tilemap/sound changes add sentinel keys (`"*assets*"`, `"*tilemaps*"`, `"*sounds*"`, `"*sheet*"`). `markClean(keys)` accepts the exact set of keys that were saved, preventing a race where an in-flight edit lands during a save.

### Copy-on-write example cloning

`changeFile` checks `currentProjectId === null` (pure example). On first edit:
1. Clones the example project (new object, same content)
2. Assigns `currentProjectId = EXAMPLE_SESSION_PREFIX + exampleName`
3. The session ID signals the app to use `writeAnonStash` for saves (no API call required)

Asset/tilemap/sound mutations also auto-assign a session ID via `ensureSessionId()`.

---

## IDE store (`useIde`)

**File:** `src/state/IdeState.ts`

### State shape

```typescript
type IdeState = {
  activePanel: PanelId;               // "projects" | "settings" | "docs" | "examples" | null
  projects: Record<string, Project>;  // built-in examples
  userProjects: ApiProject[];         // server-fetched list
  loading: boolean;
  showHitboxes: boolean;              // persisted in localStorage
  showConsoleOnRun: boolean;          // persisted in localStorage
  enableLinting: boolean;             // persisted in localStorage
  enableAutocomplete: boolean;        // persisted in localStorage
  consoleOnRight: boolean;            // persisted in localStorage
  loadingProjectContent: boolean;
  saveError: SaveError | null;
  fromCache: boolean;                 // true when userProjects loaded from IndexedDB fallback
  isSaving: boolean;
}
```

### Actions

| Action | Signature | Notes |
|--------|-----------|-------|
| `setActivePanel` | `(panel) → void` | |
| `togglePanel` | `(panel) → void` | Closes if already open |
| `closePanels` | `() → void` | |
| `loadUserProjects` | `() → Promise<void>` | API call; falls back to IndexedDB cache |
| `createNewProject` | `(name) → Promise<ApiProject>` | Server create |
| `deleteUserProject` | `(id) → Promise<void>` | Server delete |
| `renameUserProject` | `(id, newName) → Promise<void>` | Server update |
| `forkExample` | `(name, project, newName?) → Promise<ApiProject>` | Server create from example content |
| `saveCurrentProject` | `() → Promise<boolean>` | See below |
| `syncQueuedSaves` | `() → Promise<void>` | Drain offline queue |
| `downloadProject` | `(id) → Promise<void>` | Download as ZIP |
| `downloadAsHtml` | `() → Promise<void>` | Download as standalone HTML |
| `importProjectFromFile` | `(file) → Promise<ApiProject>` | Import ZIP; creates on server |
| `setSaveError` | `(error) → void` | |
| `setShowHitboxes` | `(show) → void` | localStorage + state |
| `setShowConsoleOnRun` | `(show) → void` | localStorage + state |
| `setEnableLinting` | `(enable) → void` | localStorage + state |
| `setEnableAutocomplete` | `(enable) → void` | localStorage + state |
| `setConsoleOnRight` | `(v) → void` | localStorage + state |

### `saveCurrentProject` flow

Returns `Promise<boolean>` — `true` means dirty set may be cleared; `false` means keep dirty (permanent failure).

```
currentProjectId null?
  → false (no-op)

isExampleSessionId(currentProjectId)?
  → writeAnonStash (localStorage) → sets saveError on quota failure

isOnline()?
  No → queueSave to IndexedDB → saveError "network" → return true (soft success)
  Yes → saveProjectContent(API)
        success → clear saveError, update userProjects list
        4xx (non-401) → saveError "payload", return false  (keep dirty)
        401 → writeAnonStash fallback, saveError "auth", return true
        network error → queueSave to IndexedDB, saveError "network", return true
```

`saveError` carries `{ kind: "auth" | "network" | "quota" | "payload", message: string }`.

### Offline queue (`syncQueuedSaves`)

Called on reconnect. Drains `projectStorage.getQueuedSaves()`, calls the API for each, removes on success. Stops on first failure.

---

## Runner store (`useRunnerStore`)

**File:** `src/runner/RunnerProvider.tsx`

### State shape

```typescript
interface RunnerState {
  ready: boolean;
  running: boolean;
  output: OutputLine[];
  lintErrors: LintDiagnostic[];
  canvasDimensions: { width: number; height: number };
  workerEpoch: number;   // increments on hard-kill to force canvas remount
}
```

### Worker events (`WorkerEvent`)

```typescript
{ type: "ready" }
{ type: "start" }
{ type: "stdout"; text: string }
{ type: "stderr"; text: string }
{ type: "result" }
{ type: "error"; error: string }
{ type: "runtime_error"; structured: RuntimeError }
{ type: "input_request"; prompt: string }
{ type: "lint"; diagnostics: LintDiagnostic[] }
{ type: "interrupt_ack" }
```

### `LintDiagnostic`

```typescript
interface LintDiagnostic {
  code: string;
  messageKey: string;             // i18n key; validated by friendlyErrorI18n.test.ts
  messageArgs: Record<string, string | number>;
  row: number;     // 0-indexed
  column: number;
  endRow: number;
  endColumn: number;
  severity: "error";
}
```

---

## Selector pattern

Zustand selectors at call site — no centralized selector file:

```typescript
const currentFile = useEditor(s => s.currentFile);
const isDirty = useEditor(s => s.dirtyFiles.size > 0);
const { running } = useRunnerStore();

// One-off reads outside React (in async actions):
const { currentProjectId, project } = useEditor.getState();
```

---

*Verified against live source at HEAD.*
