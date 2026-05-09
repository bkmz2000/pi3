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
import { indentationGuideField, indentationGuides } from "./editor/theme";
import { ProjectsPage } from "./components/projects";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import { useUser } from "./state/useUser";
import ForkDialog from "./components/dialogs/ForkDialog";
import { useThemeStore } from "./state/useTheme";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";

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
  const running = runner.running;
  const showConsoleOnRun = useIde((s) => s.showConsoleOnRun);
  const showConsole = !showConsoleOnRun || running;
  const theme = useThemeStore((s) => s.theme);
  const fontSize = useThemeStore((s) => s.fontSize);
  const cmTheme = theme.name === "Midnight" ? githubDark : githubLight;

  const [showForkDialog, setShowForkDialog] = useState(false);

  const loaded = ProjectLoader();

  const onChange = useCallback(
    (val: string) => {
      changeFile(currentFile, val);
    },
    [currentFile, changeFile],
  );

  const handleSave = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: theme.surface,
        display: "flex",
        fontFamily: theme.fontUI,
        color: theme.appTxt,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Rail />

        {/* Main editor column */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            background: theme.editorBg,
            position: "relative",
          }}
        >
          <FileBar />
          <div style={{
            flex: 1, minHeight: 0, background: theme.editorBg,
            "--cm-bg": theme.editorBg,
            "--indent-guide-1": theme.name === "Midnight" ? "rgba(95,212,220,0.06)" : "rgba(14,154,167,0.07)",
            "--indent-guide-2": theme.name === "Midnight" ? "rgba(95,212,220,0.10)" : "rgba(14,154,167,0.11)",
            "--indent-guide-3": theme.name === "Midnight" ? "rgba(95,212,220,0.14)" : "rgba(14,154,167,0.15)",
            "--indent-guide-4": theme.name === "Midnight" ? "rgba(95,212,220,0.18)" : "rgba(14,154,167,0.19)",
            "--indent-guide-5": theme.name === "Midnight" ? "rgba(95,212,220,0.22)" : "rgba(14,154,167,0.23)",
            "--indent-guide-6": theme.name === "Midnight" ? "rgba(95,212,220,0.26)" : "rgba(14,154,167,0.27)",
          } as React.CSSProperties}>
            <CodeMirror
              key={`${currentFile || "no-file"}-${theme.editorBg}`}
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
                cmTheme,
                indentationGuides,
                EditorView.theme({ "&": { fontSize: fontSize + "px" } }),
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
          {showConsole && <ConsolePanel />}
          <CanvasWindow />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SessionChecker />
      <Routes>
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/ide/:projectId" element={<AppInner />} />
<Route path="/" element={<AppInner />} />
      </Routes>
    </>
  );
}
