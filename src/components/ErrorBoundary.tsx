import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../state/useTheme";

type Props = {
  children: ReactNode;
  // Label shown in the fallback (e.g. "Sprite editor"). Helps the user know
  // which subsystem failed when several boundaries exist.
  label?: string;
  // Called after the boundary catches; useful for telemetry hooks.
  onError?: (error: Error, info: ErrorInfo) => void;
  // When the value changes, the boundary resets its caught error. Pass a key
  // like the current project id or asset name to auto-recover on navigation.
  resetKey?: unknown;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so the crash is visible in DevTools even when the
    // fallback UI swallows the render error from React.
    console.error("[ErrorBoundary]", this.props.label ?? "component", error, info);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <Fallback label={this.props.label} error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function Fallback({ label, error, onReset }: { label?: string; error: Error; onReset: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  return (
    <div role="alert" style={{
      flex: 1,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, gap: 12,
      background: theme.surface, color: theme.appTxt,
    }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {label ? t('errorBoundary.labelCrashed', { label }) : t('errorBoundary.genericTitle')}
      </div>
      <div style={{ fontSize: 13, opacity: 0.8, maxWidth: 480, textAlign: "center" }}>
        {t('errorBoundary.body')}
      </div>
      <pre style={{
        fontSize: 11, opacity: 0.7, maxWidth: 600, maxHeight: 120,
        overflow: "auto", padding: 8, borderRadius: 4,
        background: theme.surfacePanel, border: `1px solid ${theme.panelBorder}`,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>{String(error?.message ?? error)}</pre>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onReset} style={btn(theme)}>{t('errorBoundary.tryAgain')}</button>
        <button onClick={() => location.reload()} style={btn(theme)}>{t('errorBoundary.reloadPage')}</button>
      </div>
    </div>
  );
}

function btn(theme: ReturnType<typeof useThemeStore.getState>["theme"]) {
  return {
    all: "unset" as const,
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: theme.radiusButton,
    background: theme.surfacePanel,
    color: theme.appTxt,
    border: `1px solid ${theme.panelBorder}`,
    fontSize: 13,
  };
}
