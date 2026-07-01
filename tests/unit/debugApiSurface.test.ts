/**
 * API surface snapshot for pi3.debug.
 *
 * pi3.debug is student-facing: a silent rename of `show`, `array`, or `range`
 * would break existing student visualization code. This snapshot prevents that.
 *
 * Update procedure:
 * 1. Edit __all__ in src/assets/python/pi3/debug.py
 * 2. Update tests/unit/debug-api-surface.json to match
 * 3. Run npm test to verify
 */

import * as fs from 'fs';
import * as path from 'path';

const SNAPSHOT_PATH = path.resolve(__dirname, 'debug-api-surface.json');
const MODULE_PATH = path.resolve(__dirname, '../../src/assets/python/pi3/debug.py');

function parseAllFromModule(source: string): string[] {
  const match = source.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error('Could not find __all__ in debug.py');
  const body = match[1];
  const names: string[] = [];
  const keyRegex = /"([^"]+)"/g;
  let m;
  while ((m = keyRegex.exec(body)) !== null) {
    names.push(m[1]);
  }
  return names.sort();
}

describe('pi3.debug api-surface snapshot', () => {
  let snapshot: Record<string, unknown>;
  let moduleExports: string[];

  beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    const moduleSrc = fs.readFileSync(MODULE_PATH, 'utf8');
    moduleExports = parseAllFromModule(moduleSrc);
  });

  test('snapshot __all__ matches debug.py __all__ (sorted)', () => {
    const snapshotAll = (snapshot.__all__ as string[]).slice().sort();
    expect(snapshotAll).toEqual(moduleExports);
  });

  test('snapshot contains the core visualization functions', () => {
    const names = snapshot.__all__ as string[];
    for (const name of ['array', 'grid', 'text', 'stack', 'queue', 'set', 'show']) {
      expect(names).toContain(name);
    }
  });

  test('snapshot contains the selection helpers', () => {
    const names = snapshot.__all__ as string[];
    for (const name of ['range', 'cell', 'label']) {
      expect(names).toContain(name);
    }
  });
});
