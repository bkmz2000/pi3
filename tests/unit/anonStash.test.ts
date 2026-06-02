import { readAnonStash, writeAnonStash, clearAnonStash } from '../../src/utils/anonStash';
import type { Project } from '../../src/state/IdeState';

const sampleProject: Project = {
  files: { 'main.py': 'print(1)' },
  assets: {},
  tilemaps: {},
  animations: {},
  sounds: {},
};

describe('anonStash', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no stash present', () => {
    expect(readAnonStash()).toBeNull();
  });

  it('writes and reads back project + exampleName', () => {
    writeAnonStash({ exampleName: 'snake', project: sampleProject });
    const stash = readAnonStash();
    expect(stash).not.toBeNull();
    expect(stash!.exampleName).toBe('snake');
    expect(stash!.project.files['main.py']).toBe('print(1)');
    expect(stash!.v).toBe(1);
    expect(typeof stash!.lastModified).toBe('number');
  });

  it('clears the stash', () => {
    writeAnonStash({ exampleName: 'snake', project: sampleProject });
    expect(readAnonStash()).not.toBeNull();
    clearAnonStash();
    expect(readAnonStash()).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('pi3_anon_stash', '{not json');
    expect(readAnonStash()).toBeNull();
  });

  it('returns null when schema version mismatches', () => {
    localStorage.setItem(
      'pi3_anon_stash',
      JSON.stringify({ v: 99, exampleName: 'snake', project: sampleProject, lastModified: 0 })
    );
    expect(readAnonStash()).toBeNull();
  });

  it('returns null when project field missing', () => {
    localStorage.setItem(
      'pi3_anon_stash',
      JSON.stringify({ v: 1, exampleName: 'snake', lastModified: 0 })
    );
    expect(readAnonStash()).toBeNull();
  });

  it('accepts stash without exampleName', () => {
    localStorage.setItem(
      'pi3_anon_stash',
      JSON.stringify({ v: 1, project: sampleProject, lastModified: 0 })
    );
    const stash = readAnonStash();
    expect(stash).not.toBeNull();
    expect(stash!.exampleName).toBeUndefined();
  });

  it('overwrites prior stash on subsequent write', () => {
    writeAnonStash({ exampleName: 'snake', project: sampleProject });
    writeAnonStash({
      exampleName: 'sokoban',
      project: { ...sampleProject, files: { 'main.py': 'print(2)' } },
    });
    const stash = readAnonStash();
    expect(stash!.exampleName).toBe('sokoban');
    expect(stash!.project.files['main.py']).toBe('print(2)');
  });
});
