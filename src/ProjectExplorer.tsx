import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, isExampleSessionId } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import type { AssetEditorMode } from "./AssetEditor";
import { Icon, type IconName } from "./components/Icons";
import {
  packAssetsByMeta,
  BUILTIN_SOUNDS,
  type Category,
  type Perspective,
} from "./state/assets";
import { useRunnerStore, type Screenshot } from "./runner/RunnerProvider";
import { uploadProjectThumbnail } from "./state/api";
import { ComingSoonPlug } from "./ExamplesPanel";

type Theme = ReturnType<typeof useThemeStore.getState>["theme"];

const CATEGORIES: Category[] = [
  "Characters", "Enemies", "Vehicles", "Tiles",
  "Items", "Hazards", "Effects", "Buildings",
];

const playAudio = (url: string) => {
  const a = new Audio(url);
  a.play().catch(() => {});
};

function decodePixels(pixels: string): Uint8ClampedArray {
  const raw = atob(pixels);
  const buf = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

function encodePixels(buf: Uint8ClampedArray): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function useSpriteThumbUrl(buf: Uint8ClampedArray | null, sheetW: number, strip: { x: number; y: number; frameW: number; frameH: number } | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!buf || !strip) { setUrl(undefined); return; }
    const { x, y, frameW, frameH } = strip;
    const frame = new Uint8ClampedArray(frameW * frameH * 4);
    for (let row = 0; row < frameH; row++)
      frame.set(buf.subarray(((y + row) * sheetW + x) * 4, ((y + row) * sheetW + x + frameW) * 4), row * frameW * 4);
    const canvas = new OffscreenCanvas(frameW, frameH);
    canvas.getContext('2d')!.putImageData(new ImageData(frame, frameW, frameH), 0, 0);
    canvas.convertToBlob().then((blob) => setUrl(URL.createObjectURL(blob))).catch(() => setUrl(undefined));
  }, [buf, strip, sheetW]);
  return url;
}

