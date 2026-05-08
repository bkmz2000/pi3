import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { indentUnit, bracketMatching, indentOnInput } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, drawSelection, highlightSpecialChars } from "@codemirror/view";
import { autocompletion, acceptCompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import Rail from "./SideMenu";
import { useEditor, useIde } from "./state/IdeState";
import { getProject } from "./state/api";
import FileBar from "./FileBar";
import { useRunner } from "./runner/RunnerProvider";
import CanvasWindow from "./CanvasWindow";
import LoadingScreen from "./components/LoadingScreen";
import ConsolePanel from "./components/ConsolePanel";
import { webideTheme, indentationGuideField } from "./editor/theme";
import { ProjectsPage } from "./components/projects";
import { useUser } from "./state/useUser";
import ForkDialog from "./components/dialogs/ForkDialog";

function SessionChecker() {
  const checkSession = useUser((s) => s.checkSession);
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  return null;
}

function ProjectLoader() {
  const { projectId } = useParams<{ projectId: string }>();
  const changeCurrentProject = useEditor((s) => s.changeCurrentProject);
  const setLoading = useIde((s) => s.setActivePanel);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    getProject(projectId)
      .then((apiProject) => {
        if (cancelled) return;
        changeCurrentProject(
          {
            name: apiProject.name,
            files: apiProject.files,
            assets: apiProject.assets,
            currentFile: apiProject.current_file,
          },
          projectId,
        );
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load project:", err);
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [projectId, changeCurrentProject]);

  return loaded;
}

function AppInner() {
  const changeFile = useEditor((s) => s.changeFile);
  const currentFile = useEditor((s) => s.currentFile);
  const project = useEditor((s) => s.project);
  const markClean = useEditor((s) => s.markClean);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const forkExample = useIde((s) => s.forkExample);
  const runner = useRunner();
  const ready = runner.ready;

  const [showForkDialog, setShowForkDialog] = useState(false);

  const loaded = ProjectLoader();

  const onChange = useCallback(
    (val: string) => {
      changeFile(currentFile, val);
    },
    [currentFile, changeFile],
  );

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('[App] Service Worker registered:', registration.scope);
        },
        (error) => {
          console.log('[App] Service Worker registration failed:', error);
        }
      );
    }
  }, []);

  const handleSave = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();

      // If editing an example, show fork dialog
      if (!currentProjectId && dirtyFiles.size > 0) {
        setShowForkDialog(true);
        return;
      }

      if (dirtyFiles.size > 0 && currentProjectId) {
        saveCurrentProject();
        markClean();
      }
    }
  }, [currentProjectId, dirtyFiles, saveCurrentProject, markClean]);

  useEffect(() => {
    window.addEventListener("keydown", handleSave);
    return () => window.removeEventListener("keydown", handleSave);
  }, [handleSave]);

  const handleForkSave = async (name: string) => {
    const forked = await forkExample(name, project);
    useEditor.getState().changeCurrentProject(
      { ...project, name: forked.name },
      forked.id,
    );
    markClean();
    setShowForkDialog(false);
  };

  if (!loaded || !ready) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-cyan-950">
      <Rail />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <FileBar />
        <div className="flex-1 overflow-hidden">
          <CodeMirror
            key={currentFile || "no-file"}
            value={project.files[currentFile] ?? ""}
            onChange={onChange}
            extensions={[
              python(),
              EditorState.tabSize.of(4),
              indentUnit.of("    "),
              bracketMatching(),
              indentOnInput(),
              lineNumbers(),
              highlightActiveLine(),
              drawSelection(),
              highlightSpecialChars(),
              indentationGuideField,
              webideTheme,
              EditorView.lineWrapping,
              autocompletion({ defaultKeymap: true }),
              keymap.of([
                {
                  key: "Tab",
                  run: acceptCompletion,
                },
              ]),
            ]}
            height="100%"
            width="100%"
            className="h-full text-left"
          />
        </div>
      </div>
      <ConsolePanel />
      <CanvasWindow />

      {showForkDialog && (
        <ForkDialog
          onClose={() => setShowForkDialog(false)}
          onSave={handleForkSave}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <>
      <SessionChecker />
      <Routes>
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/ide/:projectId" element={<AppInner />} />
<Route path="/" element={<AppInner />} />
      </Routes>
    </>
  );
}
