import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { Icon } from '../Icons';
import { HandleAvatar } from './HandleAvatar';

function Avatar({ seed, size = 28, role }: { seed: string; size?: number; role?: 'student' | 'teacher' }) {
  return <HandleAvatar seed={seed} size={size} role={role} />;
}

// Inline chevron-down — not in Icons.tsx
function ChevronIcon({ color }: { color: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" style={{ flex: 'none', display: 'block' }}>
      <path d="M5 6l3 3 3-3" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Inline hand — not in Icons.tsx
function HandIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" style={{ flex: 'none', display: 'block' }}>
      <path d="M5.5 9V4.2a1 1 0 1 1 2 0V8m0 0V3.2a1 1 0 1 1 2 0V8m0 0V4.2a1 1 0 1 1 2 0V9m-6 0v3a3 3 0 0 0 3 3h.5a3 3 0 0 0 3-3V9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IdentityBlock({ user }: { user: { name: string; handle?: string | null; role: string } }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [copied, setCopied] = useState(false);
  const handle = user.handle ?? '';
  const canCopy = handle.length > 0;

  const onCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(`@${handle}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked — ignore */ }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px',
    }}>
      <Avatar seed={user.handle ?? user.name} size={40} role={user.role as 'student' | 'teacher'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          onClick={onCopy}
          disabled={!canCopy}
          title={canCopy ? (copied ? t('auth.handleCopied') : t('auth.copyHandle')) : undefined}
          style={{
            all: 'unset', cursor: canCopy ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: theme.fontMono, fontSize: 13, fontWeight: 700,
            color: copied ? theme.runBg : theme.accent,
            maxWidth: '100%',
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>
            @{handle || '—'}
          </span>
          {canCopy && (
            <svg width={11} height={11} viewBox="0 0 16 16" style={{ flex: 'none', opacity: copied ? 1 : 0.55 }}>
              {copied ? (
                <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ) : (
                <>
                  <rect x="5" y="5" width="8" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <path d="M3 10V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                </>
              )}
            </svg>
          )}
        </button>
        <div style={{
          fontSize: 11.5, color: theme.panelTxtMute, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.name}
        </div>
      </div>
    </div>
  );
}

export function UserMenu() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user, logout, upgradeToTeacher } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  const isTeacher = user.role === 'teacher';

  const menuItems = isTeacher
    ? [
        {
          icon: <Icon name="sparkle" size={14} color={theme.runBg} />,
          label: t('auth.teacherDashboard'),
          highlighted: true,
          comingSoon: false,
          onClick: () => { navigate('/teacher'); setOpen(false); },
        },
        {
          icon: <Icon name="folder" size={14} color={theme.panelTxtMute} />,
          label: t('auth.myProjects'),
          highlighted: false,
          comingSoon: false,
          onClick: () => { navigate('/projects'); setOpen(false); },
        },
        {
          icon: <Icon name="users" size={14} color={theme.panelTxtMute} />,
          label: t('auth.myClasses'),
          highlighted: false,
          comingSoon: true,
          onClick: () => {},
        },
      ]
    : [
        {
          icon: <Icon name="folder" size={14} color={theme.panelTxtMute} />,
          label: t('auth.myProjects'),
          highlighted: false,
          comingSoon: false,
          onClick: () => { navigate('/projects'); setOpen(false); },
        },
        {
          icon: <HandIcon color={theme.panelTxtMute} />,
          label: t('auth.askForHelp'),
          highlighted: false,
          comingSoon: true,
          onClick: () => {},
        },
        {
          icon: <Icon name="users" size={14} color={theme.panelTxtMute} />,
          label: t('auth.myClass'),
          highlighted: false,
          comingSoon: true,
          onClick: () => {},
        },
        {
          icon: <Icon name="sparkle" size={14} color={theme.runBg} />,
          label: t('teacher.upgradeToTeacher'),
          highlighted: true,
          comingSoon: false,
          onClick: async () => {
            if (!window.confirm(t('teacher.upgradeConfirm'))) return;
            try {
              await upgradeToTeacher();
              setOpen(false);
              navigate('/teacher');
            } catch {
              window.alert(t('teacher.upgradeFailed'));
            }
          },
        },
      ];

  const highlightBg = isTeacher ? `${theme.runBg}18` : `${theme.accent}18`;
  const highlightColor = isTeacher ? theme.runBg : theme.accent;

  return (
    <div ref={menuRef} style={{ position: 'relative', fontFamily: theme.fontUI }}>
      {/* Pill trigger — single line: avatar · name · role chip · chevron */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          all: 'unset', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 10px 4px 4px',
          borderRadius: 999,
          background: theme.chip,
          border: `1px solid ${open ? theme.accent : theme.panelBorder}`,
          boxShadow: open ? `0 0 0 3px ${theme.accent}22` : 'none',
          color: theme.panelTxt,
          fontSize: 13, fontWeight: 500,
          transition: 'all 0.15s',
          maxWidth: 280,
        }}
      >
        <Avatar seed={user.handle ?? user.name} size={26} role={user.role as 'student' | 'teacher'} />
        <span style={{
          fontSize: 13, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {user.name}
        </span>
        <ChevronIcon color={theme.panelTxtMute} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 7px)',
          minWidth: 280, maxWidth: 360, width: 'max-content', zIndex: 50,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusCard + 6,
          boxShadow: theme.shadowWindow,
          padding: 5,
        }}>
          {/* Identity block — handle is primary (click to copy), name secondary */}
          <IdentityBlock user={user} />
          <div style={{ height: 1, background: theme.panelBorder, margin: '0 -5px 4px' }} />

          {/* Menu items */}
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={item.comingSoon ? undefined : item.onClick}
              disabled={item.comingSoon}
              style={{
                all: 'unset', cursor: item.comingSoon ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', borderRadius: theme.radiusButton + 2,
                background: item.highlighted ? highlightBg : 'transparent',
                color: item.comingSoon ? theme.panelTxtMute : (item.highlighted ? highlightColor : theme.panelTxt),
                fontSize: 13, fontWeight: item.highlighted ? 600 : 500,
                opacity: item.comingSoon ? 0.55 : 1,
              }}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.comingSoon && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                  background: theme.railActiveBg, color: theme.panelTxtMute,
                }}>
                  {t('teacher.comingSoon')}
                </span>
              )}
            </button>
          ))}

          {/* Separator + sign out */}
          <div style={{ height: 1, background: theme.panelBorder, margin: '5px 8px' }} />
          <button
            onClick={() => { logout(); setOpen(false); }}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px', borderRadius: theme.radiusButton + 2,
              color: theme.stopBg, fontSize: 13, fontWeight: 500,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" style={{ flex: 'none' }}>
              <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span>{t('auth.signOut')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
