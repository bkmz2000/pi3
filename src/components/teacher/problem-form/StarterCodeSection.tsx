import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { useThemeStore } from '../../../state/useTheme';
import { competeProfile } from '../../../editor/profiles';

function SectionCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{
      background: theme.surfacePanel,
      border: `0.5px solid ${theme.panelBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 15px',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
      }}>
        <span style={{ color: theme.primaryBg, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>{title}</span>
        {desc && (
          <span style={{ fontSize: 11.5, color: theme.panelTxtMute, marginLeft: 'auto', textAlign: 'right' as const }}>
            {desc}
          </span>
        )}
      </div>
      <div style={{ padding: 15 }}>{children}</div>
    </div>
  );
}

const IconCode = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function StarterCodeSection({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const themeId = useThemeStore((s) => s.themeId);
  const fontSize = useThemeStore((s) => s.fontSize);

  const cmTheme = themeId === 'midnight' ? githubDark : githubLight;

  return (
    <SectionCard icon={<IconCode />} title={t('teacher.starterCode')} desc="Pre-filled for students">
      <div style={{ border: `0.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}>
        <CodeMirror
          value={value}
          extensions={competeProfile({ theme, lang: i18n.language, fontSize, cmTheme })}
          onChange={onChange}
          height="200px"
        />
      </div>
    </SectionCard>
  );
}
