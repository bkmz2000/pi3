import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useLiveSession } from '../../state/useLiveSession';
import {
  getSessionMember, postSessionReaction,
  type LiveMemberBuffer, type SessionReactionKind,
} from '../../state/api';
import { ReadOnlyCode } from '../ReadOnlyCode';
import { Icon } from '../Icons';

const CODE_POLL_MS = 1000;

/**
 * A peer's live buffer, rendered where the editor normally is. Opened from a
 * peer card in the live panel and closed like a file tab. Read-only by
 * construction — a session shares telemetry, never edit rights.
 */
export function PeerCodeView({ peerId, label, onClose }: { peerId: string; label: string; onClose?: () => void }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { token, sid } = useLiveSession();
  const [buffer, setBuffer] = useState<LiveMemberBuffer | null>(null);
  const [denied, setDenied] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [sent, setSent] = useState<SessionReactionKind | null>(null);

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

  const react = async (reaction: SessionReactionKind) => {
    if (!token || !sid || !buffer?.file || selectedLine == null) return;
    try {
      await postSessionReaction(sid, token, reaction, peerId, buffer.file, selectedLine);
      setSent(reaction);
      window.setTimeout(() => setSent(null), 1200);
    } catch {
      /* ignore */
    }
  };

  const reactionOptions: Array<{ id: SessionReactionKind; glyph: string }> = [
    { id: 'good', glyph: '👍' },
    { id: 'question', glyph: '❓' },
    { id: 'try', glyph: '↻' },
  ];

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
        <span style={{ fontSize: 11, color: theme.panelTxtMute }}>
          {selectedLine == null ? t('session.selectLine') : t('session.selectedLine', { line: selectedLine })}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {reactionOptions.map(({ id, glyph }) => (
            <button
              key={id}
              type="button"
              title={t(`session.reaction.${id}`)}
              aria-label={t(`session.reaction.${id}`)}
              disabled={selectedLine == null}
              onClick={() => react(id)}
              style={{
                appearance: 'none', display: 'grid', placeItems: 'center',
                width: 28, height: 28, padding: 0,
                background: 'transparent', color: theme.panelTxt, border: 0,
                cursor: selectedLine == null ? 'default' : 'pointer',
                fontSize: 16, lineHeight: 1,
                opacity: selectedLine == null ? 0.45 : 1,
                transform: sent === id ? 'scale(1.16)' : 'scale(1)',
                transition: 'transform 120ms ease, opacity 120ms ease',
              }}
            >
              <span aria-hidden="true">{glyph}</span>
            </button>
          ))}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} title={t('teacher.close')} style={{
            display: 'grid', placeItems: 'center', width: 26, height: 26, padding: 0,
            border: `1px solid ${theme.panelBorder}`, borderRadius: 6,
            background: theme.surface, color: theme.panelTxtMute, cursor: 'pointer',
          }}>
            <Icon name="close" size={13} color="currentColor" />
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {buffer?.content ? (
          <ReadOnlyCode
            content={buffer.content}
            cursorLine={buffer.cursor_line}
            selectedLine={selectedLine}
            onLineSelect={setSelectedLine}
            height="100%"
          />
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
