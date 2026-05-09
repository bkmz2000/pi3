import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../hooks/useProjects';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Icons';

export function ProjectsPage() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { apiProjects, apiLoading, apiError, fetchProjects, addProject } = useProjects();
  const { authState } = useUser();
  const [showNewProject, setShowNewProject] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authState === 'logged_in') {
      fetchProjects();
    }
  }, [authState, fetchProjects]);

  const handleSelectProject = (id: string) => {
    navigate(`/ide/${id}`);
  };

  const handleCreateProject = async (name: string) => {
    await addProject(name);
    setShowNewProject(false);
  };

  const fullPage = (
    <div style={{
      position: "fixed", inset: 0,
      background: theme.surface,
      fontFamily: theme.fontUI,
      color: theme.panelTxt,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, flex: "none",
        display: "flex", alignItems: "center",
        padding: "0 20px",
        background: theme.railBg,
        borderBottom: `1px solid ${theme.panelBorder}`,
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            all: "unset", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            color: theme.railIcon,
            fontSize: 12.5, fontWeight: 500,
            padding: "6px 10px", borderRadius: 5,
            background: "transparent",
          }}
        >
          <Icon name="close" size={14} color="currentColor" />
          Back to Editor
        </button>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontWeight: 700, fontSize: 18,
          color: theme.railLogo,
        }}>
          pi<span style={{ fontSize: 12 }}>3</span>
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
        {authState === 'loading' && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 60,
          }}>
            <div style={{
              width: 24, height: 24,
              border: `3px solid ${theme.panelBorder}`,
              borderTopColor: theme.accent,
              borderRadius: 999,
              animation: "pi3blink 1s ease-in-out infinite",
            }} />
          </div>
        )}

        {authState !== 'logged_in' && authState !== 'loading' && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 60, textAlign: "center", gap: 12,
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: theme.panelTxt }}>
              {t('auth.signInToViewProjects')}
            </div>
            <div style={{ fontSize: 13, color: theme.panelTxtMute }}>
              {t('auth.needSignInToSeeProjects')}
            </div>
          </div>
        )}

        {authState === 'logged_in' && (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: theme.panelTxt }}>
                {t('auth.myProjects')}
              </div>
              <button
                onClick={() => setShowNewProject(true)}
                style={{
                  all: "unset", cursor: "pointer",
                  padding: "8px 16px", borderRadius: 6,
                  background: theme.runBg, color: theme.runTxt,
                  fontSize: 12.5, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <Icon name="plus" size={14} color="currentColor" />
                {t('sideMenu.newProject')}
              </button>
            </div>

            {apiError && (
              <div style={{
                marginBottom: 16, padding: "10px 14px",
                background: "rgba(239,68,68,0.10)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 6,
                fontSize: 13, color: theme.stopBg,
              }}>
                {apiError}
              </div>
            )}

            {apiLoading && apiProjects.length === 0 ? (
              <div style={{
                display: "flex", justifyContent: "center", padding: 40,
              }}>
                <div style={{
                  width: 20, height: 20,
                  border: `3px solid ${theme.panelBorder}`,
                  borderTopColor: theme.accent,
                  borderRadius: 999,
                  animation: "pi3blink 1s ease-in-out infinite",
                }} />
              </div>
            ) : apiProjects.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                padding: 60, textAlign: "center",
                border: `2px dashed ${theme.panelBorder}`,
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: theme.panelTxtMute }}>
                  {t('sideMenu.noProjects')}
                </div>
                <button
                  onClick={() => setShowNewProject(true)}
                  style={{
                    all: "unset", cursor: "pointer",
                    padding: "8px 16px", borderRadius: 6,
                    background: theme.runBg, color: theme.runTxt,
                    fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  {t('sideMenu.createProject')}
                </button>
              </div>
            ) : (
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 12,
              }}>
                {apiProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelect={handleSelectProject}
                    showManagement
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} onCreate={handleCreateProject} />
    </div>
  );

  return fullPage;
}
