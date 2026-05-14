import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';


export function UserMenu() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          all: "unset", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 10px 4px 4px",
          borderRadius: 999,
          background: theme.chip,
          border: `1px solid ${theme.panelBorder}`,
          color: theme.panelTxt,
          fontFamily: theme.fontUI,
          fontSize: 12.5,
          fontWeight: 500,
          transition: "background 0.15s",
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 999,
          background: theme.accent, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: theme.fontUI, fontWeight: 700, fontSize: 12,
        }}>
          {initials}
        </span>
        <span>{user.name}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          zIndex: 50,
          minWidth: 180,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 6,
          boxShadow: "0 10px 32px -10px rgba(0,0,0,0.30)",
          padding: "4px 0",
          fontFamily: theme.fontUI,
          color: theme.panelTxt,
        }}>
          <div style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${theme.panelBorder}`,
            fontSize: 13,
            fontWeight: 600,
          }}>
            {user.name}
          </div>
          <a
            href="/projects"
            style={{
              display: "block",
              padding: "8px 14px",
              fontSize: 12.5,
              color: theme.panelTxt,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {t('auth.myProjects')}
          </a>
          <button
            onClick={() => { logout(); setOpen(false); }}
            style={{
              all: "unset", cursor: "pointer", display: "block", width: "100%",
              padding: "8px 14px",
              fontSize: 12.5,
              color: theme.stopBg,
              textAlign: "left",
            }}
          >
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
