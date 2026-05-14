import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, useIde } from "../state/IdeState";
import { useRunner } from "../runner/RunnerProvider";
import { LintDiagnostic } from "../runner/WorkerInterface";

type UseRunButtonOptions = {
  onBeforeRun?: () => void;
};

export function useRunButton(options: UseRunButtonOptions = {}) {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const currentFile = useEditor((s) => s.currentFile);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const markClean = useEditor((s) => s.markClean);

  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const enableLinting = useIde((s) => s.enableLinting);

  const { running, isP5, run, interrupt, lint, clear, _appendOutput } = useRunner();

  const isStartingRef = useRef(false);

  const handleRunToggle = useCallback(async () => {
    if (running || isP5) {
      await interrupt();
      return;
    }

    if (isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;

    try {
      const code = project.files[currentFile] ?? "";
      const filename = currentFile || "main.py";
      
      // Save if there are dirty files
      if (dirtyFiles.size > 0) {
        saveCurrentProject();
        markClean();
      }
      
      clear();  // Clear previous output
      if (enableLinting) {
        _appendOutput("stdout", t('console.checking'));
        const diagnostics: LintDiagnostic[] = await lint(code, filename);

        if (diagnostics.length > 0) {
          _appendOutput("stderr", t('console.syntaxError', { count: diagnostics.length }));
          // Diagnostics are already displayed by RunnerProvider's message handler
          return;
        }

        _appendOutput("stdout", t('console.noErrors'));
      }
      options.onBeforeRun?.();
      run(project.files, project.assets, currentFile);
    } finally {
      isStartingRef.current = false;
    }
  }, [running, isP5, project, currentFile, dirtyFiles, lint, clear, _appendOutput, run, interrupt, saveCurrentProject, markClean, options, t, enableLinting]);

  return {
    running,
    isP5,
    handleRunToggle,
  };
}
