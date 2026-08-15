import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { Icon } from '../Icons';
import ImportProblemsModal from './ImportProblemsModal';
import { TeacherShell, type TeacherSection } from './TeacherShell';

interface ProblemRow {
  id: number;
  slug: string;
  title: string;
  order_index: number;
  archived: number;
  updated_at: string;
  tests_t1: number;
  tests_t2: number;
  tests_t3: number;
}

export default function TeacherProblemList() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const navigate = useNavigate();
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetch('/api/teacher/problems', { credentials: 'include' })
      .then((r) => r.json())
      .then(setProblems)
      .catch(() => {});
  }, []);

  const handleArchive = async (p: ProblemRow) => {
    if (!confirm(t('teacher.archiveConfirm', { title: p.title }))) return;
    setArchiving(p.slug);
    await fetch(`/api/teacher/problems/${p.slug}/archive`, { method: 'POST', credentials: 'include' });
    setProblems((prev) => prev.map((r) => r.slug === p.slug ? { ...r, archived: 1 } : r));
    setArchiving(null);
  };

  const active = problems.filter((p) => !p.archived);
  const archived = problems.filter((p) => p.archived);

  const rowStyle = (p: ProblemRow): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderBottom: `1px solid ${theme.panelBorder}`,
    opacity: p.archived ? 0.55 : 1,
    fontFamily: theme.fontUI,
    fontSize: 13.5,
    color: theme.panelTxt,
  });

  const renderRow = (p: ProblemRow) => (
    <div key={p.slug} style={rowStyle(p)}>
      <span style={{ flex: '0 0 40px', color: theme.panelTxtMute, fontSize: 12 }}>{p.order_index}</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{p.title}</span>
      <span style={{ color: theme.panelTxtMute, fontSize: 12, fontFamily: theme.fontMono }}>{p.slug}</span>
      <span style={{ color: theme.panelTxtMute, fontSize: 12 }}>
        {t('teacher.testCount', { t1: p.tests_t1, t2: p.tests_t2, t3: p.tests_t3 })}
      </span>
      <button
        onClick={() => navigate(`/teacher/problems/${p.slug}/edit`)}
        style={{
          all: 'unset', cursor: 'pointer', padding: '4px 10px',
          borderRadius: 5, background: theme.chip,
          fontSize: 12, color: theme.panelTxt,
        }}
      >
        {t('teacher.editProblem')}
      </button>
      {!p.archived && (
        <button
          onClick={() => handleArchive(p)}
          disabled={archiving === p.slug}
          style={{
            all: 'unset', cursor: 'pointer', padding: '4px 10px',
            borderRadius: 5, background: 'transparent',
            fontSize: 12, color: theme.panelTxtMute,
          }}
        >
          {t('teacher.archiveProblem')}
        </button>
      )}
    </div>
  );

  const goTo = (s: TeacherSection) => navigate(s === 'problems' ? '/teacher/problems' : '/teacher');

  return (
    <TeacherShell active="problems" onNavigate={goTo}>
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', fontFamily: theme.fontUI, color: theme.panelTxt }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('teacher.problems')}</h2>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowImport(true)}
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7,
            border: `0.5px solid ${theme.panelBorder}`,
            background: theme.chip, color: theme.panelTxt,
            fontSize: 13, fontWeight: 600,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Import JSON
        </button>
        <button
          onClick={() => navigate('/teacher/problems/new')}
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7,
            background: theme.primaryBg, color: theme.primaryTxt,
            fontSize: 13, fontWeight: 600,
          }}
        >
          <Icon name="plus" size={14} color={theme.primaryTxt} />
          {t('teacher.newProblem')}
        </button>
      </div>

      {showImport && (
        <ImportProblemsModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            fetch('/api/teacher/problems', { credentials: 'include' })
              .then((r) => r.json())
              .then(setProblems)
              .catch(() => {});
          }}
        />
      )}

      {active.length === 0 && archived.length === 0 && (
        <p style={{ color: theme.panelTxtMute }}>{t('teacher.noProblems')}</p>
      )}

      {active.map(renderRow)}

      {archived.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{
              all: 'unset', cursor: 'pointer',
              fontSize: 12, color: theme.panelTxtMute,
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 10 }}>{showArchived ? '▼' : '▶'}</span>
            {t('teacher.archived')} ({archived.length})
          </button>
          {showArchived && archived.map(renderRow)}
        </div>
      )}
    </div>
    </TeacherShell>
  );
}
