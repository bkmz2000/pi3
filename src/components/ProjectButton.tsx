import { useTranslation } from "react-i18next";
import { MdDownload, MdDelete } from "react-icons/md";

type ProjectButtonProps = {
  name: string;
  onClick: () => void;
  isExample?: boolean;
  isCurrent?: boolean;
  hasChanges?: boolean;
  onDelete?: () => void;
  onExport?: () => void;
};

export default function ProjectButton({
  name,
  onClick,
  isExample = false,
  isCurrent = false,
  hasChanges = false,
  onDelete,
  onExport,
}: ProjectButtonProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between group">
      <button
        type="button"
        onClick={onClick}
        className={`flex-1 text-left px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-cyan-900 ${
          isCurrent ? "bg-cyan-900" : "hover:bg-cyan-900 active:bg-cyan-900"
        }`}
      >
        <div className="flex items-center gap-2">
          <span>{name}</span>
          {hasChanges && (
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
          )}
          {isExample && (
            <span className="text-xs text-cyan-300">{t('sideMenu.example')}</span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="px-2 py-1 text-xs text-white hover:text-cyan-100 hover:bg-cyan-900/30 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            title={t('sideMenu.exportProjectTooltip')}
          >
            <MdDownload size={14} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 text-xs text-red-300 hover:text-red-100 hover:bg-red-900/30 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            title={t('sideMenu.deleteProjectTooltip')}
          >
            <MdDelete size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
