import { useState } from "react";
import { useTranslation } from "react-i18next";

type NewProjectDialogProps = {
  onClose: () => void;
  onCreate: (name: string) => void;
};

export default function NewProjectDialog({ onClose, onCreate }: NewProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-cyan-800 rounded-lg p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">{t('sideMenu.createProject')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">{t('sideMenu.projectName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-cyan-900 border border-cyan-700 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t('sideMenu.projectNamePlaceholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded hover:bg-cyan-700 transition-colors"
            >
              {t('sideMenu.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {t('sideMenu.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
