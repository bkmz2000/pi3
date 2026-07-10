import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { setDiagnostics } from "@codemirror/lint";
import { reconfigureGraphicsExtensions } from "./editor/graphicsCompletion";
import { graphicsProfile } from "./editor/profiles";
import Rail from "./SideMenu";
import { useEditor, useIde } from "./state/IdeState";
import { getProject, getComments, type ApiComment } from "./state/api";
import { projectStorage } from "./utils/storage";
import { encodeSheet, decodeSheet } from "./state/sheetCodec";
import { toEditorProject } from "./state/projectNormalization";
import { useOnlineSync } from "./hooks/useOnlineSync";
import FileBar from "./FileBar";
import { useRunner } from "./runner/RunnerProvider";
import CanvasWindow from "./CanvasWindow";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import ConsolePanel from "./components/ConsolePanel";
import { setCommentsEffect } from "./editor/comments";
import { ProjectsPage } from "./components/projects";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import TeacherProjectView from "./components/teacher/TeacherProjectView";
import TeacherProblemList from "./components/teacher/TeacherProblemList";
import TeacherProblemForm from "./components/teacher/TeacherProblemForm";
import CompetePage from "./compete/CompetePage";
import { WelcomePage } from "./pages/WelcomePage";
import { useUser } from "./state/useUser";
import { useTranslation } from "react-i18next";
import ForkDialog from "./components/dialogs/ForkDialog";
import { useThemeStore } from "./state/useTheme";
import { ToastContainer } from "./components/ToastContainer";
import { SaveErrorIndicator } from "./components/SaveErrorIndicator";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { readAnonStash, clearAnonStash } from "./utils/anonStash";

function SessionChecker() {
  const checkSession = useUser((s) => s.checkSession);
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  return null;
}

