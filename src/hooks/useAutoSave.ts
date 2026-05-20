import { useEffect } from "react";
import { useEditor, useIde } from "../state/IdeState";

const AUTO_SAVE_INTERVAL = 60000; // 1 minute

export function useAutoSave() {
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const markClean = useEditor((s) => s.markClean);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);

  useEffect(() => {
    if (!currentProjectId) return;

    const interval = setInterval(async () => {
      const dirtyFiles = useEditor.getState().dirtyFiles;
      if (dirtyFiles.size === 0) return;

      const success = await saveCurrentProject();
      if (success) {
        markClean();
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [currentProjectId, saveCurrentProject, markClean]);
}
