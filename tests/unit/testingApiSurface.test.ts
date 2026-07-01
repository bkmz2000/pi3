/**
 * API surface snapshot for pi3.testing.
 *
 * pi3.testing is teacher-facing API: a silent rename of UniqueSample or Integer
 * would break every existing problem generator. This snapshot prevents that.
 *
 * Update procedure:
 * 1. Edit __all__ in src/assets/python/pi3/testing.py
 * 2. Update tests/unit/testing-api-surface.json to match
 * 3. Run npm test to verify
 */

import * as fs from 'fs';
import * as path from 'path';

const SNAPSHOT_PATH = path.resolve(__dirname, 'testing-api-surface.json');
const MODULE_PATH = path.resolve(__dirname, '../../src/assets/python/pi3/testing.py');

function parseAllFromModule(source: string): string[] {
  const match = source.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error('Could not find __all__ in testing.py');
  const body = match[1];
  const names: string[] = [];
  const keyRegex = /'([^']+)'/g;
  let m;
  while ((m = keyRegex.exec(body)) !== null) {
    names.push(m[1]);
  }
  return names.sort();
}

describe('pi3.testing api-surface snapshot', () => {
  let snapshot: Record<string, unknown>;
  let moduleExports: string[];

  beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    const moduleSrc = fs.readFileSync(MODULE_PATH, 'utf8');
    moduleExports = parseAllFromModule(moduleSrc);
  });

  test('snapshot __all__ matches testing.py __all__ (sorted)', () => {
    const snapshotAll = (snapshot.__all__ as string[]).slice().sort();
    expect(snapshotAll).toEqual(moduleExports);
  });

  test('snapshot contains the core recipe primitives', () => {
    const names = snapshot.__all__ as string[];
    for (const name of ['Integer', 'Float', 'Choice', 'String', 'Permutation', 'Sample', 'UniqueSample', 'Literal', 'seed']) {
      expect(names).toContain(name);
    }
  });

  test('snapshot contains all TestSet tier constructors', () => {
    const names = snapshot.__all__ as string[];
    for (const name of ['Example', 'Easy', 'Medium', 'Hard']) {
      expect(names).toContain(name);
    }
  });
});
