import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, useIde } from "../state/IdeState";
import { useRunner } from "../runner/RunnerProvider";
import { LintDiagnostic, type RuntimeError, type PerError } from "../runner/WorkerInterface";

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

  const { running, run, interrupt, lint, clear, appendOutput, pushErrorCard } = useRunner();

  const isStartingRef = useRef(false);

  const handleRunToggle = useCallback(async () => {
    if (running) {
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
        const success = await saveCurrentProject();
        if (success) {
          markClean();
        }
      }
      
      clear();  // Clear previous output
      if (enableLinting) {
        appendOutput("stdout", t('console.checking'));
        const diagnostics: LintDiagnostic[] = await lint(code, filename);

        // Smart blocking: grammar/syntax errors block, naming/type/logic don't
        const blockingErrors = diagnostics.filter(
          (d) => d.severity === "error" && d.isBlocking !== false,
        );
        const nonBlockingErrors = diagnostics.filter(
          (d) => d.severity === "error" && d.isBlocking === false,
        );

        if (blockingErrors.length > 0) {
          appendOutput("stderr", t('console.foundErrors', { count: blockingErrors.length }));
          return;
        }

        // ── Multi-error batching: collect all errors into one card ──
        const allErrors = diagnostics.filter(
          (d) => d.severity === "error",
        );
        if (allErrors.length > 0) {
          const codeLines = code.split("\n");

          const perErrors: PerError[] = allErrors.map((d) => {
            const token = (d.messageArgs?.name as string) || undefined;
            const line = d.row + 1; // 1-based
            const snippet = codeLines[d.row]?.trim() ?? "";
            const suggestions = d.suggestions?.[0]?.candidates ?? [];
            const category = d.category ?? "logic";
            const messageKey = `linter.${d.code}`;
            const label = t(`linter.${d.code}Label`, d.code);
            return { code: d.code, category, label, messageKey, token, line, snippet, suggestions };
          });

          const counts: Record<string, number> = {};
          for (const e of perErrors) {
            counts[e.category] = (counts[e.category] || 0) + 1;
          }
          const summary = Object.entries(counts)
            .map(([cat, n]) => `${n} ${t(`errorCategory.${cat}`, cat)}`)
            .join(", ");

          const batchError: RuntimeError = {
            category: "grammar", // dominant category for coloring
            titleKey: "friendlyError.grammar.title",
            messageKey: "console.foundErrorsBatch",
            messageArgs: { count: allErrors.length, summary },
            raw: "",
            suggestions: allErrors
              .filter((d) => d.suggestions?.length)
              .flatMap((d) => d.suggestions!),
            isBlocking: blockingErrors.length > 0,
            perErrors,
          };

          pushErrorCard(batchError);
          // lintErrors are already set in the store by the lint() call
          return;
        }

        if (nonBlockingErrors.length > 0) {
          appendOutput("stdout", t('console.foundNonBlocking', { count: nonBlockingErrors.length }));
        }

        const warnings = diagnostics.filter((d) => d.severity === "warning");
        if (warnings.length > 0 && nonBlockingErrors.length === 0) {
          appendOutput("stdout", t('console.foundWarnings', { count: warnings.length }));
        } else if (warnings.length === 0 && nonBlockingErrors.length === 0) {
          appendOutput("stdout", t('console.noErrors'));
        }
      }
      options.onBeforeRun?.();
      run(project.files, project.assets, currentFile);
    } finally {
      isStartingRef.current = false;
    }
  }, [running, project, currentFile, dirtyFiles, lint, clear, appendOutput, pushErrorCard, run, interrupt, saveCurrentProject, markClean, options, t, enableLinting]);

  return {
    running,
    handleRunToggle,
  };
}
