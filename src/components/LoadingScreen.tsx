import { useTranslation } from "react-i18next";

export default function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-cyan-950 flex flex-col items-center justify-center z-50">
      <div className="text-6xl font-bold text-white mb-8 relative">
        <span className="text-8xl font-mono">pi</span>
        <sup className="text-4xl font-mono absolute top-0">3</sup>
      </div>
      <div className="flex items-center gap-4 text-cyan-300">
        <div className="w-8 h-8 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin" />
        <span className="text-lg">{t('app.loading')}</span>
      </div>
      <div className="mt-8 text-cyan-500 text-sm max-w-md text-center">
        {t('app.loadingHint')}
      </div>
    </div>
  );
}
