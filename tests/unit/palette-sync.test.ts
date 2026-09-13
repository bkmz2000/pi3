import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import { ALL_COLOR_NAMES, COLOR_ALIASES, PAL_NAMES, PALETTE_TITLES } from '../../src/palette';

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

describe('palette-sync: TypeScript palette mirrors Python COLOR_NAMES', () => {
  test('all TypeScript names match Python COLOR_NAMES keys in order', () => {
    const src = fs.readFileSync(PYTHON_SRC, 'utf8');
    const pythonNames = parsePythonColorNames(src);
    const tsNames = ALL_COLOR_NAMES;

    expect(tsNames).toEqual(pythonNames);
  });

  test('the 16 core swatches stay first and the expected kid color names are present', () => {
    const src = fs.readFileSync(PYTHON_SRC, 'utf8');
    const pythonNames = parsePythonColorNames(src);
    expect(Object.values(PAL_NAMES).slice(0, 16)).toEqual(pythonNames.slice(0, 16));
    expect(pythonNames).toHaveLength(22);
    expect(Object.keys(PAL_NAMES)).toHaveLength(19);
    expect(Object.keys(COLOR_ALIASES)).toHaveLength(3);
    expect(pythonNames).toEqual(expect.arrayContaining([
      'brown', 'purple', 'pink', 'grey', 'light_blue', 'dark_blue',
    ]));
    expect(PALETTE_TITLES).toEqual(expect.arrayContaining([
      expect.stringContaining('brown'),
      expect.stringContaining('purple'),
      expect.stringContaining('pink'),
      expect.stringContaining('grey'),
      expect.stringContaining('light_blue'),
      expect.stringContaining('dark_blue'),
    ]));
  });
});
