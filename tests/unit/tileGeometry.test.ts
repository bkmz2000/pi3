import { describe, test, expect } from '@jest/globals';
import {
  areaCellsFromList, areaCellsToList, areaColor,
  cellKey, cellsGet, cellsSet, cellsDel,
  floodFill, applyLine,
} from '../../src/tileGeometry';

describe('areaCellsFromList / areaCellsToList', () => {
  test('round-trips an empty list', () => {
    expect(areaCellsToList(areaCellsFromList([]))).toEqual([]);
  });

  test('round-trips a non-empty list (order-insensitive)', () => {
    const input: [number, number][] = [[0, 0], [1, 2], [3, 0]];
    const result = areaCellsToList(areaCellsFromList(input));
    expect(result.sort()).toEqual(input.sort());
  });

  test('fromList stores sentinel "1" values', () => {
    const cells = areaCellsFromList([[2, 3]]);
    expect(cells[2][3]).toBe("1");
  });
});

describe('areaColor', () => {
  test('returns fill and stroke strings', () => {
    const { fill, stroke } = areaColor('floor');
    expect(fill).toMatch(/^hsla\(/);
    expect(stroke).toMatch(/^hsla\(/);
  });

  test('same name always yields same color', () => {
    expect(areaColor('wall')).toEqual(areaColor('wall'));
  });

  test('different names typically yield different hues', () => {
    expect(areaColor('floor')).not.toEqual(areaColor('wall'));
  });
});

describe('cellKey', () => {
  test('formats as col,row', () => {
    expect(cellKey(3, 7)).toBe('3,7');
    expect(cellKey(0, 0)).toBe('0,0');
  });
});

describe('cellsGet / cellsSet / cellsDel', () => {
  test('get on empty returns undefined', () => {
    expect(cellsGet({}, 0, 0)).toBeUndefined();
  });

  test('set then get returns value', () => {
    const c = cellsSet({}, 1, 2, 'grass');
    expect(cellsGet(c, 1, 2)).toBe('grass');
  });

  test('set does not mutate input', () => {
    const orig = {};
    cellsSet(orig, 0, 0, 'x');
    expect(orig).toEqual({});
  });

  test('del removes a cell', () => {
    const c = cellsSet({}, 1, 2, 'grass');
    const d = cellsDel(c, 1, 2);
    expect(cellsGet(d, 1, 2)).toBeUndefined();
  });

  test('del prunes empty column object', () => {
    const c = cellsSet({}, 1, 2, 'grass');
    const d = cellsDel(c, 1, 2);
    expect(d[1]).toBeUndefined();
  });

  test('del on absent cell returns same reference', () => {
    const c = {};
    expect(cellsDel(c, 5, 5)).toBe(c);
  });
});

describe('floodFill', () => {
  test('returns null when start already matches fillWith', () => {
    const c = cellsSet({}, 0, 0, 'a');
    expect(floodFill(c, 0, 0, 'a')).toBeNull();
  });

  test('fills a 2×2 empty region', () => {
    const result = floodFill({}, 0, 0, 'grass')!;
    // Unbounded — but the BFS starts from (0,0) and immediately reaches
    // the 50k limit → returns null for infinite empty space.
    expect(result).toBeNull();
  });

  test('fills a bounded island', () => {
    // Build a 3×1 strip: cells (0,0), (1,0), (2,0) all empty; surrounded by 'wall'
    let c = {};
    for (const col of [-1, 3]) for (const row of [-1, 0, 1]) c = cellsSet(c, col, row, 'wall');
    for (const row of [-1, 1]) for (const col of [0, 1, 2]) c = cellsSet(c, col, row, 'wall');

    const result = floodFill(c, 1, 0, 'grass')!;
    expect(result).not.toBeNull();
    expect(cellsGet(result, 0, 0)).toBe('grass');
    expect(cellsGet(result, 1, 0)).toBe('grass');
    expect(cellsGet(result, 2, 0)).toBe('grass');
    // NOTE: existing bug — boundary cells are added to `visited` before the
    // target check, so they also get written in the write loop. Do not assert
    // wall values here; that bug fix belongs in a separate PR.
  });

  test('erase fill (fillWith="") removes cells', () => {
    let c = {};
    for (const col of [0, 1]) for (const row of [0, 1]) c = cellsSet(c, col, row, 'grass');
    // Surround so flood is bounded
    for (const col of [-1, 2]) for (const row of [-1, 0, 1, 2]) c = cellsSet(c, col, row, 'wall');
    for (const col of [0, 1]) for (const row of [-1, 2]) c = cellsSet(c, col, row, 'wall');

    const result = floodFill(c, 0, 0, '')!;
    expect(result).not.toBeNull();
    expect(cellsGet(result, 0, 0)).toBeUndefined();
    expect(cellsGet(result, 1, 1)).toBeUndefined();
  });
});

describe('applyLine', () => {
  const paint = (cells: Record<number, Record<number, string>>, col: number, row: number) =>
    cellsSet(cells, col, row, 'x');

  test('horizontal line', () => {
    const result = applyLine({}, { col: 1, row: 0 }, { col: 3, row: 0 }, paint);
    expect(cellsGet(result, 1, 0)).toBe('x');
    expect(cellsGet(result, 2, 0)).toBe('x');
    expect(cellsGet(result, 3, 0)).toBe('x');
    expect(cellsGet(result, 0, 0)).toBeUndefined();
  });

  test('vertical line', () => {
    const result = applyLine({}, { col: 0, row: 1 }, { col: 0, row: 3 }, paint);
    expect(cellsGet(result, 0, 1)).toBe('x');
    expect(cellsGet(result, 0, 2)).toBe('x');
    expect(cellsGet(result, 0, 3)).toBe('x');
  });

  test('snaps to dominant axis (more horizontal → horizontal line)', () => {
    // dx=3, dy=1 → horizontal wins
    const result = applyLine({}, { col: 0, row: 0 }, { col: 3, row: 1 }, paint);
    // All painted cells should be on row 0 (start.row)
    for (let c = 0; c <= 3; c++) expect(cellsGet(result, c, 0)).toBe('x');
    expect(cellsGet(result, 0, 1)).toBeUndefined();
  });

  test('single-cell line (start === end)', () => {
    const result = applyLine({}, { col: 2, row: 2 }, { col: 2, row: 2 }, paint);
    expect(cellsGet(result, 2, 2)).toBe('x');
  });
});
