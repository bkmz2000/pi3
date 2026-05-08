# Testing Review

## 1. SpriteEditor tests only test button existence

`tests/unit/SpriteEditor.polygon.test.tsx` has 193 lines and 20+ tests. Every test checks "does button X exist" or "does button X have the right class". There are **zero tests** that:
- Simulate drawing a shape on canvas
- Verify SVG output from `onSave`
- Test undo/redo behavior
- Test SVG import (loading a sprite)
- Test tool switching with actual canvas interaction
- Test the polygon close/finish flow

The "polygon" test name is misleading — none of these tests exercise polygon logic.

## 2. Server tests are solid but duplicate fixture setup

The server API tests in `server/tests/api.test.ts` are well-structured and test real DB interactions. However, each `beforeEach` manually constructs user/project objects with inline SQL. This should use a test factory:
```ts
// Instead of:
db.prepare('INSERT INTO users ...').run(testUser1.id, testUser1.api_token, testUser1.name, now, now);

// Use:
const alice = createTestUser({ name: 'Alice' });
const project = createTestProject({ userId: alice.id });
```

## 3. Missing tests

- No tests for `IdeState.ts` store logic
- No tests for `utils/storage.ts` (IndexedDB CRUD)
- No tests for `utils/zip.ts` (zip import/export round-trip)
- No tests for `hooks/useAutoSave.ts`
- No tests for `hooks/useRunButton.ts`
- No component tests for `SideMenu`, `FileBar`, `CanvasWindow`, or any user components
- No E2E tests for the Pyodide runner (running Python code and checking output)

## 4. `fileBar.deleteConfirm` dialog is untestable

In `FileBar.tsx`, the file delete uses `window.confirm()`. This is non-blocking in testing contexts (JSDOM) and will always return `undefined`/falsy. Tests can never exercise the delete path without mocking `window.confirm`.
