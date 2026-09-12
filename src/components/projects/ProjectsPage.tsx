import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { useEditor, isExampleSessionId, exampleNameFromSessionId } from '../../state/IdeState';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { EXAMPLES_CATALOG } from '../../data/examplesCatalog';
import { ProjectRow, ProjectArtwork } from './ProjectRow';
import { NewProjectDialog } from './NewProjectDialog';
import { Icon } from '../Icons';
import { ThemedDialog } from '../ThemedDialog';
import { joinGroupByCode } from '../../state/api';

type LibrarySection = 'mine' | 'examples' | 'shared';

function asSection(value: string | null): LibrarySection {
  return value === 'examples' || value === 'shared' ? value : 'mine';
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const {
    apiProjects,
    apiLoading,
    apiError,
    fetchProjects,
    addProject,
    removeProject,
    renameProject,
    downloadProject,
    importProjectFromFile,
  } = useProjects();
  const { authState, user } = useUser();
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const changeCurrentProject = useEditor((s) => s.changeCurrentProject);
  const [searchParams, setSearchParams] = useSearchParams();
  const section = asSection(searchParams.get('tab'));
  const [showNewProject, setShowNewProject] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinFeedback, setJoinFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [joining, setJoining] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authState === 'logged_in') fetchProjects();
  }, [authState, fetchProjects]);

  const mine = useMemo(() => apiProjects.filter((project) => project.role === 'owner'), [apiProjects]);
  const shared = useMemo(() => apiProjects.filter((project) => project.role !== 'owner'), [apiProjects]);
  const examples = useMemo(() => EXAMPLES_CATALOG.flatMap((topic) => topic.entries), []);

  const openEditor = () => {
    if (currentProjectId && !isExampleSessionId(currentProjectId)) {
      navigate(`/ide/${currentProjectId}`);
      return;
    }
    if (currentProjectId && isExampleSessionId(currentProjectId)) {
      const name = exampleNameFromSessionId(currentProjectId);
      if (name && name !== 'untitled') {
        navigate(`/ide/example/${encodeURIComponent(name)}`);
        return;
      }
    }
    navigate('/ide');
  };

  const handleCreateProject = async (name: string, description?: string) => {
    if (authState === 'logged_in') {
      const created = await addProject(name, description);
      setShowNewProject(false);
      navigate(`/ide/${created.id}`);
      return;
    }

    changeCurrentProject({
      name,
      files: { 'main.py': '# New project\nprint("Hello World!")' },
      currentFile: 'main.py',
      assets: {},
      tilemaps: {},
      sounds: {},
    });
    setShowNewProject(false);
    navigate('/ide');
  };

  const handleImport = async (file: File) => {
    const created = await importProjectFromFile(file);
    navigate(`/ide/${created.id}`);
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoining(true);
    setJoinFeedback(null);
    try {
      const result = await joinGroupByCode(code);
      setJoinFeedback({
        kind: 'success',
        text: result.already_member
          ? t('teacher.alreadyInGroup', { name: result.name })
          : t('teacher.joinedGroup', { name: result.name }),
      });
      setJoinCode('');
    } catch (error) {
      setJoinFeedback({ kind: 'error', text: error instanceof Error ? error.message : t('teacher.joinFailed') });
    } finally {
      setJoining(false);
    }
  };

  const setSection = (next: LibrarySection) => {
    setSearchParams(next === 'mine' ? {} : { tab: next });
  };

  const sectionTitle = section === 'mine'
    ? t('projects.myProjects')
    : section === 'examples'
      ? t('projects.examples')
      : t('projects.sharedWithMe');
  const sectionDescription = section === 'mine'
    ? t('projects.myProjectsDescription')
    : section === 'examples'
      ? t('projects.examplesDescription')
      : t('projects.sharedDescription');

  const signedOut = authState !== 'logged_in' && authState !== 'loading';
  const isStudent = user?.role !== 'teacher';
  const visibleProjects = section === 'mine' ? mine : shared;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: theme.surface,
      fontFamily: theme.fontUI, color: theme.panelTxt,
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        .pi3-project-library-layout { display: grid; grid-template-columns: 224px minmax(0, 1fr); min-height: 0; flex: 1; }
        .pi3-project-library-nav { border-right: 1px solid; padding: 22px 14px; display: flex; flex-direction: column; gap: 7px; }
        .pi3-project-library-content { overflow: auto; padding: 32px 38px 46px; }
        .pi3-project-list { max-width: 940px; margin: 0 auto; border-top: 1px solid; }
        @media (max-width: 720px) {
          .pi3-project-library-layout { grid-template-columns: 1fr; }
          .pi3-project-library-nav { border-right: 0; border-bottom: 1px solid; padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); }
          .pi3-project-library-nav .pi3-new-project { grid-column: 1 / -1; }
          .pi3-project-library-nav .pi3-import-project { display: none; }
          .pi3-project-library-content { padding: 24px 16px 36px; }
        }
      `}</style>

      <header style={{
        height: 62, flex: 'none', display: 'flex', alignItems: 'center',
        padding: '0 22px', background: theme.railBg,
        borderBottom: `1px solid ${theme.panelBorder}`, gap: 14,
      }}>
        <button
          type="button"
          onClick={openEditor}
          aria-label={t('projects.backToEditor')}
          style={{
            width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${theme.panelBorder}`, background: 'transparent',
            display: 'grid', placeItems: 'center', color: theme.railIcon,
          }}
        >
          <Icon name="close" size={15} color="currentColor" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 750 }}>{t('projects.libraryTitle')}</div>
          <div style={{ marginTop: 2, fontSize: 11.5, color: theme.panelTxtMute }}>{t('projects.librarySubtitle')}</div>
        </div>
        <div style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 800, fontSize: 20, color: theme.railLogo }}>
          pi<span style={{ fontSize: 12 }}>3</span>
        </div>
      </header>

      <div className="pi3-project-library-layout">
        <nav className="pi3-project-library-nav" aria-label={t('projects.categories')} style={{
          background: theme.surfacePanel, borderColor: theme.panelBorder,
        }}>
          <button
            type="button"
            className="pi3-new-project"
            onClick={() => setShowNewProject(true)}
            style={{
              minHeight: 44, border: 0, borderRadius: 8, cursor: 'pointer',
              background: theme.runBg, color: theme.runTxt,
              fontFamily: theme.fontUI, fontSize: 13, fontWeight: 750,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <Icon name="plus" size={15} color="currentColor" />
            {t('projects.newProject')}
          </button>

          <LibraryNavButton
            active={section === 'mine'} icon="folder" label={t('projects.myProjects')}
            count={mine.length} theme={theme} onClick={() => setSection('mine')}
          />
          <LibraryNavButton
            active={section === 'examples'} icon="examples" label={t('projects.examples')}
            count={examples.length} theme={theme} onClick={() => setSection('examples')}
          />
          <LibraryNavButton
            active={section === 'shared'} icon="users" label={t('projects.sharedWithMe')}
            count={shared.length} theme={theme} onClick={() => setSection('shared')}
          />

          {authState === 'logged_in' && (
            <button
              type="button"
              className="pi3-import-project"
              onClick={() => importRef.current?.click()}
              style={{
                marginTop: 'auto', minHeight: 40, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${theme.panelBorder}`, background: 'transparent',
                color: theme.panelTxt, fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 650,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Icon name="import" size={14} color="currentColor" />
              {t('sideMenu.importProject')}
            </button>
          )}
          <input
            ref={importRef}
            type="file"
            accept=".zip"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) handleImport(file).catch(() => {});
            }}
          />
        </nav>

        <main className="pi3-project-library-content">
          <div style={{ maxWidth: 940, margin: '0 auto 22px', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800 }}>{sectionTitle}</h1>
              <p style={{ margin: '7px 0 0', fontSize: 13.5, color: theme.panelTxtMute }}>{sectionDescription}</p>
            </div>
            {section === 'shared' && authState === 'logged_in' && isStudent && (
              <button
                type="button"
                onClick={() => { setShowJoin(true); setJoinFeedback(null); }}
                style={{
                  minHeight: 38, padding: '0 14px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${theme.panelBorder}`, background: theme.chip,
                  color: theme.panelTxt, fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                }}
              >
                <Icon name="users" size={14} color="currentColor" />
                {t('teacher.joinGroup')}
              </button>
            )}
          </div>

          {apiError && !signedOut && section !== 'examples' && (
            <div role="alert" style={{
              maxWidth: 940, margin: '0 auto 16px', padding: '10px 13px', borderRadius: 7,
              color: theme.stopBg, border: `1px solid ${theme.stopBg}55`, background: `${theme.stopBg}12`,
            }}>
              {apiError}
            </div>
          )}

          {section === 'examples' ? (
            <div className="pi3-project-list" style={{ borderColor: theme.panelBorder }}>
              {examples.map((entry) => (
                <ExampleProjectRow
                  key={entry.key}
                  projectKey={entry.key}
                  name={t(`examplesGallery.entries.${entry.i18nKey}.name`)}
                  description={t(`examplesGallery.entries.${entry.i18nKey}.blurb`)}
                  theme={theme}
                  onOpen={() => navigate(`/ide/example/${encodeURIComponent(entry.key)}`)}
                />
              ))}
            </div>
          ) : signedOut ? (
            <LibraryMessage title={t('auth.signInToViewProjects')} body={t('auth.needSignInToSeeProjects')} theme={theme} />
          ) : apiLoading && apiProjects.length === 0 ? (
            <LibraryMessage title={t('projects.loading')} theme={theme} />
          ) : visibleProjects.length === 0 ? (
            <LibraryMessage
              title={section === 'mine' ? t('projects.noProjects') : t('projects.noSharedProjects')}
              body={section === 'mine' ? t('projects.noProjectsHint') : t('projects.noSharedProjectsHint')}
              theme={theme}
            />
          ) : (
            <div className="pi3-project-list" style={{ borderColor: theme.panelBorder }}>
              {visibleProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onSelect={(id) => navigate(`/ide/${id}`)}
                  onDelete={project.role === 'owner' ? removeProject : undefined}
                  onRename={project.role === 'owner' ? renameProject : undefined}
                  onExport={downloadProject}
                  showRole={section === 'shared'}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} onCreate={handleCreateProject} />

      {showJoin && (
        <ThemedDialog
          title={t('teacher.joinGroup')}
          onClose={() => { setShowJoin(false); setJoinCode(''); setJoinFeedback(null); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.joinGroupHint')}</div>
            <input
              autoFocus
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => { if (event.key === 'Enter') handleJoin(); }}
              placeholder={t('teacher.joinCodePlaceholder')}
              style={{
                all: 'unset', padding: '10px 12px', background: theme.chip,
                border: `1px solid ${theme.panelBorder}`, borderRadius: 6,
                fontFamily: theme.fontMono, fontSize: 18, fontWeight: 700,
                letterSpacing: 3, color: theme.panelTxt, textAlign: 'center',
              }}
            />
            {joinFeedback && (
              <div role="status" aria-live="polite" style={{
                fontSize: 12, color: joinFeedback.kind === 'success' ? theme.runBg : theme.stopBg,
              }}>
                {joinFeedback.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowJoin(false); setJoinCode(''); setJoinFeedback(null); }}
                style={{
                  border: `1px solid ${theme.panelBorder}`, background: 'transparent', color: theme.panelTxt,
                  borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: theme.fontUI,
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleJoin}
                disabled={!joinCode.trim() || joining}
                style={{
                  border: 0, background: theme.runBg, color: theme.runTxt,
                  borderRadius: 6, padding: '8px 14px', cursor: joining ? 'default' : 'pointer',
                  opacity: !joinCode.trim() || joining ? 0.55 : 1, fontFamily: theme.fontUI, fontWeight: 700,
                }}
              >
                {joining ? t('teacher.joining') : t('teacher.join')}
              </button>
            </div>
          </div>
        </ThemedDialog>
      )}
    </div>
  );
}

function LibraryNavButton({ active, icon, label, count, theme, onClick }: {
  active: boolean;
  icon: 'folder' | 'examples' | 'users';
  label: string;
  count: number;
  theme: ReturnType<typeof useThemeStore.getState>['theme'];
  onClick: () => void;
}) {
  return (
    <button type="button" aria-current={active ? 'page' : undefined} onClick={onClick} style={{
      minHeight: 43, padding: '0 11px', border: 0, borderRadius: 8, cursor: 'pointer',
      background: active ? theme.railActiveBg : 'transparent',
      color: active ? theme.railIconActive : theme.panelTxt,
      fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: active ? 750 : 600,
      display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
      boxShadow: active ? `inset 3px 0 0 ${theme.accent}` : 'none',
    }}>
      <Icon name={icon} size={15} color="currentColor" />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: active ? theme.railIconActive : theme.panelTxtMute }}>{count}</span>
    </button>
  );
}

function ExampleProjectRow({ projectKey, name, description, theme, onOpen }: {
  projectKey: string;
  name: string;
  description: string;
  theme: ReturnType<typeof useThemeStore.getState>['theme'];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <article style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 2px', borderBottom: `1px solid ${theme.panelBorder}` }}>
      <button type="button" onClick={onOpen} style={{
        all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center', gap: 14, borderRadius: 8,
      }}>
        <ProjectArtwork id={`example-${projectKey}`} />
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 750, color: theme.panelTxt }}>{name}</span>
          <span style={{
            display: 'block', marginTop: 5, fontSize: 12.5, color: theme.panelTxtMute,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {description}
          </span>
        </span>
      </button>
      <button type="button" onClick={onOpen} style={{
        border: `1px solid ${theme.accent}`, borderRadius: 7, background: 'transparent',
        color: theme.accent, padding: '8px 14px', cursor: 'pointer',
        fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 700,
      }}>
        {t('projects.openAsDraft')}
      </button>
    </article>
  );
}

function LibraryMessage({ title, body, theme }: {
  title: string;
  body?: string;
  theme: ReturnType<typeof useThemeStore.getState>['theme'];
}) {
  return (
    <div style={{
      maxWidth: 940, margin: '0 auto', padding: '56px 24px', textAlign: 'center',
      border: `1px dashed ${theme.panelBorder}`, borderRadius: 9,
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</div>
      {body && <div style={{ marginTop: 7, color: theme.panelTxtMute, fontSize: 12.5 }}>{body}</div>}
    </div>
  );
}
