import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../state/useUser';

export function UserMenu() {
  const { t } = useTranslation();
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
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full bg-cyan-500 px-3 py-1.5 text-white hover:bg-cyan-400"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold">
          {initials}
        </span>
        <span className="text-sm font-medium">{user.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg bg-cyan-800 py-1 shadow-lg text-white">
          <div className="border-b border-cyan-700 px-4 py-2">
            <p className="text-sm font-medium">{user.name}</p>
          </div>
          <a
            href="/projects"
            className="block px-4 py-2 text-sm hover:bg-cyan-700"
          >
            {t('auth.myProjects')}
          </a>
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-300 hover:bg-cyan-700 hover:text-red-200"
          >
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
