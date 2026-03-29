import { useEffect } from "react";
import { useEditor, useIde } from "../state/IdeState";

const AUTO_SAVE_INTERVAL = 60000; // 1 minute

export function useAutoSave() {
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const markClean = useEditor((s) => s.markClean);
  const updateLastSaveTime = useEditor((s) => s.updateLastSaveTime);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);

  useEffect(() => {
    if (!currentProjectId || dirtyFiles.size === 0) return;

    const interval = setInterval(() => {
      saveCurrentProject();
      markClean();
      updateLastSaveTime();
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [currentProjectId, dirtyFiles.size, saveCurrentProject, markClean, updateLastSaveTime]);
}
