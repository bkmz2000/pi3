import { Project as ApiProject } from "./api";

export type EditorProject = {
  name?: string;
  files: Record<string, string>;
  currentFile?: string;
  assets: Record<string, string>;
};

// Normalize ApiProject (snake_case) to editor Project (camelCase)
export function toEditorProject(api: ApiProject): EditorProject {
  return {
    name: api.name,
    files: api.files,
    currentFile: api.current_file,
    assets: api.assets,
  };
}
