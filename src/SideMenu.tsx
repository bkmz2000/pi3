import { useEffect, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { packAssetsByMeta, type Category, type Perspective } from "./state/assets";
import { useIde, useEditor, type TilemapData } from "./state/IdeState";
import { useRunner } from "./runner/RunnerProvider";
import { useRunButton } from "./hooks/useRunButton";
import { useProjects } from "./hooks/useProjects";
import { useAutoSave } from "./hooks/useAutoSave";
import { usePanels } from "./hooks/usePanels";
import { useThemeStore, type Theme, type ThemeId } from "./state/useTheme";
import { useUser } from "./state/useUser";
import { getProject } from "./state/api";
import Backdrop from "./components/Backdrop";
import NewProjectDialog from "./components/dialogs/NewProjectDialog";
import ImportDialog from "./components/dialogs/ImportDialog";
import { ThemedDialog } from "./components/ThemedDialog";
import {
  Icon,
  type IconName,
} from "./components/Icons";

const SpriteEditor = lazy(() => import("./SpriteEditor"));
const TileEditor = lazy(() => import("./TileEditor"));
const DocsPanel = lazy(() => import("./components/DocsPanel"));

// ── Logo ───────────────────────────────────
function Pi3Logo({ color }: { color: string }) {
  return (
    <div
      style={{
        fontFamily: "'Nunito', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 26,
        color,
        lineHeight: 1,
        letterSpacing: -0.5,
        display: "inline-flex",
        alignItems: "flex-start",
      }}
    >
      pi<span style={{ fontSize: 15.6, marginLeft: 1, transform: "translateY(-2px)", display: "inline-block" }}>3</span>
    </div>
  );
}

// ── Rail Button ────────────────────────────
function RailButton({
  icon,
  label,
  active,
  onClick,
  theme,
  badge,
  accentBg,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
  theme: Theme;
  badge?: boolean;
  accentBg?: string;
}) {
  const [hover, setHover] = useState(false);
  const bg = accentBg
    ? accentBg
    : active
      ? theme.railActiveBg
      : hover
        ? theme.railHoverBg
        : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      aria-label={label}
      style={{
        all: "unset",
        cursor: "pointer",
        width: 44,
        height: 44,
        borderRadius: theme.radiusButton,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: active ? theme.railIconActive : theme.railIcon,
        position: "relative",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <Icon name={icon} size={21} color="currentColor" />
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: 7,
            background: theme.tabDirty,
          }}
        />
      )}
    </button>
  );
}

