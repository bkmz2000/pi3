import { useThemeStore } from '../../state/useTheme';

export function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer', boxSizing: 'border-box',
        display: 'block', width: '100%',
        padding: '9px 16px',
        borderRadius: 6,
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? theme.primaryBg : theme.panelTxt,
        background: active ? theme.chip : 'transparent',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}
