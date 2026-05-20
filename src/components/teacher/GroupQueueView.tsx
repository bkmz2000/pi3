import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { getGroupHelpRequests, addressHelpRequest, markHelpRequestInProgress, type HelpRequest } from '../../state/api';
import { asyncAction } from '../../state/asyncAction';
import { btnPrimary, btnSecondary } from './styles';

export function GroupQueueView({
  groupId, groupName, onBack,
}: { groupId: string; groupName: string; onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGroupHelpRequests(groupId).then(reqs => {
      if (cancelled) return;
      setRequests(reqs);
      setSelectedId(reqs[0]?.id ?? null);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId]);

  async function handleResolve(id: string) {
    setActing(true);
    try {
      await asyncAction(() => addressHelpRequest(id), {
        errorMessage: () => 'Failed to resolve request',
      });
      setRequests(prev => {
        const next = prev.filter(r => r.id !== id);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch {
      // Error already shown by asyncAction
    } finally {
      setActing(false);
    }
  }

  async function handleInProgress(id: string) {
    setActing(true);
    try {
      await asyncAction(() => markHelpRequestInProgress(id), {
        errorMessage: () => 'Failed to mark as in progress',
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'in_progress' } : r));
    } catch {
      // Error already shown by asyncAction
    } finally {
      setActing(false);
    }
  }

  const selected = requests.find(r => r.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: queue panel */}
      <div style={{
        width: 260, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${theme.panelBorder}`,
        background: theme.surfacePanel,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${theme.panelBorder}` }}>
          <button
            type="button"
            onClick={onBack}
            style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}
          >
            ← {t('teacher.backToGroups')}
          </button>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.panelTxt, marginBottom: 2 }}>{groupName}</div>
          <div style={{ fontSize: 11, color: theme.panelTxtMute }}>{t('teacher.requestQueue')}</div>
        </div>

        {selected && (
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.panelBorder}`, display: 'flex', gap: 8 }}>
            <button type="button" disabled={acting} onClick={() => handleResolve(selected.id)} style={btnPrimary(theme, acting)}>
              {t('teacher.resolve')}
            </button>
            {selected.status === 'pending' && (
              <button type="button" disabled={acting} onClick={() => handleInProgress(selected.id)} style={btnSecondary(theme, acting)}>
                {t('teacher.inProgress')}
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 14, color: theme.panelTxtMute, fontSize: 13 }}>{t('sideMenu.loading')}</div>
          ) : requests.length === 0 ? (
            <div style={{ padding: 14, color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noQueueRequests')}</div>
          ) : (
            requests.map(r => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(r.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.id); } }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.panelBorder}`,
                  background: selectedId === r.id ? theme.railActiveBg : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: theme.panelTxt }}>{r.student_name}</span>
                  {r.status === 'in_progress' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(0,120,255,0.15)', color: theme.railIconActive }}>
                      {t('teacher.inProgress')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{r.project_name}</div>
                <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 2 }}>
                  {t('teacher.requestedAt')} {new Date(r.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: selected request details */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {selected ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: theme.panelTxt, marginBottom: 6 }}>{selected.student_name}</div>
            <div style={{ fontSize: 14, color: theme.panelTxtMute, marginBottom: 4 }}>{selected.project_name}</div>
            <div style={{ fontSize: 12, color: theme.panelTxtMute, marginBottom: 20 }}>{new Date(selected.created_at).toLocaleString()}</div>
            {selected.status === 'in_progress' && (
              <div style={{ marginBottom: 20, padding: '8px 14px', borderRadius: 6, background: 'rgba(0,120,255,0.1)', border: '1px solid rgba(0,120,255,0.2)', fontSize: 13, color: theme.railIconActive }}>
                {t('teacher.inProgress')} — student can now add comments.
              </div>
            )}
            <a href={`/teacher/projects/${selected.project_id}`} style={{ display: 'inline-block', padding: '8px 18px', borderRadius: 6, background: theme.railActiveBg, color: theme.panelTxt, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              {t('teacher.review')} →
            </a>
          </div>
        ) : !loading && (
          <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noQueueRequests')}</div>
        )}
      </div>
    </div>
  );
}
