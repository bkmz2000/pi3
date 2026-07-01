import { useThemeStore } from '../state/useTheme';

export type ConsoleStatus = 'running' | 'idle' | 'error' | null;

interface ConsoleViewProps {
  label: string;
  content: string;
  status?: ConsoleStatus;
  actions?: React.ReactNode;
  maxHeight?: number;
}

export default function ConsoleView({ label, content, status, actions, maxHeight }: ConsoleViewProps) {
  const theme = useThemeStore((s) => s.theme);

  const pillBg =
    status === 'running' ? theme.successPill :
    status === 'error'   ? theme.chip :
    theme.chip;
  const pillColor =
    status === 'running' ? theme.successPillTxt :
    status === 'error'   ? theme.consoleErr :
    theme.consoleTxtMute;

  return (
    <div style={{
      background: theme.surfacePanel,
      border: `0.5px solid ${theme.panelBorder}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        height: 32,
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderBottom: `1px solid ${theme.consoleBorder}`,
        flex: 'none',
      }}>
        <div style={{
          fontFamily: theme.fontUI,
          fontWeight: theme.weightUI + 100,
          color: theme.consoleTxt,
          fontSize: 12.5,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>
          {label}
        </div>
        {status != null && (
          <div style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: pillBg,
            color: pillColor,
            fontFamily: theme.fontUI,
            fontSize: 10.5,
            fontWeight: theme.weightUI + 100,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
            {status}
          </div>
        )}
        {actions != null && (
          <>
            <div style={{ flex: 1 }} />
            {actions}
          </>
        )}
      </div>
      <pre style={{
        margin: 0,
        padding: '10px 14px',
        fontFamily: theme.fontMono,
        fontSize: 12.5,
        lineHeight: 1.55,
        color: theme.consoleTxt,
        overflowY: 'auto',
        maxHeight,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </pre>
    </div>
  );
}
