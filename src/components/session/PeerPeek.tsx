import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import type { LiveMemberBuffer } from '../../state/api';

const PEEK_POLL_MS = 1000;
const PEEK_LINES = 24;

/**
 * Hover preview of a peer's live buffer, floated beside the live panel. Plain
 * text rather than a CodeMirror instance: it mounts and unmounts on every hover,
 * so it has to be cheap. Click the card for the full read-only editor tab.
 */
export function PeerPeek({
  label,
  anchorY,
  fetchBuffer,
}: {
  label: string;
  anchorY: number;
  fetchBuffer: () => Promise<LiveMemberBuffer>;
}) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [buffer, setBuffer] = useState<LiveMemberBuffer | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const b = await fetchBuffer();
        if (!stop) setBuffer(b);
      } catch {
        /* keep whatever we had */
      } finally {
        if (!stop) timer = window.setTimeout(tick, PEEK_POLL_MS);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [fetchBuffer]);

  const lines = (buffer?.content ?? '').split('\n');
  const shown = lines.slice(0, PEEK_LINES).join('\n');
  const truncated = lines.length > PEEK_LINES;

  return (
    <div
      // Purely informational: the card behind it owns the interaction.
      aria-hidden
      style={{
        position: 'fixed',
        left: 388, // rail (60) + panel (320) + gap
        top: Math.max(8, Math.min(anchorY, window.innerHeight - 320)),
        width: 420,
        maxHeight: 300,
        overflow: 'hidden',
        background: theme.surfacePanel,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 8,
        boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
        zIndex: 60,
        pointerEvents: 'none',
        fontFamily: theme.fontUI,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', borderBottom: `1px solid ${theme.panelBorder}`,
        fontSize: 11.5, color: theme.panelTxtMute,
      }}>
        <span style={{ fontWeight: 700, color: theme.panelTxt }}>{label}</span>
        <span style={{ fontFamily: theme.fontMono }}>{buffer?.file ?? ''}</span>
      </div>
      {buffer?.content ? (
        <pre style={{
          margin: 0, padding: '8px 10px',
          fontFamily: theme.fontMono, fontSize: 11.5, lineHeight: 1.45,
          color: theme.panelTxt, whiteSpace: 'pre', overflow: 'hidden',
        }}>
          {shown}{truncated ? '\n…' : ''}
        </pre>
      ) : (
        <div style={{ padding: '10px', fontSize: 12, color: theme.panelTxtMute }}>
          {t('teacher.noLiveCode')}
        </div>
      )}
    </div>
  );
}

export default PeerPeek;
