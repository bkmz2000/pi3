import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import { PAL_NAMES } from '../../src/palette';

const PYTHON_SRC = path.resolve(__dirname, '../../src/assets/python/graphics/_color.py');

function parsePythonColorNames(src: string): string[] {
  // Match the COLOR_NAMES = { ... } block (may span multiple lines)
  const blockMatch = src.match(/COLOR_NAMES\s*=\s*\{([^}]+)\}/s);
  if (!blockMatch) throw new Error('Could not find COLOR_NAMES block in Python source');

  const block = blockMatch[1];
  // Extract keys: lines of the form   "name":  ...
  const names: string[] = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*"([^"]+)"\s*:/);
    if (m) names.push(m[1]);
  }
  return names;
}

describe('palette-sync: TypeScript PAL_NAMES mirrors Python COLOR_NAMES', () => {
  test('PAL_NAMES values match Python COLOR_NAMES keys in order', () => {
    const src = fs.readFileSync(PYTHON_SRC, 'utf8');
    const pythonNames = parsePythonColorNames(src);
    const tsNames = Object.values(PAL_NAMES);

    expect(tsNames).toEqual(pythonNames);
  });

  test('both palettes have exactly 16 entries', () => {
    const src = fs.readFileSync(PYTHON_SRC, 'utf8');
    const pythonNames = parsePythonColorNames(src);
    expect(pythonNames).toHaveLength(16);
    expect(Object.keys(PAL_NAMES)).toHaveLength(16);
  });
});
