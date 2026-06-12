// Pure tile-grid helpers extracted from TileEditor. No DOM/React deps.

// Internal area cell representation: col → row → sentinel "1".
export type AreaCells = Record<number, Record<number, string>>;

export function areaCellsFromList(cells: Array<[number, number]>): AreaCells {
  const out: AreaCells = {};
  for (const [c, r] of cells) {
    if (!out[c]) out[c] = {};
    out[c][r] = "1";
  }
  return out;
}

export function areaCellsToList(cells: AreaCells): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [colStr, rows] of Object.entries(cells)) {
    const col = Number(colStr);
    for (const rowStr of Object.keys(rows)) out.push([col, Number(rowStr)]);
  }
  return out;
}

// Deterministic HSL color from area name — distinct hues without a palette table.
export function areaColor(name: string): { fill: string; stroke: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { fill: `hsla(${hue}, 75%, 55%, 0.35)`, stroke: `hsla(${hue}, 75%, 55%, 0.85)` };
}

export const cellKey = (col: number, row: number) => `${col},${row}`;

export function cellsGet(cells: Record<number, Record<number, string>>, col: number, row: number): string | undefined {
  return cells[col]?.[row];
}

export function cellsSet(cells: Record<number, Record<number, string>>, col: number, row: number, name: string): Record<number, Record<number, string>> {
  return { ...cells, [col]: { ...cells[col], [row]: name } };
}

export function cellsDel(cells: Record<number, Record<number, string>>, col: number, row: number): Record<number, Record<number, string>> {
  if (!cells[col]?.[row]) return cells;
  const colClone = { ...cells[col] };
  delete colClone[row];
  if (Object.keys(colClone).length === 0) {
    const out = { ...cells };
    delete out[col];
    return out;
  }
  return { ...cells, [col]: colClone };
}

// BFS flood-fill on cells; works on empty or painted targets; cap at 50k.
// Returns null if start already matches fillWith or the region is unbounded.
export function floodFill(
  cells: Record<number, Record<number, string>>,
  startCol: number,
  startRow: number,
  fillWith: string,
): Record<number, Record<number, string>> | null {
  const target = cellsGet(cells, startCol, startRow);
  if (target === fillWith) return null;

  const visited = new Set<string>();
  const queue: [number, number][] = [[startCol, startRow]];
  const LIMIT = 50_000;

  while (queue.length > 0) {
    if (visited.size >= LIMIT) return null; // unbounded
    const [col, row] = queue.shift()!;
    const k = cellKey(col, row);
    if (visited.has(k)) continue;
    visited.add(k);
    const here = cellsGet(cells, col, row);
    if (here !== target) continue; // boundary
    for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nk = cellKey(col+dc, row+dr);
      if (!visited.has(nk)) queue.push([col+dc, row+dr]);
    }
  }

  let result = cells;
  for (const k of visited) {
    const [c, r] = k.split(",").map(Number);
    if (fillWith === "") {
      result = cellsDel(result, c, r);
    } else {
      result = cellsSet(result, c, r, fillWith);
    }
  }
  return result;
}

// Snap-paint along a horizontal or vertical line between two grid cells.
export function applyLine(
  cells: Record<number, Record<number, string>>,
  start: { col: number; row: number },
  end: { col: number; row: number },
  apply: (cells: Record<number, Record<number, string>>, col: number, row: number) => Record<number, Record<number, string>>,
): Record<number, Record<number, string>> {
  let result = cells;
  if (Math.abs(end.col - start.col) >= Math.abs(end.row - start.row)) {
    const r = start.row;
    const c0 = Math.min(start.col, end.col);
    const c1 = Math.max(start.col, end.col);
    for (let c = c0; c <= c1; c++) result = apply(result, c, r);
  } else {
    const col = start.col;
    const r0 = Math.min(start.row, end.row);
    const r1 = Math.max(start.row, end.row);
    for (let r = r0; r <= r1; r++) result = apply(result, col, r);
  }
  return result;
}
