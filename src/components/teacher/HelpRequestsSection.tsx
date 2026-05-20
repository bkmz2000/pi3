import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useNotifications } from '../../state/useNotifications';

export function HelpRequestsSection() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const { helpRequests, lastPolledAt, error, refresh, address } = useNotifications();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>
          {t('teacher.helpRequests')}
          {helpRequests.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: theme.tabDirty, color: '#fff', borderRadius: 99, padding: '1px 7px' }}>
              {helpRequests.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={refresh}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute }}
          title={lastPolledAt ? new Date(lastPolledAt).toLocaleTimeString() : ''}
        >
          ↻
        </button>
      </div>
      {error && <div role="alert" aria-live="polite" style={{ fontSize: 12, color: '#e05', marginBottom: 8 }}>{error}</div>}
      {helpRequests.length === 0 ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noHelpRequests')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {helpRequests.map(hr => (
            <div key={hr.id} style={{ border: `1px solid ${theme.panelBorder}`, borderRadius: 8, padding: '12px 14px', background: theme.surfacePanel, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: theme.panelTxt }}>{hr.student_name}</div>
                <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{hr.project_name}</div>
                <div style={{ fontSize: 11, color: theme.panelTxtMute }}>{new Date(hr.created_at).toLocaleTimeString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`/teacher/projects/${hr.project_id}`} style={{ all: 'unset', cursor: 'pointer', fontSize: 12, padding: '5px 10px', borderRadius: 5, background: theme.railActiveBg, color: theme.panelTxt, fontWeight: 500 }}>
                  {t('teacher.review')}
                </a>
                <button
                  type="button"
                  onClick={() => address(hr.id)}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: 12, padding: '5px 10px', borderRadius: 5, background: theme.runBg, color: theme.runTxt, fontWeight: 600 }}
                >
                  {t('teacher.addressed')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