function SpriteThumbRow({ name, sentry, decodedSheetBuf, sheetW, theme, onOpen, onDelete, t }: {
  name: string;
  sentry: { animations: Record<string, { x: number; y: number; frameW: number; frameH: number }> };
  decodedSheetBuf: Uint8ClampedArray | null;
  sheetW: number;
  theme: Theme;
  onOpen: (name: string) => void;
  onDelete: (name: string) => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const firstStrip = Object.values(sentry.animations)[0];
  const thumbUrl = useSpriteThumbUrl(decodedSheetBuf, sheetW, firstStrip);
  return (
    <RowButton
      key={name}
      theme={theme}
      label={name}
      icon="frame"
      thumbUrl={thumbUrl}
      onClick={() => onOpen(name)}
      hoverActions={(close) => (
        <IconButton title={t('sideMenu.remove')} icon="trash" theme={theme} danger
          onClick={() => { onDelete(name); close(); }} />
      )}
    />
  );
}

type UserProject = {
  id: string;
  name: string;
  files: Record<string, string>;
  assets: Record<string, string>;
};

type Props = {
  onClose: () => void;
  // Editor launchers (state lives in SideMenu)
  setEditorMode: (m: AssetEditorMode | null) => void;
  onOpenSheetSprite: (name: string) => void;
  setEditingTilemap: (n: string | null) => void;
  // Project ops (already wired in SideMenu)
  onOpenUserProject: (p: UserProject) => void;
  onNewProject: () => void;
  onImport: () => void;
  onDeleteProject: (id: string) => void;
  onExportProject: (id: string) => void;
  userProjects: UserProject[];
  loading: boolean;
  loadUserProjects: () => void;
};

export default function ProjectExplorer({
  onClose,
  setEditorMode,
  onOpenSheetSprite,
  setEditingTilemap,
  onOpenUserProject,
  onNewProject,
  onImport,
  onDeleteProject,
  onExportProject,
  userProjects,
  loading,
  loadUserProjects,
}: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  const project = useEditor((s) => s.project);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const currentFile = useEditor((s) => s.currentFile);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);

  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const changeFile = useEditor((s) => s.changeFile);
  const deleteFile = useEditor((s) => s.deleteFile);
  const renameFile = useEditor((s) => s.renameFile);
  const addAssetInstance = useEditor((s) => s.addAssetInstance);
  const deleteTilemap = useEditor((s) => s.deleteTilemap);
  const setSheet = useEditor((s) => s.setSheet);
  const addSound = useEditor((s) => s.addSound);
  const removeSound = useEditor((s) => s.removeSound);

  const currentProjectName =
    userProjects.find((up) => up.id === currentProjectId)?.name
    ?? project.name
    ?? t('sideMenu.examples');

  const [libraryKind, setLibraryKind] = useState<"sounds" | null>(null);

  const decodedSheetBuf = useMemo(() => {
    if (!project.sheet) return null;
    return decodePixels(project.sheet.pixels);
  }, [project.sheet]);

  const deleteSheetSprite = (name: string) => {
    const sheet = project.sheet;
    if (!sheet) return;
    const sentry = sheet.sprites[name];
    if (!sentry) return;
    const buf = decodePixels(sheet.pixels);
    for (const strip of Object.values(sentry.animations)) {
      for (let row = 0; row < strip.frameH; row++) {
        buf.fill(0, ((strip.y + row) * sheet.width + strip.x) * 4, ((strip.y + row) * sheet.width + strip.x + strip.frameW * strip.frameCount) * 4);
      }
    }
    const newSprites = { ...sheet.sprites };
    delete newSprites[name];
    setSheet({ ...sheet, pixels: encodePixels(buf), sprites: newSprites });
  };

  return (
    <>
      <ProjectSwitcher
        theme={theme}
        currentProjectId={currentProjectId}
        currentProjectName={currentProjectName}
        userProjects={userProjects}
        loading={loading}
        loadUserProjects={loadUserProjects}
        onOpen={onOpenUserProject}
        onNew={onNewProject}
        onImport={onImport}
        onExportCurrent={() => currentProjectId && onExportProject(currentProjectId)}
        onDeleteCurrent={() => currentProjectId && onDeleteProject(currentProjectId)}
        onClose={onClose}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        <Section
          theme={theme}
          title={t('sideMenu.tabSprites').toLowerCase() === 'sprites' ? 'Code' : 'Code'}
          defaultOpen
          actions={
            <NewFileInline theme={theme} onCreate={(n) => { changeFile(n, ""); changeCurrentFile(n); }} />
          }
        >
          {Object.keys(project.files).map((name) => (
            <RowButton
              key={name}
              theme={theme}
              active={name === currentFile}
              label={name}
              dirty={dirtyFiles.has(name)}
              icon="text"
              onClick={() => changeCurrentFile(name)}
              hoverActions={(close) => (
                <>
                  <IconButton title={t('fileBar.renameFile')} icon="pencil" theme={theme}
                    onClick={() => {
                      const next = window.prompt(t('fileBar.renameFile'), name);
                      if (next && next !== name) renameFile(name, next);
                      close();
                    }} />
                  <IconButton title={t('sideMenu.deleteProjectTooltip')} icon="trash" theme={theme} danger
                    onClick={() => {
                      if (window.confirm(t('fileBar.deleteConfirm', { filename: name }))) deleteFile(name);
                      close();
                    }} />
                </>
              )}
            />
          ))}
        </Section>

        <Section
          theme={theme}
          title={t('sideMenu.tabSprites')}
          defaultOpen
          actions={
            <IconButton title={t('sideMenu.newSprite')} icon="plus" theme={theme}
              onClick={() => setEditorMode('sheet')} />
          }
        >
          {Object.entries(project.sheet?.sprites ?? {}).map(([name, sentry]) => (
            <SpriteThumbRow
              key={name}
              name={name}
              sentry={sentry}
              decodedSheetBuf={decodedSheetBuf}
              sheetW={project.sheet?.width ?? 512}
              theme={theme}
              onOpen={onOpenSheetSprite}
              onDelete={deleteSheetSprite}
              t={t}
            />
          ))}
          {!project.sheet?.sprites || Object.keys(project.sheet.sprites).length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: theme.panelTxtMute }}>
              {t('sideMenu.noSpritesMatch', { context: 'empty' })}
            </div>
          )}
        </Section>