// ── Rail ───────────────────────────────────
export default function Rail() {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const changeEditorCurrentProject = useEditor((s) => s.changeCurrentProject);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const importProjectFromFile = useIde((s) => s.importProjectFromFile);
  const markClean = useEditor((s) => s.markClean);

  const [editorOpen, setEditorOpen] = useState(false);
  const [tileEditorOpen, setTileEditorOpen] = useState(false);
  const [editingTilemap, setEditingTilemap] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [animEditorOpen, setAnimEditorOpen] = useState(false);
  const [editingAnimation, setEditingAnimation] = useState<{ name: string; data: import('./state/IdeState').AnimationData } | null>(null);

  const { user } = useUser();
  const { ready } = useRunner();
  const { running, isP5, handleRunToggle } = useRunButton();
  const {
    projects,
    userProjects,
    loading,
    loadUserProjects,
    handleOpenExample,
    handleForkExample,
    handleNewProject,
    handleDeleteProject,
    downloadProject,
  } = useProjects();
  const { activePanel, isOpen, togglePanel, closePanels } = usePanels();

  useAutoSave();

  useEffect(() => {
    if (activePanel === "projects") {
      loadUserProjects();
    }
  }, [activePanel, loadUserProjects]);

  const handleOpenUserProject = async (userProject: {
    id: string;
    name: string;
    files: Record<string, string>;
    assets: Record<string, string>;
  }) => {
    if (currentProjectId === userProject.id) return;

    if (currentProjectId && dirtyFiles.size > 0) {
      const success = await saveCurrentProject();
      if (success) {
        markClean();
      }
    }

    // Fetch full project data — the list endpoint doesn't include files/assets
    const full = await getProject(userProject.id);
    changeEditorCurrentProject(
      {
        files: full.files,
        assets: full.assets,
        tilemaps: full.tilemaps ?? {},
        animations: full.animations ?? {},
      },
      full.id,
    );
  };

  const handleCreateNewProject = async (name: string) => {
    await handleNewProject(name);
    setShowNewProjectDialog(false);
  };

  const handleExportProject = async (id: string) => {
    try {
      await downloadProject(id);
    } catch (error) {
      console.error("Failed to export project:", error);
      setAlertMsg(t('sideMenu.failedExport'));
    }
  };

  const handleImportProject = async (file: File) => {
    try {
      const importedProject = await importProjectFromFile(file);
      changeEditorCurrentProject(
        {
          files: importedProject.files,
          assets: importedProject.assets,
          tilemaps: importedProject.tilemaps ?? {},
          animations: importedProject.animations ?? {},
        },
        importedProject.id,
      );
      setShowImportDialog(false);
    } catch (error) {
      console.error("Failed to import project:", error);
      setAlertMsg(t('sideMenu.failedImport'));
    }
  };

  const projectAssets = useEditor((s) => s.project.assets);
  const projectTilemaps = useEditor((s) => s.project.tilemaps);
  const projectAnimations = useEditor((s) => s.project.animations);
  const toggleAsset = useEditor((s) => s.toggleAsset);
  const changeAsset = useEditor((s) => s.changeAsset);
  const addAssetInstance = useEditor((s) => s.addAssetInstance);
  const removeAsset = useEditor((s) => s.removeAsset);
  const saveTilemap = useEditor((s) => s.saveTilemap);
  const deleteTilemap = useEditor((s) => s.deleteTilemap);
  const saveAnimation = useEditor((s) => s.saveAnimation);
  const deleteAnimation = useEditor((s) => s.deleteAnimation);

  const isRunning = running || isP5;
  const runIcon: IconName = !ready ? "settings" : isRunning ? "stop" : "play";

  return (
    <>
      {alertMsg && (
        <ThemedDialog title={t('sideMenu.close')} onClose={() => setAlertMsg(null)}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'inherit' }}>{alertMsg}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setAlertMsg(null)}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '7px 16px', borderRadius: 6,
                background: theme.runBg, color: theme.runTxt,
                fontSize: 13, fontWeight: 600,
              }}
            >
              OK
            </button>
          </div>
        </ThemedDialog>
      )}
      {/* Rail */}
      <div
        style={{
          width: 60,
          flex: "none",
          background: theme.railBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0 14px",
          gap: 8,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <Pi3Logo color={theme.railLogo} />
        </div>

        <RailButton
          icon="folder"
          label={t('sideMenu.projects')}
          active={isOpen("projects")}
          onClick={() => togglePanel("projects")}
          theme={theme}
        />

        <div style={{ position: "relative", marginTop: 4, marginBottom: 4 }}>
          <button
            type="button"
            onClick={handleRunToggle}
            aria-label={isRunning ? t('sideMenu.stop') : t('sideMenu.run')}
            title={isRunning ? t('sideMenu.stop') : t('sideMenu.run')}
            disabled={!ready}
            style={{
              all: "unset",
              cursor: ready ? "pointer" : "not-allowed",
              width: 44, height: 44, borderRadius: theme.radiusButton,
              background: isRunning ? theme.stopBg : theme.runBg,
              color: theme.runTxt,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: ready ? 1 : 0.5,
            }}
          >
            <Icon name={runIcon} size={20} color="currentColor" />
          </button>
        </div>

        <RailButton
          icon="sparkle"
          label={t('sideMenu.assets')}
          active={isOpen("assets")}
          onClick={() => togglePanel("assets")}
          theme={theme}
        />

        <RailButton
          icon="grid"
          label={t('sideMenu.tilemaps')}
          active={isOpen("tilemaps")}
          onClick={() => togglePanel("tilemaps")}
          theme={theme}
        />

        <RailButton
          icon="play"
          label={t('sideMenu.animations')}
          active={isOpen("animations")}
          onClick={() => togglePanel("animations")}
          theme={theme}
        />

        <div style={{ flex: 1 }} />

        {user?.role === 'teacher' && (
          <a
            href="/teacher"
            title={t('teacher.navLabel')}
            aria-label={t('teacher.navLabel')}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: theme.radiusButton,
              color: theme.railIcon,
              textDecoration: "none",
            }}
          >
            <Icon name="users" size={21} color="currentColor" />
          </a>
        )}

        <RailButton
          icon="book"
          label={t('sideMenu.docs')}
          active={isOpen("docs")}
          onClick={() => togglePanel("docs")}
          theme={theme}
        />

        <RailButton
          icon="settings"
          label={t('sideMenu.settings')}
          active={isOpen("settings")}
          onClick={() => togglePanel("settings")}
          theme={theme}
        />
      </div>

      <Backdrop open={activePanel !== null} onClick={closePanels} />

      {/* Floating side panels */}
      {activePanel && (
        <div
          style={{
            position: "absolute",
            top: 0, bottom: 0, left: 60,
            width: 320,
            background: theme.surfacePanel,
            display: "flex",
            flexDirection: "column",
            borderRight: `1px solid ${theme.panelBorder}`,
            boxShadow: "8px 0 28px rgba(0,0,0,0.28), 2px 0 6px rgba(0,0,0,0.10)",
            zIndex: 10,
          }}
        >
          {activePanel === "projects" && (
            <ProjectsPanel
              theme={theme}
              projects={projects}
              userProjects={userProjects}
              loading={loading}
              currentProjectId={currentProjectId}
              dirtyFiles={dirtyFiles}
              onOpenExample={handleOpenExample}
              onForkExample={handleForkExample}
              onOpenUserProject={handleOpenUserProject}
              onDeleteProject={handleDeleteProject}
              onExportProject={handleExportProject}
              onNewProject={() => setShowNewProjectDialog(true)}
              onImport={() => setShowImportDialog(true)}
              onClose={closePanels}
            />
          )}
          {activePanel === "assets" && (
            <AssetsPanel
              theme={theme}
              projectAssets={projectAssets}
              onAddAsset={addAssetInstance}
              onRemoveAsset={removeAsset}
              onNewSprite={() => { setEditingAsset(null); setEditorOpen(true); }}
              onEditAsset={(name, url) => {
                setEditingAsset({ name, url });
                setEditorOpen(true);
              }}
              onClose={closePanels}
            />
          )}
          {activePanel === "tilemaps" && (
            <TilemapsPanel
              theme={theme}
              tilemaps={projectTilemaps}
              onOpen={(name) => { setEditingTilemap(name); setTileEditorOpen(true); }}
              onNew={() => { setEditingTilemap(null); setTileEditorOpen(true); }}
              onDelete={deleteTilemap}
              onClose={closePanels}
            />
          )}
          {activePanel === "animations" && (
            <AnimationsPanel
              theme={theme}
              animations={projectAnimations ?? {}}
              onEdit={(name, data) => { setEditingAnimation({ name, data }); setAnimEditorOpen(true); }}
              onNew={() => { setEditingAnimation(null); setAnimEditorOpen(true); }}
              onDelete={deleteAnimation}
              onClose={closePanels}
            />
          )}
          {activePanel === "settings" && (
            <SettingsPanel
              theme={theme}
              onClose={closePanels}
            />
          )}
          {activePanel === "docs" && (
            <Suspense fallback={null}>
              <DocsPanel
                theme={theme}
                lang={i18n.language}
                onClose={closePanels}
              />
            </Suspense>
          )}
        </div>
      )}

      {showNewProjectDialog && (
        <NewProjectDialog
          onClose={() => setShowNewProjectDialog(false)}
          onCreate={handleCreateNewProject}
        />
      )}

      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={handleImportProject}
        />
      )}

      <Suspense fallback={null}>
        <TileEditor
          key={tileEditorOpen ? (editingTilemap ?? "__new__") : "closed"}
          open={tileEditorOpen}
          initialName={editingTilemap ?? ""}
          onClose={() => { setTileEditorOpen(false); setEditingTilemap(null); }}
          onSave={(name, data) => { saveTilemap(name, data); setTileEditorOpen(false); setEditingTilemap(null); }}
          onNewSprite={() => { setEditingAsset(null); setEditorOpen(true); }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SpriteEditor
          key={editorOpen ? "open" : "closed"}
          open={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingAsset(null);
          }}
          onSave={(name, dataUrl) => {
            const cleanName = name.replace(/\.svg$/i, '');
            const oldName = editingAsset?.name.replace(/\.svg$/i, '') || '';

            if (editingAsset && oldName !== cleanName) {
              // Renamed: remove old asset, add new asset
              removeAsset(editingAsset.name);
              changeAsset(cleanName + ".svg", dataUrl);
            } else if (editingAsset) {
              // Updated: change existing asset
              changeAsset(editingAsset.name, dataUrl);
            } else {
              // New: toggle asset
              toggleAsset(cleanName + ".svg", dataUrl);
            }
            setEditorOpen(false);
            setEditingAsset(null);
          }}
          initialName={editingAsset?.name.replace(/\.svg$/i, '') || ''}
          initialDataUrl={editingAsset?.url}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SpriteEditor
          key={animEditorOpen ? `anim-${editingAnimation?.name ?? "__new__"}` : "anim-closed"}
          open={animEditorOpen}
          onClose={() => { setAnimEditorOpen(false); setEditingAnimation(null); }}
          onSave={() => { /* unused in anim mode; handled by onSaveAnimation */ }}
          initialName={editingAnimation?.name ?? ""}
          initialAnimation={editingAnimation?.data}
          onSaveAnimation={(name, data) => {
            saveAnimation(name, data);
            setAnimEditorOpen(false);
            setEditingAnimation(null);
          }}
        />
      </Suspense>
    </>
  );
}

