import { useTranslation } from 'react-i18next';
import { useIde, useEditor, isExampleSessionId } from '../state/IdeState';

function CloudIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function Chip({ icon, text, bg }: { icon: 'cloud' | 'local'; text: string; bg: string }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      zIndex: 9998,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 500,
      color: '#fff',
      background: bg,
      boxShadow: '0 1px 6px rgba(0,0,0,0.22)',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {icon === 'cloud' ? <CloudIcon /> : <DeviceIcon />}
      {text}
    </div>
  );
}

export function SaveErrorIndicator() {
  const { t } = useTranslation();
  const saveError = useIde((s) => s.saveError);
  const isSaving = useIde((s) => s.isSaving);
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);

  if (!currentProjectId) return null;

  if (isSaving) {
    return <Chip icon="cloud" text={t('saveIndicator.saving')} bg="rgba(0,0,0,0.45)" />;
  }

  if (saveError?.kind === 'auth') {
    return <Chip icon="local" text={t('saveIndicator.savedLocallySignIn')} bg="#b07100" />;
  }

  if (saveError?.kind === 'network') {
    return <Chip icon="local" text={t('saveIndicator.savedOfflineWillSync')} bg="#c0392b" />;
  }

  if (saveError?.kind === 'quota') {
    return <Chip icon="local" text={saveError.message} bg="#c0392b" />;
  }

  if (saveError?.kind === 'payload') {
    return <Chip icon="local" text={saveError.message} bg="#c0392b" />;
  }

  if (isExampleSessionId(currentProjectId)) {
    if (dirtyFiles.size > 0) {
      return <Chip icon="local" text={t('saveIndicator.localOnly')} bg="rgba(80,80,80,0.7)" />;
    }
    return null;
  }

  // Named project, clean
  if (dirtyFiles.size === 0) {
    return <Chip icon="cloud" text={t('saveIndicator.saved')} bg="rgba(30,120,70,0.85)" />;
  }

  return null;
}
