/**
 * API surface snapshot test.
 *
 * Asserts that the checked-in api-surface.json matches the current state of
 * the graphics library's _manifest.py __all__ list. Any future add/remove of
 * a public name turns CI red until the snapshot AND docs are deliberately updated.
 *
 * Update procedure (documented in CLAUDE.md):
 * 1. Edit graphics/__init__.py __all__ and _manifest.py EXPORTED_NAMES
 * 2. Update tests/unit/api-surface.json to match
 * 3. Update docs/api-v1.md changelog
 * 4. Run tests to verify
 */

import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const SNAPSHOT_PATH = path.resolve(__dirname, 'api-surface.json');
const MANIFEST_PATH = path.resolve(__dirname, '../../src/assets/python/graphics/_manifest.py');

function parseManifestExports(source: string): string[] {
  const match = source.match(/EXPORTED_NAMES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error('Could not find EXPORTED_NAMES in _manifest.py');
  const body = match[1];
  const names: string[] = [];
  const keyRegex = /"([^"]+)"/g;
  let m;
  while ((m = keyRegex.exec(body)) !== null) {
    names.push(m[1]);
  }
  return names;
}

describe('api-surface snapshot', () => {
  let snapshot: Record<string, unknown>;
  let manifestExports: string[];

  beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    const manifestSrc = fs.readFileSync(MANIFEST_PATH, 'utf8');
    manifestExports = parseManifestExports(manifestSrc);
  });

  test('snapshot __all__ matches _manifest.py EXPORTED_NAMES', () => {
    const snapshotAll = snapshot.__all__ as string[];
    expect(snapshotAll).toEqual(manifestExports);
  });

  test('snapshot version matches _manifest.py _version', () => {
    // Read _version from graphics/__init__.py
    const initPath = path.resolve(__dirname, '../../src/assets/python/graphics/__init__.py');
    const initSrc = fs.readFileSync(initPath, 'utf8');
    const versionMatch = initSrc.match(/_version\s*=\s*"([^"]+)"/);
    expect(versionMatch).not.toBeNull();
    expect(snapshot._version).toBe(versionMatch![1]);
  });

  test('snapshot contains all expected sections', () => {
    expect(snapshot).toHaveProperty('__all__');
    expect(snapshot).toHaveProperty('Actor');
    expect(snapshot).toHaveProperty('Mouse');
    expect(snapshot).toHaveProperty('Keyboard');
    expect(snapshot).toHaveProperty('Window');
    expect(snapshot).toHaveProperty('State');
    expect(snapshot).toHaveProperty('Group');
    expect(snapshot).toHaveProperty('ACTOR_METHODS');
  });

  test('snapshot ACTOR_METHODS is a non-empty sorted array of strings', () => {
    const methods = snapshot.ACTOR_METHODS as string[];
    expect(Array.isArray(methods)).toBe(true);
    expect(methods.length).toBeGreaterThan(0);
    // Must include core callable methods
    for (const m of ['draw', 'move', 'forward', 'bounce', 'die', 'update', 'rotate']) {
      expect(methods).toContain(m);
    }
    // Must NOT include static methods or properties
    expect(methods).not.toContain('all_actors');
    expect(methods).not.toContain('random_coords');
    expect(methods).not.toContain('x');
    expect(methods).not.toContain('y');
    expect(methods).not.toContain('visible');
    // Must be sorted
    const sorted = [...methods].sort();
    expect(methods).toEqual(sorted);
  });
});
