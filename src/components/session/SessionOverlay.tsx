import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useLiveSession } from '../../state/useLiveSession';
import { GroupView } from './GroupView';

// Build a shareable join link. The token rides the URL fragment (never the
// query) so it stays out of server logs and Referer headers.
function joinLink(token: string): string {
  return `${window.location.origin}/#session=${encodeURIComponent(token)}`;
}

/**
 * Floating live-session control, available in both profiles (public: the
 * headline collaboration surface; institutional: an opt-in peer-pairing bar,
 * alongside the teacher dashboard's classroom view). Start a session, copy the
 * join link, open the symmetric group view, or leave. Also auto-joins from a
 * `#session=<token>` fragment when someone opens a shared link.
 */
export function SessionOverlay() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { token, sid, role, start, join, leave } = useLiveSession();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const joinedFromHash = useRef(false);

  // Auto-join from a shared link (#session=<token>), once.
  useEffect(() => {
    if (joinedFromHash.current) return;
    const m = window.location.hash.match(/session=([^&]+)/);
    if (!m) return;
    joinedFromHash.current = true;
    const tok = decodeURIComponent(m[1]);
    // Clear the token from the URL immediately so it isn't left in history.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setBusy(true);
    join(tok).catch(() => { /* invalid/expired link — silently ignore */ }).finally(() => setBusy(false));
  }, [join]);

  const inSession = !!token && !!sid;

  const btn = (bg: string): React.CSSProperties => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    fontFamily: theme.fontUI,
  });

  const handleStart = async () => {
    setBusy(true);
    try { await start(); } finally { setBusy(false); }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard?.writeText(joinLink(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; ignore */ }
  };

  return (
    <>
      <div style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 8,
        background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
        borderRadius: 10, padding: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        {!inSession ? (
          <button type="button" disabled={busy} onClick={handleStart} style={btn(theme.accent)}>
            {busy ? t('session.starting') : t('session.start')}
          </button>
        ) : (
          <>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: '#7ec98f' }} />
            <span style={{ fontSize: 12, color: theme.panelTxt, fontWeight: 600 }}>
              {role === 'starter' ? t('session.hosting') : t('session.joined')}
            </span>
            <button type="button" onClick={handleCopy} style={btn(theme.accent)}>
              {copied ? t('session.copied') : t('session.copyLink')}
            </button>
            <button type="button" onClick={() => setShowGroup(true)} style={btn(theme.accent)}>
              {t('session.groupView')}
            </button>
            <button type="button" onClick={() => { leave(); setShowGroup(false); }} style={{ ...btn(theme.stopBg), }}>
              {t('session.leave')}
            </button>
          </>
        )}
      </div>

      {showGroup && inSession && (
        <div
          role="dialog"
          aria-modal
          onClick={(e) => { if (e.target === e.currentTarget) setShowGroup(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div style={{ width: 'min(1100px, 96vw)', height: 'min(680px, 90vh)', background: theme.surface, border: `1px solid ${theme.panelBorder}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${theme.panelBorder}`, background: theme.surfacePanel }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: theme.panelTxt }}>{t('session.groupView')}</span>
              <button type="button" onClick={() => setShowGroup(false)} title={t('teacher.close')} style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: '0 6px', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <GroupView />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SessionOverlay;
