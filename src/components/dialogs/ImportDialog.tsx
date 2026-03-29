import { useTranslation } from "react-i18next";

type ImportDialogProps = {
  onClose: () => void;
  onImport: (file: File) => void;
};

export default function ImportDialog({ onClose, onImport }: ImportDialogProps) {
  const { t } = useTranslation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-cyan-800 rounded-lg p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">{t('sideMenu.importProjectTitle')}</h3>
        <div className="space-y-4">
          <p className="text-sm mb-4">
            {t('sideMenu.importProjectInstructions')}
          </p>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="w-full px-3 py-2 bg-cyan-900 border border-cyan-700 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded hover:bg-cyan-700 transition-colors"
            >
              {t('sideMenu.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
