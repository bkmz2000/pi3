import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../state/api';
import { useThemeStore } from '../../state/useTheme';
import { ShareDialog } from './ShareDialog';
import { Icon } from '../Icons';

interface ProjectRowProps {
  project: Project;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onExport?: (id: string) => Promise<void>;
  showRole?: boolean;
}

// Deterministic FNV-1a variant. Fallback art stays familiar between visits.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function GradientArtwork({ id, width, height }: { id: string; width: number; height: number }) {
  const h = hashStr(id);
  const hue1 = h % 360;
  const hue2 = (hue1 + 60 + ((h >> 8) % 180)) % 360;
  const shape = (h >> 4) % 4;
  const c1 = `hsl(${hue1} 64% 58%)`;
  const c2 = `hsl(${hue2} 62% 34%)`;
  const gradientId = `project-art-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return (
    <svg width={width} height={height} viewBox="0 0 96 58" preserveAspectRatio="none" style={{ display: 'block', borderRadius: 8, flexShrink: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="96" height="58" fill={`url(#${gradientId})`} />
      {shape === 0 && <circle cx="66" cy="18" r="15" fill="rgba(255,255,255,0.22)" />}
      {shape === 1 && <rect x="12" y="28" width="30" height="24" rx="4" fill="rgba(255,255,255,0.20)" />}
      {shape === 2 && <polygon points="48,6 82,52 14,52" fill="rgba(255,255,255,0.20)" />}
      {shape === 3 && (
        <>
          <circle cx="28" cy="19" r="10" fill="rgba(255,255,255,0.20)" />
          <circle cx="69" cy="40" r="13" fill="rgba(255,255,255,0.18)" />
        </>
      )}
    </svg>
  );
}

export function ProjectArtwork({
  id,
  thumbnailUpdatedAt,
  width = 128,
  height = 72,
}: {
  id: string;
  thumbnailUpdatedAt?: number | null;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  if (thumbnailUpdatedAt && !failed) {
    return (
      <img
        src={`/api/projects/${id}/thumbnail?v=${thumbnailUpdatedAt}`}
        width={width}
        height={height}
        onError={() => setFailed(true)}
        style={{
          width, height, borderRadius: 8, flexShrink: 0,
          objectFit: 'cover', background: theme.canvasBg, imageRendering: 'pixelated',
        }}
        alt=""
      />
    );
  }
  return <GradientArtwork id={id} width={width} height={height} />;
}

function timeAgo(ts: number, lang: string): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang.startsWith('ru') ? 'только что' : 'just now';
  if (m < 60) return lang.startsWith('ru') ? `${m} мин назад` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang.startsWith('ru') ? `${h} ч назад` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return lang.startsWith('ru') ? `${d} дн назад` : `${d}d ago`;
  return new Date(ts).toLocaleDateString(lang);
}

export function ProjectRow({ project, onSelect, onDelete, onRename, onExport, showRole = false }: ProjectRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [showShare, setShowShare] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = project.role === 'owner';
  const roleLabel = project.role === 'editor' ? t('projects.roleEditor') : t('projects.roleViewer');
  const roleAccent = project.role === 'editor' ? theme.runBg : theme.panelTxtMute;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleRename = async () => {
    if (!onRename) return;
    const name = window.prompt(t('projects.renamePrompt'), project.name)?.trim();
    if (!name || name === project.name) return;
    setBusy(true);
    try { await onRename(project.id, name); } finally { setBusy(false); setMenuOpen(false); }
  };

  const handleDelete = async () => {
    if (!onDelete || !window.confirm(t('projects.confirmDelete', { name: project.name }))) return;
    setBusy(true);
    try { await onDelete(project.id); } finally { setBusy(false); setMenuOpen(false); }
  };

  const handleExport = async () => {
    if (!onExport) return;
    setBusy(true);
    try { await onExport(project.id); } finally { setBusy(false); setMenuOpen(false); }
  };

  return (
    <>
      <article style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 2px', borderBottom: `1px solid ${theme.panelBorder}`,
      }}>
        <button
          type="button"
          onClick={() => onSelect(project.id)}
          aria-label={`${t('projects.open')} ${project.name}`}
          style={{
            all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 14, borderRadius: 8,
          }}
        >
          <ProjectArtwork id={project.id} thumbnailUpdatedAt={project.thumbnail_updated_at} />
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontWeight: 750, fontSize: 15, color: theme.panelTxt,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {project.name}
              </span>
              {showRole && !isOwner && (
                <span style={{
                  flex: 'none', padding: '2px 7px', borderRadius: 999,
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.35,
                  background: `${roleAccent}20`, color: roleAccent,
                }}>
                  {roleLabel}
                </span>
              )}
            </span>
            {project.description && (
              <span style={{
                display: 'block', marginTop: 4, fontSize: 12.5, color: theme.panelTxtMute,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {project.description}
              </span>
            )}
            <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: theme.panelTxtMute }}>
              {timeAgo(project.updated_at, i18n.language)}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelect(project.id)}
          style={{
            border: `1px solid ${theme.accent}`, borderRadius: 7, background: 'transparent',
            color: theme.accent, padding: '8px 14px', cursor: 'pointer', fontWeight: 700,
            fontFamily: theme.fontUI, fontSize: 12.5,
          }}
        >
          {t('projects.open')}
        </button>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t('projects.moreActions', { name: project.name })}
            aria-expanded={menuOpen}
            disabled={busy}
            style={{
              border: `1px solid ${theme.panelBorder}`, borderRadius: 7,
              background: theme.surfacePanel, color: theme.panelTxt,
              width: 38, height: 38, cursor: busy ? 'default' : 'pointer',
              fontSize: 17, letterSpacing: 1,
            }}
          >
            ···
          </button>
          {menuOpen && (
            <div role="menu" style={{
              position: 'absolute', zIndex: 20, right: 0, top: 44, width: 180,
              padding: 5, borderRadius: 8, background: theme.surfacePanel,
              border: `1px solid ${theme.panelBorder}`, boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            }}>
              {isOwner && onRename && <MenuAction label={t('projects.rename')} icon="pencil" theme={theme} onClick={handleRename} />}
              {isOwner && <MenuAction label={t('projects.share')} icon="export" theme={theme} onClick={() => { setShowShare(true); setMenuOpen(false); }} />}
              {onExport && <MenuAction label={t('projects.export')} icon="export" theme={theme} onClick={handleExport} />}
              {isOwner && onDelete && <MenuAction label={t('projects.delete')} icon="trash" theme={theme} danger onClick={handleDelete} />}
            </div>
          )}
        </div>
      </article>

      <ShareDialog open={showShare} onClose={() => setShowShare(false)} projectId={project.id} projectName={project.name} />
    </>
  );
}

function MenuAction({ label, icon, theme, danger, onClick }: {
  label: string;
  icon: 'pencil' | 'export' | 'trash';
  theme: ReturnType<typeof useThemeStore.getState>['theme'];
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} style={{
      width: '100%', border: 0, borderRadius: 6, background: 'transparent',
      color: danger ? theme.stopBg : theme.panelTxt, padding: '8px 9px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.fontUI, fontSize: 12.5,
    }}>
      <Icon name={icon} size={14} color="currentColor" />
      {label}
    </button>
  );
}
