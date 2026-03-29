import { useEffect, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import ProjectIcon from "./assets/project.svg";
import PlayIcon from "./assets/play.svg";
import StopIcon from "./assets/stop.svg";
import AssetsIcon from "./assets/assets.svg";
import SettingsIcon from "./assets/settings.svg";
import { PACK_ASSET_LIST } from "./state/assets";
import { useIde, useEditor } from "./state/IdeState";
import { useRunner } from "./runner/RunnerProvider";
import { useRunButton } from "./hooks/useRunButton";
import { useProjects } from "./hooks/useProjects";
import { useAutoSave } from "./hooks/useAutoSave";
import { usePanels } from "./hooks/usePanels";
import Backdrop from "./components/Backdrop";
import SidePanel from "./components/SidePanel";
import IconButton from "./components/IconButton";
import ProjectButton from "./components/ProjectButton";
import NewProjectDialog from "./components/dialogs/NewProjectDialog";
import ImportDialog from "./components/dialogs/ImportDialog";

const SpriteEditor = lazy(() => import("./SpriteEditor"));

export default function Rail() {
  const { t } = useTranslation();
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const importProjectFromFile = useIde((s) => s.importProjectFromFile);
  const showHitboxes = useIde((s) => s.showHitboxes);
  const setShowHitboxes = useIde((s) => s.setShowHitboxes);

  const toggleAsset = useEditor((s) => s.toggleAsset);
  const project = useEditor((s) => s.project);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const changeEditorCurrentProject = useEditor((s) => s.changeCurrentProject);
  const markClean = useEditor((s) => s.markClean);

  const [editorOpen, setEditorOpen] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<{
    name: string;
    url: string;
  } | null>(null);

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
      await saveCurrentProject();
      markClean();
    }

    changeEditorCurrentProject(
      {
        files: userProject.files,
        assets: userProject.assets,
      },
      userProject.id,
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
      alert(t('sideMenu.failedExport'));
    }
  };

  const handleImportProject = async (file: File) => {
    try {
      const importedProject = await importProjectFromFile(file);
      changeEditorCurrentProject(
        {
          files: importedProject.files,
          assets: importedProject.assets,
        },
        importedProject.id,
      );
      setShowImportDialog(false);
    } catch (error) {
      console.error("Failed to import project:", error);
      alert(t('sideMenu.failedImport'));
    }
  };

  const allAssets = [...PACK_ASSET_LIST];
  const userAssetsMap = new Map(Object.entries(project.assets));

  userAssetsMap.forEach((url, name) => {
    const existingIndex = allAssets.findIndex((asset) => asset.name === name);
    if (existingIndex >= 0) {
      allAssets[existingIndex] = { name, url };
    } else {
      allAssets.push({ name, url });
    }
  });

  const sortedAssets = allAssets.sort((a, b) => {
    const aSelected = !!project.assets[a.name];
    const bSelected = !!project.assets[b.name];
    if (aSelected === bSelected) return 0;
    return aSelected ? -1 : 1;
  });

  const isRunning = running || isP5;
  const runIcon = !ready ? SettingsIcon : isRunning ? StopIcon : PlayIcon;
  const runLabel = !ready ? t('sideMenu.loading') : isRunning ? t('sideMenu.stop') : t('sideMenu.run');

  return (
    <>
      <nav className="flex flex-col bg-cyan-700 text-white p-2 gap-2 z-10">
        <IconButton
          label={t('sideMenu.projects')}
          icon={ProjectIcon}
          expanded={isOpen("projects")}
          controls="panel-projects"
          onClick={() => togglePanel("projects")}
          active={isOpen("projects")}
        />

        <IconButton
          label={runLabel}
          icon={runIcon}
          active={false}
          disabled={!ready}
          spin={!ready}
          onClick={handleRunToggle}
        />

        <IconButton
          label={t('sideMenu.assets')}
          icon={AssetsIcon}
          expanded={isOpen("assets")}
          controls="panel-assets"
          onClick={() => togglePanel("assets")}
          active={isOpen("assets")}
        />

        <div className="flex-1" />

        <IconButton
          label={t('sideMenu.settings')}
          icon={SettingsIcon}
          expanded={isOpen("settings")}
          controls="panel-settings"
          onClick={() => togglePanel("settings")}
          active={isOpen("settings")}
        />
      </nav>

      <Backdrop open={activePanel !== null} onClick={closePanels} />

      <SidePanel
        id="panel-projects"
        title={t('sideMenu.projects')}
        open={isOpen("projects")}
        side="left"
        onClose={closePanels}
      >
        <ProjectsPanel
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
        />
      </SidePanel>

      <SidePanel
        id="panel-assets"
        title={t('sideMenu.assets')}
        open={isOpen("assets")}
        side="left"
        onClose={closePanels}
      >
        <AssetsPanel
          assets={sortedAssets}
          selectedAssets={project.assets}
          onToggleAsset={toggleAsset}
          onNewSprite={() => setEditorOpen(true)}
          onEditAsset={(name, url) => {
            setEditingAsset({ name, url });
            setEditorOpen(true);
          }}
          onRemoveAsset={toggleAsset}
        />
      </SidePanel>

      <SidePanel
        id="panel-settings"
        title={t('sideMenu.settings')}
        open={isOpen("settings")}
        side="left"
        onClose={closePanels}
      >
        <SettingsPanel showHitboxes={showHitboxes} onShowHitboxesChange={setShowHitboxes} />
      </SidePanel>

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
              const newAssets = { ...project.assets };
              delete newAssets[editingAsset.name];
              newAssets[cleanName + ".svg"] = dataUrl;
              changeEditorCurrentProject(
                { ...project, assets: newAssets },
                currentProjectId || undefined,
              );
            } else if (editingAsset) {
              const newAssets = { ...project.assets };
              newAssets[editingAsset.name] = dataUrl;
              changeEditorCurrentProject(
                { ...project, assets: newAssets },
                currentProjectId || undefined,
              );
            } else {
              toggleAsset(cleanName + ".svg", dataUrl);
            }
            setEditorOpen(false);
            setEditingAsset(null);
          }}
          initialName={editingAsset?.name.replace(/\.svg$/i, '') || ''}
          initialDataUrl={editingAsset?.url}
        />
      </Suspense>
    </>
  );
}

