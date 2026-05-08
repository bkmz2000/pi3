# State Management Issues

## 1. Zustand store `changeFile` doesn't actually auto-fork

Lines 104-121 in `IdeState.ts`:
```ts
if (s.currentProjectId === null) {
  const exampleName = Object.keys(Examples).find(
    (key) => Examples[key] === s.project,
  );
  if (exampleName) {
    // This will be handled by the component that calls changeFile
    // We'll just mark it as dirty for now
    ...
    return { project, dirtyFiles: dirty };
  }
}
```

The comment says "auto-fork" but nothing actually forks. The example stays in-place with dirty marked. If the user refreshes, changes are lost because `changeCurrentProject` is never called with a new ID.

## 2. Object reference comparison for example detection is fragile

```ts
const exampleName = Object.keys(Examples).find(
  (key) => Examples[key] === s.project,  // reference equality
);
```

This only works because Zustand `set` uses the immutable pattern. If `s.project` is ever a copy (from a save/restore), this breaks silently.

## 3. Shared `setTimeout`/`setInterval` without cleanup in production

`useAutoSave` creates a `setInterval` that runs `saveCurrentProject()` + `markClean()`. If the save fails (e.g., IndexedDB error), the `dirtyFiles` remain, and it will retry. But `markClean()` happens unconditionally — if save fails, dirty tracking is lost. The user won't know their changes weren't saved.

## 4. `interrupt()` uses both `postMessage` and `setTimeout` race

In `RunnerProvider.tsx` lines 323-352:
```ts
worker.postMessage({ cmd: "interrupt" });
if (interruptBuffer) {
  interruptBuffer[0] = 2;
  setTimeout(() => { interruptBuffer[0] = 0; }, 100);
}
useRunnerStore.getState().stop();
setTimeout(() => { resolve(); }, 100);
```

Three things happen concurrently: worker message, interrupt buffer write, and store update. The `setTimeout` resolves before the `interrupt_ack` might arrive. The `interruptBuffer` is cleared after 100ms regardless. If Pyodide takes longer to interrupt, the buffer is already zeroed.

## 5. `lastSaveTime` written but never read

The `lastSaveTime` field in `IdeState` and `updateLastSaveTime()` action are set on save but never read by any component or logic.
