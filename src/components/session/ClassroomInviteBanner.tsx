import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLiveGroupInvitations, joinClassroomSession, type LiveGroupInvitation } from '../../state/api';
import { useIde } from '../../state/IdeState';
import { useLiveSession } from '../../state/useLiveSession';
import { useThemeStore } from '../../state/useTheme';
import { useUser } from '../../state/useUser';

const POLL_MS = 8000;

export function ClassroomInviteBanner({ onJoined }: { onJoined?: () => void } = {}) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const user = useUser((s) => s.user);
  const authState = useUser((s) => s.authState);
  const sid = useLiveSession((s) => s.sid);
  const adopt = useLiveSession((s) => s.adopt);
  const [invitation, setInvitation] = useState<LiveGroupInvitation | null>(null);
  const [dismissedSid, setDismissedSid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authState !== 'logged_in' || user?.role !== 'student' || sid) {
      setInvitation(null);
      return;
    }
    let stopped = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const invitations = await getLiveGroupInvitations();
        if (!stopped) {
          setInvitation(invitations.find((item) => item.session_id !== dismissedSid) ?? null);
        }
      } catch {
        if (!stopped) setInvitation(null);
      } finally {
        if (!stopped) timer = window.setTimeout(tick, POLL_MS);
      }
    };
    void tick();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [authState, user?.role, sid, dismissedSid]);

  if (!invitation) return null;

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await joinClassroomSession(invitation.group_id);
      adopt(session.token, session.session_id, 'joiner', session.expires_at, {
        kind: 'classroom', groupId: invitation.group_id, label: invitation.group_name,
      });
      useIde.getState().setActivePanel('live');
      setInvitation(null);
      onJoined?.();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : t('session.joinFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', flexShrink: 0,
      background: theme.successPill, color: theme.panelTxt,
      borderBottom: `1px solid ${theme.panelBorder}`,
      fontFamily: theme.fontUI, fontSize: 13,
    }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: theme.successPillTxt }} />
      <span style={{ flex: 1, fontWeight: 650 }}>
        {error ?? t('session.classroomInvite', { group: invitation.group_name })}
      </span>
      <button type="button" disabled={busy} onClick={() => void join()} style={{
        border: 0, borderRadius: 6, padding: '6px 12px', cursor: busy ? 'default' : 'pointer',
        background: theme.runBg, color: theme.runTxt, fontWeight: 700, fontFamily: theme.fontUI,
      }}>
        {busy ? t('session.joining') : t('session.joinClass')}
      </button>
      <button type="button" onClick={() => setDismissedSid(invitation.session_id)} style={{
        border: 0, background: 'transparent', color: theme.panelTxtMute, cursor: 'pointer',
        fontFamily: theme.fontUI, padding: '6px 8px',
      }}>
        {t('session.notNow')}
      </button>
    </div>
  );
}