function AnonStashLoader() {
  const changeCurrentProject = useEditor((s) => s.changeCurrentProject);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Only restore if no project is already loaded (no URL param)
    if (currentProjectId) return;

    const stash = readAnonStash();
    if (!stash) return;

    const sessionId = stash.exampleName
      ? `__example_session_${stash.exampleName}`
      : "__example_session_untitled";

    changeCurrentProject(stash.project, sessionId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function ClaimOnLogin() {
  const authState = useUser((s) => s.authState);
  const changeCurrentProject = useEditor((s) => s.changeCurrentProject);
  const forkExample = useIde((s) => s.forkExample);
  const prevAuthState = useRef(authState);
  const claimed = useRef(false);

  useEffect(() => {
    if (prevAuthState.current === 'logged_in' || authState !== 'logged_in') {
      prevAuthState.current = authState;
      return;
    }
    prevAuthState.current = authState;
    if (claimed.current) return;
    claimed.current = true;

    const stash = readAnonStash();
    if (!stash) return;

    const name = stash.exampleName?.replace(/^__example_session_/, '') || 'untitled';

    forkExample(name, stash.project, `${name} (saved work)`).then((forked) => {
      if (forked) {
        changeCurrentProject(
          { ...stash.project, name: forked.name },
          forked.id,
        );
        clearAnonStash();
      }
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const loadFromApi = async () => {
      try {
        const apiProject = await getProject(projectId);
        if (cancelled) return;
        // Cache full content locally for offline reloads.
        projectStorage.cacheProjectContent(projectId, {
          files: apiProject.files,
          assets: apiProject.assets,
          tilemaps: apiProject.tilemaps ?? {},
          sounds: apiProject.sounds ?? {},
          // Server may return either wire or legacy sheet shape; normalize to
          // wire so the cache row stays compact regardless.
          sheet: apiProject.sheet ? encodeSheet(decodeSheet(apiProject.sheet)!) : undefined,
          currentFile: apiProject.current_file,
        }).catch(() => {});
        // toEditorProject decodes the sheet wire shape back into the in-memory
        // flat-buffer SheetData every consumer (editor, worker, exporter)
        // expects. Without this, sheet/sounds were silently dropped on load.
        changeCurrentProject(toEditorProject(apiProject), projectId);
        setLoaded(true);
      } catch (apiErr) {
        if (cancelled) return;
        // Try local cache as fallback
        try {
          const cached = await projectStorage.getCachedProjectContent(projectId);
          if (cancelled) return;
          if (cached) {
            console.log("Loaded project from local cache");
            changeCurrentProject(
              {
                name: projectId,
                files: cached.files,
                assets: cached.assets,
                tilemaps: cached.tilemaps,
                sounds: cached.sounds,
                sheet: decodeSheet(cached.sheet),
                currentFile: cached.currentFile ?? Object.keys(cached.files)[0],
              },
              projectId,
            );
          } else {
            console.error("Failed to load project, not in cache:", apiErr);
          }
        } catch (cacheErr) {
          console.error("Failed to load project from cache:", cacheErr);
        }
        setLoaded(true);
      }
    };

    loadFromApi();

    return () => { cancelled = true; };
  }, [projectId, changeCurrentProject]);

  return loaded;
}



function AppInner() {
  useOnlineSync();
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
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const showConsoleOnRun = useIde((s) => s.showConsoleOnRun);
  const enableAutocomplete = useIde((s) => s.enableAutocomplete);
  const consoleOnRight = useIde((s) => s.consoleOnRight);
  const showConsole = !showConsoleOnRun || running;
  const theme = useThemeStore((s) => s.theme);
  const fontSize = useThemeStore((s) => s.fontSize);
  const cmTheme = theme.name === "Midnight" ? githubDark : githubLight;

  const [showForkDialog, setShowForkDialog] = useState(false);
  const [fileComments, setFileComments] = useState<ApiComment[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [anchorY, setAnchorY] = useState<number | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyFiles.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyFiles]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('auth_error');
    if (errorCode) {
      const errorMessages: Record<string, string> = {
        provider: 'Your account provider returned an error. Please try signing in again.',
        state: 'Your login session expired. Please try again.',
        token: 'Could not complete sign-in. Please try again.',
        userinfo: 'Could not reach the login service. Please try again.',
      };
      setAuthError(errorMessages[errorCode] ?? 'Sign-in failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loaded = ProjectLoader();

  // Fetch when file/project changes
  useEffect(() => {
    if (!currentProjectId || !currentFile) { setFileComments([]); return; }
    getComments(currentProjectId, currentFile)
      .then(rows => setFileComments(rows))
      .catch(() => {});
  }, [currentProjectId, currentFile]);

  // Push into editor on every render — handles editor mounting after the fetch
  useEffect(() => {
    if (editorRef.current?.view) {
      editorRef.current.view.dispatch({ effects: setCommentsEffect.of(fileComments) });
    }
  });

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;
    view.dispatch({ effects: reconfigureGraphicsExtensions(theme, lang, enableAutocomplete, runner.requestCompletions) });
  }, [theme, lang, enableAutocomplete, runner.requestCompletions]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;
    const doc = view.state.doc;
    const cmDiagnostics = runner.lintErrors.map((d) => {
      const fromLine = doc.line(Math.min(d.row + 1, doc.lines));
      const toLine = doc.line(Math.min(d.endRow + 1, doc.lines));
      const from = fromLine.from + Math.min(d.column, fromLine.length);
      const to = toLine.from + Math.min(d.endColumn, toLine.length);
      return {
        from,
        to: to > from ? to : from + 1,
        severity: d.severity as "error" | "warning",
        message: t(d.messageKey, d.messageArgs as Record<string, string>),
      };
    });
    view.dispatch(setDiagnostics(view.state, cmDiagnostics));
  }, [runner.lintErrors]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = useCallback(
    (val: string) => {
      changeFile(currentFile, val);
    },
    [currentFile, changeFile],
  );

  const handleSave = useCallback(async (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();

      if (!currentProjectId && dirtyFiles.size > 0) {
        setShowForkDialog(true);
        return;
      }

      if (dirtyFiles.size > 0 && currentProjectId) {
        const snapshot = new Set(dirtyFiles);
        const success = await saveCurrentProject();
        if (success) {
          markClean(snapshot);
        }
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

        {/* Main content column: header on top, editor+console below */}
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
          {authError !== null && (
            <div style={{
              background: '#dc2626',
              color: 'white',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 14,
              fontFamily: theme.fontUI,
              flexShrink: 0,
            }}>
              <span style={{ flex: 1 }}>{authError}</span>
              <button
                onClick={() => setAuthError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >×</button>
            </div>
          )}
          <FileBar />

          {/* Outer row: [editor+console block] | [docked canvas]. Keeps the
              canvas on the right regardless of where the console sits. */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row" }}>
          <div
            style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: consoleOnRight ? "row" : "column" }}
            onClick={e => {
              const target = e.target as HTMLElement;
              if (!target.closest('.cm-comment-gutter') && !target.closest('[data-comment-popover]')) {
                setSelectedLine(null);
                setAnchorY(null);
              }
            }}
          >
            {/* Editor */}
            <div style={{
              flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
              background: theme.editorBg,
              position: "relative",
            }}>
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
                  ref={editorRef}
                  key={`${currentFile || "no-file"}-${theme.editorBg}`}
                  value={project.files[currentFile] ?? ""}
                  onChange={onChange}
                  extensions={graphicsProfile({
                    theme,
                    lang,
                    fontSize,
                    cmTheme,
                    enableAutocomplete,
                    requestCompletions: runner.requestCompletions,
                    onLineSelect: (line, y) => { setSelectedLine(line); setAnchorY(y); },
                  })}
                  height="100%"
                  width="100%"
                  className="h-full text-left"
                />
              </div>
              {selectedLine !== null && anchorY !== null && (() => {
                const lineComments = fileComments.filter(c => c.line_number === selectedLine);
                if (lineComments.length === 0) return null;
                return (
                  <div data-comment-popover style={{
                    position: 'fixed',
                    left: 320,
                    top: Math.max(8, Math.min(anchorY - 60, window.innerHeight - 300)),
                    width: 280,
                    background: theme.surfacePanel,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                    zIndex: 50,
                    padding: 12,
                    display: 'flex', flexDirection: 'column', gap: 8,
                    fontFamily: theme.fontUI,
                  }}>
                    {lineComments.map(c => (
                      <div key={c.id} style={{
                        background: theme.surface, borderRadius: 6, padding: '8px 10px',
                        border: `1px solid ${theme.panelBorder}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: theme.panelTxt }}>{c.author_name}</span>
                          <span style={{ fontSize: 10.5, color: theme.panelTxtMute }}>
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {showConsole && <ConsolePanel onRight={consoleOnRight} />}
          </div>
          <ErrorBoundary label="Canvas">
            <CanvasWindow />
          </ErrorBoundary>
          </div>
        </div>
      </div>
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
      <AnonStashLoader />
      <ClaimOnLogin />
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/projects/:projectId" element={<TeacherProjectView />} />
        <Route path="/teacher/problems" element={<TeacherProblemList />} />
        <Route path="/teacher/problems/new" element={<TeacherProblemForm />} />
        <Route path="/teacher/problems/:slug/edit" element={<TeacherProblemForm />} />
        <Route path="/compete/:slug" element={<CompetePage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/ide/:projectId" element={<AppInner />} />
        <Route path="/" element={<AppInner />} />
      </Routes>
      <SaveErrorIndicator />
      <ToastContainer />
    </>
  );
}
