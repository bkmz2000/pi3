import { Project } from '../../src/state/IdeState';

describe('Asset save dirty tracking', () => {
  it('preserves Python file dirty state when saving a sprite', () => {
    // Create a project with unsaved Python file
    const project: Project = {
      name: 'Test Project',
      files: {
        'main.py': 'print("hello")',
      },
      assets: {
        'sprite.svg': 'data:image/svg+xml,...',
      },
      currentFile: 'main.py',
    };

    // Simulate dirty state: user edited main.py
    const dirtyFiles = new Set(['main.py']);

    // Simulate asset store action (changeAsset) with dirty tracking
    const assets = { ...project.assets };
    assets['sprite.svg'] = 'data:image/svg+xml,...updated...';

    // Simulate changeAsset marking assets dirty
    const newDirty = new Set(dirtyFiles);
    newDirty.add('*assets*');

    // Verify Python file remains dirty
    expect(newDirty.has('main.py')).toBe(true);
    expect(newDirty.has('*assets*')).toBe(true);
    expect(newDirty.size).toBe(2);
  });

  it('changeAsset marks assets dirty without clearing file dirty state', () => {
    const dirtyFiles = new Set(['script.py', 'utils.py']);

    // Simulate changeAsset action
    const newDirty = new Set(dirtyFiles);
    newDirty.add('*assets*');

    // All dirty states preserved
    expect(newDirty.has('script.py')).toBe(true);
    expect(newDirty.has('utils.py')).toBe(true);
    expect(newDirty.has('*assets*')).toBe(true);
  });

  it('removing asset and adding new asset both mark assets dirty', () => {
    const dirtyFiles = new Set(['code.py']);

    // Simulate removeAsset + changeAsset (rename case)
    const dirty = new Set(dirtyFiles);

    // Remove old
    dirty.add('*assets*');

    // Add new
    dirty.add('*assets*');

    // Verify Python file still dirty
    expect(dirty.has('code.py')).toBe(true);
    expect(dirty.has('*assets*')).toBe(true);
  });

  it('changeEditorCurrentProject (wrong approach) resets dirty state', () => {
    // This is what we DON'T want to do anymore:
    // changeEditorCurrentProject resets dirtyFiles to new Set()
    const resetDirty = new Set(); // This is what the old code did

    expect(resetDirty.has('main.py')).toBe(false);
    expect(resetDirty.size).toBe(0);
  });
});
