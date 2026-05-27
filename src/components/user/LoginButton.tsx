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
          padding: "4px 8px",
          fontFamily: theme.fontUI,
          fontWeight: 500,
          fontSize: 12,
          color: theme.panelTxtMute,
          display: "inline-flex",
          alignItems: "center",
          transition: "color 0.15s",
        }}
      >
        {t('auth.signIn')}
      </button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
