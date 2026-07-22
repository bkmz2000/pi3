import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { getLiveGroup, getLiveMember, type LivePresenceMember, type LiveMemberBuffer } from '../../state/api';
import { userLabel } from '../../utils/userDisplay';
import { ReadOnlyCode } from '../ReadOnlyCode';

const POLL_MS = 4000;
const CODE_POLL_MS = 3000;

/**
 * Live per-student activity for one group. Polls the server every few seconds
 * and shows current file + cursor line + updated-ago tag. Idle rows dim out.
 *
 * No WebSocket — deliberate. Polling keeps the server stateless, works behind
 * proxies, and matches classroom scale (dozens, not thousands).
 */
export function LiveRoster({ groupId }: { groupId: string }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [members, setMembers] = useState<LivePresenceMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<LiveMemberBuffer | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const r = await getLiveGroup(groupId);
        if (cancelled.current) return;
        setMembers(r.members);
        setServerNow(r.server_now);
        setError(null);
      } catch (e) {
        if (cancelled.current) return;
        setError(e instanceof Error ? e.message : 'Roster unavailable');
      } finally {
        if (!cancelled.current) {
          timer = window.setTimeout(tick, POLL_MS);
        }
      }
    };
    void tick();

    return () => {
      cancelled.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [groupId]);

  // Master-detail: while a member is selected, poll only their buffer.
  useEffect(() => {
    if (!selectedId) { setBuffer(null); return; }
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const b = await getLiveMember(groupId, selectedId);
        if (!stop) setBuffer(b);
      } catch {
        /* best-effort; keep last buffer */
      } finally {
        if (!stop) timer = window.setTimeout(tick, CODE_POLL_MS);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [selectedId, groupId]);

  if (members == null && !error) {
    return <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('sideMenu.loading')}</div>;
  }
  if (error) {
    return <div style={{ color: theme.tabDirty, fontSize: 13 }}>{error}</div>;
  }
  if (!members || members.length === 0) {
    return <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noMembers')}</div>;
  }

  // `server_now` from the last poll; avoids clock drift between teacher and
  // student devices. Ago-label refreshes on every poll (every POLL_MS).
  const now = serverNow || 0;
  const selectedMember = selectedId ? members.find((m) => m.student_id === selectedId) ?? null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {members.map((m) => {
        const secs = m.updated_at ? Math.round((now - m.updated_at) / 1000) : null;
        const ago = secs == null
          ? t('teacher.notActive')
          : secs <= 2 ? t('teacher.justNow') : `${secs}s ${t('teacher.ago')}`;
        const selected = selectedId === m.student_id;
        return (
          <div
            key={m.student_id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => setSelectedId(selected ? null : m.student_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(selected ? null : m.student_id); }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              background: selected ? theme.chip : theme.surfacePanel,
              border: `1px solid ${selected ? theme.accent : theme.panelBorder}`,
              opacity: m.idle ? 0.55 : 1,
              transition: 'opacity 200ms, border-color 120ms',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8, height: 8, borderRadius: 99,
                background: m.idle ? theme.panelTxtMute : '#7ec98f',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>
                {userLabel(m.student_name, m.student_handle)}
              </div>
              <div style={{ fontSize: 11.5, color: theme.panelTxtMute, fontFamily: theme.fontMono }}>
                {m.file ?? '—'}
                {m.cursor_line != null && <> · line {m.cursor_line}</>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: theme.panelTxtMute }}>{ago}</div>
          </div>
        );
      })}
      {selectedMember && (
        <div style={{ marginTop: 4, border: `1px solid ${theme.panelBorder}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: theme.chip }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxt }}>
              {userLabel(selectedMember.student_name, selectedMember.student_handle)}
            </span>
            <span style={{ fontSize: 11, color: theme.panelTxtMute, fontFamily: theme.fontMono, flex: 1, minWidth: 0 }}>
              {buffer?.file ?? selectedMember.file ?? '—'}
              {buffer?.cursor_line != null && <> · {t('teacher.line')} {buffer.cursor_line}</>}
            </span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              title={t('teacher.close')}
              style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute, padding: '0 4px' }}
            >
              ✕
            </button>
          </div>
          <div style={{ height: 260, background: theme.surfacePanel }}>
            {buffer?.content != null && buffer.content !== ''
              ? <ReadOnlyCode content={buffer.content} cursorLine={buffer.cursor_line} height="260px" />
              : <div style={{ padding: 12, fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.noLiveCode')}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
