import { Project as ApiProject } from "./api";
import type { TilemapData, SheetData } from "./IdeState";

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

// Normalize ApiProject (snake_case) to editor Project (camelCase)
export function toEditorProject(api: ApiProject): EditorProject {
  return {
    name: api.name,
    files: api.files,
    currentFile: api.current_file,
    assets: api.assets,
    tilemaps: api.tilemaps ?? {},
    sounds: api.sounds ?? {},
    sheet: api.sheet,
  };
}
