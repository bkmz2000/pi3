import { useTranslation } from "react-i18next";
import { useThemeStore } from "../state/useTheme";

export default function LoadingScreen() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: theme.appBg,
        color: theme.appTxt,
        fontFamily: theme.fontUI,
      }}
    >
      <div style={{ marginBottom: 32, position: "relative", color: theme.primaryBg, fontWeight: 700 }}>
        <span style={{ fontSize: 96, fontFamily: theme.fontMono, lineHeight: 1 }}>pi</span>
        <sup style={{ fontSize: 36, fontFamily: theme.fontMono, position: "absolute", top: 0 }}>3</sup>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: theme.primaryBg }}>
        <div
          data-testid="loading-spinner"
          className="animate-spin"
          style={{
            width: 32,
            height: 32,
            boxSizing: "border-box",
            border: `4px solid ${theme.primaryBg}`,
            borderTopColor: "transparent",
            borderRadius: "50%",
          }}
        />
        <span style={{ fontSize: 18 }}>{t('app.loading')}</span>
      </div>
      <div style={{ marginTop: 32, color: theme.consoleTxtMute, fontSize: 14, maxWidth: 448, textAlign: "center" }}>
        {t('app.loadingHint')}
      </div>
    </div>
  );
}
