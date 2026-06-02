import { useEffect, useRef } from "react";
import { useEditor, useIde, isExampleSessionId } from "../state/IdeState";

const AUTO_SAVE_INTERVAL = 60000; // 1 minute
const DEBOUNCE_MS = 3000;         // save 3s after last change on real projects

export function useAutoSave() {
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const markClean = useEditor((s) => s.markClean);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Periodic fallback save (catches anything the debounce missed)
  useEffect(() => {
    if (!currentProjectId) return;

    const interval = setInterval(async () => {
      const dirty = useEditor.getState().dirtyFiles;
      if (dirty.size === 0) return;
      // Snapshot what we're about to persist so a concurrent edit (during the
      // network roundtrip) doesn't get falsely marked clean.
      const snapshot = new Set(dirty);
      const success = await saveCurrentProject();
      if (success) markClean(snapshot);
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [currentProjectId, saveCurrentProject, markClean]);

  // Debounced save triggered 3s after any change on a real (named) project
  useEffect(() => {
    if (!currentProjectId || isExampleSessionId(currentProjectId)) return;
    if (dirtyFiles.size === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const snapshot = new Set(useEditor.getState().dirtyFiles);
      const success = await saveCurrentProject();
      if (success) markClean(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dirtyFiles, currentProjectId, saveCurrentProject, markClean]);
}
