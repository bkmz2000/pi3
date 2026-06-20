import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../state/useTheme';
import { useUser } from '../../state/useUser';
import { useNotifications } from '../../state/useNotifications';
import { Icon } from '../Icons';
import { NavItem } from './NavItem';
import { GroupsSection } from './GroupsSection';
import { StudentProjectsSection } from './StudentProjectsSection';
import { HelpRequestsSection } from './HelpRequestsSection';

type Section = 'groups' | 'projects' | 'help';

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { user } = useUser();
  const [section, setSection] = useState<Section>('groups');
  const { helpRequests } = useNotifications();
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: theme.surface,
      fontFamily: theme.fontUI,
      color: theme.panelTxt,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, flex: 'none',
        display: 'flex', alignItems: 'center',
        padding: '0 20px',
        background: theme.railBg,
        borderBottom: `1px solid ${theme.panelBorder}`,
        gap: 12,
      }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: theme.railIcon, textDecoration: 'none', fontSize: 12.5, fontWeight: 500, padding: '6px 10px', borderRadius: 5 }}>
          <Icon name="close" size={14} color="currentColor" />
          {t('teacher.backToIde')}
        </a>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 700, fontSize: 18, color: theme.railLogo }}>
          pi<span style={{ fontSize: 12 }}>3</span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: theme.railIconActive }}>{t('teacher.dashboard')}</span>
      </div>

      {user && user.role !== 'teacher' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: theme.panelTxtMute, fontSize: 14 }}>
          {t('teacher.notTeacher')}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left nav */}
          <div style={{ width: 200, flex: 'none', background: theme.surfacePanel, borderRight: `1px solid ${theme.panelBorder}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <NavItem label={t('teacher.groups')} active={section === 'groups'} onClick={() => setSection('groups')} />
            <NavItem label={t('teacher.studentProjects')} active={section === 'projects'} onClick={() => setSection('projects')} />
            <NavItem label={t('teacher.problems')} active={false} onClick={() => navigate('/teacher/problems')} />
            <div style={{ position: 'relative' }}>
              <NavItem label={t('teacher.helpRequests')} active={section === 'help'} onClick={() => setSection('help')} />
              {helpRequests.length > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 8, width: 8, height: 8, borderRadius: 99, background: theme.tabDirty, pointerEvents: 'none' }} />
              )}
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {section === 'groups' && <GroupsSection />}
            {section === 'projects' && (
              <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
                <StudentProjectsSection />
              </div>
            )}
            {section === 'help' && (
              <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
                <HelpRequestsSection />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
