import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../../state/useTheme';
import { IconEye, IconEyeOff } from '../../../Icons';

interface Props {
  visibleCount: number;
  onPreviewClick: () => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export default function TestBuilderToolbar({
  visibleCount,
  onPreviewClick,
  onShowAll,
  onHideAll,
}: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 0 12px',
      flexWrap: 'wrap',
    }}>
      <button
        type="button"
        onClick={onShowAll}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11.5,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 6,
          background: theme.chip,
          color: theme.panelTxt,
          fontFamily: theme.fontUI,
        }}
      >
        <IconEye size={12} color="currentColor" />
        {t('teacher.showAllTests')}
      </button>

      <button
        type="button"
        onClick={onHideAll}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11.5,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 6,
          background: theme.chip,
          color: theme.panelTxt,
          fontFamily: theme.fontUI,
        }}
      >
        <IconEyeOff size={12} color="currentColor" />
        {t('teacher.hideAllTests')}
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onPreviewClick}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 14px',
          borderRadius: 7,
          background: theme.actionBg,
          color: theme.actionTxt,
          fontFamily: theme.fontUI,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {t('teacher.preview')} {visibleCount > 0 && `(${visibleCount})`}
      </button>
    </div>
  );
}
