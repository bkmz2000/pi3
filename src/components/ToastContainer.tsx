import { useThemeStore } from '../state/useTheme';
import { useToasts } from '../state/useToasts';

export function ToastContainer() {
  const theme = useThemeStore((s) => s.theme);
  const { toasts, dismiss } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: '12px 16px',
            borderRadius: 6,
            fontSize: 13,
            color: theme.surfacePanel,
            background: toast.type === 'error' ? '#e05' : toast.type === 'success' ? '#2d5' : theme.accent,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: 200,
            maxWidth: 300,
            wordWrap: 'break-word',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