<Section
          theme={theme}
          title={t('sideMenu.tilemaps')}
          defaultOpen
          actions={
            <IconButton title={t('sideMenu.newTilemap')} icon="plus" theme={theme}
              onClick={() => { setEditingTilemap(null); setEditorMode('tilemap'); }} />
          }
        >
          {Object.keys(project.tilemaps).map((name) => (
            <RowButton
              key={name}
              theme={theme}
              label={name}
              icon="grid"
              onClick={() => { setEditingTilemap(name); setEditorMode('tilemap'); }}
              hoverActions={(close) => (
                <IconButton title={t('sideMenu.deleteTilemap')} icon="trash" theme={theme} danger
                  onClick={() => { deleteTilemap(name); close(); }} />
              )}
            />
          ))}
        </Section>

        <Section
          theme={theme}
          title={t('sideMenu.tabSounds')}
          defaultOpen
          actions={
            <>
              <UploadSoundButton theme={theme} onAdd={addSound} />
              <IconButton title={t('sideMenu.soundLibrary')} icon="folder" theme={theme}
                onClick={() => setLibraryKind('sounds')} />
            </>
          }
        >
          {Object.entries(project.sounds ?? {}).map(([name, url]) => (
            <RowButton
              key={name}
              theme={theme}
              label={name}
              icon="speaker"
              onClick={() => playAudio(url)}
              hoverActions={(close) => (
                <IconButton title={t('sideMenu.soundRemove')} icon="trash" theme={theme} danger
                  onClick={() => { removeSound(name); close(); }} />
              )}
            />
          ))}
        </Section>

        <ScreenshotsSection
          theme={theme}
          currentProjectId={currentProjectId}
        />

      </div>

      {libraryKind && (
        <LibraryPickerModal
          theme={theme}
          kind={libraryKind}
          onClose={() => setLibraryKind(null)}
          onAddSprite={(name, url) => addAssetInstance(name, url)}
          onAddSound={(name, url) => addSound(name, url)}
        />
      )}
    </>
  );
}

// ── ScreenshotsSection ────────────────────────────────────────────────────────

