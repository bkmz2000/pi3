import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { Icon } from '../Icons';

function Avatar({ name, role, size = 28 }: { name: string; role: string; size?: number }) {
  const theme = useThemeStore((s) => s.theme);
  const initials = name
    .split(/[\s_-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const bg = role === 'teacher' ? theme.runBg : theme.accent;
  return (
    <span style={{
      width: size, height: size, borderRadius: 999,
      background: bg, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: theme.fontUI, fontWeight: 700,
      fontSize: Math.round(size * 0.42),
      flexShrink: 0,
    }}>
      {initials}
    </span>
  );
}

function RoleTag({ role }: { role: string }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const isTeacher = role === 'teacher';
  const color = isTeacher ? theme.runBg : theme.accent;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px 2px 5px',
      borderRadius: 999,
      background: `${color}20`,
      color: theme.panelTxt,
      fontFamily: theme.fontUI, fontSize: 10, fontWeight: 700,
      letterSpacing: 0.4, textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />
      {isTeacher ? t('auth.roleTeacher') : t('auth.roleStudent')}
    </span>
  );
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

export function UserMenu() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user, logout } = useUser();
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
      ];

  const highlightBg = isTeacher ? `${theme.runBg}18` : `${theme.accent}18`;
  const highlightColor = isTeacher ? theme.runBg : theme.accent;

  return (
    <div ref={menuRef} style={{ position: 'relative', fontFamily: theme.fontUI }}>
      {/* Pill trigger */}
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
        }}
      >
        <Avatar name={user.name} role={user.role} size={26} />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, textAlign: 'left' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
            color: isTeacher ? theme.runBg : theme.accent, marginTop: 1,
          }}>
            {isTeacher ? t('auth.roleTeacher') : t('auth.roleStudent')}
          </span>
        </span>
        <ChevronIcon color={theme.panelTxtMute} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 7px)',
          width: 250, zIndex: 50,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusCard + 6,
          boxShadow: theme.shadowWindow,
          padding: 5,
        }}>
          {/* Identity block */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 10px 10px',
            borderBottom: `1px solid ${theme.panelBorder}`,
            marginBottom: 4,
          }}>
            <Avatar name={user.name} role={user.role} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.panelTxt }}>{user.name}</div>
              <div style={{
                fontSize: 10.5, color: theme.panelTxtMute, fontFamily: theme.fontMono,
                marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                @{user.name}
              </div>
            </div>
            <RoleTag role={user.role} />
          </div>

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
