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

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ fontSize: 12, color: theme.panelTxtMute, display: 'block', marginBottom: 6 }}>
      {label}
      {required && <span style={{ color: '#ff7a7a', marginLeft: 3 }}>*</span>}
    </div>
  );
}

function FieldInput({
  value,
  onChange,
  onBlur,
  mono,
  prefix,
  type,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  mono?: boolean;
  prefix?: string;
  type?: string;
  min?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const base: React.CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    background: theme.surface,
    color: theme.panelTxt,
    border: `0.5px solid ${theme.panelBorder}`,
    borderRadius: 8,
    padding: '9px 11px',
    fontFamily: mono ? theme.fontMono : theme.fontUI,
    fontSize: mono ? 13 : 14,
    outline: 'none',
  };

  if (prefix) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: theme.surface,
        border: `0.5px solid ${theme.panelBorder}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          padding: '9px 11px',
          color: theme.panelTxtMute,
          fontFamily: theme.fontMono,
          fontSize: 13,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
          {prefix}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={{ ...base, border: 'none', borderRadius: 0, flex: 1, paddingLeft: 2 }}
        />
      </div>
    );
  }

  return (
    <input
      value={value}
      type={type}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={base}
    />
  );
}

const IconDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

interface Props {
  title: string;
  slug: string;
  orderIndex: number;
  slugTouched: boolean;
  isNew: boolean;
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onOrderIndexChange: (v: string) => void;
}

export default function ProblemDetailsSection({
  title,
  slug,
  orderIndex,
  slugTouched,
  isNew,
  onTitleChange,
  onSlugChange,
  onOrderIndexChange,
}: Props) {
  const { t } = useTranslation();

  function slugify(titleText: string): string {
    return titleText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || '';
  }

  const handleTitleChange = (v: string) => {
    if (!slugTouched && isNew) {
      onTitleChange(v);
      onSlugChange(slugify(v));
    } else {
      onTitleChange(v);
    }
  };

  return (
    <SectionCard icon={<IconDoc />} title={t('teacher.problemTitle')} desc="Title and list position">
      <div style={{ marginBottom: 14 }}>
        <FieldLabel label={t('teacher.problemTitle')} required />
        <FieldInput value={title} onChange={handleTitleChange} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>
          <FieldLabel label={t('teacher.problemSlug')} required />
          <FieldInput
            value={slug}
            prefix="/compete/"
            mono
            onChange={onSlugChange}
          />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel label={t('teacher.orderIndex')} />
          <FieldInput
            value={String(orderIndex)}
            type="number"
            min={0}
            onChange={onOrderIndexChange}
          />
        </div>
      </div>
    </SectionCard>
  );
}
