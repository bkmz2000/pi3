import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoginDialog } from './LoginDialog';

export function LoginButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-cyan-500 px-3 py-1.5 text-sm text-white hover:bg-cyan-400"
      >
        {t('auth.signIn')}
      </button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
