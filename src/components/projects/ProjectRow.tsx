import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../state/api';
import { useProjects } from '../../hooks/useProjects';
import { useThemeStore } from '../../state/useTheme';
import { ShareDialog } from './ShareDialog';
import { Icon } from '../Icons';

interface ProjectRowProps {
  project: Project;
  onSelect: (id: string) => void;
  showManagement?: boolean;
}

// Deterministic 32-bit-ish hash from string (FNV-1a variant)
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Build a gradient thumbnail seeded by project id, using two distinct hues + a simple geometric overlay
function GradientThumb({ id, width, height }: { id: string; width: number; height: number }) {
  const h = hashStr(id);
  const hue1 = h % 360;
  const hue2 = (hue1 + 60 + ((h >> 8) % 180)) % 360;
  const shape = (h >> 4) % 4;
  const c1 = `hsl(${hue1} 70% 55%)`;
  const c2 = `hsl(${hue2} 70% 35%)`;
  return (
    <svg width={width} height={height} viewBox="0 0 64 64" preserveAspectRatio="none" style={{ display: 'block', borderRadius: 6, flexShrink: 0 }}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#g-${id})`} />
      {shape === 0 && <circle cx="44" cy="20" r="14" fill="rgba(255,255,255,0.18)" />}
      {shape === 1 && <rect x="8" y="36" width="22" height="22" rx="3" fill="rgba(255,255,255,0.18)" />}
      {shape === 2 && <polygon points="32,8 56,52 8,52" fill="rgba(255,255,255,0.18)" />}
      {shape === 3 && (
        <>
          <circle cx="20" cy="20" r="8" fill="rgba(255,255,255,0.18)" />
          <circle cx="44" cy="44" r="10" fill="rgba(255,255,255,0.18)" />
        </>
      )}
    </svg>
  );
}

function ProjectThumb({ project, width, height }: { project: Project; width: number; height: number }) {
  const [failed, setFailed] = useState(false);
  if (project.thumbnail_updated_at && !failed) {
    return (
      <img
        src={`/api/projects/${project.id}/thumbnail?v=${project.thumbnail_updated_at}`}
        width={width}
        height={height}
        onError={() => setFailed(true)}
        style={{
          width, height, borderRadius: 6, flexShrink: 0,
          objectFit: 'cover', background: '#000', imageRendering: 'pixelated',
        }}
        alt=""
      />
    );
  }
  return <GradientThumb id={project.id} width={width} height={height} />;
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

export function ProjectRow({ project, onSelect, showManagement }: ProjectRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { removeProject } = useProjects();
  const [showShare, setShowShare] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hover, setHover] = useState(false);

  const isOwner = project.role === 'owner';
  const roleLabel = project.role === 'owner' ? t('projects.roleOwner') : project.role === 'editor' ? t('projects.roleEditor') : t('projects.roleViewer');
  const roleAccent = project.role === 'owner' ? theme.accent : project.role === 'editor' ? theme.runBg : theme.panelTxtMute;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('projects.confirmDelete', { name: project.name }))) return;
    setDeleting(true);
    try { await removeProject(project.id); } catch { setDeleting(false); }
  };

  return (
    <>
      <div
        onClick={() => onSelect(project.id)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: 14,
          background: hover ? theme.panelHeader : theme.surfacePanel,
          border: `1px solid ${hover ? theme.accent : theme.panelBorder}`,
          borderRadius: 7,
          cursor: 'pointer',
          transition: 'background 0.12s, border-color 0.12s',
        }}
      >
        <ProjectThumb project={project} width={192} height={108} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontWeight: 700, fontSize: 16, color: theme.panelTxt,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.name}
            </span>
            <span style={{
              flex: 'none',
              padding: '2px 8px', borderRadius: 999,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              background: `${roleAccent}20`, color: roleAccent,
            }}>
              {roleLabel}
            </span>
          </div>
          {project.description ? (
            <div style={{
              marginTop: 4, fontSize: 13, color: theme.panelTxtMute,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.description}
            </div>
          ) : null}
          <div style={{
            marginTop: 6, fontSize: 12, color: theme.panelTxtMute,
          }}>
            {timeAgo(project.updated_at, i18n.language)}
          </div>
        </div>

        {/* Action icons — owner only; visible on hover */}
        {showManagement && isOwner && (
          <div style={{
            display: 'flex', gap: 4, alignItems: 'center',
            opacity: hover ? 1 : 0.35,
            transition: 'opacity 0.12s',
          }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowShare(true); }}
              title={t('projects.share')}
              style={{
                all: 'unset', cursor: 'pointer',
                width: 32, height: 32, borderRadius: 6,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: theme.panelTxt,
                border: `1px solid ${theme.panelBorder}`,
                background: theme.surfacePanel,
              }}
            >
              <Icon name="export" size={14} color="currentColor" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title={t('projects.delete')}
              style={{
                all: 'unset', cursor: deleting ? 'default' : 'pointer',
                width: 32, height: 32, borderRadius: 6,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: theme.stopBg,
                border: `1px solid ${theme.stopBg}44`,
                background: theme.surfacePanel,
                opacity: deleting ? 0.5 : 1,
              }}
            >
              <Icon name="trash" size={14} color="currentColor" />
            </button>
          </div>
        )}
      </div>

      <ShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}
