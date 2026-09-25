import 'fake-indexeddb/auto';
import { migrateLegacyAnonStash } from '../../src/utils/anonStash';

it('migrates the legacy stash to a distinct draft without overwriting newer IndexedDB work', async () => {
  const project = {
    name: 'Old anonymous work',
    files: { 'main.py': 'print("preserve me")' },
    assets: { 'sprite.png': 'data:image/png;base64,abc' },
    tilemaps: {},
    sounds: {},
  };
  const newerDraft = {
    id: '__example_session_legacy-example',
    exampleName: 'legacy-example',
    project: { ...project, files: { 'main.py': 'print("newer IndexedDB work")' } },
    lastModified: 5678,
  };

  // Seed the destination schema before importing ProjectStorage's singleton.
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('WebIDE', 4);
    request.onupgradeneeded = () => request.result.createObjectStore('anonymousDrafts', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  const tx = db.transaction('anonymousDrafts', 'readwrite');
  tx.objectStore('anonymousDrafts').put(newerDraft);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  localStorage.setItem('pi3_anon_stash', JSON.stringify({
    v: 1,
    exampleName: 'legacy-example',
    project,
    lastModified: 1234,
  }));

  await expect(migrateLegacyAnonStash()).resolves.toBe(true);
  expect(localStorage.getItem('pi3_anon_stash')).toBeNull();

  const { projectStorage } = await import('@/utils/storage');
  await expect(projectStorage.getAnonymousDraft(newerDraft.id)).resolves.toEqual(newerDraft);
  const migratedId = '__anon_draft_migrated_legacy_legacy-example_1234';
  const migrated = {
    id: migratedId,
    exampleName: 'legacy-example',
    project,
    lastModified: 1234,
  };
  await expect(projectStorage.getAnonymousDraft(migratedId)).resolves.toEqual(migrated);

  // If the old key reappears after the migrated draft has since been edited,
  // the deterministic destination must not be overwritten by the stale stash.
  const newerMigrated = {
    ...migrated,
    project: { ...project, files: { 'main.py': 'print("newer migrated edits")' } },
    lastModified: 5678,
  };
  await projectStorage.saveAnonymousDraft(newerMigrated);
  localStorage.setItem('pi3_anon_stash', JSON.stringify({
    v: 1, exampleName: 'legacy-example', project, lastModified: 1234,
  }));
  await expect(migrateLegacyAnonStash()).resolves.toBe(true);
  expect(localStorage.getItem('pi3_anon_stash')).toBeNull();
  await expect(projectStorage.getAnonymousDraft(migratedId)).resolves.toEqual(newerMigrated);
  await expect(projectStorage.getAnonymousDraft(newerDraft.id)).resolves.toEqual(newerDraft);
});
