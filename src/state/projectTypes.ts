export type TilemapLayer = {
  name: string;
  tileSize: number;
  cells: Record<number, Record<number, string>>;
};

// Named cell-set zones brushed in the Tile Editor, used as collision/test
// regions in Python. Stored as a flat list of [col, row] cells. Areas span
// the whole tilemap and are not tied to a specific layer.
export type TilemapArea = {
  cells: Array<[number, number]>;
};

export type TilemapData = {
  layers: TilemapLayer[];
  // Area name → cell-set. Names are validated as /^[a-z][a-z0-9_]*$/ in the
  // editor so they map cleanly to Python attribute access (`level.areas.X`).
  areas?: Record<string, TilemapArea>;
};

export type SheetAnimationStrip = {
  x: number;
  y: number;
  frameW: number;
  frameH: number;
  frameCount: number;
  fps?: number;
};

export type SheetSpriteEntry = {
  animations: Record<string, SheetAnimationStrip>;
};

export type SheetSprites = Record<string, SheetSpriteEntry>;

export type SheetData = {
  pixels: string;   // base64-encoded raw RGBA bytes (width × height × 4)
  width: number;
  height: number;
  sprites: SheetSprites;
};

export type Project = {
  name?: string;
  files: Record<string, string>;
  currentFile?: string;
  assets: Record<string, string>;
  tilemaps: Record<string, TilemapData>;
  sounds?: Record<string, string>;
  sheet?: SheetData;
};
