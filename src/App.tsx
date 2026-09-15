import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Routes, Route, useNavigate, useParams } from "react-router-dom";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { setDiagnostics } from "@codemirror/lint";
import { reconfigureGraphicsExtensions } from "./editor/graphicsCompletion";
import { graphicsProfile } from "./editor/profiles";
import Rail from "./SideMenu";
import { useEditor, useIde, isExampleSessionId, EXAMPLE_SESSION_PREFIX } from "./state/IdeState";
import {
  getProject, getComments, listSessionReactions,
  ApiHttpError, type ApiComment, type SessionReaction,
} from "./state/api";
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
import { useToasts } from "./state/useToasts";
import { setCommentsEffect } from "./editor/comments";
import { ProjectsPage } from "./components/projects";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import TeacherProjectView from "./components/teacher/TeacherProjectView";
import TeacherProblemList from "./components/teacher/TeacherProblemList";
import TeacherProblemForm from "./components/teacher/TeacherProblemForm";
import CompetePage from "./compete/CompetePage";
import { WelcomePage } from "./pages/WelcomePage";
import { isInstitutional } from "./state/deploymentProfile";
import { useUser } from "./state/useUser";
import { usePresencePinger } from "./state/usePresencePinger";
import { useSessionAutoJoin } from "./state/useSessionAutoJoin";
import { useLiveSession } from "./state/useLiveSession";
import { PeerCodeView } from "./components/session/PeerCodeView";
import { ClassroomInviteBanner } from "./components/session/ClassroomInviteBanner";
import { useTranslation } from "react-i18next";
import ForkDialog from "./components/dialogs/ForkDialog";
import { useThemeStore } from "./state/useTheme";
import { ToastContainer } from "./components/ToastContainer";
import { SaveErrorIndicator } from "./components/SaveErrorIndicator";
import { getCmTheme } from "./editor/cmTheme";
import { readAnonStash, clearAnonStash } from "./utils/anonStash";

const SESSION_REACTION_GLYPHS: Record<SessionReaction["reaction"], string> = {
  good: "👍",
  question: "❓",
  try: "↻",
};

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

function ProjectLoader() {
  const { projectId, exampleKey } = useParams<{ projectId?: string; exampleKey?: string }>();
  const changeCurrentProject = useEditor((s) => s.changeCurrentProject);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    setError(null);

    if (exampleKey) {
      const name = decodeURIComponent(exampleKey);
      const example = useIde.getState().projects[name];
      if (example) {
        changeCurrentProject(
          {
            ...example,
            name: example.name ?? name,
            files: { ...example.files },
            assets: { ...example.assets },
            tilemaps: { ...example.tilemaps },
            sounds: { ...(example.sounds ?? {}) },
          },
          `${EXAMPLE_SESSION_PREFIX}${name}`,
        );
        localStorage.setItem('pi3_last_editor_path', `/ide/example/${encodeURIComponent(name)}`);
      } else {
        setError('example_not_found');
      }
      setLoaded(true);
      return;
    }

    if (!projectId) {
      localStorage.setItem('pi3_last_editor_path', '/ide');
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
        localStorage.setItem('pi3_last_editor_path', `/ide/${projectId}`);
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
            setError('project_not_found');
          }
        } catch (cacheErr) {
          console.error("Failed to load project from cache:", cacheErr);
          setError('project_not_found');
        }
        setLoaded(true);
      }
    };

    loadFromApi();

    return () => { cancelled = true; };
  }, [projectId, exampleKey, changeCurrentProject]);

  return { loaded, error };
}