function ScreenshotsSection({ theme, currentProjectId }: { theme: Theme; currentProjectId: string | null }) {
  const { t } = useTranslation();
  const screenshots = useRunnerStore((s) => s.screenshots);
  const [coverId, setCoverId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const canPersist = !!currentProjectId && !isExampleSessionId(currentProjectId);
  const [lightboxSnap, setLightboxSnap] = useState<Screenshot | null>(null);

  if (screenshots.length === 0) return null;

  const setAsCover = async (snap: Screenshot) => {
    if (!canPersist || !currentProjectId) return;
    try {
      setBusy(true);
      await uploadProjectThumbnail(currentProjectId, snap.blob);
      setCoverId(snap.id);
    } catch (err) {
      console.warn("Thumbnail upload failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      theme={theme}
      title={t('sideMenu.screenshots', 'Screenshots')}
      defaultOpen
      actions={null}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 12px 8px 22px' }}>
        {screenshots.map((snap) => (
          <ScreenshotThumb
            key={snap.id}
            snap={snap}
            isCover={snap.id === coverId}
            canPersist={canPersist}
            busy={busy}
            theme={theme}
            onSetCover={() => setAsCover(snap)}
            onPreview={() => setLightboxSnap(snap)}
          />
        ))}
      </div>
      {lightboxSnap && (
        <div
          onClick={() => setLightboxSnap(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxSnap.url}
            style={{ maxWidth: '85vw', maxHeight: '80vh', imageRendering: 'pixelated', borderRadius: 4 }}
            alt=""
          />
          {canPersist && (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); setAsCover(lightboxSnap).then(() => setLightboxSnap(null)); }}
              style={{
                all: 'unset', cursor: busy ? 'default' : 'pointer',
                padding: '8px 20px', borderRadius: 6,
                background: lightboxSnap.id === coverId ? theme.accent : theme.runBg,
                color: '#fff', fontFamily: theme.fontUI, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Icon name="camera" size={14} color="#fff" />
              {lightboxSnap.id === coverId
                ? t('canvas.setAsCover') + ' ✓'
                : t('canvas.setAsCover')}
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

function ScreenshotThumb({ snap, isCover, canPersist, busy, theme, onSetCover, onPreview }: {
  snap: Screenshot;
  isCover: boolean;
  canPersist: boolean;
  busy: boolean;
  theme: Theme;
  onSetCover: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onPreview}
        title={t('canvas.screenshot')}
        style={{
          all: 'unset', cursor: 'pointer', display: 'block',
          width: 56, height: 56, borderRadius: 4, overflow: 'hidden',
          border: `2px solid ${isCover ? theme.accent : hover ? theme.panelTxtMute : theme.panelBorder}`,
          transition: 'border-color 0.12s',
        }}
      >
        <img src={snap.url} alt=""
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }} />
      </button>
      {isCover && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          background: theme.accent, borderRadius: 3,
          padding: '1px 4px', fontSize: 8, fontWeight: 700,
          color: '#fff', fontFamily: theme.fontUI, pointerEvents: 'none',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          cover
        </div>
      )}
      {hover && canPersist && !isCover && (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onSetCover(); }}
          title={t('canvas.setAsCover')}
          style={{
            all: 'unset', cursor: busy ? 'default' : 'pointer',
            position: 'absolute', inset: 0, borderRadius: 4,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 2,
          }}
        >
          <Icon name="camera" size={16} color="#fff" />
          <span style={{ fontSize: 8, color: '#fff', fontFamily: theme.fontUI, fontWeight: 700, letterSpacing: '0.02em' }}>
            {t('canvas.setAsCover')}
          </span>
        </button>
      )}
    </div>
  );
}

// ── ProjectSwitcher ────────────────────────────────────────────────────────────

function ProjectSwitcher({
  theme, currentProjectId, currentProjectName, userProjects, loading,
  loadUserProjects, onOpen, onNew, onImport, onExportCurrent, onDeleteCurrent, onClose,
}: {
  theme: Theme;
  currentProjectId: string | null;
  currentProjectName: string;
  userProjects: UserProject[];
  loading: boolean;
  loadUserProjects: () => void;
  onOpen: (p: UserProject) => void;
  onNew: () => void;
  onImport: () => void;
  onExportCurrent: () => void;
  onDeleteCurrent: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadUserProjects();
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open, loadUserProjects]);

  return (
    <div style={{
      height: 40, display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 8px 0 12px', background: theme.panelHeader,
      borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0,
    }}>
      <div ref={wrapRef} style={{ flex: 1, position: 'relative' }}>
        <button type="button" onClick={() => setOpen((v) => !v)}
          style={{
            all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', borderRadius: 5, color: theme.panelTxt,
            fontFamily: theme.fontUI, fontSize: 13, fontWeight: 600, width: '100%', boxSizing: 'border-box',
          }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentProjectName}
          </span>
          <span style={{ fontSize: 10, color: theme.panelTxtMute }}>{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 100,
            background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
            borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '4px 0',
            maxHeight: 360, overflowY: 'auto',
          }}>
            {loading && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: theme.panelTxtMute }}>
                {t('sideMenu.loadingProjects')}
              </div>
            )}
            {userProjects.map((p) => (
              <button key={p.id} type="button"
                onClick={() => { onOpen(p); setOpen(false); }}
                style={{
                  all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', width: '100%', boxSizing: 'border-box',
                  background: currentProjectId === p.id ? `${theme.accent}22` : 'transparent',
                  color: currentProjectId === p.id ? theme.accent : theme.panelTxt,
                  fontFamily: theme.fontUI, fontSize: 12,
                }}>
                <span style={{ width: 8, color: theme.accent, fontSize: 10 }}>
                  {currentProjectId === p.id ? '●' : ''}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${theme.panelBorder}`, margin: '4px 0' }} />
            <SwitcherAction theme={theme} icon="plus" label={t('sideMenu.newProject')}
              onClick={() => { onNew(); setOpen(false); }} />
            <SwitcherAction theme={theme} icon="import" label={t('sideMenu.importProject') || 'Import'}
              onClick={() => { onImport(); setOpen(false); }} />
            {currentProjectId && (
              <>
                <SwitcherAction theme={theme} icon="export" label={t('sideMenu.exportProjectTooltip')}
                  onClick={() => { onExportCurrent(); setOpen(false); }} />
                <SwitcherAction theme={theme} icon="trash" label={t('sideMenu.deleteProjectTooltip')}
                  danger onClick={() => { onDeleteCurrent(); setOpen(false); }} />
              </>
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={onClose} title={t('sideMenu.close')}
        style={{
          all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.panelTxtMute,
        }}>
        <Icon name="close" size={16} color="currentColor" />
      </button>
    </div>
  );
}

function SwitcherAction({
  theme, icon, label, danger, onClick,
}: {
  theme: Theme; icon: IconName; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px', width: '100%', boxSizing: 'border-box',
        color: danger ? '#ef4444' : theme.panelTxt, fontFamily: theme.fontUI, fontSize: 12,
      }}>
      <Icon name={icon} size={13} color="currentColor" />
      <span>{label}</span>
    </button>
  );
}

// ── Section + Row + IconButton primitives ──────────────────────────────────────

function Section({
  theme, title, defaultOpen, actions, children,
}: {
  theme: Theme; title: string; defaultOpen?: boolean;
  actions: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 10px',
        cursor: 'pointer', userSelect: 'none',
      }}>
        <button type="button" onClick={() => setOpen((v) => !v)}
          style={{
            all: 'unset', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: 6,
            color: theme.panelTxtMute, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: theme.fontUI,
          }}>
          <span style={{ fontSize: 9, width: 8 }}>{open ? '▾' : '▸'}</span>
          {title}
        </button>
        <div style={{ display: 'flex', gap: 2 }}>{actions}</div>
      </div>
      {open && <div style={{ paddingLeft: 4 }}>{children}</div>}
    </div>
  );
}

function RowButton({
  theme, label, icon, active, dirty, thumbUrl, onClick, hoverActions,
}: {
  theme: Theme; label: string; icon: IconName;
  active?: boolean; dirty?: boolean; thumbUrl?: string;
  onClick: () => void;
  hoverActions?: (close: () => void) => React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px 3px 22px',
        cursor: 'pointer', background: active ? `${theme.accent}18` : hover ? theme.chip : 'transparent',
        borderRadius: 4, margin: '0 6px',
      }}
      onClick={onClick}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', objectFit: 'contain', flexShrink: 0 }} />
      ) : (
        <Icon name={icon} size={13} color={active ? theme.accent : theme.panelTxtMute} />
      )}
      <span style={{
        flex: 1, fontSize: 12, fontFamily: theme.fontUI,
        color: active ? theme.accent : theme.panelTxt,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
      {dirty && <span style={{ width: 6, height: 6, borderRadius: 99, background: theme.accent, flexShrink: 0 }} />}
      {hover && hoverActions && (
        <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          {hoverActions(() => setHover(false))}
        </div>
      )}
    </div>
  );
}

function IconButton({
  theme, icon, title, danger, onClick,
}: {
  theme: Theme; icon: IconName; title: string;
  danger?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" title={title} onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        all: 'unset', cursor: 'pointer', width: 20, height: 20, borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: danger ? '#ef4444' : theme.panelTxtMute,
      }}>
      <Icon name={icon} size={12} color="currentColor" />
    </button>
  );
}

function NewFileInline({ theme, onCreate }: { theme: Theme; onCreate: (name: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (!editing) {
    return <IconButton theme={theme} icon="plus" title={t('sideMenu.newProject') || 'New file'}
      onClick={() => { setEditing(true); setValue(""); }} />;
  }
  return (
    <input autoFocus value={value} onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { if (value.trim()) onCreate(value.trim()); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      style={{
        width: 100, padding: '2px 6px', fontSize: 11, fontFamily: theme.fontMono,
        background: theme.chip, color: theme.panelTxt,
        border: `1px solid ${theme.accent}`, borderRadius: 3, outline: 'none',
      }} />
  );
}

function UploadSoundButton({
  theme, onAdd,
}: { theme: Theme; onAdd: (name: string, url: string) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <IconButton theme={theme} icon="plus" title={t('sideMenu.uploadSound')}
        onClick={() => ref.current?.click()} />
      <input ref={ref} type="file" accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav" multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          for (const f of Array.from(files)) {
            if (!/\.(mp3|ogg|wav)$/i.test(f.name)) continue;
            const r = new FileReader();
            r.onloadend = () => onAdd(f.name.replace(/\.[^.]+$/, ''), r.result as string);
            r.readAsDataURL(f);
          }
          e.target.value = '';
        }} />
    </>
  );
}

// ── LibraryPickerModal ─────────────────────────────────────────────────────────

function LibraryPickerModal({
  theme, kind, onClose, onAddSprite, onAddSound,
}: {
  theme: Theme;
  kind: "sprites" | "sounds";
  onClose: () => void;
  onAddSprite: (name: string, url: string) => void;
  onAddSound: (name: string, url: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [perspective, setPerspective] = useState<Perspective | null>(null);

  // Asset list derivation removed pre-launch — the library content isn't
  // shipped yet. Filter chips above stay wired so future re-enable is a
  // straight restore of the deleted blocks.
  void packAssetsByMeta; void BUILTIN_SOUNDS;
  void category; void perspective; void query;

  const chipStyle = (active: boolean): React.CSSProperties => ({
    all: 'unset', cursor: 'pointer',
    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    fontFamily: theme.fontUI,
    background: active ? theme.accent : theme.chip,
    color: active ? '#fff' : theme.panelTxtMute,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: 720, maxHeight: '85vh',
        background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
        borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: theme.panelHeader, borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: theme.panelTxt }}>
            {kind === 'sprites' ? t('sideMenu.availableAssets') : t('sideMenu.soundLibrary')}
          </span>
          <button onClick={onClose}
            style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
            <Icon name="close" size={16} color="currentColor" />
          </button>
        </div>

        <div style={{ padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: `1px solid ${theme.panelBorder}` }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('sideMenu.searchSprites')}
            style={{
              flex: '1 1 200px', minWidth: 160, padding: '6px 10px', background: theme.chip,
              border: `1px solid ${theme.panelBorder}`, borderRadius: 8,
              fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxt, outline: 'none',
            }} />
          {kind === 'sprites' && (
            <>
              <button style={chipStyle(category === null)} onClick={() => setCategory(null)}>{t('sideMenu.filterAll')}</button>
              {CATEGORIES.map((c) => (
                <button key={c} style={chipStyle(category === c)}
                  onClick={() => setCategory(category === c ? null : c)}>{c}</button>
              ))}
              <span style={{ width: 1, height: 16, background: theme.panelBorder, margin: '0 4px' }} />
              {([null, 'side', 'top-down'] as const).map((p) => (
                <button key={p ?? 'any'} style={chipStyle(perspective === p)}
                  onClick={() => setPerspective(p)}>
                  {p === null ? t('sideMenu.filterAll') : p === 'side' ? t('sideMenu.filterSide') : t('sideMenu.filterTopDown')}
                </button>
              ))}
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {/* Pre-launch plug: sprite/sound asset packs aren't shipped yet.
              Keeping the modal shell + the filter chips intact so the picker
              feels real, but replacing the grid/list with a coming-soon hint. */}
          <ComingSoonPlug
            theme={theme}
            message={kind === 'sprites' ? t('comingSoon.sprites') : t('comingSoon.sounds')}
          />
        </div>
      </div>
    </div>
  );
}
