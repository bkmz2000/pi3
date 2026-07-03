import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../state/useTheme';

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

const IconLines = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function StatementSection({ value, onChange }: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  return (
    <SectionCard icon={<IconLines />} title={t('teacher.problemStatement')} desc="Markdown">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          background: theme.surface,
          color: theme.panelTxt,
          border: `0.5px solid ${theme.panelBorder}`,
          borderRadius: 8,
          padding: '9px 11px',
          fontFamily: theme.fontMono,
          fontSize: 13,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
        }}
      />
    </SectionCard>
  );
}
