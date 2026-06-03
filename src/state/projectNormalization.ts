import { Project as ApiProject } from "./api";
import type { TilemapData, SheetData } from "./IdeState";
import { decodeSheet } from "./sheetCodec";

export type EditorProject = {
  name?: string;
  files: Record<string, string>;
  currentFile?: string;
  assets: Record<string, string>;
  tilemaps: Record<string, TilemapData>;
  sounds?: Record<string, string>;
  sheet?: SheetData;
  theme?: string;
};

// Normalize ApiProject (snake_case) to editor Project (camelCase).
// `sheet` may arrive in either the sparse-chunk wire shape or the legacy
// single-buffer shape; decodeSheet handles both.
export function toEditorProject(api: ApiProject): EditorProject {
  return {
    name: api.name,
    files: api.files,
    currentFile: api.current_file,
    assets: api.assets,
    tilemaps: api.tilemaps ?? {},
    sounds: api.sounds ?? {},
    sheet: decodeSheet(api.sheet),
  };
}
