import { useCallback, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { indentUnit, bracketMatching, indentOnInput } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, drawSelection, highlightSpecialChars } from "@codemirror/view";
import Rail from "./SideMenu";
import { useEditor } from "./state/IdeState";
import { useIde } from "./state/IdeState";
import FileBar from "./FileBar";
import { useRunner } from "./runner/RunnerProvider";
import CanvasWindow from "./CanvasWindow";
import LoadingScreen from "./components/LoadingScreen";
import ConsolePanel from "./components/ConsolePanel";
import { webideTheme, indentationGuideField } from "./editor/theme";

function AppInner() {
  const changeFile = useEditor((s) => s.changeFile);
  const currentFile = useEditor((s) => s.currentFile);
  const project = useEditor((s) => s.project);
  const markClean = useEditor((s) => s.markClean);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const runner = useRunner();
  const ready = runner.ready;

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (dirtyFiles.size > 0) {
          saveCurrentProject();
          markClean();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dirtyFiles, saveCurrentProject, markClean]);

  if (!ready) {
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
            ]}
            height="100%"
            width="100%"
            className="h-full text-left"
          />
        </div>
      </div>
      <ConsolePanel />
      <CanvasWindow />
    </div>
  );
}

export default function App() {
  return <AppInner />;
}
