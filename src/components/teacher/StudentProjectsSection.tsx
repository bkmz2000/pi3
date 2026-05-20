import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { getSharedProjects, type SharedProject } from '../../state/api';

export function StudentProjectsSection() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSharedProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const grouped = projects.reduce<Record<string, SharedProject[]>>((acc, p) => {
    const key = p.group_name || t('teacher.ungrouped');
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: theme.panelTxt, marginBottom: 16 }}>{t('teacher.studentProjects')}</div>
      {loading ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('sideMenu.loading')}</div>
      ) : projects.length === 0 ? (
        <div style={{ color: theme.panelTxtMute, fontSize: 13 }}>{t('teacher.noSharedProjects')}</div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{group}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {items.map(p => (
                <div key={p.id} style={{ border: `1px solid ${p.help_request_id ? theme.tabDirty : theme.panelBorder}`, borderRadius: 8, padding: '12px 14px', background: theme.surfacePanel }}>
                  {p.help_request_id && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.tabDirty, marginBottom: 4 }}>✋ {t('teacher.needsHelp')}</div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 13, color: theme.panelTxt, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{p.student_name}</div>
                  <a href={`/teacher/projects/${p.id}`} style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: theme.railIconActive, textDecoration: 'none', fontWeight: 500 }}>
                    {t('teacher.review')} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
