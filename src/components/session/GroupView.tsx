import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useLiveSession } from '../../state/useLiveSession';
import {
  getSessionRoster, getSessionMember, getAllowedEmoji, postSessionComment, listSessionComments,
  type LiveSessionMember, type LiveMemberBuffer, type SessionComment,
} from '../../state/api';
import { userLabel } from '../../utils/userDisplay';
import { ReadOnlyCode } from '../ReadOnlyCode';

const ROSTER_POLL_MS = 4000;
const CODE_POLL_MS = 3000;
const COMMENT_POLL_MS = 4000;

/**
 * Session group view: everyone's live code in one place. Master-detail — the
 * roster lists members (self-registered via session-stamped presence pings),
 * selecting one streams their buffer. Symmetric by default; in a classroom
 * (groupId-bound) session the server only lets the starter read peers.
 */
export function GroupView() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { token, sid } = useLiveSession();
  const [members, setMembers] = useState<LiveSessionMember[] | null>(null);
  const [serverNow, setServerNow] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<LiveMemberBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowedEmoji, setAllowedEmoji] = useState<string[]>([]);
  const [comments, setComments] = useState<SessionComment[]>([]);

  // Allowed emoji palette (fixed whitelist, fetched once).
  useEffect(() => {
    getAllowedEmoji().then(setAllowedEmoji).catch(() => { /* ignore */ });
  }, []);

  // Poll reactions.
  useEffect(() => {
    if (!token || !sid) return;
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

  const react = async (emoji: string, target: string) => {
    if (!token || !sid) return;
    try {
      const c = await postSessionComment(sid, token, emoji, target);
      setComments((prev) => [...prev, c]); // optimistic; next poll reconciles
    } catch {
      /* ignore */
    }
  };

  // Reaction counts per target: { studentId: { emoji: count } }.
  const countsByTarget: Record<string, Record<string, number>> = {};
  for (const c of comments) {
    if (!c.target) continue;
    (countsByTarget[c.target] ??= {})[c.emoji] = (countsByTarget[c.target]?.[c.emoji] ?? 0) + 1;
  }

  // Poll the roster.
  useEffect(() => {
    if (!token || !sid) return;
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

  // Poll the selected member's buffer.
  useEffect(() => {
    if (!token || !sid || !selectedId) { setBuffer(null); return; }
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const b = await getSessionMember(sid, selectedId, token);
        if (!stop) setBuffer(b);
      } catch {
        /* keep last buffer */
      } finally {
        if (!stop) timer = window.setTimeout(tick, CODE_POLL_MS);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [token, sid, selectedId]);

  const now = serverNow || 0;
  const selectedMember = selectedId ? members?.find((m) => m.student_id === selectedId) ?? null : null;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Roster */}
      <div style={{ flex: '0 0 240px', overflowY: 'auto', borderRight: `1px solid ${theme.panelBorder}`, background: theme.surfacePanel }}>
        {error && <div style={{ padding: 12, fontSize: 12, color: theme.tabDirty }}>{error}</div>}
        {members && members.length === 0 && (
          <div style={{ padding: 12, fontSize: 12, color: theme.panelTxtMute }}>{t('session.empty')}</div>
        )}
        {members?.map((m) => {
          const secs = m.updated_at ? Math.round((now - m.updated_at) / 1000) : null;
          const ago = secs == null ? t('teacher.notActive') : secs <= 2 ? t('teacher.justNow') : `${secs}s ${t('teacher.ago')}`;
          const selected = selectedId === m.student_id;
          return (
            <div
              key={m.student_id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => setSelectedId(selected ? null : m.student_id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(selected ? null : m.student_id); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer',
                borderBottom: `1px solid ${theme.panelBorder}`,
                background: selected ? theme.chip : 'transparent',
                opacity: m.idle ? 0.55 : 1,
              }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: m.idle ? theme.panelTxtMute : '#7ec98f', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>{userLabel(m.student_name ?? '', m.student_handle)}</div>
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

      {/* Code pane */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: theme.surface }}>
        {selectedMember && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: `1px solid ${theme.panelBorder}`, background: theme.surfacePanel }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxt, flex: 1, minWidth: 0 }}>
              {userLabel(selectedMember.student_name ?? '', selectedMember.student_handle)}
            </span>
            {/* Emoji-only reactions targeting this member. */}
            <div style={{ display: 'flex', gap: 2 }}>
              {allowedEmoji.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  title={t('session.react')}
                  onClick={() => react(emoji, selectedMember.student_id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          {selectedMember && buffer?.content
            ? <ReadOnlyCode content={buffer.content} cursorLine={buffer.cursor_line} height="100%" />
            : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.panelTxtMute, fontSize: 13 }}>
                {selectedMember ? t('teacher.noLiveCode') : t('session.selectMember')}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default GroupView;
