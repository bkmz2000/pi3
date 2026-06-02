import { useEffect, useState, lazy, Suspense } from "react";
import ProjectExplorer from "./ProjectExplorer";
import { useTranslation } from "react-i18next";
import { useIde, useEditor } from "./state/IdeState";
import { useRunner } from "./runner/RunnerProvider";
import { useRunButton } from "./hooks/useRunButton";
import { useProjects } from "./hooks/useProjects";
import { useAutoSave } from "./hooks/useAutoSave";
import { usePanels } from "./hooks/usePanels";
import { useThemeStore, type Theme, type ThemeId } from "./state/useTheme";
import { useUser } from "./state/useUser";
import { getProject } from "./state/api";
import Backdrop from "./components/Backdrop";
import ImportDialog from "./components/dialogs/ImportDialog";
import { ThemedDialog } from "./components/ThemedDialog";
import {
  Icon,
  type IconName,
} from "./components/Icons";
import { CloseButton } from "./components/CloseButton";

import AssetEditor, { type AssetEditorMode } from "./AssetEditor";
import ExamplesPanel from "./ExamplesPanel";
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
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const changeEditorCurrentProject = useEditor((s) => s.changeCurrentProject);
  const exampleProjects = useIde((s) => s.projects);
  const saveCurrentProject = useIde((s) => s.saveCurrentProject);
  const importProjectFromFile = useIde((s) => s.importProjectFromFile);
  const markClean = useEditor((s) => s.markClean);

  // Single unified launch point for sprite/animation/tilemap editing.
  const [editorMode, setEditorMode] = useState<AssetEditorMode | null>(null);
  const [editingSheetSprite, setEditingSheetSprite] = useState<string | null>(null);
  const [editingTilemap, setEditingTilemap] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const withUnsavedGuard = (action: () => Promise<void>) => {
    if (dirtyFiles.size > 0) {
      setPendingAction(() => action);
    } else {
      action();
    }
  };

  const closeEditor = () => {
    setEditorMode(null);
    setEditingSheetSprite(null);
    setEditingTilemap(null);
  };

  const { user } = useUser();
  const { ready } = useRunner();
  const { running, handleRunToggle } = useRunButton();
  const {
    userProjects,
    loading,
    loadUserProjects,
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

    // Fetch full project data — the list endpoint doesn't include files/assets
    const full = await getProject(userProject.id);
    changeEditorCurrentProject(
      {
        files: full.files,
        assets: full.assets,
        tilemaps: full.tilemaps ?? {},
      },
      full.id,
    );
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
        },
        importedProject.id,
      );
      setShowImportDialog(false);
    } catch (error) {
      console.error("Failed to import project:", error);
      setAlertMsg(t('sideMenu.failedImport'));
    }
  };

  const saveTilemap = useEditor((s) => s.saveTilemap);

  const isRunning = running;
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
      {pendingAction && (
        <ThemedDialog title="Unsaved changes" onClose={() => setPendingAction(null)}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'inherit' }}>
            You have unsaved changes. What would you like to do?
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '7px 16px', borderRadius: 6,
                fontSize: 13, color: theme.panelTxtMute,
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const action = pendingAction;
                setPendingAction(null);
                markClean();
                await action();
              }}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '7px 16px', borderRadius: 6,
                fontSize: 13, color: theme.panelTxtMute,
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={async () => {
                const action = pendingAction;
                setPendingAction(null);
                const success = await saveCurrentProject();
                if (success) markClean();
                await action();
              }}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '7px 16px', borderRadius: 6,
                background: theme.runBg, color: theme.runTxt,
                fontSize: 13, fontWeight: 600,
              }}
            >
              Save and continue
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

        <RailButton
          icon="examples"
          label={t('examples.title', 'Examples')}
          active={isOpen("examples")}
          onClick={() => togglePanel("examples")}
          theme={theme}
        />

        <div style={{ position: "relative", marginTop: 4, marginBottom: 4 }}>
          <button
            type="button"
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleRunToggle(); }}
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

        <div style={{ width: 26, height: 1, background: "rgba(148,210,216,0.22)", margin: "6px 0" }} />

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
          role="region"
          aria-label={activePanel.charAt(0).toUpperCase() + activePanel.slice(1)}
          style={{
            position: "absolute",
            top: 0, bottom: 0, left: 60,
            // Docs needs more horizontal room for signatures + param tables;
            // other panels are mostly vertical lists.
            width: activePanel === "docs" ? 520 : 320,
            background: theme.surfacePanel,
            display: "flex",
            flexDirection: "column",
            borderRight: `1px solid ${theme.panelBorder}`,
            boxShadow: "8px 0 28px rgba(0,0,0,0.28), 2px 0 6px rgba(0,0,0,0.10)",
            zIndex: 10,
          }}
        >
          {activePanel === "examples" && (
            <ExamplesPanel
              onClose={closePanels}
              onOpen={(name) => {
                withUnsavedGuard(async () => {
                  const p = exampleProjects[name];
                  if (p) changeEditorCurrentProject(p);
                  closePanels();
                });
              }}
            />
          )}
          {activePanel === "projects" && (
            <ProjectExplorer
              onClose={closePanels}
              setEditorMode={setEditorMode}
              onOpenSheetSprite={(name) => { setEditingSheetSprite(name); setEditorMode('sheet'); }}
              setEditingTilemap={setEditingTilemap}
              onOpenUserProject={(p) => withUnsavedGuard(() => handleOpenUserProject(p))}
              onNewProject={() => withUnsavedGuard(async () => { handleNewProject(); closePanels(); })}
              onImport={() => setShowImportDialog(true)}
              onDeleteProject={handleDeleteProject}
              onExportProject={handleExportProject}
              userProjects={userProjects}
              loading={loading}
              loadUserProjects={loadUserProjects}
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
                onClose={closePanels}
              />
            </Suspense>
          )}
        </div>
      )}

      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={handleImportProject}
        />
      )}

      <AssetEditor
        key={editorMode ?? 'closed'}
        open={editorMode !== null}
        mode={editorMode}
        onClose={closeEditor}
        sheetInitialSprite={editingSheetSprite ?? undefined}
        tilemapInitial={editingTilemap !== null ? { name: editingTilemap } : undefined}
        onSaveTilemap={(name, data) => {
          saveTilemap(name, data);
          setEditingTilemap(name);
          closeEditor();
        }}
      />
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
      <CloseButton theme={theme} onClose={onClose} />
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




// ── Sounds Sub-Panel ───────────────────────

// ── Settings Panel ─────────────────────────
function ToggleRow({
  label,
  hint,
  on: checked,
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
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
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
          background: checked ? (accent || theme.runBg) : theme.panelBorder,
          position: "relative",
          transition: "background 0.18s",
          flex: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
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
            aria-label="Font size"
            aria-valuemin={10}
            aria-valuemax={24}
            aria-valuenow={fontSize}
            aria-valuetext={`${fontSize} pixels`}
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

