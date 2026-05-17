import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { LoginDialog } from './LoginDialog';

export function LoginButton() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          all: "unset", cursor: "pointer",
          padding: "6px 16px",
          borderRadius: 999,
          background: theme.runBg,
          color: theme.runTxt,
          fontFamily: theme.fontUI,
          fontWeight: 600,
          fontSize: 12.5,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset",
          transition: "opacity 0.15s",
        }}
      >
        {t('auth.signIn')}
      </button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
