import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherShell, type TeacherSection } from './TeacherShell';
import { GroupsSection } from './GroupsSection';
import { StudentProjectsSection } from './StudentProjectsSection';
import { HelpRequestsSection } from './HelpRequestsSection';

type DashboardSection = Exclude<TeacherSection, 'problems'>;

export default function TeacherDashboard() {
  const [section, setSection] = useState<DashboardSection>('groups');
  const navigate = useNavigate();

  return (
    <TeacherShell
      active={section}
      onNavigate={(s) => {
        if (s === 'problems') navigate('/teacher/problems');
        else setSection(s);
      }}
    >
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
    </TeacherShell>
  );
}
