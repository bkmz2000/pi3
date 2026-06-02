import { useState } from "react";
import { useTranslation } from "react-i18next";

type ForkDialogProps = {
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
};

export default function ForkDialog({ onClose, onSave }: ForkDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === "Unauthorized" ? "Sign in to save your project" : msg);
    } finally {
      setSaving(false);
    }
  };

  const isAuthError = error === "Sign in to save your project";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-cyan-800 rounded-lg p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-2">{t('fork.saveAsNewProject')}</h3>
        <p className="text-sm text-cyan-200 mb-4">
          {t('fork.saveExampleAsProject')}
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">{t('sideMenu.projectName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              className="w-full px-3 py-2 bg-cyan-900 border border-cyan-700 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t('sideMenu.projectNamePlaceholder')}
              autoFocus
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
          {error && (
            <div className="text-sm text-amber-300 bg-amber-900/40 border border-amber-700 rounded px-3 py-2">
              {error}
              {isAuthError && (
                <a href="/api/auth/login" className="block mt-1 underline text-amber-200 hover:text-amber-100">
                  Sign in
                </a>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm rounded hover:bg-cyan-700 transition-colors"
            >
              {t('sideMenu.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {saving ? t('fork.saving') : t('fork.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
