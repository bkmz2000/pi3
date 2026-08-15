import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useUser } from '../../state/useUser';
import { useLiveSession } from '../../state/useLiveSession';
import {
  getSessionRoster, getSessionMember, listSessionComments,
  type LiveSessionMember, type SessionComment,
} from '../../state/api';
import { joinLink } from '../../state/pendingSession';
import { userLabel } from '../../utils/userDisplay';
import { Icon } from '../Icons';
import { PeerPeek } from './PeerPeek';

// Fast enough to read as live. Presence pings run at the same cadence, so a
// keystroke shows up on a peer's roster row within ~2 ticks.
const ROSTER_POLL_MS = 1000;
const COMMENT_POLL_MS = 2000;

/**
 * Live panel: session status, session controls, and the peer roster. Hovering a
 * peer card peeks at their code; clicking it opens their buffer as a read-only
 * tab in the editor (see FileBar / PeerCodeView).
 */
export default function LivePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user, authState } = useUser();
  const { token, sid, role, start, leave, openPeer, peerTabs } = useLiveSession();

  const [members, setMembers] = useState<LiveSessionMember[] | null>(null);
  const [serverNow, setServerNow] = useState(0);
  const [comments, setComments] = useState<SessionComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [peek, setPeek] = useState<{ id: string; label: string; anchorY: number } | null>(null);
  const copiedTimer = useRef<number | null>(null);

  const inSession = !!token && !!sid;

  // Poll the roster.
  useEffect(() => {
    if (!token || !sid) { setMembers(null); return; }
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const r = await getSessionRoster(sid, token);
        if (stop) return;
        setMembers(r.members);
        setServerNow(r.server_now);
        setError(null);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : 'Session unavailable');
      } finally {
        if (!stop) timer = window.setTimeout(tick, ROSTER_POLL_MS);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [token, sid]);

  // Poll reactions (for the per-card counts).
  useEffect(() => {
    if (!token || !sid) { setComments([]); return; }
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const c = await listSessionComments(sid, token);
        if (!stop) setComments(c);
      } catch {
        /* ignore */
      } finally {
        if (!stop) timer = window.setTimeout(tick, COMMENT_POLL_MS);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [token, sid]);

  useEffect(() => () => { if (copiedTimer.current) window.clearTimeout(copiedTimer.current); }, []);

  const handleStart = async () => {
    setBusy(true);
    try { await start(); } catch { /* surfaced by the roster error line */ } finally { setBusy(false); }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard?.writeText(joinLink(token));
      setCopied(true);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; ignore */ }
  };

  const fetchPeek = useCallback(
    (id: string) => (token && sid ? getSessionMember(sid, id, token) : Promise.reject(new Error('no session'))),
    [token, sid],
  );

  // Reaction counts per target: { studentId: { emoji: count } }.
  const countsByTarget: Record<string, Record<string, number>> = {};
  for (const c of comments) {
    if (!c.target) continue;
    (countsByTarget[c.target] ??= {})[c.emoji] = (countsByTarget[c.target]?.[c.emoji] ?? 0) + 1;
  }

  const btn = (bg: string, txt: string): React.CSSProperties => ({
    all: 'unset', cursor: 'pointer', textAlign: 'center',
    background: bg, color: txt, borderRadius: 6,
    padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
    fontFamily: theme.fontUI,
  });

  const self = members?.find((m) => m.student_id === user?.id) ?? null;
  const peers = members?.filter((m) => m.student_id !== user?.id) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px 0 12px', background: theme.panelHeader,
        borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0,
      }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: theme.panelTxt, fontFamily: theme.fontUI }}>
          {t('session.panelTitle')}
        </span>
        <button
          type="button"
          onClick={onClose}
          title={t('sideMenu.close')}
          style={{
            all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.panelTxtMute,
          }}
        >
          <Icon name="close" size={14} color="currentColor" />
        </button>
      </div>

      {/* Status + controls */}
      <div style={{
        padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
        borderBottom: `1px solid ${theme.panelBorder}`, fontFamily: theme.fontUI, flexShrink: 0,
      }}>
        {authState !== 'logged_in' ? (
          <div style={{ fontSize: 12.5, color: theme.panelTxtMute }}>{t('session.signInFirst')}</div>
        ) : !inSession ? (
          <>
            <div style={{ fontSize: 12.5, color: theme.panelTxtMute }}>{t('session.notInSession')}</div>
            <button type="button" disabled={busy} onClick={handleStart} style={btn(theme.primaryBg, theme.primaryTxt)}>
              {busy ? t('session.starting') : t('session.start')}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: '#7ec98f' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.panelTxt }}>
                {role === 'starter' ? t('session.hosting') : t('session.joined')}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: theme.panelTxtMute, fontFamily: theme.fontMono }}>
                {self?.file ?? '—'}{self?.cursor_line != null && <> · {t('teacher.line')} {self.cursor_line}</>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={handleCopy} style={{ ...btn(theme.accent, '#fff'), flex: 1 }}>
                {copied ? t('session.copied') : t('session.copyLink')}
              </button>
              <button type="button" onClick={leave} style={btn(theme.stopBg, '#fff')}>
                {t('session.leave')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Peers */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {error && <div style={{ padding: 12, fontSize: 12, color: theme.tabDirty, fontFamily: theme.fontUI }}>{error}</div>}
        {inSession && peers.length === 0 && (
          <div style={{ padding: 12, fontSize: 12.5, color: theme.panelTxtMute, fontFamily: theme.fontUI }}>
            {t('session.empty')}
          </div>
        )}
        {peers.map((m) => {
          const secs = m.updated_at ? Math.round((serverNow - m.updated_at) / 1000) : null;
          const ago = secs == null ? t('teacher.notActive') : secs <= 2 ? t('teacher.justNow') : `${secs}s ${t('teacher.ago')}`;
          const label = userLabel(m.student_name ?? '', m.student_handle);
          const open = peerTabs.some((p) => p.id === m.student_id);
          return (
            <div
              key={m.student_id}
              role="button"
              tabIndex={0}
              title={t('session.openPeerTab')}
              onMouseEnter={(e) => setPeek({ id: m.student_id, label, anchorY: e.currentTarget.getBoundingClientRect().top })}
              onMouseLeave={() => setPeek((p) => (p?.id === m.student_id ? null : p))}
              onFocus={(e) => setPeek({ id: m.student_id, label, anchorY: e.currentTarget.getBoundingClientRect().top })}
              onBlur={() => setPeek((p) => (p?.id === m.student_id ? null : p))}
              onClick={() => openPeer({ id: m.student_id, label })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPeer({ id: m.student_id, label }); }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer',
                borderBottom: `1px solid ${theme.panelBorder}`,
                background: open ? theme.chip : 'transparent',
                opacity: m.idle ? 0.55 : 1,
                fontFamily: theme.fontUI,
              }}
            >
              <span aria-hidden style={{
                width: 8, height: 8, borderRadius: 99, flexShrink: 0,
                background: m.idle ? theme.panelTxtMute : '#7ec98f',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>{label}</div>
                <div style={{ fontSize: 11.5, color: theme.panelTxtMute, fontFamily: theme.fontMono }}>
                  {m.file ?? '—'}{m.cursor_line != null && <> · {t('teacher.line')} {m.cursor_line}</>}
                </div>
                {countsByTarget[m.student_id] && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                    {Object.entries(countsByTarget[m.student_id]).map(([emoji, n]) => (
                      <span key={emoji} style={{ fontSize: 11, background: theme.surface, borderRadius: 10, padding: '1px 6px', color: theme.panelTxt }}>
                        {emoji} {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: theme.panelTxtMute }}>{ago}</span>
            </div>
          );
        })}
      </div>

      {peek && <PeerPeek label={peek.label} anchorY={peek.anchorY} fetchBuffer={() => fetchPeek(peek.id)} />}
    </div>
  );
}
