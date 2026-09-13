import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  endClassroomSession, getActiveClassroomSession, getSessionRoster, startClassroomSession,
  ApiHttpError, type LiveSessionMember,
} from '../../state/api';
import { useLiveSession } from '../../state/useLiveSession';
import { useThemeStore } from '../../state/useTheme';
import { userLabel } from '../../utils/userDisplay';
import { PeerCodeView } from '../session/PeerCodeView';

const POLL_MS = 1200;

export function ClassroomSessionPanel({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const token = useLiveSession((state) => state.token);
  const sid = useLiveSession((state) => state.sid);
  const kind = useLiveSession((state) => state.kind);
  const activeGroupId = useLiveSession((state) => state.groupId);
  const adopt = useLiveSession((state) => state.adopt);
  const leave = useLiveSession((state) => state.leave);
  const [members, setMembers] = useState<LiveSessionMember[]>([]);
  const [selected, setSelected] = useState<LiveSessionMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = kind === 'classroom' && activeGroupId === groupId && !!token && !!sid;

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    getActiveClassroomSession(groupId)
      .then((result) => {
        if (!stopped && result?.token) {
          adopt(result.token, result.session_id, 'starter', result.expires_at, {
            kind: 'classroom', groupId, label: groupName,
          });
        }
      })
      .catch(() => { /* no active session */ })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
    // The session store deliberately is not a dependency: adopting the result
    // would otherwise cause a second resume request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, groupName]);

  useEffect(() => {
    if (!active || !token || !sid) { setMembers([]); setSelected(null); return; }
    let stopped = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const roster = await getSessionRoster(sid, token);
        if (!stopped) {
          setMembers(roster.members);
          setSelected((current) => current
            ? roster.members.find((member) => member.student_id === current.student_id) ?? null
            : null);
        }
      } catch (rosterError) {
        if (!stopped) {
          setMembers([]);
          if (rosterError instanceof ApiHttpError && rosterError.status === 410) leave();
        }
      } finally {
        if (!stopped) timer = window.setTimeout(tick, POLL_MS);
      }
    };
    void tick();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [active, sid, token, leave]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await startClassroomSession(groupId);
      adopt(result.token, result.session_id, 'starter', result.expires_at, {
        kind: 'classroom', groupId, label: groupName,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t('teacher.classroomSessionFailed'));
    } finally {
      setBusy(false);
    }
  }, [adopt, groupId, groupName, t]);

  const end = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await endClassroomSession(groupId);
      leave();
      setMembers([]);
      setSelected(null);
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : t('teacher.classroomSessionFailed'));
    } finally {
      setBusy(false);
    }
  }, [groupId, leave, t]);

  if (loading) return <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('sideMenu.loading')}</div>;

  if (!active) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
        background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`, borderRadius: 8,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.panelTxt }}>{t('teacher.classroomSession')}</div>
          <div style={{ marginTop: 3, fontSize: 11.5, color: theme.panelTxtMute }}>{t('teacher.classroomSessionHint')}</div>
          {error && <div role="alert" style={{ marginTop: 4, fontSize: 11.5, color: theme.errorLine }}>{error}</div>}
        </div>
        <button type="button" disabled={busy} onClick={() => void start()} style={{
          border: 0, borderRadius: 6, padding: '8px 13px', cursor: busy ? 'default' : 'pointer',
          background: theme.runBg, color: theme.runTxt, fontFamily: theme.fontUI, fontWeight: 700,
        }}>
          {busy ? t('session.starting') : t('teacher.startClass')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden', background: theme.surfacePanel }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: `1px solid ${theme.panelBorder}` }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: theme.successPillTxt }} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: theme.panelTxt }}>
          {t('teacher.groupIsLive', { group: groupName })}
        </span>
        <span style={{ fontSize: 11.5, color: theme.panelTxtMute }}>{t('teacher.joinedCount', { count: members.length })}</span>
        <button type="button" disabled={busy} onClick={() => void end()} style={{
          border: `1px solid ${theme.panelBorder}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer',
          background: theme.surface, color: theme.panelTxt, fontFamily: theme.fontUI, fontSize: 11.5,
        }}>
          {t('teacher.endClass')}
        </button>
      </div>
      {error && <div role="alert" style={{ padding: '7px 10px', color: theme.errorLine, fontSize: 11.5 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '190px minmax(0, 1fr)' : '1fr', minHeight: selected ? 380 : 0 }}>
        <div style={{ borderRight: selected ? `1px solid ${theme.panelBorder}` : undefined }}>
          {members.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.waitingForStudents')}</div>
          ) : members.map((member) => {
            const label = userLabel(member.student_name ?? '', member.student_handle);
            return (
              <button key={member.student_id} type="button" onClick={() => setSelected(member)} style={{
                display: 'flex', width: '100%', boxSizing: 'border-box', alignItems: 'center', gap: 8,
                padding: '9px 10px', border: 0, borderBottom: `1px solid ${theme.panelBorder}`,
                cursor: 'pointer', textAlign: 'left', fontFamily: theme.fontUI,
                background: selected?.student_id === member.student_id ? theme.chip : 'transparent', color: theme.panelTxt,
              }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: member.idle ? theme.panelTxtMute : theme.successPillTxt }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: theme.panelTxtMute, overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.file ?? '—'}</span>
                </span>
              </button>
            );
          })}
        </div>
        {selected && <PeerCodeView peerId={selected.student_id} label={userLabel(selected.student_name ?? '', selected.student_handle)} />}
      </div>
    </div>
  );
}
