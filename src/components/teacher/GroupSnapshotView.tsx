import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { getGroupSnapshot, type GroupSnapshot, type GroupSnapshotMember } from '../../state/api';
import { btnSecondary } from './styles';
import { userLabel } from '../../utils/userDisplay';

const POLL_INTERVAL_MS = 8000;

export function GroupSnapshotView({
  groupId, groupName, onBack,
}: { groupId: string; groupName: string; onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;

    async function poll() {
      if (inFlight.current || document.hidden) return;
      inFlight.current = true;
      try {
        const snap = await getGroupSnapshot(groupId);
        if (stopped) return;
        setSnapshot(snap);
        setError(null);
        setSelectedId((prev) => prev ?? snap.members[0]?.student_id ?? null);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      } finally {
        inFlight.current = false;
      }
    }

    function schedule() {
      if (stopped) return;
      timer = window.setTimeout(async () => {
        await poll();
        schedule();
      }, POLL_INTERVAL_MS);
    }

    function onVisibility() {
      if (document.hidden) {
        if (timer !== null) { clearTimeout(timer); timer = null; }
      } else {
        void poll();
        if (timer === null) schedule();
      }
    }

    void poll();
    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [groupId]);

  const members = snapshot?.members ?? [];
  const selected = members.find((m) => m.student_id === selectedId) ?? members[0] ?? null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${theme.panelBorder}` }}>
        <button type="button" onClick={onBack} style={btnSecondary(theme)}>← {t('teacher.backToGroups')}</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>{groupName}</span>
        <span style={{ fontSize: 12, color: theme.panelTxtMute, marginLeft: 'auto' }}>
          {snapshot ? t('teacher.snapshotUpdatedAt', { time: new Date(snapshot.generated_at).toLocaleTimeString() }) : t('sideMenu.loading')}
        </span>
      </div>
      {error && (
        <div style={{ padding: '8px 20px', fontSize: 12, color: theme.stopBg }}>{error}</div>
      )}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 240, borderRight: `1px solid ${theme.panelBorder}`, overflow: 'auto' }}>
          {members.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: theme.panelTxtMute }}>{t('teacher.noMembers')}</div>
          ) : members.map((m) => (
            <MemberRow key={m.student_id} m={m} selected={m.student_id === selected?.student_id} onSelect={() => setSelectedId(m.student_id)} />
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {selected ? <MemberDetail m={selected} /> : (
            <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.snapshotSelectMember')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ m, selected, onSelect }: { m: GroupSnapshotMember; selected: boolean; onSelect: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const label = userLabel(m.student_name, m.student_handle);
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        all: 'unset', cursor: 'pointer', display: 'block',
        width: '100%', boxSizing: 'border-box',
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.panelBorder}`,
        background: selected ? theme.railActiveBg : 'transparent',
        color: theme.panelTxt,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 2 }}>
        {m.updated_at ? t('teacher.snapshotUpdatedAt', { time: new Date(m.updated_at).toLocaleTimeString() }) : t('teacher.snapshotNoProject')}
      </div>
    </button>
  );
}

function MemberDetail({ m }: { m: GroupSnapshotMember }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  if (!m.files || !m.project_id) {
    return <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.snapshotNoProject')}</div>;
  }
  const currentFile = m.current_file && m.files[m.current_file]
    ? m.current_file
    : Object.keys(m.files)[0] ?? null;
  const code = currentFile ? m.files[currentFile] : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>
        {m.project_name} <span style={{ color: theme.panelTxtMute, fontWeight: 400 }}>· {currentFile ?? '—'}</span>
      </div>
      <pre style={{
        flex: 1, margin: 0, padding: 12, overflow: 'auto',
        background: theme.chip, border: `1px solid ${theme.panelBorder}`, borderRadius: 6,
        fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxt,
        whiteSpace: 'pre',
      }}>{code}</pre>
    </div>
  );
}
