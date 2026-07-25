import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useLiveSession } from '../../state/useLiveSession';
import {
  getSessionMember, getAllowedEmoji, postSessionComment,
  type LiveMemberBuffer,
} from '../../state/api';
import { ReadOnlyCode } from '../ReadOnlyCode';

const CODE_POLL_MS = 1000;

/**
 * A peer's live buffer, rendered where the editor normally is. Opened from a
 * peer card in the live panel and closed like a file tab. Read-only by
 * construction — a session shares telemetry, never edit rights.
 */
export function PeerCodeView({ peerId, label }: { peerId: string; label: string }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { token, sid } = useLiveSession();
  const [buffer, setBuffer] = useState<LiveMemberBuffer | null>(null);
  const [allowedEmoji, setAllowedEmoji] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getAllowedEmoji().then(setAllowedEmoji).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!token || !sid) { setBuffer(null); return; }
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const b = await getSessionMember(sid, peerId, token);
        if (!stop) { setBuffer(b); setDenied(false); }
      } catch {
        // In a classroom session only the teacher may read a peer; keep the
        // last buffer (if any) and say so rather than looping silently.
        if (!stop && !buffer) setDenied(true);
      } finally {
        if (!stop) timer = window.setTimeout(tick, CODE_POLL_MS);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
    // `buffer` is intentionally not a dependency: it would restart the poll on
    // every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sid, peerId]);

  const react = async (emoji: string) => {
    if (!token || !sid) return;
    try {
      await postSessionComment(sid, token, emoji, peerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: theme.surface }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderBottom: `1px solid ${theme.panelBorder}`,
        background: theme.surfacePanel, fontFamily: theme.fontUI, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.panelTxt }}>{label}</span>
        <span style={{ fontSize: 11.5, color: theme.panelTxtMute, fontFamily: theme.fontMono }}>
          {buffer?.file ?? ''}{buffer?.cursor_line != null && <> · {t('teacher.line')} {buffer.cursor_line}</>}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: theme.panelTxtMute }}>{t('session.readOnly')}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {allowedEmoji.map((emoji) => (
            <button
              key={emoji}
              type="button"
              title={t('session.react')}
              onClick={() => react(emoji)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {buffer?.content ? (
          <ReadOnlyCode content={buffer.content} cursorLine={buffer.cursor_line} height="100%" />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
            color: theme.panelTxtMute, fontSize: 13, fontFamily: theme.fontUI,
          }}>
            {denied ? t('session.peerNotVisible') : t('teacher.noLiveCode')}
          </div>
        )}
      </div>
    </div>
  );
}

export default PeerCodeView;
