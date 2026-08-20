/**
 * editorStore: the editor half of IDE state — project contents, current
 * file, dirty tracking. Tests the copy-on-write example clone, dirty-set
 * lifecycle (edit→save→clean), rename, asset/tilemap/sound ops, and the
 * session-id assignment for anonymous edits.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { useEditor } from '../../src/state/editorStore';
import { EXAMPLE_SESSION_PREFIX } from '../../src/state/sessionId';

beforeEach(() => {
  // Reset to the hello-world example default between tests.
  useEditor.setState({
    currentProjectId: null,
    currentFile: 'main.py',
    dirtyFiles: new Set(),
    queuedSaveCount: 0,
  });
});

describe('changeFile (dirty tracking + copy-on-write)', () => {
  test('editing an example clones it into an example session and marks dirty', () => {
    useEditor.getState().changeFile('main.py', 'print(2)');
    const s = useEditor.getState();
    expect(s.currentProjectId).toBe(EXAMPLE_SESSION_PREFIX + 'hello world');
    expect(s.dirtyFiles.has('main.py')).toBe(true);
    expect(s.project.files['main.py']).toBe('print(2)');
  });

  test('editing a named project does not change its id', () => {
    useEditor.setState({ currentProjectId: 'proj-1' });
    useEditor.getState().changeFile('main.py', 'print(3)');
    const s = useEditor.getState();
    expect(s.currentProjectId).toBe('proj-1');
    expect(s.dirtyFiles.has('main.py')).toBe(true);
  });

  test('saveFile clears the dirty flag for that file only', () => {
    useEditor.getState().changeFile('main.py', 'x');
    useEditor.getState().changeFile('other.py', 'y');
    useEditor.getState().saveFile('main.py');
    const s = useEditor.getState();
    expect(s.dirtyFiles.has('main.py')).toBe(false);
    expect(s.dirtyFiles.has('other.py')).toBe(true);
  });

  test('markClean clears the whole dirty set or specific keys', () => {
    useEditor.getState().changeFile('a.py', 'x');
    useEditor.getState().changeFile('b.py', 'y');
    useEditor.getState().markClean(new Set(['a.py']));
    expect(useEditor.getState().dirtyFiles.has('a.py')).toBe(false);
    expect(useEditor.getState().dirtyFiles.has('b.py')).toBe(true);

    useEditor.getState().changeFile('c.py', 'z');
    useEditor.getState().markClean();
    expect(useEditor.getState().dirtyFiles.size).toBe(0);
  });
});

describe('file management', () => {
  test('renameFile updates the key, keeps content, and retargets currentFile', () => {
    const before = useEditor.getState().project.files['main.py'];
    useEditor.getState().renameFile('main.py', 'game.py');
    const s = useEditor.getState();
    expect(s.project.files['game.py']).toBe(before);
    expect('main.py' in s.project.files).toBe(false);
    expect(s.currentFile).toBe('game.py');
  });

  test('deleteFile removes the file', () => {
    useEditor.getState().deleteFile('main.py');
    expect('main.py' in useEditor.getState().project.files).toBe(false);
  });

  test('changeCurrentFile updates the active tab', () => {
    useEditor.getState().changeCurrentFile('other.py');
    expect(useEditor.getState().currentFile).toBe('other.py');
  });
});

describe('asset / tilemap / sound / sheet ops', () => {
  test('changeAsset sets a url and marks *assets* dirty', () => {
    useEditor.getState().changeAsset('hero.png', 'data:x');
    const s = useEditor.getState();
    expect(s.project.assets['hero.png']).toBe('data:x');
    expect(s.dirtyFiles.has('*assets*')).toBe(true);
  });

  test('saveTilemap stores the tilemap and marks dirty', () => {
    const data = { layers: [] } as never;
    useEditor.getState().saveTilemap('map1', data);
    const s = useEditor.getState();
    expect(s.project.tilemaps['map1']).toBe(data);
    expect(s.dirtyFiles.has('*tilemaps*')).toBe(true);
  });

  test('addSound stores the sound and marks dirty', () => {
    useEditor.getState().addSound('jump', 'data:snd');
    const s = useEditor.getState();
    expect(s.project.sounds['jump']).toBe('data:snd');
    expect(s.dirtyFiles.has('*sounds*')).toBe(true);
  });

  test('setSheet replaces the sheet and marks dirty', () => {
    const sheet = { width: 8, height: 8, pixels: '', sprites: {} } as never;
    useEditor.getState().setSheet(sheet);
    const s = useEditor.getState();
    expect(s.project.sheet).toBe(sheet);
    expect(s.dirtyFiles.has('*sheet*')).toBe(true);
  });
});

describe('queued save counter', () => {
  test('increment/decrement track pending offline saves', () => {
    useEditor.getState().incrementQueuedSaves();
    useEditor.getState().incrementQueuedSaves();
    expect(useEditor.getState().queuedSaveCount).toBe(2);
    useEditor.getState().decrementQueuedSaves();
    expect(useEditor.getState().queuedSaveCount).toBe(1);
  });
});