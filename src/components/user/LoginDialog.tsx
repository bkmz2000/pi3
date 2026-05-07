import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../state/useUser';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useUser();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await login(name.trim());
      setName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-cyan-800 p-6 shadow-xl text-white">
        <h2 className="mb-4 text-xl font-bold">{t('auth.signIn')}</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">{t('auth.yourName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.enterYourName')}
              className="w-full rounded border border-cyan-600 bg-cyan-900 px-3 py-2 text-white placeholder-cyan-400"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 rounded bg-red-500/30 p-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-cyan-200 hover:bg-cyan-700"
              disabled={loading}
            >
              {t('auth.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
