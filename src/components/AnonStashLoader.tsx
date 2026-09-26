import { useEffect, useRef } from "react";
import { useEditor } from "../state/IdeState";
import { canRestoreAnonymousDraft } from "../state/sessionId";
import { migrateLegacyAnonStash } from "../utils/anonStash";
import { projectStorage } from "../utils/storage";

export function AnonStashLoader() {
  const changeCurrentProject = useEditor((s) => s.changeCurrentProject);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const initialEditor = useEditor.getState();
    if (!canRestoreAnonymousDraft(window.location.pathname, initialEditor.currentProjectId, initialEditor.dirtyFiles.size > 0)) return;

    void (async () => {
      try {
        await migrateLegacyAnonStash();
        const drafts = await projectStorage.listAnonymousDrafts();
        const latestEditor = useEditor.getState();
        // Re-check after asynchronous storage work: a newly selected project,
        // a route change, or edits made while IDB opened must win over old drafts.
        if (!canRestoreAnonymousDraft(window.location.pathname, latestEditor.currentProjectId, latestEditor.dirtyFiles.size > 0) || drafts.length === 0) return;
        const latest = drafts[0];
        changeCurrentProject(latest.project, latest.id);
        localStorage.setItem("pi3_last_editor_path", `/ide/${latest.id}`);
      } catch (error) {
        console.error("Failed to restore anonymous draft:", error);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