type ProjectsPanelProps = {
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
};

function ProjectsPanel({
  projects,
  userProjects,
  loading,
  currentProjectId,
  dirtyFiles,
  onOpenExample,
  onForkExample,
  onOpenUserProject,
  onDeleteProject,
  onExportProject,
  onNewProject,
  onImport,
}: ProjectsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-cyan-300">{t('sideMenu.examples')}</h3>
        </div>
        <div className="space-y-1.5">
          {Object.keys(projects).map((name) => (
            <ProjectButton
              key={name}
              name={name}
              isExample={true}
              isCurrent={!currentProjectId && projects[name] === projects[name]}
              onClick={() => onOpenExample(name)}
              onDelete={() => onForkExample(name)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-cyan-300">
            {t('sideMenu.yourProjects')}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onImport}
              className="px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              title={t('sideMenu.importProjectTooltip')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              onClick={onNewProject}
              className="px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              title={t('sideMenu.newProjectTooltip')}
            >
              {t('sideMenu.newProject')}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-4 text-cyan-300">
            {t('sideMenu.loadingProjects')}
          </div>
        ) : userProjects.length === 0 ? (
          <div className="text-center py-4 text-cyan-300/70 text-sm">
            {t('sideMenu.noProjects')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {userProjects.map((userProject) => (
              <ProjectButton
                key={userProject.id}
                name={userProject.name}
                isCurrent={currentProjectId === userProject.id}
                hasChanges={currentProjectId === userProject.id && dirtyFiles.size > 0}
                onClick={() => onOpenUserProject(userProject)}
                onDelete={() => onDeleteProject(userProject.id)}
                onExport={() => onExportProject(userProject.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type AssetsPanelProps = {
  assets: { name: string; url: string }[];
  selectedAssets: Record<string, string>;
  onToggleAsset: (name: string, url: string) => void;
  onNewSprite: () => void;
  onEditAsset: (name: string, url: string) => void;
  onRemoveAsset: (name: string, url: string) => void;
};

function AssetsPanel({
  assets,
  selectedAssets,
  onToggleAsset,
  onNewSprite,
  onEditAsset,
  onRemoveAsset,
}: AssetsPanelProps) {
  const { t } = useTranslation();

  const selected = assets.filter(({ name }) => selectedAssets[name]);
  const available = assets.filter(({ name }) => !selectedAssets[name]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">
          {t('sideMenu.selectedAssets')}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {selected.map(({ name, url }) => (
            <AssetTile
              key={url}
              name={name}
              url={url}
              selected
              onDoubleClick={() => onEditAsset(name, url)}
              onRemove={() => onRemoveAsset(name, url)}
            />
          ))}
          {selected.length === 0 && (
            <div className="col-span-3 text-center py-4 text-white text-sm">
              {t('sideMenu.noAssetsSelected')}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-2">
          {t('sideMenu.availableAssets')}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onNewSprite}
            className="flex flex-col items-center justify-center gap-1 p-1 rounded border border-white/20 hover:border-white/40 min-h-[60px]"
          >
            <span className="text-2xl text-white/60 hover:text-white leading-none">+</span>
            <span className="text-xs text-white/60 hover:text-white truncate w-full text-center">
              {t('sideMenu.newSprite')}
            </span>
          </button>
          {available.map(({ name, url }) => (
            <AssetTile
              key={url}
              name={name}
              url={url}
              onClick={() => onToggleAsset(name, url)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type AssetTileProps = {
  name: string;
  url: string;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onRemove?: () => void;
};

function AssetTile({ name, url, selected, onClick, onDoubleClick, onRemove }: AssetTileProps) {
  const { t } = useTranslation();
  const displayName = name.replace(/\.svg$/i, '');

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`w-full aspect-square p-1 rounded border bg-cyan-900/50 hover:bg-cyan-800/60 transition-colors ${
          selected ? "border-cyan-400" : "border-cyan-600"
        }`}
        title={displayName}
      >
        <img src={url} alt={displayName} className="w-full h-full object-contain" />
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow"
          title={t('sideMenu.remove')}
        >
          <span className="text-xs">×</span>
        </button>
      )}
    </div>
  );
}

type SettingsPanelProps = {
  showHitboxes: boolean;
  onShowHitboxesChange: (show: boolean) => void;
};

function SettingsPanel({ showHitboxes, onShowHitboxesChange }: SettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" className="accent-cyan-500" defaultChecked /> {t('sideMenu.autoSave')}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="accent-cyan-500" /> {t('sideMenu.vimMode')}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="accent-cyan-500"
          checked={showHitboxes}
          onChange={(e) => onShowHitboxesChange(e.target.checked)}
        /> {t('sideMenu.showHitboxes')}
      </label>
    </div>
  );
}