// ── Panel Header ───────────────────────────
function PanelHeader({
  title,
  theme,
  onClose,
}: {
  title: string;
  theme: Theme;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        padding: "16px 20px 12px",
        borderBottom: `1px solid ${theme.panelBorder}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: theme.panelHeader,
      }}
    >
      <div
        style={{
          fontFamily: theme.fontUI,
          fontWeight: theme.weightHeader,
          fontSize: 17,
          color: theme.panelTxt,
        }}
      >
        {title}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          all: "unset",
          cursor: "pointer",
          width: 30,
          height: 30,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.panelTxtMute,
        }}
      >
        <Icon name="close" size={18} color="currentColor" />
      </button>
    </div>
  );
}

function SectionLabel({
  children,
  theme,
  noPad,
}: {
  children: React.ReactNode;
  theme: Theme;
  noPad?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: theme.fontUI,
        fontWeight: theme.weightUI + 100,
        fontSize: 11.5,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: theme.panelTxtMute,
        marginBottom: 8,
        paddingLeft: noPad ? 0 : 4,
      }}
    >
      {children}
    </div>
  );
}

// ── Projects Panel ─────────────────────────
type ProjectsPanelProps = {
  theme: Theme;
  projects: Record<string, { files: Record<string, string>; assets: Record<string, string> }>;
  userProjects: { id: string; name: string; files: Record<string, string>; assets: Record<string, string> }[];
  loading: boolean;
  currentProjectId: string | null;
  dirtyFiles: Set<string>;
  onOpenExample: (name: string) => void;
  onForkExample: (name: string) => void;
  onOpenUserProject: (project: { id: string; name: string; files: Record<string, string>; assets: Record<string, string> }) => void;
  onDeleteProject: (id: string) => void;
  onExportProject: (id: string) => void;
  onNewProject: () => void;
  onImport: () => void;
  onClose: () => void;
};

function ProjectsPanel({
  theme,
  projects,
  userProjects,
  loading,
  currentProjectId,
  dirtyFiles,
  onOpenExample,
  onOpenUserProject,
  onDeleteProject,
  onExportProject,
  onNewProject,
  onImport,
  onClose,
}: ProjectsPanelProps) {
  const { t } = useTranslation();
  const icons: IconName[] = ["cursor", "play", "square", "folder", "sparkle", "trash"];

  return (
    <>
      <PanelHeader title={t('sideMenu.projects')} theme={theme} onClose={onClose} />
      <div style={{ padding: "16px 16px 4px", overflowY: "auto", flex: 1 }}>
        <SectionLabel theme={theme}>{t('sideMenu.examples')}</SectionLabel>
        <div style={{ marginBottom: 18 }}>
          {Object.keys(projects).map((name, i) => (
            <ExampleRow
              key={name}
              name={name}
              icon={icons[i % icons.length]}
              theme={theme}
              current={!currentProjectId && true}
              onClick={() => onOpenExample(name)}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            paddingRight: 4,
          }}
        >
          <SectionLabel theme={theme} noPad>
            {t('sideMenu.yourProjects')}
          </SectionLabel>
          <div style={{ display: "flex", gap: 6 }}>
            <PanelButton theme={theme} icon="import" onClick={onImport}>
              {t('sideMenu.importProject') || "Import"}
            </PanelButton>
            <PanelButton theme={theme} icon="plus" primary onClick={onNewProject}>
              {t('sideMenu.newProject')}
            </PanelButton>
          </div>
        </div>
        <div>
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "16px 0",
                fontFamily: theme.fontUI,
                fontSize: 13,
                color: theme.panelTxtMute,
              }}
            >
              {t('sideMenu.loadingProjects')}
            </div>
          ) : userProjects.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "16px 0",
                fontFamily: theme.fontUI,
                fontSize: 13,
                color: theme.panelTxtMute,
              }}
            >
              {t('sideMenu.noProjects')}
            </div>
          ) : (
            userProjects.map((p) => (
              <ProjectRow
                key={p.id}
                name={p.name}
                isCurrent={currentProjectId === p.id}
                dirty={currentProjectId === p.id && dirtyFiles.size > 0}
                theme={theme}
                onClick={() => onOpenUserProject(p)}
                onDelete={() => onDeleteProject(p.id)}
                onExport={() => onExportProject(p.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ExampleRow({
  name,
  icon,
  theme,
  current,
  onClick,
}: {
  name: string;
  icon: IconName;
  theme: Theme;
  current?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: theme.radiusButton,
        background: current ? theme.chip : hover ? theme.chip : "transparent",
        marginBottom: 2,
        width: "100%",
        boxSizing: "border-box",
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: current ? theme.accent + "22" : theme.chip,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: current ? theme.accent : theme.panelTxtMute,
          flex: "none",
        }}
      >
        <Icon name={icon} size={20} color="currentColor" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            color: theme.panelTxt,
            fontSize: 14,
            lineHeight: 1.2,
          }}
        >
          {name}
        </div>
      </div>
      {current && (
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            background: theme.successPill,
            color: theme.successPillTxt,
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {t('sideMenu.openBadge')}
        </span>
      )}
    </button>
  );
}

function ProjectRow({
  name,
  isCurrent,
  dirty,
  theme,
  onClick,
  onDelete,
  onExport,
}: {
  name: string;
  isCurrent?: boolean;
  dirty?: boolean;
  theme: Theme;
  onClick: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: theme.radiusButton,
        background: isCurrent ? theme.chip : hover ? theme.chip : "transparent",
        marginBottom: 2,
        width: "100%",
        boxSizing: "border-box",
        transition: "background 0.15s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div
          style={{
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            color: theme.panelTxt,
            fontSize: 14,
            lineHeight: 1.2,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {name}
          {dirty && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 7,
                background: theme.tabDirty,
              }}
            />
          )}
        </div>
      </div>
      <span
        style={{
          opacity: hover ? 1 : 0,
          transition: "opacity 0.15s",
          display: "inline-flex",
          gap: 4,
          color: theme.panelTxtMute,
        }}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onExport(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onExport(); } }}
          style={{
            cursor: "pointer",
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
          }}
        >
          <Icon name="export" size={16} color="currentColor" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onDelete(); } }}
          style={{
            cursor: "pointer",
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
          }}
        >
          <Icon name="trash" size={16} color="currentColor" />
        </span>
      </span>
    </button>
  );
}

function PanelButton({
  children,
  theme,
  icon,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  theme: Theme;
  icon?: IconName;
  primary?: boolean;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 12px",
        borderRadius: 999,
        fontFamily: theme.fontUI,
        fontWeight: theme.weightUI + 100,
        fontSize: 12.5,
        background: primary ? theme.runBg : theme.chip,
        color: primary ? theme.runTxt : theme.panelTxt,
        boxShadow: primary && hover ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
        transition: "box-shadow 0.15s",
      }}
    >
      {icon && <Icon name={icon} size={14} color="currentColor" />}
      {children}
    </button>
  );
}

// ── Assets Panel ───────────────────────────

const CATEGORIES: Category[] = [
  "Characters", "Enemies", "Vehicles", "Tiles",
  "Items", "Hazards", "Effects", "Buildings",
];

function AvailableSpriteTile({
  url,
  name,
  theme,
  onClick,
}: {
  url: string;
  name: string;
  theme: Theme;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={name}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        aspectRatio: "1 / 1",
        background: theme.chip,
        borderRadius: theme.radiusCard,
        border: `2px solid transparent`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        transition: "transform 0.12s",
        transform: hover ? "translateY(-2px)" : "none",
      }}
    >
      <img src={url} alt={name} style={{ width: "80%", height: "80%", objectFit: "contain" }} />
    </button>
  );
}

function UsedSpriteTile({
  url,
  name,
  theme,
  onDelete,
  onDuplicate,
  onEdit,
}: {
  url: string;
  name: string;
  theme: Theme;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const baseName = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const pythonName = `assets.sprites.${baseName}`;

  const closeCtx = () => setCtxMenu(null);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { closeCtx(); onEdit(); }}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
      style={{
        aspectRatio: "1 / 1",
        background: theme.chip,
        borderRadius: theme.radiusCard,
        border: `2px solid ${hover ? theme.accent : theme.accent + "88"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "visible",
        transform: hover ? "scale(1.12)" : "scale(1)",
        transformOrigin: "center",
        transition: "transform 0.14s, border-color 0.14s",
        cursor: "pointer",
        zIndex: hover ? 3 : 1,
      }}
    >
      <img src={url} alt={name} style={{
        width: "80%", height: "80%", objectFit: "contain",
        borderRadius: theme.radiusCard,
        pointerEvents: "none",
      }} />

      {/* Name badge — visible on hover, click copies python name */}
      <div
        title={`Click to copy: ${pythonName}`}
        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(pythonName); }}
        style={{
          position: "absolute",
          bottom: -22,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.panelTxt,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 4,
          padding: "1px 5px",
          cursor: "copy",
          opacity: hover ? 1 : 0,
          transition: "opacity 0.12s",
          pointerEvents: hover ? "auto" : "none",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <Icon name="copy" size={9} color={theme.panelTxtMute} />
        {baseName}
      </div>

      {/* Right-click context menu — rendered in a portal to escape the tile's CSS transform */}
      {ctxMenu && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={closeCtx}
            onContextMenu={(e) => { e.preventDefault(); closeCtx(); }}
          />
          <div style={{
            position: "fixed",
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 100,
            background: theme.surfacePanel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 8,
            padding: "4px 0",
            minWidth: 130,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); closeCtx(); onDuplicate(); }}
              style={{
                all: "unset", display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "6px 12px", cursor: "pointer",
                fontSize: 12, color: theme.panelTxt, fontFamily: theme.fontUI,
                boxSizing: "border-box",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = theme.chip)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="copy" size={13} color={theme.panelTxt} />
              {t('sideMenu.duplicate')}
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); closeCtx(); onDelete(); }}
              style={{
                all: "unset", display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "6px 12px", cursor: "pointer",
                fontSize: 12, color: "#ef4444", fontFamily: theme.fontUI,
                boxSizing: "border-box",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="trash" size={13} color="#ef4444" />
              {t('sideMenu.remove')}
            </button>
          </div>
        </>, document.body
      )}
    </div>
  );
}

