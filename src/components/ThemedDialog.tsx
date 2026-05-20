import { useThemeStore } from '../state/useTheme';
import { Icon } from './Icons';

export function ThemedDialog({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{
        background: theme.surfacePanel,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 10,
        padding: 24,
        minWidth: 320,
        maxWidth: 440,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontFamily: theme.fontUI,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: theme.panelTxt }}>{title}</span>
          <button type="button" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
