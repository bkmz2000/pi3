import { useEffect, useRef } from "react";
import { useEditor, useIde } from "../state/IdeState";

const AUTO_SAVE_INTERVAL = 60000; // 1 minute
const DEBOUNCE_MS = 3000;         // save 3s after last change on real projects

export function useAutoSave() {
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  // Sticky client-side errors (413, validation) — retrying on every keystroke
  // would just keep failing. The user must fix the project before we try again.
  const saveError = useIde((s) => s.saveError);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Periodic fallback save (catches anything the debounce missed). Drafts and
  // example sessions are persisted locally by saveCurrentProject(), never sent
  // to the project API.
  useEffect(() => {
    if (!currentProjectId) return;
    if (saveError?.kind === "payload" || saveError?.kind === "conflict") return;

    const interval = setInterval(async () => {
      const dirty = useEditor.getState().dirtyFiles;
      if (dirty.size === 0) return;
      // saveCurrentProject owns snapshot-aware dirty cleanup after persistence
      // is verified; a second cleanup here could erase an in-flight edit.
      await saveCurrentProject();
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [currentProjectId, saveCurrentProject, saveError?.kind]);

  // Debounced save triggered 3s after any change. Real projects go to the API;
  // drafts and example sessions go to local storage.
  useEffect(() => {
    if (!currentProjectId) return;
    if (dirtyFiles.size === 0) return;
    if (saveError?.kind === "payload" || saveError?.kind === "conflict") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // The save action owns snapshot-aware dirty cleanup.
      await saveCurrentProject();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dirtyFiles, currentProjectId, saveCurrentProject, saveError?.kind]);
}