// ── Tilemaps Panel ─────────────────────────
function TilemapsPanel({
  theme, tilemaps, onOpen, onNew, onDelete, onClose,
}: {
  theme: Theme;
  tilemaps: Record<string, TilemapData>;
  onOpen: (name: string) => void;
  onNew: () => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const names = Object.keys(tilemaps);
  return (
    <>
      <PanelHeader title={t('sideMenu.tilemaps')} theme={theme} onClose={onClose} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            all: "unset", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: theme.radiusCard,
            border: `1.5px dashed ${theme.panelBorder}`,
            color: theme.panelTxtMute, fontSize: 13, fontFamily: theme.fontUI,
          }}
        >
          <Icon name="plus" size={16} color="currentColor" />
          {t('sideMenu.newTilemap')}
        </button>
        {names.length === 0 && (
          <div style={{ fontSize: 12, color: theme.panelTxtMute, paddingTop: 4 }}>
            {t('sideMenu.noTilemaps')}
          </div>
        )}
        {names.map((name) => (
          <div key={name} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 10px", borderRadius: theme.radiusCard,
            background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
          }}>
            <Icon name="grid" size={14} color={theme.panelTxtMute} />
            <span
              style={{ flex: 1, fontSize: 13, fontFamily: theme.fontUI, color: theme.panelTxt, cursor: "pointer" }}
              onClick={() => onOpen(name)}
            >
              {name}
            </span>
            <button
              type="button"
              title={t('sideMenu.editTilemap')}
              onClick={() => onOpen(name)}
              style={{ all: "unset", cursor: "pointer", color: theme.panelTxtMute, display: "flex" }}
            >
              <Icon name="pencil" size={13} color="currentColor" />
            </button>
            <button
              type="button"
              title={t('sideMenu.deleteTilemap')}
              onClick={() => onDelete(name)}
              style={{ all: "unset", cursor: "pointer", color: "#ef4444", display: "flex" }}
            >
              <Icon name="trash" size={13} color="currentColor" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Animations Panel ───────────────────────
function AnimationsPanel({
  theme, animations, onEdit, onNew, onDelete, onClose,
}: {
  theme: Theme;
  animations: Record<string, import('./state/IdeState').AnimationData>;
  onEdit: (name: string, data: import('./state/IdeState').AnimationData) => void;
  onNew: () => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const names = Object.keys(animations);
  return (
    <>
      <PanelHeader title={t('sideMenu.animations')} theme={theme} onClose={onClose} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            all: "unset", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: theme.radiusCard,
            border: `1.5px dashed ${theme.panelBorder}`,
            color: theme.panelTxtMute, fontSize: 13, fontFamily: theme.fontUI,
          }}
        >
          <Icon name="plus" size={16} color="currentColor" />
          {t('sideMenu.newAnimation')}
        </button>
        {names.length === 0 && (
          <div style={{ fontSize: 12, color: theme.panelTxtMute, paddingTop: 4 }}>
            {t('sideMenu.noAnimations')}
          </div>
        )}
        {names.map((name) => {
          const anim = animations[name];
          const pythonName = `assets.animations.${name}`;
          return (
            <div key={name} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 10px", borderRadius: theme.radiusCard,
              background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
            }}>
              <Icon name="play" size={14} color={theme.panelTxtMute} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  title={`Click to copy: ${pythonName}`}
                  onClick={() => navigator.clipboard.writeText(pythonName)}
                  style={{
                    fontSize: 13, fontFamily: theme.fontUI, color: theme.panelTxt,
                    cursor: "copy", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
                <div style={{ fontSize: 10, color: theme.panelTxtMute, fontFamily: theme.fontUI }}>
                  {anim.frames.length} {t('sideMenu.frames')} · {anim.fps} fps
                </div>
              </div>
              <button
                type="button"
                title={t('sideMenu.editAnimation')}
                onClick={() => onEdit(name, anim)}
                style={{ all: "unset", cursor: "pointer", color: theme.panelTxtMute, display: "flex" }}
              >
                <Icon name="pencil" size={13} color="currentColor" />
              </button>
              <button
                type="button"
                title={t('sideMenu.deleteAnimation')}
                onClick={() => onDelete(name)}
                style={{ all: "unset", cursor: "pointer", color: "#ef4444", display: "flex" }}
              >
                <Icon name="trash" size={13} color="currentColor" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

type AssetsPanelProps = {
  theme: Theme;
  projectAssets: Record<string, string>;
  onAddAsset: (baseName: string, url: string) => void;
  onRemoveAsset: (instanceName: string) => void;
  onNewSprite: () => void;
  onEditAsset: (name: string, url: string) => void;
  onClose: () => void;
};

function AssetsPanel({
  theme,
  projectAssets,
  onAddAsset,
  onRemoveAsset,
  onNewSprite,
  onEditAsset,
  onClose,
}: AssetsPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activePerspective, setActivePerspective] = useState<Perspective | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = (activeCategory ? 1 : 0) + (activePerspective ? 1 : 0);

  const usedEntries = Object.entries(projectAssets);

  const availableSprites = packAssetsByMeta(
    activeCategory ?? undefined,
    activePerspective ?? undefined,
  ).filter(({ name }) => name.includes(query.trim().toLowerCase()));

  const tabBtnStyle = (active: boolean) => ({
    all: "unset" as const,
    cursor: "pointer" as const,
    padding: "3px 8px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: theme.fontUI,
    background: active ? theme.accent : theme.chip,
    color: active ? "#fff" : theme.panelTxtMute,
    whiteSpace: "nowrap" as const,
    transition: "background 0.12s, color 0.12s",
  });

  return (
    <>
      <PanelHeader title={t('sideMenu.assets')} theme={theme} onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {/* Used section */}
        <div style={{ padding: "12px 14px 0" }}>
          <SectionLabel theme={theme}>{t('sideMenu.selectedAssets')}</SectionLabel>
        </div>
        <div style={{ padding: "0 14px 12px" }}>
          {usedEntries.length === 0 ? (
            <div style={{ fontSize: 12, color: theme.panelTxtMute, padding: "8px 0" }}>
              {t('sideMenu.noAssetsSelected')}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {usedEntries.map(([name, url]) => (
                <UsedSpriteTile
                  key={name}
                  name={name}
                  url={url}
                  theme={theme}
                  onDelete={() => onRemoveAsset(name)}
                  onDuplicate={() => onAddAsset(name, url)}
                  onEdit={() => onEditAsset(name, url)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Available section with filters */}
        <div style={{ borderTop: `1px solid ${theme.panelBorder}`, padding: "10px 14px 6px" }}>
          <SectionLabel theme={theme}>{t('sideMenu.availableAssets')}</SectionLabel>

          {/* Search bar + filter toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: showFilters ? 6 : 10 }}>
            <input
              type="text"
              placeholder={t('sideMenu.searchSprites')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                all: "unset",
                flex: 1,
                padding: "6px 10px",
                background: theme.chip,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 8,
                fontFamily: theme.fontUI,
                fontSize: 12,
                color: theme.panelTxt,
              }}
            />
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              title={t('sideMenu.filterSprites')}
              style={{
                all: "unset", cursor: "pointer", flexShrink: 0,
                height: 32, padding: "0 8px",
                display: "inline-flex", alignItems: "center", gap: 4,
                background: showFilters || activeFilterCount > 0
                  ? theme.accent + "22" : theme.chip,
                border: `1px solid ${showFilters || activeFilterCount > 0 ? theme.accent : theme.panelBorder}`,
                borderRadius: 8,
                fontFamily: theme.fontUI, fontSize: 11, fontWeight: 600,
                color: showFilters || activeFilterCount > 0 ? theme.accent : theme.panelTxtMute,
              }}
            >
              <Icon name="filter" size={13} color="currentColor" />
              {activeFilterCount > 0 && (
                <span style={{
                  background: theme.accent, color: "#fff",
                  borderRadius: 99, fontSize: 9, fontWeight: 700,
                  minWidth: 14, height: 14, display: "inline-flex",
                  alignItems: "center", justifyContent: "center", padding: "0 3px",
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter dropdown */}
          {showFilters && (
            <div style={{
              marginBottom: 8, padding: "8px 10px",
              background: theme.chip,
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: 8,
            }}>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: theme.panelTxtMute,
                  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  {t('sideMenu.filterCategory')}
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  <button style={tabBtnStyle(activeCategory === null)}
                    onClick={() => setActiveCategory(null)}>{t('sideMenu.filterAll')}</button>
                  {CATEGORIES.map((cat) => (
                    <button key={cat} style={tabBtnStyle(activeCategory === cat)}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: theme.panelTxtMute,
                  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  {t('sideMenu.filterPerspective')}
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {([null, "side", "top-down"] as const).map((p) => (
                    <button key={p ?? "all"} style={tabBtnStyle(activePerspective === p)}
                      onClick={() => setActivePerspective(p)}>
                      {p === null ? t('sideMenu.filterAll') : p === "side" ? t('sideMenu.filterSide') : t('sideMenu.filterTopDown')}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button type="button"
                  onClick={() => { setActiveCategory(null); setActivePerspective(null); }}
                  style={{
                    all: "unset", cursor: "pointer", marginTop: 6,
                    fontSize: 10, color: theme.accent, fontFamily: theme.fontUI,
                  }}>
                  {t('sideMenu.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Available grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
          {availableSprites.length === 0 ? (
            <div style={{ fontSize: 12, color: theme.panelTxtMute, paddingTop: 8, textAlign: "center" }}>
              {t('sideMenu.noSpritesMatch')}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={onNewSprite}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  aspectRatio: "1 / 1",
                  border: `1.5px dashed ${theme.panelBorder}`,
                  borderRadius: theme.radiusCard,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  color: theme.panelTxtMute,
                  fontFamily: theme.fontUI,
                  fontSize: 11,
                  fontWeight: theme.weightUI,
                }}
              >
                <Icon name="plus" size={20} color="currentColor" />
                {t('sideMenu.newSprite')}
              </button>
              {availableSprites.map(({ name, url }) => (
                <AvailableSpriteTile
                  key={name}
                  name={name}
                  url={url}
                  theme={theme}
                  onClick={() => onAddAsset(name, url)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Settings Panel ─────────────────────────
function ToggleRow({
  label,
  hint,
  on,
  theme,
  accent,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  theme: Theme;
  accent?: string;
  onChange?: (v: boolean) => void;
}) {
  const [v, setV] = useState(on);
  const current = v;
  return (
    <button
      type="button"
      onClick={() => {
        const next = !v;
        setV(next);
        onChange?.(next);
      }}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        marginBottom: 6,
        background: theme.chip,
        borderRadius: theme.radiusCard,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            color: theme.panelTxt,
            fontSize: 14,
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontFamily: theme.fontUI,
              fontSize: 12,
              color: theme.panelTxtMute,
              marginTop: 2,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <span
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          background: current ? (accent || theme.runBg) : theme.panelBorder,
          position: "relative",
          transition: "background 0.18s",
          flex: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: current ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 0.18s",
          }}
        />
      </span>
    </button>
  );
}

function SettingsPanel({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const showHitboxes = useIde((s) => s.showHitboxes);
  const setShowHitboxes = useIde((s) => s.setShowHitboxes);
  const showConsoleOnRun = useIde((s) => s.showConsoleOnRun);
  const setShowConsoleOnRun = useIde((s) => s.setShowConsoleOnRun);
  const enableLinting = useIde((s) => s.enableLinting);
  const setEnableLinting = useIde((s) => s.setEnableLinting);
  const enableAutocomplete = useIde((s) => s.enableAutocomplete);
  const setEnableAutocomplete = useIde((s) => s.setEnableAutocomplete);
  const consoleOnRight = useIde((s) => s.consoleOnRight);
  const setConsoleOnRight = useIde((s) => s.setConsoleOnRight);
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const fontSize = useThemeStore((s) => s.fontSize);
  const setFontSize = useThemeStore((s) => s.setFontSize);

  const themes: { id: ThemeId; label: string }[] = [
    { id: "studio", label: "Studio" },
    { id: "midnight", label: "Midnight" },
    { id: "daylight", label: "Daylight" },
  ];

  const languages = [
    { id: "en", label: "English" },
    { id: "ru", label: "Русский" },
  ];

  return (
    <>
      <PanelHeader title={t('sideMenu.settings')} theme={theme} onClose={onClose} />
      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>

        {/* Language */}
        <SectionLabel theme={theme}>{t('sideMenu.language')}</SectionLabel>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {languages.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => i18n.changeLanguage(l.id)}
              style={{
                all: "unset", cursor: "pointer", flex: 1,
                padding: "10px 0",
                borderRadius: theme.radiusCard,
                fontFamily: theme.fontUI,
                fontWeight: i18n.language === l.id ? 600 : 400,
                fontSize: 13,
                textAlign: "center",
                background: i18n.language === l.id ? theme.accent : theme.chip,
                color: i18n.language === l.id ? "#fff" : theme.panelTxt,
                transition: "background 0.15s",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Theme selector */}
        <SectionLabel theme={theme}>{t('sideMenu.theme')}</SectionLabel>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {themes.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setTheme(th.id)}
              style={{
                all: "unset", cursor: "pointer", flex: 1,
                padding: "10px 0",
                borderRadius: theme.radiusCard,
                fontFamily: theme.fontUI,
                fontWeight: themeId === th.id ? 600 : 400,
                fontSize: 13,
                textAlign: "center",
                background: themeId === th.id ? theme.accent : theme.chip,
                color: themeId === th.id ? "#fff" : theme.panelTxt,
                transition: "background 0.15s",
              }}
            >
              {th.label}
            </button>
          ))}
        </div>

        {/* Font size */}
        <SectionLabel theme={theme}>{t('sideMenu.fontSize')}</SectionLabel>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", marginBottom: 20,
          background: theme.chip, borderRadius: theme.radiusCard,
        }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxtMute }}>10</span>
          <input
            type="range" min="10" max="24" step="1"
            value={fontSize}
            onChange={(e) => setFontSize(+e.target.value)}
            style={{ flex: 1, accentColor: theme.accent }}
          />
          <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxtMute }}>24</span>
          <span style={{
            fontFamily: theme.fontMono, fontSize: 13, color: theme.panelTxt,
            minWidth: 32, textAlign: "right",
          }}>{fontSize}px</span>
        </div>

        {/* Console */}
        <SectionLabel theme={theme}>{t('sideMenu.console')}</SectionLabel>
        <ToggleRow
          label={t('sideMenu.autoHideConsole')}
          hint={t('sideMenu.autoHideConsoleHint')}
          on={showConsoleOnRun}
          theme={theme}
          accent={theme.accent}
          onChange={(v) => setShowConsoleOnRun(v)}
        />
        <ToggleRow
          label={t('sideMenu.consoleOnRight')}
          hint={t('sideMenu.consoleOnRightHint')}
          on={consoleOnRight}
          theme={theme}
          accent={theme.accent}
          onChange={(v) => setConsoleOnRight(v)}
        />

        <div style={{ height: 4 }} />

        {/* Linting */}
        <SectionLabel theme={theme}>{t('sideMenu.linting')}</SectionLabel>
        <ToggleRow
          label={t('sideMenu.enableLinting')}
          hint={t('sideMenu.enableLintingHint')}
          on={enableLinting}
          theme={theme}
          accent={theme.accent}
          onChange={(v) => setEnableLinting(v)}
        />

        <div style={{ height: 4 }} />

        {/* Editor */}
        <SectionLabel theme={theme}>{t('sideMenu.editor')}</SectionLabel>
        <ToggleRow
          label={t('sideMenu.enableAutocomplete')}
          hint={t('sideMenu.enableAutocompleteHint')}
          on={enableAutocomplete}
          theme={theme}
          accent={theme.accent}
          onChange={(v) => setEnableAutocomplete(v)}
        />

        <div style={{ height: 4 }} />

        {/* Hitboxes */}
        <SectionLabel theme={theme}>{t('sideMenu.runtime')}</SectionLabel>
        <ToggleRow
          label={t('sideMenu.showHitboxes')}
          hint={t('sideMenu.showHitboxesHint')}
          on={showHitboxes}
          theme={theme}
          accent={theme.accent}
          onChange={(v) => setShowHitboxes(v)}
        />
      </div>
    </>
  );
}