function AppInner() {
  const navigate = useNavigate();
  useOnlineSync();
  const changeFile = useEditor((s) => s.changeFile);
  const currentFile = useEditor((s) => s.currentFile);
  const project = useEditor((s) => s.project);
  const markClean = useEditor((s) => s.markClean);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const queuedSaveCount = useEditor((s) => s.queuedSaveCount);
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
  const enableLinting = useIde((s) => s.enableLinting);
  const { show: showToast } = useToasts();
  const showConsole = !showConsoleOnRun || running;
  const theme = useThemeStore((s) => s.theme);
  const fontSize = useThemeStore((s) => s.fontSize);
  const cmTheme = getCmTheme(theme);

  const [showForkDialog, setShowForkDialog] = useState(false);
  const [fileComments, setFileComments] = useState<ApiComment[]>([]);
  const [sessionReactions, setSessionReactions] = useState<SessionReaction[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [anchorY, setAnchorY] = useState<number | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // First-run lint notice: once per browser, tell the student hints are on
  // (and where the toggle lives). Only fires when linting is enabled.
  useEffect(() => {
    if (!enableLinting) return;
    if (localStorage.getItem("pi3_lintNoticeShown")) return;
    localStorage.setItem("pi3_lintNoticeShown", "1");
    showToast(t("linter.firstRunNotice"), "info", 6000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableLinting]);

  // Feed the teacher live-roster: pings project id + file + cursor line every
  // few seconds while the user is actively editing.
  const authStateLive = useUser((s) => s.authState);
  usePresencePinger({
    projectId: currentProjectId,
    currentFile,
    editorRef,
    loggedIn: authStateLive === 'logged_in',
  });

  // A `#session=` link may have parked a token before sign-in; claim it here so
  // joining never depends on the live panel being open.
  useSessionAutoJoin(authStateLive === 'logged_in');
  const peerTabs = useLiveSession((s) => s.peerTabs);
  const activePeer = useLiveSession((s) => s.activePeer);
  const closePeer = useLiveSession((s) => s.closePeer);
  const liveToken = useLiveSession((s) => s.token);
  const liveSid = useLiveSession((s) => s.sid);
  const activePeerTab = activePeer ? peerTabs.find((p) => p.id === activePeer) ?? null : null;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyFiles.size > 0 || queuedSaveCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyFiles, queuedSaveCount]);

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

  const projectLoad = ProjectLoader();

  // Fetch when file/project changes
  useEffect(() => {
    if (!currentProjectId || isExampleSessionId(currentProjectId) || !currentFile) { setFileComments([]); return; }
    getComments(currentProjectId, currentFile)
      .then(rows => setFileComments(rows))
      .catch(() => {});
  }, [currentProjectId, currentFile]);

  useEffect(() => {
    if (!liveToken || !liveSid) { setSessionReactions([]); return; }
    let stopped = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const rows = await listSessionReactions(liveSid, liveToken);
        if (!stopped) setSessionReactions(rows);
      } catch (error) {
        if (!stopped) setSessionReactions([]);
        if (error instanceof ApiHttpError && error.status === 410) {
          useLiveSession.getState().leave();
        }
      } finally {
        if (!stopped) timer = window.setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [liveToken, liveSid]);

  const visibleComments = useMemo<ApiComment[]>(() => {
    const userId = useUser.getState().user?.id;
    const live = sessionReactions
      .filter((item) => item.target === userId && item.file === currentFile)
      .map((item): ApiComment => ({
        id: `session:${item.id}`,
        project_id: currentProjectId ?? '',
        file_path: item.file,
        line_number: item.line,
        anchor_text: '',
        text: SESSION_REACTION_GLYPHS[item.reaction],
        author_id: item.author_id,
        author_name: t('session.liveReaction'),
        author_handle: null,
        created_at: item.created_at,
      }));
    return [...fileComments, ...live];
  }, [sessionReactions, currentFile, currentProjectId, fileComments, t]);

  // Push into editor on every render — handles editor mounting after the fetch
  useEffect(() => {
    if (editorRef.current?.view) {
      editorRef.current.view.dispatch({ effects: setCommentsEffect.of(visibleComments) });
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

      if (dirtyFiles.size > 0 && authStateLive === 'logged_in' && (!currentProjectId || isExampleSessionId(currentProjectId))) {
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
  }, [currentProjectId, dirtyFiles, saveCurrentProject, markClean, setShowForkDialog, authStateLive]);

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
    clearAnonStash();
    setShowForkDialog(false);
    navigate(`/ide/${forked.id}`, { replace: true });
  };

  if (!projectLoad.loaded || !ready) {
    return <LoadingScreen />;
  }

  if (projectLoad.error) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
        background: theme.surface, color: theme.panelTxt, fontFamily: theme.fontUI,
      }}>
        <div style={{
          width: 'min(440px, calc(100vw - 32px))', padding: 26, textAlign: 'center',
          borderRadius: 10, border: `1px solid ${theme.panelBorder}`, background: theme.surfacePanel,
        }}>
          <div style={{ fontSize: 18, fontWeight: 750 }}>{t('projects.loadFailed')}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: theme.panelTxtMute }}>{t('projects.loadFailedHint')}</div>
          <button type="button" onClick={() => navigate('/projects')} style={{
            marginTop: 18, border: 0, borderRadius: 7, padding: '9px 16px', cursor: 'pointer',
            background: theme.runBg, color: theme.runTxt, fontFamily: theme.fontUI, fontWeight: 700,
          }}>
            {t('projects.backToProjects')}
          </button>
        </div>
      </div>
    );
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
          <style>{`
            @media (max-width: 800px) {
              .pi3-live-split { flex-direction: column !important; }
              .pi3-live-peer {
                flex: 0 1 50% !important;
                min-width: 0 !important;
                max-width: none !important;
                border-left: 0 !important;
                border-top: 1px solid ${theme.panelBorder};
              }
            }
          `}</style>
          {authError !== null && (
            <div style={{
              background: theme.errorChipBg,
              color: theme.errorChipTxt,
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
          <ClassroomInviteBanner />
          <FileBar />

          {/* Editor + Console — row when consoleOnRight, column otherwise.
              The canvas floats above this block (position: fixed), so it takes
              no space here. */}
          <div
            style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: consoleOnRight ? "row" : "column" }}
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
              flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "row",
              background: theme.editorBg,
              position: "relative",
            }} className="pi3-live-split">
              <div style={{
                flex: 1, minWidth: 0, minHeight: 0, background: theme.editorBg,
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
              {/* Keep both editors visible: your file stays on the left while
                  the selected live buffer opens as a dedicated right pane. */}
              {activePeerTab && (
                <div className="pi3-live-peer" style={{
                  flex: '0 1 50%', minWidth: 340, maxWidth: 720,
                  borderLeft: `1px solid ${theme.panelBorder}`, display: 'flex',
                }}>
                  <PeerCodeView
                    peerId={activePeerTab.id}
                    label={activePeerTab.label}
                    onClose={() => closePeer(activePeerTab.id)}
                  />
                </div>
              )}
              {selectedLine !== null && anchorY !== null && (() => {
                const lineComments = visibleComments.filter(c => c.line_number === selectedLine);
                if (lineComments.length === 0) return null;
                return (
                  <div data-comment-popover style={{
                    position: 'fixed',
                    left: 320,
                    top: Math.max(8, Math.min(anchorY - 60, window.innerHeight - 300)),
                    width: 240,
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
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/projects/:projectId" element={<TeacherProjectView />} />
        <Route path="/teacher/problems" element={<TeacherProblemList />} />
        <Route path="/teacher/problems/new" element={<TeacherProblemForm />} />
        <Route path="/teacher/problems/:slug/edit" element={<TeacherProblemForm />} />
        <Route path="/compete/:slug" element={<CompetePage />} />
        <Route path="/examples" element={<Navigate to="/projects?tab=examples" replace />} />
        <Route path="/ide/example/:exampleKey" element={<AppInner />} />
        <Route path="/ide/:projectId" element={<AppInner />} />
        <Route path="/ide" element={<AppInner />} />
        <Route path="/" element={isInstitutional() ? <AppInner /> : <WelcomePage />} />
      </Routes>
      <SaveErrorIndicator />
      <ToastContainer />
    </>
  );
}
